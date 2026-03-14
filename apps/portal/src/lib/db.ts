import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { CLICLAW_HOME } from "./constants";
import { runMigrations } from "./db-migrations";

const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function cleanExpiredSessions(): void {
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
}

export function getDb(): Database.Database {
  const g = globalThis as any;
  if (!g.__portalDb) {
    const dbDir = join(CLICLAW_HOME, "portal");
    mkdirSync(dbDir, { recursive: true });

    const db = new Database(join(dbDir, "portal.db"));
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    runMigrations(db);
    g.__portalDb = db;

    // Clean up expired sessions on startup
    db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();

    // Schedule periodic cleanup every hour
    if (!g.__portalSessionCleanupInterval) {
      g.__portalSessionCleanupInterval = setInterval(
        cleanExpiredSessions,
        SESSION_CLEANUP_INTERVAL_MS
      );
      // Allow the process to exit even if this interval is still scheduled
      g.__portalSessionCleanupInterval.unref?.();
    }
  }
  return g.__portalDb;
}

export function generateId(): string {
  return randomBytes(16).toString("hex");
}
