import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";

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
  constructor(private agentsDir: string) {}

  private ensureDir(): void {
    if (!existsSync(this.agentsDir)) {
      mkdirSync(this.agentsDir, { recursive: true });
    }
  }

  private filePath(name: string): string {
    return join(this.agentsDir, `${name}.json`);
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
    writeFileSync(this.filePath(config.name), JSON.stringify(config, null, 2), "utf-8");
  }

  delete(name: string): boolean {
    const path = this.filePath(name);
    if (!existsSync(path)) return false;
    unlinkSync(path);
    return true;
  }

  list(): AgentConfig[] {
    this.ensureDir();
    return readdirSync(this.agentsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(this.agentsDir, f), "utf-8")) as AgentConfig;
        } catch {
          return null;
        }
      })
      .filter((c): c is AgentConfig => c !== null);
  }

  listNames(): string[] {
    this.ensureDir();
    return readdirSync(this.agentsDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  }
}
