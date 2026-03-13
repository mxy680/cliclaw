import "dotenv/config";
import express from "express";
import cors from "cors";
import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { stmts } from "./db.js";
import { requireAuth, requireSecret } from "./auth.js";
import authRoutes from "./routes/auth-routes.js";
import adminRoutes from "./routes/admin-routes.js";

const app = express();
const PORT = process.env.PORT ?? "3002";

app.use(cors({
  origin: process.env.PORTAL_URL || "http://localhost:3001",
  credentials: true,
}));
app.use(express.json());

// Auth routes (no API secret needed — these are called directly or via portal proxy)
app.use("/auth", authRoutes);

// Admin routes
app.use("/admin", adminRoutes);

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

  const workspacePath = store.workspacePath(agentName);

  // Strip CLAUDECODE so the spawned process doesn't think it's nested
  const cleanEnv: Record<string, string | undefined> = { ...process.env };
  delete cleanEnv.CLAUDECODE;

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
        allowedTools: ["Read", "Glob", "Grep"],
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
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Agent server running on http://localhost:${PORT}`);
});
