import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

const app = express();
const PORT = process.env.PORT ?? "3002";
const API_SECRET = process.env.AGENT_API_SECRET;

app.use(cors());
app.use(express.json());

// Auth middleware — skips /health
function requireSecret(req: Request, res: Response, next: NextFunction): void {
  if (!API_SECRET) {
    res.status(500).json({ error: "AGENT_API_SECRET is not configured" });
    return;
  }
  const provided = req.headers["x-api-secret"];
  if (provided !== API_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// GET /health
app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// GET /agents
app.get("/agents", requireSecret, (_req: Request, res: Response) => {
  const store = new AgentStore(getAgentsDir());
  const all = store.list();
  const agents = all.map((agent) => ({
    name: agent.name,
    displayName: agent.displayName,
    role: agent.role,
  }));
  res.json({ agents });
});

// POST /chat/:agentName
app.post("/chat/:agentName", requireSecret, async (req: Request, res: Response) => {
  const { agentName } = req.params;
  const body = req.body as { message?: string; sessionId?: string };
  const { message, sessionId } = body;

  if (!message) {
    res.status(400).json({ error: "message is required" });
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
