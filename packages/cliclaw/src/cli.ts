#!/usr/bin/env node
import { Command } from "commander";
import { TokenStore, OAuthClientManager, AgentStore, getAgentsDir } from "@digitalpresence/cliclaw-auth";
import { loadConfig, getTokensPath } from "./lib/config.js";
import { registerGmailCommands } from "./commands/gmail.js";
import { registerGDriveCommands } from "./commands/gdrive.js";
import { registerGSlidesCommands } from "./commands/gslides.js";
import { registerSheetsCommands } from "./commands/sheets.js";
import { registerCalendarCommands } from "./commands/calendar.js";
import { registerFormsCommands } from "./commands/forms.js";
import { registerAgentCommands } from "./commands/agent.js";
import { registerCronCommands } from "./commands/cron.js";
import { registerGithubCommands } from "./commands/github.js";
import { registerVercelCommands } from "./commands/vercel.js";
import { registerInitCommand } from "./commands/init.js";
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
  .description("CLI tool for Gmail, Google Drive, Google Slides, Google Sheets, Google Calendar, Google Forms, GitHub, and Vercel operations")
  .version("0.1.0");

registerGmailCommands(program, getClientManager);
registerGDriveCommands(program, getClientManager);
registerGSlidesCommands(program, getClientManager);
registerSheetsCommands(program, getClientManager);
registerCalendarCommands(program, getClientManager);
registerFormsCommands(program, getClientManager);
registerGithubCommands(program, () => new TokenStore(getTokensPath()));
registerVercelCommands(program, () => new TokenStore(getTokensPath()));
registerAgentCommands(program, () => new AgentStore(getAgentsDir()));
registerCronCommands(program, () => new AgentStore(getAgentsDir()));
registerInitCommand(program);

program.parseAsync().catch((err) => {
  outputError("cli_error", err instanceof Error ? err.message : String(err));
});
