import { writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { AgentConfig } from "@digitalpresence/cliclaw-auth";
import { getStmts } from "./db-statements";
import type { ClientTokenRow } from "./types";

interface InjectionResult {
  tokensPath: string;
  connectedIntegrations: string[];
}

export function injectClientTokens(
  userId: string,
  agent: AgentConfig,
  workspacePath: string,
  env: Record<string, string>
): InjectionResult {
  const stmts = getStmts();
  const tokens = stmts.getClientTokens.all(userId) as ClientTokenRow[];

  // Build set of (integration, account) pairs this agent needs
  const requiredPairs = new Set(
    agent.permissions.map((p) => `${p.integration}:${p.account}`)
  );

  // Match tokens by (integration, account) pair
  const clientTokensFile: Record<string, unknown> = {};
  const connectedIntegrations: string[] = [];

  for (const token of tokens) {
    const key = `${token.integration}:${token.account}`;
    if (requiredPairs.has(key)) {
      clientTokensFile[key] = JSON.parse(token.credentials);
      connectedIntegrations.push(key);
    }
  }

  const tokensPath = join(workspacePath, "tokens.json");
  writeFileSync(tokensPath, JSON.stringify(clientTokensFile, null, 2));

  // Write integration instructions
  if (connectedIntegrations.length > 0) {
    const lines = connectedIntegrations.map(
      (key) => `- ${key}: Use --account ${key.split(":")[1]} when accessing this integration`
    );
    const md = `# Client Integrations\n\nThe following integrations are connected for this client:\n\n${lines.join("\n")}\n`;
    writeFileSync(join(workspacePath, "CLIENT_INTEGRATIONS.md"), md);
  }

  env.CLICLAW_TOKENS_PATH = tokensPath;

  return { tokensPath, connectedIntegrations };
}

export function persistRefreshedTokens(
  userId: string,
  injection: InjectionResult
): void {
  try {
    const raw = readFileSync(injection.tokensPath, "utf-8");
    const tokens = JSON.parse(raw) as Record<string, unknown>;
    const stmts = getStmts();

    for (const [key, credentials] of Object.entries(tokens)) {
      const parts = key.split(":");
      const integration = parts[0];
      const account = parts[1] || "default";
      if (!integration) continue;

      stmts.upsertClientToken.run(
        randomBytes(16).toString("hex"),
        userId,
        integration,
        account,
        JSON.stringify(credentials),
        null // email stays unchanged on refresh
      );
    }
  } catch {
    // Non-critical — token refresh persistence is best-effort
  }
}
