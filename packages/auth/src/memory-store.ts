import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "fs";
import { join } from "path";
import { randomBytes } from "crypto";

export interface MemoryEntry {
  id: string;
  fact: string;
  tags: string[];
  source: "user" | "agent" | "system";
  importance: 1 | 2 | 3;
  createdAt: string;
}

export class MemoryStore {
  private filePath: string;

  constructor(private memoryDir: string) {
    this.filePath = join(memoryDir, "memories.jsonl");
  }

  private ensureDir(): void {
    if (!existsSync(this.memoryDir)) {
      mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  private readAll(): MemoryEntry[] {
    if (!existsSync(this.filePath)) return [];
    const content = readFileSync(this.filePath, "utf-8").trim();
    if (!content) return [];
    return content
      .split("\n")
      .map((line) => {
        try {
          return JSON.parse(line) as MemoryEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is MemoryEntry => e !== null);
  }

  private writeAll(entries: MemoryEntry[]): void {
    this.ensureDir();
    const content = entries.map((e) => JSON.stringify(e)).join("\n");
    writeFileSync(this.filePath, content ? content + "\n" : "", "utf-8");
  }

  list(opts?: { tag?: string; source?: string; limit?: number }): MemoryEntry[] {
    let entries = this.readAll();
    if (opts?.tag) {
      entries = entries.filter((e) => e.tags.includes(opts.tag!));
    }
    if (opts?.source) {
      entries = entries.filter((e) => e.source === opts.source);
    }
    if (opts?.limit && opts.limit > 0) {
      entries = entries.slice(-opts.limit);
    }
    return entries;
  }

  get(id: string): MemoryEntry | null {
    return this.readAll().find((e) => e.id === id) ?? null;
  }

  add(
    fact: string,
    opts?: { tags?: string[]; source?: "user" | "agent" | "system"; importance?: 1 | 2 | 3 },
  ): MemoryEntry {
    this.ensureDir();
    const entry: MemoryEntry = {
      id: randomBytes(4).toString("hex"),
      fact,
      tags: opts?.tags ?? [],
      source: opts?.source ?? "user",
      importance: opts?.importance ?? 2,
      createdAt: new Date().toISOString(),
    };
    appendFileSync(this.filePath, JSON.stringify(entry) + "\n", "utf-8");
    return entry;
  }

  remove(id: string): boolean {
    const entries = this.readAll();
    const filtered = entries.filter((e) => e.id !== id);
    if (filtered.length === entries.length) return false;
    this.writeAll(filtered);
    return true;
  }

  removeByTag(tag: string): number {
    const entries = this.readAll();
    const filtered = entries.filter((e) => !e.tags.includes(tag));
    const removed = entries.length - filtered.length;
    if (removed > 0) this.writeAll(filtered);
    return removed;
  }

  search(query: string): MemoryEntry[] {
    const lower = query.toLowerCase();
    return this.readAll().filter(
      (e) =>
        e.fact.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  clear(): number {
    const entries = this.readAll();
    const count = entries.length;
    if (count > 0) this.writeAll([]);
    return count;
  }

  migrate(legacyMemory: string[]): void {
    for (const fact of legacyMemory) {
      this.add(fact, { source: "system", importance: 2 });
    }
  }
}
