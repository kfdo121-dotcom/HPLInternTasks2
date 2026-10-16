-- Run once:  mysql -u root -p < database.sql
CREATE DATABASE IF NOT EXISTS taskboard CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE taskboard;

CREATE TABLE IF NOT EXISTS tasks (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title      VARCHAR(120) NOT NULL,
  priority   ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  due        DATE NULL,
  done       TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_done (done)
) ENGINE=InnoDB;

-- Recommended: a dedicated least-privilege user instead of root
-- CREATE USER 'taskboard'@'localhost' IDENTIFIED BY 'change-this-password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON taskboard.tasks TO 'taskboard'@'localhost';
