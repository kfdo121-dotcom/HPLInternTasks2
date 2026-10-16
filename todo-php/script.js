(function () {
  'use strict';
  var API = 'api.php';
  var tasks = [];
  var filter = 'all';
  var editingId = null;

  var $ = function (id) { return document.getElementById(id); };
  var form = $('add-form'), titleEl = $('title'), errEl = $('title-err');
  var listEl = $('list'), emptyEl = $('empty'), summaryEl = $('summary'), warnEl = $('warn');

  /* ---------- API layer (talks to api.php, which talks to MySQL) ---------- */
  function api(method, url, payload) {
    var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
    if (payload) opts.body = JSON.stringify(payload);
    return fetch(url, opts).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || 'Request failed (' + res.status + ').');
        warnEl.hidden = true;
        return data;
      });
    }, function () {
      throw new Error('Cannot reach the server. Check that PHP is running.');
    });
  }
  function showError(e) { warnEl.textContent = e.message; warnEl.hidden = false; }

  /* ---------- CRUD ---------- */
  function loadTasks() {
    return api('GET', API).then(function (data) { tasks = data; render(); }).catch(showError);
  }
  function createTask(title, priority, due) {
    return api('POST', API, { title: title, priority: priority, due: due }).then(function (t) {
      tasks.unshift(t); render();
    });
  }
  function updateTask(id, changes) {
    return api('PUT', API + '?id=' + encodeURIComponent(id), changes).then(function (t) {
      tasks = tasks.map(function (x) { return x.id === id ? t : x; });
    });
  }
  function deleteTask(id) {
    return api('DELETE', API + '?id=' + encodeURIComponent(id)).then(function () {
      tasks = tasks.filter(function (t) { return t.id !== id; });
      if (editingId === id) editingId = null;
      render();
    }).catch(showError);
  }
  function clearCompleted() {
    return api('DELETE', API + '?completed=1').then(function () {
      tasks = tasks.filter(function (t) { return !t.done; });
      render();
    }).catch(showError);
  }

  /* ---------- Helpers ---------- */
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') el.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else el.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) el.appendChild(c); });
    return el;
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmt(d) {
    var p = d.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function validate(v) {
    v = v.trim();
    if (!v) return 'Enter a task title.';
    if (v.length < 2) return 'Title must be at least 2 characters.';
    return '';
  }
  function priorityOptions(sel) {
    return ['low', 'medium', 'high'].map(function (p) {
      var o = h('option', { value: p, text: p[0].toUpperCase() + p.slice(1) });
      if (p === sel) o.selected = true;
      return o;
    });
  }

  /* ---------- Render ---------- */
  function render() {
    listEl.textContent = '';
    var shown = tasks.filter(function (t) {
      return filter === 'all' || (filter === 'done' ? t.done : !t.done);
    });
    shown.forEach(function (t) { listEl.appendChild(t.id === editingId ? editRow(t) : viewRow(t)); });

    var left = tasks.filter(function (t) { return !t.done; }).length;
    var doneCount = tasks.length - left;
    summaryEl.textContent = tasks.length ? left + ' open, ' + doneCount + ' done' : 'No tasks yet';
    $('clear').disabled = doneCount === 0;

    emptyEl.hidden = shown.length > 0;
    if (!shown.length) {
      emptyEl.textContent = !tasks.length ? 'Nothing here yet. Add your first task above.'
        : filter === 'done' ? 'No completed tasks yet.' : 'All caught up. No open tasks.';
    }
    document.querySelectorAll('.tab').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.filter === filter);
    });
    var focus = listEl.querySelector('[data-autofocus]');
    if (focus) { focus.focus(); focus.select(); }
  }

  function viewRow(t) {
    var overdue = t.due && !t.done && t.due < today();
    var meta = h('div', { 'class': 'meta' }, [
      h('span', { text: t.priority[0].toUpperCase() + t.priority.slice(1) + ' priority' })
    ]);
    if (t.due) {
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(h('span', { 'class': overdue ? 'overdue' : '', text: (overdue ? 'Overdue: ' : 'Due ') + fmt(t.due) }));
    }
    var cb = h('input', { type: 'checkbox', 'aria-label': 'Mark "' + t.title + '" as done',
      onchange: function () {
        updateTask(t.id, { done: cb.checked }).then(render).catch(function (e) { showError(e); render(); });
      } });
    cb.checked = t.done;
    return h('li', { 'class': 'item' + (t.done ? ' done' : ''), 'data-p': t.priority }, [
      cb,
      h('div', { 'class': 'body' }, [h('div', { 'class': 't', text: t.title }), meta]),
      h('div', { 'class': 'actions' }, [
        h('button', { type: 'button', 'class': 'btn small', text: 'Edit',
          'aria-label': 'Edit ' + t.title, onclick: function () { editingId = t.id; render(); } }),
        h('button', { type: 'button', 'class': 'btn small danger', text: 'Delete',
          'aria-label': 'Delete ' + t.title, onclick: function () { deleteTask(t.id); } })
      ])
    ]);
  }

  function editRow(t) {
    var title = h('input', { type: 'text', maxlength: '120', value: t.title, 'aria-label': 'Task title', 'data-autofocus': '1' });
    var pr = h('select', { 'aria-label': 'Priority' }, priorityOptions(t.priority));
    var due = h('input', { type: 'date', value: t.due, 'aria-label': 'Due date' });
    var err = h('p', { 'class': 'err', 'aria-live': 'polite' });
    function commit() {
      var msg = validate(title.value);
      if (msg) { err.textContent = msg; title.focus(); return; }
      updateTask(t.id, { title: title.value.trim(), priority: pr.value, due: due.value })
        .then(function () { editingId = null; render(); })
        .catch(function (e) { err.textContent = e.message; });
    }
    function cancel() { editingId = null; render(); }
    var f = h('form', { 'class': 'edit-form', novalidate: '',
      onsubmit: function (e) { e.preventDefault(); commit(); },
      onkeydown: function (e) { if (e.key === 'Escape') cancel(); } }, [
      title,
      h('div', { 'class': 'row' }, [pr, due]),
      err,
      h('div', { 'class': 'row' }, [
        h('button', { type: 'submit', 'class': 'btn small', text: 'Save' }),
        h('button', { type: 'button', 'class': 'btn small', text: 'Cancel', onclick: cancel })
      ])
    ]);
    return h('li', { 'class': 'item', 'data-p': t.priority }, [f]);
  }

  /* ---------- Events ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = validate(titleEl.value);
    form.classList.toggle('invalid', !!msg);
    errEl.textContent = msg;
    if (msg) { titleEl.focus(); return; }
    createTask(titleEl.value.trim(), $('priority').value, $('due').value).then(function () {
      titleEl.value = ''; $('due').value = ''; titleEl.focus();
    }).catch(function (err) { errEl.textContent = err.message; form.classList.add('invalid'); });
  });
  titleEl.addEventListener('input', function () {
    if (form.classList.contains('invalid')) {
      var msg = validate(titleEl.value);
      errEl.textContent = msg; form.classList.toggle('invalid', !!msg);
    }
  });
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { filter = b.dataset.filter; editingId = null; render(); });
  });
  $('clear').addEventListener('click', clearCompleted);

  render();
  loadTasks();
})();
