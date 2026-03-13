import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, mkdirSync, existsSync, realpathSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  const store = new AgentStore(getAgentsDir());
  const agent = store.get(name);
  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspacePath = store.workspacePath(name);

  // Parse FormData or JSON
  let message: string;
  let sessionId: string | undefined;
  let model: string | undefined;
  const savedPaths: string[] = [];

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    message = (formData.get("message") as string) ?? "";
    sessionId = (formData.get("sessionId") as string) || undefined;
    model = (formData.get("model") as string) || undefined;

    // Save uploaded files to workspace/uploads/
    const uploadsDir = join(workspacePath, "uploads");
    if (!existsSync(uploadsDir)) {
      mkdirSync(uploadsDir, { recursive: true });
    }

    for (const [key, value] of formData.entries()) {
      if (key === "files" && value instanceof File) {
        const bytes = await value.arrayBuffer();
        const filePath = join(uploadsDir, value.name);
        writeFileSync(filePath, Buffer.from(bytes));
        savedPaths.push(filePath);
      }
    }
  } else {
    const body = (await request.json()) as { message: string; sessionId?: string; model?: string };
    message = body.message;
    sessionId = body.sessionId;
    model = body.model;
  }

  // Build prompt with file references
  let prompt = message;
  if (savedPaths.length > 0) {
    const fileRefs = savedPaths
      .map((p) => `- ${p}`)
      .join("\n");
    prompt = `The user has uploaded the following files:\n${fileRefs}\n\nUse the Read tool to read them. ${message}`;
  }

  // Strip CLAUDECODE env var so the spawned Claude Code process doesn't
  // think it's nested inside another session and refuse to start.
  const cleanEnv = { ...process.env };
  delete cleanEnv.CLAUDECODE;

  // Ensure cliclaw CLI is in PATH with a shell wrapper
  // Navigate from dashboard (apps/dashboard) up to monorepo root, then to CLI dist
  const monorepoRoot = join(process.cwd(), "..", "..");
  const binScript = realpathSync(join(monorepoRoot, "packages", "cliclaw", "dist", "cli.js"));
  if (existsSync(binScript)) {
    const localBin = join(workspacePath, ".bin");
    if (!existsSync(localBin)) mkdirSync(localBin, { recursive: true });
    const wrapper = join(localBin, "cliclaw");
    // Always rewrite wrapper to ensure it's correct and executable
    writeFileSync(wrapper, `#!/bin/sh\nexec node "${binScript}" "$@"\n`, { mode: 0o755 });
    cleanEnv.PATH = `${localBin}:${cleanEnv.PATH ?? ""}`;
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: string) {
        // SSE spec: newlines in data must use separate "data:" lines
        const encoded = data.split("\n").map((line) => `data: ${line}`).join("\n");
        controller.enqueue(encoder.encode(`event: ${event}\n${encoded}\n\n`));
      }

      let currentToolInput = "";

      try {
        const conversation = query({
          prompt,
          options: {
            cwd: workspacePath,
            env: cleanEnv,
            systemPrompt: {
              type: "preset" as const,
              preset: "claude_code" as const,
            },
            settingSources: ["project"],
            includePartialMessages: true,
            allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
            ...(model ? { model } : {}),
            ...(sessionId ? { resume: sessionId } : {}),
          },
        });

        for await (const event of conversation) {
          const msg = event as SDKMessage;

          // Skip "assistant" messages — text is already sent via stream_event deltas
          if (msg.type === "stream_event" && msg.event) {
            const streamEvent = msg.event as {
              type: string;
              content_block?: { type: string; name?: string; id?: string };
              delta?: { type: string; text?: string; partial_json?: string };
            };
            if (streamEvent.type === "content_block_start" && streamEvent.content_block?.type === "tool_use") {
              send("tool_start", JSON.stringify({
                name: streamEvent.content_block.name,
                id: streamEvent.content_block.id,
              }));
              currentToolInput = "";
            } else if (streamEvent.type === "content_block_delta") {
              if (streamEvent.delta?.type === "text_delta" && streamEvent.delta.text) {
                send("delta", streamEvent.delta.text);
              } else if (streamEvent.delta?.type === "input_json_delta" && streamEvent.delta.partial_json) {
                currentToolInput += streamEvent.delta.partial_json;
              }
            } else if (streamEvent.type === "content_block_stop" && currentToolInput) {
              try {
                const input = JSON.parse(currentToolInput);
                send("tool_input", JSON.stringify(input));
              } catch {
                // incomplete JSON, skip
              }
              currentToolInput = "";
            }
          } else if ((msg as { type: string }).type === "tool_result") {
            // Tool execution completed
            send("tool_result", JSON.stringify({
              name: (msg as { tool_name?: string }).tool_name,
            }));
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
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
