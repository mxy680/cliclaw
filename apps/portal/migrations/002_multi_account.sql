-- Multi-account integrations: add account column to client_tokens
-- SQLite requires table recreation to change constraints

CREATE TABLE client_tokens_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  integration TEXT NOT NULL,
  account TEXT NOT NULL DEFAULT 'default',
  credentials TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, integration, account)
);

INSERT INTO client_tokens_new (id, user_id, integration, account, credentials, email, created_at, updated_at)
  SELECT id, user_id, integration, 'default', credentials, email, created_at, updated_at
  FROM client_tokens;

DROP TABLE client_tokens;

ALTER TABLE client_tokens_new RENAME TO client_tokens;

CREATE INDEX IF NOT EXISTS idx_tokens_user ON client_tokens(user_id);
