import { spawn } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse, ForbiddenError, NotFoundError } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";
import { getInstancesDir } from "@digitalpresence/cliclaw-auth";
import type { ClientTokenRow } from "@/lib/types";
import { jobSchema, parseBody } from "@/lib/validation";
import { applyRateLimit, API_LIMIT } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rl = applyRateLimit(request, API_LIMIT);
  if (rl.blocked) return rl.blocked;

  try {
    const user = await requireAuth();
    const { agentName, jobId } = await parseBody(request, jobSchema);

    // Verify access
    const hasAccess = getStmts().checkAccess.get(user.id, agentName);
    if (!hasAccess) throw new ForbiddenError("No access to this agent");

    // Verify job exists
    const agent = getAgentStore().get(agentName);
    if (!agent) throw new NotFoundError("Agent not found");
    const job = agent.cronJobs.find((j) => j.id === jobId);
    if (!job) throw new NotFoundError("Job not found");

    // Inject client tokens into the cron instance
    const cronInstancePath = join(getInstancesDir(), agentName, "_cron");
    const cronWorkspace = join(cronInstancePath, "workspace");
    mkdirSync(cronWorkspace, { recursive: true });

    // Write tokens file
    const tokens = getStmts().getClientTokens.all(user.id) as ClientTokenRow[];
    const tokenData: Record<string, unknown> = {};
    for (const token of tokens) {
      if (agent.integrations.includes(token.integration)) {
        const key = `${token.integration}:${token.account}`;
        if (!tokenData[key]) {
          tokenData[key] = JSON.parse(token.credentials);
        }
      }
    }
    const tokensPath = join(cronWorkspace, "cron-tokens.json");
    writeFileSync(tokensPath, JSON.stringify(tokenData, null, 2), { mode: 0o600 });

    // Write cliclaw config with only the public client_id.
    // The client_secret is never written to the container — it is not needed
    // because the container operates with pre-obtained access tokens.
    const cliclawConfigDir = join(cronInstancePath, ".cliclaw-config");
    mkdirSync(cliclawConfigDir, { recursive: true });
    writeFileSync(
      join(cliclawConfigDir, "client_secret.json"),
      JSON.stringify({
        web: {
          client_id: process.env.GOOGLE_CLIENT_ID || "",
          auth_uri: "https://accounts.google.com/o/oauth2/auth",
          token_uri: "https://oauth2.googleapis.com/token",
        },
      }),
    );
    writeFileSync(
      join(cliclawConfigDir, "config.json"),
      JSON.stringify({
        client_secret_path: join(cliclawConfigDir, "client_secret.json"),
        oauth_port: 9753,
      }),
    );

    // Write CLIENT_INTEGRATIONS.md
    const connectedKeys = Object.keys(tokenData);
    if (connectedKeys.length > 0) {
      const lines = connectedKeys.map((key) => `- **${key.split(":")[0]}**: \`--account ${key}\``);
      writeFileSync(
        join(cronWorkspace, "CLIENT_INTEGRATIONS.md"),
        `# Client Integrations\n\nUse these account names (not "default") when running cliclaw commands.\n\n${lines.join("\n")}\n`,
      );
    }

    // Run in background via cliclaw CLI
    const child = spawn("cliclaw", ["cron", "run", agentName, jobId], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN,
        CLICLAW_TOKENS_PATH: tokensPath,
      },
      detached: true,
    });

    child.unref();

    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const immediateError = await new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), 2000);
      child.on("error", (err) => {
        clearTimeout(timer);
        resolve(err.message);
      });
      child.on("exit", (code) => {
        if (code !== null && code !== 0) {
          clearTimeout(timer);
          resolve(stderr || `Exit code ${code}`);
        }
      });
    });

    if (immediateError) {
      return Response.json({ error: immediateError }, { status: 500 });
    }

    return Response.json({ status: "started", agentName, jobId });
  } catch (err) {
    return errorResponse(err);
  }
}
