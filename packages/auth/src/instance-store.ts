import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  rmSync,
  readdirSync,
  statSync,
} from "fs";
import { join } from "path";
import { AgentStore } from "./agent-store.js";
import { generateUniversalClaudeMd, generateContextMd } from "./claude-md-generator.js";
import { MemoryStore } from "./memory-store.js";
import { getConfigDir } from "./config.js";

export class InstanceStore {
  constructor(
    private instancesDir: string,
    private agentStore: AgentStore,
  ) {}

  private ensureDir(path: string): void {
    if (!existsSync(path)) {
      mkdirSync(path, { recursive: true });
    }
  }

  /** Get the root path for an instance */
  getInstancePath(agentName: string, userId: string): string {
    return join(this.instancesDir, agentName, userId);
  }

  /** Get the workspace subdir (what gets mounted into Docker) */
  getWorkspacePath(agentName: string, userId: string): string {
    return join(this.getInstancePath(agentName, userId), "workspace");
  }

  /** Create a new instance by copying template files and generating CONTEXT.md */
  createInstance(agentName: string, userId: string): string {
    const config = this.agentStore.get(agentName);
    if (!config) throw new Error(`Agent "${agentName}" not found`);

    const instancePath = this.getInstancePath(agentName, userId);
    this.ensureDir(instancePath);
    this.ensureDir(join(instancePath, "workspace"));
    this.ensureDir(join(instancePath, "memory"));
    this.ensureDir(join(instancePath, "cron"));

    // Copy universal CLAUDE.md
    const universalClaudeMd = join(getConfigDir(), "CLAUDE.md");
    if (existsSync(universalClaudeMd)) {
      cpSync(universalClaudeMd, join(instancePath, "CLAUDE.md"));
    } else {
      // Generate it if it doesn't exist yet
      writeFileSync(join(instancePath, "CLAUDE.md"), generateUniversalClaudeMd(), "utf-8");
    }

    // Copy agent template files
    const agentDir = this.agentStore.workspacePath(agentName);
    for (const file of ["SOUL.md", "ROLE.md"]) {
      const src = join(agentDir, file);
      if (existsSync(src)) {
        cpSync(src, join(instancePath, file));
      }
    }

    // Generate CONTEXT.md
    const memoryStore = new MemoryStore(join(instancePath, "memory"));
    const memories = memoryStore.list();
    writeFileSync(
      join(instancePath, "CONTEXT.md"),
      generateContextMd(config, memories),
      "utf-8",
    );

    return instancePath;
  }

  /** Re-copy template files and regenerate CONTEXT.md after agent config changes */
  syncInstance(agentName: string, userId: string): void {
    const config = this.agentStore.get(agentName);
    if (!config) throw new Error(`Agent "${agentName}" not found`);

    const instancePath = this.getInstancePath(agentName, userId);
    if (!existsSync(instancePath)) {
      this.createInstance(agentName, userId);
      return;
    }

    // Re-copy template files
    const agentDir = this.agentStore.workspacePath(agentName);
    for (const file of ["SOUL.md", "ROLE.md"]) {
      const src = join(agentDir, file);
      if (existsSync(src)) {
        cpSync(src, join(instancePath, file));
      }
    }

    // Re-copy universal CLAUDE.md
    const universalClaudeMd = join(getConfigDir(), "CLAUDE.md");
    if (existsSync(universalClaudeMd)) {
      cpSync(universalClaudeMd, join(instancePath, "CLAUDE.md"));
    }

    // Regenerate CONTEXT.md
    const memoryStore = new MemoryStore(join(instancePath, "memory"));
    const memories = memoryStore.list();
    writeFileSync(
      join(instancePath, "CONTEXT.md"),
      generateContextMd(config, memories),
      "utf-8",
    );
  }

  /** Delete an instance */
  deleteInstance(agentName: string, userId: string): boolean {
    const instancePath = this.getInstancePath(agentName, userId);
    if (!existsSync(instancePath)) return false;
    rmSync(instancePath, { recursive: true });
    return true;
  }

  /** List all instances, optionally filtered by agent name */
  listInstances(agentName?: string): Array<{ agentName: string; userId: string; path: string }> {
    const results: Array<{ agentName: string; userId: string; path: string }> = [];

    if (!existsSync(this.instancesDir)) return results;

    const agentDirs = agentName ? [agentName] : readdirSync(this.instancesDir).filter((entry) => {
      const entryPath = join(this.instancesDir, entry);
      return statSync(entryPath).isDirectory();
    });

    for (const agent of agentDirs) {
      const agentPath = join(this.instancesDir, agent);
      if (!existsSync(agentPath)) continue;

      for (const userId of readdirSync(agentPath)) {
        const userPath = join(agentPath, userId);
        if (statSync(userPath).isDirectory()) {
          results.push({ agentName: agent, userId, path: userPath });
        }
      }
    }

    return results;
  }
}
