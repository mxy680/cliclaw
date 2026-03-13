import "dotenv/config";

const REQUIRED_ENV = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "AGENT_API_SECRET"] as const;
const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  console.error("Ensure .env file exists in apps/agent-server/");
  process.exit(1);
}

import express from "express";
import cors from "cors";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { AgentStore, getAgentsDir, INTEGRATIONS } from "@cliclaw/auth";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { stmts, generateId } from "./db.js";
import { requireAuth, requireSecret } from "./auth.js";
import authRoutes from "./routes/auth-routes.js";
import adminRoutes from "./routes/admin-routes.js";
import integrationRoutes from "./routes/integration-routes.js";

const app = express();
const PORT = process.env.PORT ?? "3002";

app.use(cors({
  origin: [process.env.PORTAL_URL || "http://localhost:3001", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());

// Auth routes (no API secret needed — these are called directly or via portal proxy)
app.use("/auth", authRoutes);

// Admin routes
app.use("/admin", adminRoutes);

// Integration routes
app.use("/integrations", integrationRoutes);

// GET /health
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /agents — returns agents the authenticated user has access to
app.get("/agents", requireAuth, (req, res) => {
  const store = new AgentStore(getAgentsDir());
  const all = store.list();

  // Get user's access
  const access = stmts.getUserAccess.all(req.user!.id) as { agent_name: string }[];
  const accessSet = new Set(access.map((a) => a.agent_name));

  const agents = all
    .filter((agent: { name: string }) => accessSet.has(agent.name))
    .map((agent: { name: string; displayName: string; role: string }) => ({
      name: agent.name,
      displayName: agent.displayName,
      role: agent.role,
    }));

  res.json({ agents });
});

// POST /chat/:agentName — stream SSE chat
app.post("/chat/:agentName", requireAuth, async (req, res) => {
  const agentName = req.params.agentName as string;
  const { message, sessionId } = req.body as { message?: string; sessionId?: string };

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  // Check access
  const access = stmts.checkAccess.get(req.user!.id, agentName);
  if (!access) {
    res.status(403).json({ error: "You don't have access to this agent" });
    return;
  }

  const store = new AgentStore(getAgentsDir());
  const agent = store.get(agentName);
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }

  const workspacePath = store.clientWorkspacePath(agentName, req.user!.id);

  // Strip CLAUDECODE so the spawned process doesn't think it's nested
  const cleanEnv: Record<string, string | undefined> = { ...process.env };
  delete cleanEnv.CLAUDECODE;

  // Inject client tokens into workspace
  const permittedIntegrations = new Set(agent.permissions.map((p) => p.integration));
  const clientTokenRows = stmts.getClientTokens.all(req.user!.id) as {
    integration: string;
    credentials: string;
    email: string | null;
  }[];

  const clientTokensFile: Record<string, unknown> = {};
  const connectedIntegrations: { integration: string; email: string | null }[] = [];

  for (const row of clientTokenRows) {
    if (!permittedIntegrations.has(row.integration)) continue;
    try {
      clientTokensFile[`${row.integration}:client`] = JSON.parse(row.credentials);
      connectedIntegrations.push({ integration: row.integration, email: row.email });
    } catch {
      // Skip malformed credentials
    }
  }

  const tokensPath = join(workspacePath, "tokens.json");
  if (Object.keys(clientTokensFile).length > 0) {
    writeFileSync(tokensPath, JSON.stringify(clientTokensFile, null, 2), "utf-8");
    cleanEnv.CLICLAW_TOKENS_PATH = tokensPath;

    // Write CLIENT_INTEGRATIONS.md so the agent knows which accounts to use
    const lines = ["# Connected Client Integrations\n"];
    for (const ci of connectedIntegrations) {
      const def = INTEGRATIONS[ci.integration];
      lines.push(`- **${def?.displayName ?? ci.integration}**: account \`client\` (${ci.email ?? "connected"})`);
    }
    lines.push("\nUse `--account client` for these integrations when acting on behalf of the user.");
    writeFileSync(join(workspacePath, "CLIENT_INTEGRATIONS.md"), lines.join("\n"), "utf-8");
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  function send(event: string, data: string): void {
    const encoded = data.split("\n").map((line) => `data: ${line}`).join("\n");
    res.write(`event: ${event}\n${encoded}\n\n`);
  }

  let currentToolInput = "";

  try {
    const conversation = query({
      prompt: message,
      options: {
        cwd: workspacePath,
        env: cleanEnv,
        systemPrompt: { type: "preset" as const, preset: "claude_code" as const },
        settingSources: ["project"],
        includePartialMessages: true,
        permissionMode: "bypassPermissions" as const,
        model: "claude-sonnet-4-6",
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });

    for await (const event of conversation) {
      const msg = event as SDKMessage;

      if (msg.type === "stream_event" && msg.event) {
        const streamEvent = msg.event as {
          type: string;
          content_block?: { type: string; name?: string; id?: string };
          delta?: { type: string; text?: string; partial_json?: string };
        };

        if (
          streamEvent.type === "content_block_start" &&
          streamEvent.content_block?.type === "tool_use"
        ) {
          send(
            "tool_start",
            JSON.stringify({
              name: streamEvent.content_block.name,
              id: streamEvent.content_block.id,
            }),
          );
          currentToolInput = "";
        } else if (streamEvent.type === "content_block_delta") {
          if (streamEvent.delta?.type === "text_delta" && streamEvent.delta.text) {
            send("delta", streamEvent.delta.text);
          } else if (
            streamEvent.delta?.type === "input_json_delta" &&
            streamEvent.delta.partial_json
          ) {
            currentToolInput += streamEvent.delta.partial_json;
          }
        } else if (streamEvent.type === "content_block_stop" && currentToolInput) {
          try {
            const input = JSON.parse(currentToolInput) as unknown;
            send("tool_input", JSON.stringify(input));
          } catch {
            // incomplete JSON, skip
          }
          currentToolInput = "";
        }
      } else if ((msg as { type: string }).type === "tool_result") {
        send(
          "tool_result",
          JSON.stringify({ name: (msg as { tool_name?: string }).tool_name }),
        );
      } else if (msg.type === "result") {
        if (msg.session_id) {
          send("session", msg.session_id);
        }
        send(
          "result",
          JSON.stringify({
            costUsd: "total_cost_usd" in msg ? msg.total_cost_usd : 0,
            turnCount: "num_turns" in msg ? msg.num_turns : 0,
            sessionId: msg.session_id,
          }),
        );
      }
    }
  } catch (err) {
    send("error", err instanceof Error ? err.message : "Unknown error");
  } finally {
    // Persist any refreshed tokens back to SQLite
    if (existsSync(tokensPath) && connectedIntegrations.length > 0) {
      try {
        const updated = JSON.parse(readFileSync(tokensPath, "utf-8")) as Record<string, unknown>;
        for (const ci of connectedIntegrations) {
          const key = `${ci.integration}:client`;
          if (updated[key]) {
            stmts.upsertClientToken.run(
              generateId(),
              req.user!.id,
              ci.integration,
              JSON.stringify(updated[key]),
              ci.email,
            );
          }
        }
      } catch {
        // Non-critical — token refresh persistence failure
      }
    }
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Agent server running on http://localhost:${PORT}`);
});
