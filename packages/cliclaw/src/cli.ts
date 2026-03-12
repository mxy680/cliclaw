#!/usr/bin/env node
import { Command } from "commander";
import { join } from "path";
import { loadConfig, getConfigDir } from "./lib/config.js";
import { TokenStore } from "./auth/token-store.js";
import { OAuthClientManager } from "./auth/oauth-client-manager.js";
import { registerGmailCommands } from "./commands/gmail.js";
import { outputError } from "./lib/output.js";

function getClientManager(): { clientManager: OAuthClientManager; port: number } {
  const config = loadConfig();
  const tokenStore = new TokenStore(join(getConfigDir(), "tokens.json"));
  const clientManager = new OAuthClientManager(config.client_secret_path, config.oauth_port, tokenStore);
  return { clientManager, port: config.oauth_port };
}

const program = new Command();

program
  .name("cliclaw")
  .description("CLI tool for Gmail operations")
  .version("0.1.0");

registerGmailCommands(program, getClientManager);

program.parseAsync().catch((err) => {
  outputError("cli_error", err instanceof Error ? err.message : String(err));
});
