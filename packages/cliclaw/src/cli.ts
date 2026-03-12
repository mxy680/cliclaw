#!/usr/bin/env node
import { Command } from "commander";
import { TokenStore, OAuthClientManager, AgentStore, getAgentsDir } from "@cliclaw/auth";
import { loadConfig, getTokensPath } from "./lib/config.js";
import { registerGmailCommands } from "./commands/gmail.js";
import { registerGDriveCommands } from "./commands/gdrive.js";
import { registerAgentCommands } from "./commands/agent.js";
import { outputError } from "./lib/output.js";

function getClientManager(): { clientManager: OAuthClientManager; port: number } {
  const config = loadConfig();
  const tokenStore = new TokenStore(getTokensPath());
  const redirectUri = `http://localhost:${config.oauth_port}/oauth/callback`;
  const clientManager = new OAuthClientManager(config.client_secret_path, redirectUri, tokenStore);
  return { clientManager, port: config.oauth_port };
}

const program = new Command();

program
  .name("cliclaw")
  .description("CLI tool for Gmail and Google Drive operations")
  .version("0.1.0");

registerGmailCommands(program, getClientManager);
registerGDriveCommands(program, getClientManager);
registerAgentCommands(program, () => new AgentStore(getAgentsDir()));

program.parseAsync().catch((err) => {
  outputError("cli_error", err instanceof Error ? err.message : String(err));
});
