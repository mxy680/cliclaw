import { getClient } from "./db";
import { encryptTokens, decryptTokens } from "./crypto";
import type { ClientTokenRow } from "./types";

function decryptRow(row: any): ClientTokenRow {
  return { ...row, credentials: decryptTokens(row.credentials as string) };
}

export function getStmts() {
  return {
    // Users
    findUserByEmail: {
      async get(email: string) {
        const r = await getClient().execute({
          sql: "SELECT * FROM users WHERE email = ?",
          args: [email],
        });
        return r.rows[0] ?? undefined;
      },
    },
    createUser: {
      async run(id: string, email: string) {
        return getClient().execute({
          sql: "INSERT INTO users (id, email) VALUES (?, ?)",
          args: [id, email],
        });
      },
    },
    getUser: {
      async get(id: string) {
        const r = await getClient().execute({
          sql: "SELECT * FROM users WHERE id = ?",
          args: [id],
        });
        return r.rows[0] ?? undefined;
      },
    },
    listUsers: {
      async all() {
        const r = await getClient().execute(
          "SELECT * FROM users ORDER BY created_at DESC"
        );
        return r.rows;
      },
    },

    // Sessions
    createSession: {
      async run(token: string, userId: string, maxAge: number) {
        return getClient().execute({
          sql: "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, datetime('now', '+' || ? || ' seconds'))",
          args: [token, userId, maxAge],
        });
      },
    },
    getSession: {
      async get(token: string) {
        const r = await getClient().execute({
          sql: `
            SELECT s.token, s.user_id, u.email, s.expires_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > datetime('now')
          `,
          args: [token],
        });
        return r.rows[0] ?? undefined;
      },
    },
    deleteSession: {
      async run(token: string) {
        return getClient().execute({
          sql: "DELETE FROM sessions WHERE token = ?",
          args: [token],
        });
      },
    },
    cleanExpiredSessions: {
      async run() {
        return getClient().execute(
          "DELETE FROM sessions WHERE expires_at <= datetime('now')"
        );
      },
    },

    // Access
    grantAccess: {
      async run(id: string, userId: string, agentName: string, grantedBy: string) {
        return getClient().execute({
          sql: "INSERT OR IGNORE INTO client_agent_access (id, user_id, agent_name, granted_by) VALUES (?, ?, ?, ?)",
          args: [id, userId, agentName, grantedBy],
        });
      },
    },
    revokeAccess: {
      async run(userId: string, agentName: string) {
        return getClient().execute({
          sql: "DELETE FROM client_agent_access WHERE user_id = ? AND agent_name = ?",
          args: [userId, agentName],
        });
      },
    },
    checkAccess: {
      async get(userId: string, agentName: string) {
        const r = await getClient().execute({
          sql: "SELECT 1 FROM client_agent_access WHERE user_id = ? AND agent_name = ?",
          args: [userId, agentName],
        });
        return r.rows[0] ?? undefined;
      },
    },
    getUserAccess: {
      async all(userId: string) {
        const r = await getClient().execute({
          sql: "SELECT agent_name FROM client_agent_access WHERE user_id = ?",
          args: [userId],
        });
        return r.rows;
      },
    },
    listAccess: {
      async all() {
        const r = await getClient().execute(`
          SELECT a.id, a.user_id, u.email, a.agent_name, a.granted_at, a.granted_by
          FROM client_agent_access a
          JOIN users u ON a.user_id = u.id
          ORDER BY a.granted_at DESC
        `);
        return r.rows;
      },
    },

    // Chat sessions
    createChatSession: {
      async run(id: string, userId: string, agentName: string) {
        return getClient().execute({
          sql: "INSERT INTO chat_sessions (id, user_id, agent_name) VALUES (?, ?, ?)",
          args: [id, userId, agentName],
        });
      },
    },
    updateChatSession: {
      async run(
        costUsd: number,
        turnCount: number,
        claudeSessionId: string | null,
        title: string | null,
        id: string
      ) {
        return getClient().execute({
          sql: `
            UPDATE chat_sessions
            SET messages = messages + 1,
                cost_usd = cost_usd + ?,
                turn_count = turn_count + ?,
                claude_session_id = COALESCE(?, claude_session_id),
                title = COALESCE(?, title),
                updated_at = datetime('now')
            WHERE id = ?
          `,
          args: [costUsd, turnCount, claudeSessionId, title, id],
        });
      },
    },
    getChatSession: {
      async get(id: string) {
        const r = await getClient().execute({
          sql: "SELECT * FROM chat_sessions WHERE id = ?",
          args: [id],
        });
        return r.rows[0] ?? undefined;
      },
    },
    getUserChatSessions: {
      async all(userId: string) {
        const r = await getClient().execute({
          sql: "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
          args: [userId],
        });
        return r.rows;
      },
    },

    // Client tokens (with encryption)
    upsertClientToken: {
      async run(
        id: string,
        userId: string,
        integration: string,
        account: string,
        credentials: string,
        email: string | null
      ) {
        return getClient().execute({
          sql: `
            INSERT INTO client_tokens (id, user_id, integration, account, credentials, email)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id, integration, account) DO UPDATE SET
              credentials = excluded.credentials,
              email = excluded.email,
              updated_at = datetime('now')
          `,
          args: [id, userId, integration, account, encryptTokens(credentials), email],
        });
      },
    },
    getClientTokens: {
      async all(userId: string): Promise<ClientTokenRow[]> {
        const r = await getClient().execute({
          sql: "SELECT * FROM client_tokens WHERE user_id = ?",
          args: [userId],
        });
        return r.rows.map(decryptRow);
      },
    },
    getClientToken: {
      async get(
        userId: string,
        integration: string,
        account: string
      ): Promise<ClientTokenRow | undefined> {
        const r = await getClient().execute({
          sql: "SELECT * FROM client_tokens WHERE user_id = ? AND integration = ? AND account = ?",
          args: [userId, integration, account],
        });
        const row = r.rows[0];
        return row ? decryptRow(row) : undefined;
      },
    },
    deleteClientToken: {
      async run(userId: string, integration: string, account: string) {
        return getClient().execute({
          sql: "DELETE FROM client_tokens WHERE user_id = ? AND integration = ? AND account = ?",
          args: [userId, integration, account],
        });
      },
    },
    renameClientTokenAccount: {
      async run(
        newAccount: string,
        userId: string,
        integration: string,
        oldAccount: string
      ) {
        return getClient().execute({
          sql: "UPDATE client_tokens SET account = ?, updated_at = datetime('now') WHERE user_id = ? AND integration = ? AND account = ?",
          args: [newAccount, userId, integration, oldAccount],
        });
      },
    },

    // Stats
    countUsers: {
      async get() {
        const r = await getClient().execute(
          "SELECT COUNT(*) as count FROM users"
        );
        return r.rows[0] ?? undefined;
      },
    },
    countSessions: {
      async get() {
        const r = await getClient().execute(
          "SELECT COUNT(*) as count FROM chat_sessions"
        );
        return r.rows[0] ?? undefined;
      },
    },
    totalCost: {
      async get() {
        const r = await getClient().execute(
          "SELECT COALESCE(SUM(cost_usd), 0) as total FROM chat_sessions"
        );
        return r.rows[0] ?? undefined;
      },
    },
    countAccess: {
      async get() {
        const r = await getClient().execute(
          "SELECT COUNT(*) as count FROM client_agent_access"
        );
        return r.rows[0] ?? undefined;
      },
    },

    // Admin - user list with stats
    listUsersWithStats: {
      async all() {
        const r = await getClient().execute(`
          SELECT u.id, u.email, u.created_at,
            (SELECT COUNT(*) FROM client_tokens WHERE user_id = u.id) as integration_count,
            (SELECT COUNT(*) FROM chat_sessions WHERE user_id = u.id) as session_count,
            (SELECT COALESCE(SUM(cost_usd), 0) FROM chat_sessions WHERE user_id = u.id) as total_cost,
            (SELECT COUNT(DISTINCT agent_name) FROM client_agent_access WHERE user_id = u.id) as agent_count
          FROM users u
          ORDER BY u.created_at DESC
        `);
        return r.rows;
      },
    },

    // Admin - recent sessions with user email
    listRecentSessions: {
      async all() {
        const r = await getClient().execute(`
          SELECT cs.id, cs.user_id, u.email, cs.agent_name, cs.title, cs.messages, cs.cost_usd, cs.turn_count, cs.created_at, cs.updated_at
          FROM chat_sessions cs
          JOIN users u ON cs.user_id = u.id
          ORDER BY cs.updated_at DESC
          LIMIT 100
        `);
        return r.rows;
      },
    },

    // Admin - per-agent session count and cost
    countSessionsByAgent: {
      async all() {
        const r = await getClient().execute(`
          SELECT agent_name, COUNT(*) as session_count, COALESCE(SUM(cost_usd), 0) as total_cost
          FROM chat_sessions
          GROUP BY agent_name
        `);
        return r.rows;
      },
    },

    // Admin - per-agent user count
    countUsersByAgent: {
      async all() {
        const r = await getClient().execute(`
          SELECT agent_name, COUNT(DISTINCT user_id) as user_count
          FROM client_agent_access
          GROUP BY agent_name
        `);
        return r.rows;
      },
    },

    // Admin - recent access grants
    recentAccessGrants: {
      async all() {
        const r = await getClient().execute(`
          SELECT a.id, a.user_id, u.email, a.agent_name, a.granted_at, a.granted_by
          FROM client_agent_access a
          JOIN users u ON a.user_id = u.id
          ORDER BY a.granted_at DESC
          LIMIT 10
        `);
        return r.rows;
      },
    },

    // Admin - recent chat sessions
    recentChatSessions: {
      async all() {
        const r = await getClient().execute(`
          SELECT cs.id, cs.user_id, u.email, cs.agent_name, cs.title, cs.messages, cs.cost_usd, cs.created_at, cs.updated_at
          FROM chat_sessions cs
          JOIN users u ON cs.user_id = u.id
          ORDER BY cs.updated_at DESC
          LIMIT 10
        `);
        return r.rows;
      },
    },

    // Admin - agents for a specific user
    getUserAgents: {
      async all(userId: string) {
        const r = await getClient().execute({
          sql: `
            SELECT a.agent_name, a.granted_at
            FROM client_agent_access a
            WHERE a.user_id = ?
            ORDER BY a.granted_at DESC
          `,
          args: [userId],
        });
        return r.rows;
      },
    },

    // Admin - sessions for a specific user
    getUserRecentSessions: {
      async all(userId: string) {
        const r = await getClient().execute({
          sql: `
            SELECT cs.id, cs.agent_name, cs.title, cs.messages, cs.cost_usd, cs.created_at, cs.updated_at
            FROM chat_sessions cs
            WHERE cs.user_id = ?
            ORDER BY cs.updated_at DESC
            LIMIT 50
          `,
          args: [userId],
        });
        return r.rows;
      },
    },
  };
}
