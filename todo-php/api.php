<?php
declare(strict_types=1);
require __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

function respond($data, int $code = 200): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}

// Character count that works even if the mbstring extension is not enabled.
function char_len(string $s): int {
    return function_exists('mb_strlen') ? mb_strlen($s) : (int)preg_match_all('/./us', $s);
}

function present(array $r): array {
    return [
        'id'       => (int)$r['id'],
        'title'    => $r['title'],
        'priority' => $r['priority'],
        'due'      => $r['due'] ?? '',
        'done'     => (bool)$r['done'],
    ];
}

// Reads the JSON body. Requiring application/json also blocks cross-site form posts (CSRF).
function body(): array {
    $type = $_SERVER['CONTENT_TYPE'] ?? '';
    if (stripos($type, 'application/json') !== 0) respond(['error' => 'Content-Type must be application/json.'], 415);
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) respond(['error' => 'Invalid JSON body.'], 400);
    return $data;
}

// Validates input and returns only whitelisted columns. $partial = true for updates.
function clean(array $d, bool $partial): array {
    $out = [];
    if (!$partial || array_key_exists('title', $d)) {
        $t = trim((string)($d['title'] ?? ''));
        $len = char_len($t);
        if ($len < 2)   respond(['error' => 'Title must be at least 2 characters.'], 422);
        if ($len > 120) respond(['error' => 'Title must be 120 characters or fewer.'], 422);
        $out['title'] = $t;
    }
    if (!$partial || array_key_exists('priority', $d)) {
        $p = (string)($d['priority'] ?? 'medium');
        if (!in_array($p, ['low', 'medium', 'high'], true)) respond(['error' => 'Invalid priority.'], 422);
        $out['priority'] = $p;
    }
    if (!$partial || array_key_exists('due', $d)) {
        $due = $d['due'] ?? '';
        if ($due === '' || $due === null) {
            $out['due'] = null;
        } else {
            $dt = DateTime::createFromFormat('Y-m-d', (string)$due);
            if (!$dt || $dt->format('Y-m-d') !== $due) respond(['error' => 'Due date must be YYYY-MM-DD.'], 422);
            $out['due'] = $due;
        }
    }
    if (array_key_exists('done', $d)) {
        $out['done'] = $d['done'] ? 1 : 0;
    }
    return $out;
}

function find(int $id): ?array {
    $st = db()->prepare('SELECT * FROM tasks WHERE id = ?');
    $st->execute([$id]);
    $r = $st->fetch();
    return $r ? present($r) : null;
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

    switch ($method) {
        case 'GET': // READ
            $rows = db()->query('SELECT * FROM tasks ORDER BY id DESC')->fetchAll();
            respond(array_map('present', $rows));

        case 'POST': // CREATE
            $f = clean(body(), false);
            $st = db()->prepare('INSERT INTO tasks (title, priority, due) VALUES (?, ?, ?)');
            $st->execute([$f['title'], $f['priority'], $f['due']]);
            respond(find((int)db()->lastInsertId()), 201);

        case 'PUT': // UPDATE
            if ($id < 1) respond(['error' => 'Missing task id.'], 400);
            $f = clean(body(), true);
            if (!$f) respond(['error' => 'Nothing to update.'], 400);
            $sets = implode(', ', array_map(fn($c) => "$c = ?", array_keys($f))); // keys are whitelisted above
            $st = db()->prepare("UPDATE tasks SET $sets WHERE id = ?");
            $st->execute([...array_values($f), $id]);
            $task = find($id);
            $task ? respond($task) : respond(['error' => 'Task not found.'], 404);

        case 'DELETE': // DELETE one, or all completed with ?completed=1
            if (isset($_GET['completed'])) {
                $n = db()->exec('DELETE FROM tasks WHERE done = 1');
                respond(['deleted' => $n]);
            }
            if ($id < 1) respond(['error' => 'Missing task id.'], 400);
            $st = db()->prepare('DELETE FROM tasks WHERE id = ?');
            $st->execute([$id]);
            $st->rowCount() ? respond(['deleted' => 1]) : respond(['error' => 'Task not found.'], 404);

        default:
            header('Allow: GET, POST, PUT, DELETE');
            respond(['error' => 'Method not allowed.'], 405);
    }
} catch (PDOException $e) {
    error_log('Taskboard DB error: ' . $e->getMessage());
    respond(['error' => 'Database error. Check config.php and that database.sql was imported.'], 500);
}
