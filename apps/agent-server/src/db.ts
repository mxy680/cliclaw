import Database from "better-sqlite3";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import crypto from "crypto";

const DATA_DIR = process.env.DATA_DIR || join(process.env.HOME || "~", ".cliclaw", "portal");

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(join(DATA_DIR, "portal.db"));

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    email TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS magic_links (
    token TEXT PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS client_agent_access (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    granted_at TEXT DEFAULT (datetime('now')),
    granted_by TEXT NOT NULL,
    UNIQUE(user_id, agent_name)
  );

  CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    claude_session_id TEXT,
    title TEXT NOT NULL DEFAULT 'New Chat',
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    cost_usd REAL DEFAULT 0,
    turn_count INTEGER DEFAULT 0
  );
`);

// Prepared statements
const stmts = {
  // Users
  findUserByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  createUser: db.prepare("INSERT INTO users (id, email) VALUES (?, ?) RETURNING *"),
  getUser: db.prepare("SELECT * FROM users WHERE id = ?"),
  listUsers: db.prepare("SELECT * FROM users ORDER BY created_at DESC"),

  // Magic links
  createMagicLink: db.prepare("INSERT INTO magic_links (token, email, expires_at) VALUES (?, ?, datetime('now', '+15 minutes'))"),
  findMagicLink: db.prepare("SELECT * FROM magic_links WHERE token = ? AND used = 0 AND expires_at > datetime('now')"),
  useMagicLink: db.prepare("UPDATE magic_links SET used = 1 WHERE token = ?"),

  // Sessions
  createSession: db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))"),
  findSession: db.prepare("SELECT s.*, u.email FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime('now')"),
  deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),
  cleanExpired: db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')"),

  // Access
  checkAccess: db.prepare("SELECT * FROM client_agent_access WHERE user_id = ? AND agent_name = ?"),
  getUserAccess: db.prepare("SELECT agent_name FROM client_agent_access WHERE user_id = ?"),
  grantAccess: db.prepare("INSERT OR IGNORE INTO client_agent_access (id, user_id, agent_name, granted_by) VALUES (?, ?, ?, ?)"),
  revokeAccess: db.prepare("DELETE FROM client_agent_access WHERE user_id = ? AND agent_name = ?"),
  listAllAccess: db.prepare(`
    SELECT a.*, u.email as user_email
    FROM client_agent_access a
    JOIN users u ON a.user_id = u.id
    ORDER BY a.granted_at DESC
  `),
};

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export { db, stmts };
