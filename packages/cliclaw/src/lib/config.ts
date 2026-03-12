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

export function loadConfig(): CliclawConfig {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  if (!existsSync(CONFIG_PATH)) {
    console.error(
      `Config file not found: ${CONFIG_PATH}\n` +
      `Create it with:\n` +
      `  mkdir -p ~/.cliclaw\n` +
      `  echo '{"client_secret_path": "/path/to/client_secret.json", "oauth_port": 9753}' > ~/.cliclaw/config.json`
    );
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

  if (!raw.client_secret_path) {
    console.error("config.json missing required field: client_secret_path");
    process.exit(1);
  }

  return {
    client_secret_path: raw.client_secret_path,
    oauth_port: raw.oauth_port ?? 9753,
  };
}
