import type { Client } from "@libsql/client";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export async function runMigrations(client: Client): Promise<void> {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = join(process.cwd(), "migrations");
  let files: string[];
  try {
    files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    return; // No migrations directory
  }

  const result = await client.execute("SELECT name FROM _migrations");
  const applied = new Set(result.rows.map((row) => row.name as string));

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    // executeMultiple handles files with multiple statements separated by ;
    await client.executeMultiple(sql);
    await client.execute({
      sql: "INSERT INTO _migrations (name) VALUES (?)",
      args: [file],
    });

    console.log(`[db] Applied migration: ${file}`);
  }
}
