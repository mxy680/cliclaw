import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { AgentConfig } from "@digitalpresence/cliclaw-auth";
import { getStmts } from "./db-statements";
import type { ClientTokenRow } from "./types";

/**
 * Writes client_secret.json and config.json into the given directory so the
 * Google auth library inside a container can refresh expired access tokens.
 */
export function writeOAuthConfig(
  configDir: string,
  containerSecretPath: string,
): void {
  mkdirSync(configDir, { recursive: true });
  writeFileSync(
    join(configDir, "client_secret.json"),
    JSON.stringify({
      web: {
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
      },
    }),
    "utf-8",
  );
  writeFileSync(
    join(configDir, "config.json"),
    JSON.stringify({ client_secret_path: containerSecretPath, oauth_port: 9753 }),
    "utf-8",
  );
}

interface InjectionResult {
  tokensPath: string;
  connectedIntegrations: string[];
}

export async function injectClientTokens(
  userId: string,
  agent: AgentConfig,
  workspacePath: string,
  env: Record<string, string>
): Promise<InjectionResult> {
  const stmts = getStmts();
  const tokens = await stmts.getClientTokens.all(userId) as unknown as ClientTokenRow[];

  // Build set of integrations this agent needs
  const requiredIntegrations = new Set(agent.integrations);

  // Match tokens by integration — use the first available account for each
  const clientTokensFile: Record<string, unknown> = {};
  const connectedIntegrations: string[] = [];

  for (const token of tokens) {
    if (requiredIntegrations.has(token.integration)) {
      const key = `${token.integration}:${token.account}`;
      if (!clientTokensFile[key]) {
        clientTokensFile[key] = JSON.parse(token.credentials);
        connectedIntegrations.push(key);
      }
    }
  }

  const nonce = randomBytes(8).toString("hex");
  const tokensPath = join(workspacePath, `tokens-${nonce}.json`);
  writeFileSync(tokensPath, JSON.stringify(clientTokensFile, null, 2), { mode: 0o600 });

  // Write integration instructions
  if (connectedIntegrations.length > 0) {
    const lines = connectedIntegrations.map((key) => {
      const [integration, account] = key.split(":");
      return `- **${integration}**: \`--account ${account}\``;
    });
    const md = `# Client Integrations\n\nUse these account names when running cliclaw commands.\n\n${lines.join("\n")}\n`;
    writeFileSync(join(workspacePath, "CLIENT_INTEGRATIONS.md"), md);
  }

  env.CLICLAW_TOKENS_PATH = tokensPath;

  return { tokensPath, connectedIntegrations };
}

export async function persistRefreshedTokens(
  userId: string,
  injection: InjectionResult
): Promise<void> {
  try {
    const raw = readFileSync(injection.tokensPath, "utf-8");
    const tokens = JSON.parse(raw) as Record<string, unknown>;
    const stmts = getStmts();

    for (const [key, credentials] of Object.entries(tokens)) {
      const parts = key.split(":");
      const integration = parts[0];
      const account = parts[1] || "default";
      if (!integration) continue;

      await stmts.upsertClientToken.run(
        randomBytes(16).toString("hex"),
        userId,
        integration,
        account,
        JSON.stringify(credentials),
        null // email stays unchanged on refresh
      );
    }
  } catch (err) {
    console.error("[token-injector] persistRefreshedTokens failed:", err);
  }
}
