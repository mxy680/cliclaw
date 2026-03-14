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
  symlinkSync,
  lstatSync,
} from "fs";
import { join } from "path";
import { generateContextMd } from "./claude-md-generator.js";
import { MemoryStore } from "./memory-store.js";

/** @deprecated Use `integrations: string[]` on AgentConfig instead */
export interface AgentPermission {
  integration: string;
  account: string;
}

export interface CronJobConfig {
  id: string;
  schedule: string;
  taskFile: string;           // relative path to markdown task description
  maxIterations: number;
  enabled: boolean;
  createdAt: string;
}

export interface AgentConfig {
  name: string;
  displayName: string;
  role: string;
  integrations: string[];     // integration IDs (e.g. ["gmail", "gdrive"])
  cronJobs: CronJobConfig[];
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

  /** Get or create a per-client workspace, symlinking shared agent files */
  clientWorkspacePath(agentName: string, userId: string): string {
    const clientDir = join(this.agentsDir, agentName, "clients", userId);
    if (!existsSync(clientDir)) {
      mkdirSync(clientDir, { recursive: true });
    }

    // Symlink shared agent files into the client workspace
    const agentDir = this.workspacePath(agentName);
    for (const file of ["CONTEXT.md", "SOUL.md", "ROLE.md"]) {
      const target = join(agentDir, file);
      const link = join(clientDir, file);
      if (existsSync(target) && !existsSync(link)) {
        symlinkSync(target, link);
      }
    }

    return clientDir;
  }

  get(name: string): AgentConfig | null {
    const path = this.filePath(name);
    if (!existsSync(path)) return null;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8"));
      // Migrate legacy formats
      if (!raw.cronJobs) raw.cronJobs = [];
      if (!raw.integrations) {
        // Migrate from permissions[] → integrations[]
        if (raw.permissions && Array.isArray(raw.permissions)) {
          raw.integrations = [...new Set(raw.permissions.map((p: AgentPermission) => p.integration))];
        } else {
          raw.integrations = [];
        }
      }
      // Drop legacy fields
      delete raw.permissions;
      delete raw.memory;
      return raw as AgentConfig;
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

  /** Get or create a MemoryStore for an agent */
  getMemoryStore(name: string): MemoryStore {
    let store = this.memoryStores.get(name);
    if (store) return store;

    const memoryDir = join(this.workspacePath(name), "memory");
    store = new MemoryStore(memoryDir);
    this.memoryStores.set(name, store);
    return store;
  }

  /** Regenerate CONTEXT.md from current config */
  regenerateContextMd(name: string): void {
    const config = this.get(name);
    if (!config) return;
    const dir = this.workspacePath(name);
    const memoryStore = this.getMemoryStore(name);
    const memories = memoryStore.list();
    writeFileSync(join(dir, "CONTEXT.md"), generateContextMd(config, memories), "utf-8");
  }

  addCronJob(agentName: string, job: CronJobConfig): void {
    const config = this.get(agentName);
    if (!config) throw new Error(`Agent "${agentName}" not found`);
    config.cronJobs.push(job);
    config.updatedAt = new Date().toISOString();
    this.save(config);
    this.regenerateContextMd(agentName);
  }

  removeCronJob(agentName: string, jobId: string): void {
    const config = this.get(agentName);
    if (!config) throw new Error(`Agent "${agentName}" not found`);
    const idx = config.cronJobs.findIndex((j) => j.id === jobId);
    if (idx === -1) throw new Error(`Cron job "${jobId}" not found`);
    config.cronJobs.splice(idx, 1);
    config.updatedAt = new Date().toISOString();
    this.save(config);
    this.regenerateContextMd(agentName);
  }

  listCronJobs(agentName: string): CronJobConfig[] {
    const config = this.get(agentName);
    if (!config) throw new Error(`Agent "${agentName}" not found`);
    return config.cronJobs;
  }

  toggleCronJob(agentName: string, jobId: string, enabled: boolean): void {
    const config = this.get(agentName);
    if (!config) throw new Error(`Agent "${agentName}" not found`);
    const job = config.cronJobs.find((j) => j.id === jobId);
    if (!job) throw new Error(`Cron job "${jobId}" not found`);
    job.enabled = enabled;
    config.updatedAt = new Date().toISOString();
    this.save(config);
  }

  private writeWorkspaceFiles(config: AgentConfig, dir: string): void {
    const memoryStore = this.getMemoryStore(config.name);
    const memories = memoryStore.list();
    writeFileSync(join(dir, "CONTEXT.md"), generateContextMd(config, memories), "utf-8");

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
