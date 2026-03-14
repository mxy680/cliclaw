import type Database from "better-sqlite3";
import { getDb } from "./db";

function prepareStatements(db: Database.Database) {
  return {
    // Users
    findUserByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
    createUser: db.prepare(
      "INSERT INTO users (id, email) VALUES (?, ?)"
    ),
    getUser: db.prepare("SELECT * FROM users WHERE id = ?"),
    listUsers: db.prepare("SELECT * FROM users ORDER BY created_at DESC"),

    // Sessions
    createSession: db.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' seconds'))"
    ),
    getSession: db.prepare(`
      SELECT s.token, s.user_id, u.email, s.expires_at
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `),
    deleteSession: db.prepare("DELETE FROM sessions WHERE token = ?"),
    cleanExpiredSessions: db.prepare(
      "DELETE FROM sessions WHERE expires_at <= datetime('now')"
    ),

    // Access
    grantAccess: db.prepare(
      "INSERT OR IGNORE INTO client_agent_access (id, user_id, agent_name, granted_by) VALUES (?, ?, ?, ?)"
    ),
    revokeAccess: db.prepare(
      "DELETE FROM client_agent_access WHERE user_id = ? AND agent_name = ?"
    ),
    checkAccess: db.prepare(
      "SELECT 1 FROM client_agent_access WHERE user_id = ? AND agent_name = ?"
    ),
    getUserAccess: db.prepare(
      "SELECT agent_name FROM client_agent_access WHERE user_id = ?"
    ),
    listAccess: db.prepare(`
      SELECT a.id, a.user_id, u.email, a.agent_name, a.granted_at, a.granted_by
      FROM client_agent_access a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.granted_at DESC
    `),

    // Chat sessions
    createChatSession: db.prepare(
      "INSERT INTO chat_sessions (id, user_id, agent_name) VALUES (?, ?, ?)"
    ),
    updateChatSession: db.prepare(`
      UPDATE chat_sessions
      SET messages = messages + 1,
          cost_usd = cost_usd + ?,
          turn_count = turn_count + ?,
          claude_session_id = COALESCE(?, claude_session_id),
          title = COALESCE(?, title),
          updated_at = datetime('now')
      WHERE id = ?
    `),
    getChatSession: db.prepare("SELECT * FROM chat_sessions WHERE id = ?"),
    getUserChatSessions: db.prepare(
      "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC"
    ),

    // Client tokens
    upsertClientToken: db.prepare(`
      INSERT INTO client_tokens (id, user_id, integration, account, credentials, email)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, integration, account) DO UPDATE SET
        credentials = excluded.credentials,
        email = excluded.email,
        updated_at = datetime('now')
    `),
    getClientTokens: db.prepare(
      "SELECT * FROM client_tokens WHERE user_id = ?"
    ),
    getClientToken: db.prepare(
      "SELECT * FROM client_tokens WHERE user_id = ? AND integration = ? AND account = ?"
    ),
    deleteClientToken: db.prepare(
      "DELETE FROM client_tokens WHERE user_id = ? AND integration = ? AND account = ?"
    ),

    // Stats
    countUsers: db.prepare("SELECT COUNT(*) as count FROM users"),
    countSessions: db.prepare("SELECT COUNT(*) as count FROM chat_sessions"),
    totalCost: db.prepare(
      "SELECT COALESCE(SUM(cost_usd), 0) as total FROM chat_sessions"
    ),
    countAccess: db.prepare(
      "SELECT COUNT(*) as count FROM client_agent_access"
    ),
  };
}

let _stmts: ReturnType<typeof prepareStatements> | null = null;

export function getStmts() {
  if (!_stmts) {
    _stmts = prepareStatements(getDb());
  }
  return _stmts;
}
