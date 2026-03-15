import type Database from "better-sqlite3";
import { getDb } from "./db";
import { encryptTokens, decryptTokens } from "./crypto";
import type { ClientTokenRow } from "./types";

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
    renameClientTokenAccount: db.prepare(
      "UPDATE client_tokens SET account = ?, updated_at = datetime('now') WHERE user_id = ? AND integration = ? AND account = ?"
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

    // Admin - user list with stats
    listUsersWithStats: db.prepare(`
      SELECT u.id, u.email, u.created_at,
        (SELECT COUNT(*) FROM client_tokens WHERE user_id = u.id) as integration_count,
        (SELECT COUNT(*) FROM chat_sessions WHERE user_id = u.id) as session_count,
        (SELECT COALESCE(SUM(cost_usd), 0) FROM chat_sessions WHERE user_id = u.id) as total_cost,
        (SELECT COUNT(DISTINCT agent_name) FROM client_agent_access WHERE user_id = u.id) as agent_count
      FROM users u
      ORDER BY u.created_at DESC
    `),

    // Admin - recent sessions with user email
    listRecentSessions: db.prepare(`
      SELECT cs.id, cs.user_id, u.email, cs.agent_name, cs.title, cs.messages, cs.cost_usd, cs.turn_count, cs.created_at, cs.updated_at
      FROM chat_sessions cs
      JOIN users u ON cs.user_id = u.id
      ORDER BY cs.updated_at DESC
      LIMIT 100
    `),

    // Admin - per-agent session count and cost
    countSessionsByAgent: db.prepare(`
      SELECT agent_name, COUNT(*) as session_count, COALESCE(SUM(cost_usd), 0) as total_cost
      FROM chat_sessions
      GROUP BY agent_name
    `),

    // Admin - per-agent user count
    countUsersByAgent: db.prepare(`
      SELECT agent_name, COUNT(DISTINCT user_id) as user_count
      FROM client_agent_access
      GROUP BY agent_name
    `),

    // Admin - recent access grants
    recentAccessGrants: db.prepare(`
      SELECT a.id, a.user_id, u.email, a.agent_name, a.granted_at, a.granted_by
      FROM client_agent_access a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.granted_at DESC
      LIMIT 10
    `),

    // Admin - recent chat sessions
    recentChatSessions: db.prepare(`
      SELECT cs.id, cs.user_id, u.email, cs.agent_name, cs.title, cs.messages, cs.cost_usd, cs.created_at, cs.updated_at
      FROM chat_sessions cs
      JOIN users u ON cs.user_id = u.id
      ORDER BY cs.updated_at DESC
      LIMIT 10
    `),

    // Admin - agents for a specific user
    getUserAgents: db.prepare(`
      SELECT a.agent_name, a.granted_at
      FROM client_agent_access a
      WHERE a.user_id = ?
      ORDER BY a.granted_at DESC
    `),

    // Admin - sessions for a specific user
    getUserRecentSessions: db.prepare(`
      SELECT cs.id, cs.agent_name, cs.title, cs.messages, cs.cost_usd, cs.created_at, cs.updated_at
      FROM chat_sessions cs
      WHERE cs.user_id = ?
      ORDER BY cs.updated_at DESC
      LIMIT 50
    `),
  };
}

let _stmts: ReturnType<typeof prepareStatements> | null = null;

function getRawStmts() {
  if (!_stmts) {
    _stmts = prepareStatements(getDb());
  }
  return _stmts;
}

/** Decrypt the credentials field on a token row (or array of rows). */
function decryptRow(row: ClientTokenRow): ClientTokenRow {
  return { ...row, credentials: decryptTokens(row.credentials) };
}

/**
 * Returns statement helpers with transparent token encryption/decryption.
 * All callers use this — no manual encrypt/decrypt needed at call sites.
 */
export function getStmts() {
  const raw = getRawStmts();

  return {
    ...raw,

    // Override upsertClientToken to encrypt credentials before storing
    upsertClientToken: {
      run(id: string, userId: string, integration: string, account: string, credentials: string, email: string | null) {
        return raw.upsertClientToken.run(
          id,
          userId,
          integration,
          account,
          encryptTokens(credentials),
          email
        );
      },
    },

    // Override getClientTokens to decrypt credentials after reading
    getClientTokens: {
      all(userId: string): ClientTokenRow[] {
        const rows = raw.getClientTokens.all(userId) as ClientTokenRow[];
        return rows.map(decryptRow);
      },
    },

    // Override getClientToken to decrypt credentials after reading
    getClientToken: {
      get(userId: string, integration: string, account: string): ClientTokenRow | undefined {
        const row = raw.getClientToken.get(userId, integration, account) as ClientTokenRow | undefined;
        return row ? decryptRow(row) : undefined;
      },
    },
  };
}
