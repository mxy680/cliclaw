import { existsSync, mkdirSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export interface CliclawConfig {
  client_secret_path: string;
  oauth_port: number;
}

const CONFIG_DIR = join(homedir(), ".cliclaw");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getTokensPath(): string {
  return join(CONFIG_DIR, "tokens.json");
}

export function getAgentsDir(): string {
  return join(CONFIG_DIR, "agents");
}

export function loadConfig(): CliclawConfig {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found: ${CONFIG_PATH}\n` +
      `Create it with:\n` +
      `  mkdir -p ~/.cliclaw\n` +
      `  echo '{"client_secret_path": "/path/to/client_secret.json", "oauth_port": 9753}' > ~/.cliclaw/config.json`
    );
  }

  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

  if (!raw.client_secret_path) {
    throw new Error("config.json missing required field: client_secret_path");
  }

  return {
    client_secret_path: raw.client_secret_path,
    oauth_port: raw.oauth_port ?? 9753,
  };
}
