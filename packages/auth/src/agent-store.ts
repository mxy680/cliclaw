import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import { generateClaudeMd } from "./claude-md-generator.js";
import { MemoryStore } from "./memory-store.js";

export interface AgentPermission {
  integration: string;
  account: string;
}

export interface AgentConfig {
  name: string;
  displayName: string;
  role: string;
  permissions: AgentPermission[];
  memory: string[];
  createdAt: string;
  updatedAt: string;
}

export class AgentStore {
  private memoryStores = new Map<string, MemoryStore>();

  constructor(private agentsDir: string) {}

  private ensureDir(): void {
    if (!existsSync(this.agentsDir)) {
      mkdirSync(this.agentsDir, { recursive: true });
    }
    this.migrateIfNeeded();
  }

  /** Migrate old flat {name}.json files to {name}/config.json + scaffold */
  private migrateIfNeeded(): void {
    const entries = readdirSync(this.agentsDir);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const fullPath = join(this.agentsDir, entry);
      if (!statSync(fullPath).isFile()) continue;

      try {
        const config = JSON.parse(readFileSync(fullPath, "utf-8")) as AgentConfig;
        const dir = join(this.agentsDir, config.name);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        renameSync(fullPath, join(dir, "config.json"));
        this.writeWorkspaceFiles(config, dir);
      } catch {
        // Skip files that can't be parsed
      }
    }
  }

  private filePath(name: string): string {
    return join(this.agentsDir, name, "config.json");
  }

  workspacePath(name: string): string {
    return join(this.agentsDir, name);
  }

  get(name: string): AgentConfig | null {
    const path = this.filePath(name);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf-8")) as AgentConfig;
    } catch {
      return null;
    }
  }

  save(config: AgentConfig): void {
    this.ensureDir();
    const dir = this.workspacePath(config.name);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath(config.name), JSON.stringify(config, null, 2), "utf-8");
  }

  delete(name: string): boolean {
    const dir = this.workspacePath(name);
    if (!existsSync(dir)) return false;
    rmSync(dir, { recursive: true });
    return true;
  }

  list(): AgentConfig[] {
    this.ensureDir();
    return readdirSync(this.agentsDir)
      .filter((entry) => {
        const entryPath = join(this.agentsDir, entry);
        return statSync(entryPath).isDirectory() && existsSync(join(entryPath, "config.json"));
      })
      .map((entry) => {
        try {
          return JSON.parse(
            readFileSync(join(this.agentsDir, entry, "config.json"), "utf-8"),
          ) as AgentConfig;
        } catch {
          return null;
        }
      })
      .filter((c): c is AgentConfig => c !== null);
  }

  listNames(): string[] {
    this.ensureDir();
    return readdirSync(this.agentsDir)
      .filter((entry) => {
        const entryPath = join(this.agentsDir, entry);
        return statSync(entryPath).isDirectory() && existsSync(join(entryPath, "config.json"));
      });
  }

  /** Create workspace directory with config.json, CLAUDE.md, SOUL.md, ROLE.md */
  scaffoldWorkspace(config: AgentConfig): void {
    this.ensureDir();
    const dir = this.workspacePath(config.name);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath(config.name), JSON.stringify(config, null, 2), "utf-8");
    this.writeWorkspaceFiles(config, dir);
  }

  /** Get or create a MemoryStore for an agent, auto-migrating legacy memory */
  getMemoryStore(name: string): MemoryStore {
    let store = this.memoryStores.get(name);
    if (store) return store;

    const memoryDir = join(this.workspacePath(name), "memory");
    store = new MemoryStore(memoryDir);

    // Lazy migration: move config.memory[] → JSONL
    const config = this.get(name);
    if (config && config.memory.length > 0) {
      store.migrate(config.memory);
      config.memory = [];
      config.updatedAt = new Date().toISOString();
      this.save(config);
    }

    this.memoryStores.set(name, store);
    return store;
  }

  /** Regenerate CLAUDE.md from current config */
  regenerateClaudeMd(name: string): void {
    const config = this.get(name);
    if (!config) return;
    const dir = this.workspacePath(name);
    const memoryStore = this.getMemoryStore(name);
    const memories = memoryStore.list();
    writeFileSync(join(dir, "CLAUDE.md"), generateClaudeMd(config, memories), "utf-8");
  }

  private writeWorkspaceFiles(config: AgentConfig, dir: string): void {
    const memoryStore = this.getMemoryStore(config.name);
    const memories = memoryStore.list();
    writeFileSync(join(dir, "CLAUDE.md"), generateClaudeMd(config, memories), "utf-8");

    const soulPath = join(dir, "SOUL.md");
    if (!existsSync(soulPath)) {
      writeFileSync(
        soulPath,
        `# ${config.displayName}\n\nDefine this agent's personality and identity here.\n`,
        "utf-8",
      );
    }

    const rolePath = join(dir, "ROLE.md");
    if (!existsSync(rolePath)) {
      writeFileSync(
        rolePath,
        `# ${config.displayName} — Role\n\n${config.role}\n\nAdd detailed capabilities and instructions here.\n`,
        "utf-8",
      );
    }
  }
}
