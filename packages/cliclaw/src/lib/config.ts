import { loadConfig as loadConfigBase, getConfigDir, getTokensPath } from "@digitalpresence/cliclaw-auth";
import type { CliclawConfig } from "@digitalpresence/cliclaw-auth";

export type { CliclawConfig };
export { getConfigDir, getTokensPath };

export function loadConfig(): CliclawConfig {
  try {
    return loadConfigBase();
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
