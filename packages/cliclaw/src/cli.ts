#!/usr/bin/env node
import { Command } from "commander";
import { join } from "path";
import { loadConfig, getConfigDir } from "./lib/config.js";
import { TokenStore } from "./auth/token-store.js";
import { OAuthClientManager } from "./auth/oauth-client-manager.js";
import { registerGmailCommands } from "./commands/gmail.js";
import { outputError } from "./lib/output.js";

const program = new Command();

program
  .name("cliclaw")
  .description("CLI tool for Gmail operations")
  .version("0.1.0");

try {
  const config = loadConfig();
  const tokenStore = new TokenStore(join(getConfigDir(), "tokens.json"));
  const clientManager = new OAuthClientManager(config.client_secret_path, config.oauth_port, tokenStore);

  registerGmailCommands(program, clientManager, config.oauth_port);

  program.parseAsync().catch((err) => {
    outputError("cli_error", err instanceof Error ? err.message : String(err));
  });
} catch (err) {
  // Config loading errors already call process.exit(1) with stderr messages
  // This catches any other unexpected errors
  if (err instanceof Error && err.message) {
    outputError("init_error", err.message);
  }
}
