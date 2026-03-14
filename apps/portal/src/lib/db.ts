import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { CLICLAW_HOME } from "./constants";
import { runMigrations } from "./db-migrations";

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
  }
  return g.__portalDb;
}

export function generateId(): string {
  return randomBytes(16).toString("hex");
}
