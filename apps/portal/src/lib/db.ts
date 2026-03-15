import { createClient, type Client } from "@libsql/client";
import { randomBytes } from "crypto";
import { runMigrations } from "./db-migrations";

let _client: Client | null = null;
let _initPromise: Promise<void> | null = null;

export function getClient(): Client {
  if (!_client) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      throw new Error("TURSO_DATABASE_URL environment variable is not set");
    }

    _client = createClient({ url, authToken });
  }
  return _client;
}

export async function initDb(): Promise<void> {
  if (!_initPromise) {
    _initPromise = runMigrations(getClient());
  }
  return _initPromise;
}

export function generateId(): string {
  return randomBytes(16).toString("hex");
}
