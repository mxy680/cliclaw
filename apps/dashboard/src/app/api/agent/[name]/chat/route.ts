import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync, mkdirSync, existsSync, realpathSync, symlinkSync } from "fs";
import { join, dirname } from "path";

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
  const savedPaths: string[] = [];

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    message = (formData.get("message") as string) ?? "";
    sessionId = (formData.get("sessionId") as string) || undefined;

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
    const body = (await request.json()) as { message: string; sessionId?: string };
    message = body.message;
    sessionId = body.sessionId;
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

  // Ensure cliclaw CLI is in PATH by symlinking the built binary
  try {
    const cliPkg = require.resolve("@cliclaw/cli/package.json");
    const cliDir = dirname(realpathSync(cliPkg));
    const binScript = join(cliDir, "dist", "cli.js");
    const localBin = join(workspacePath, ".bin");
    if (!existsSync(localBin)) mkdirSync(localBin, { recursive: true });
    const link = join(localBin, "cliclaw");
    if (!existsSync(link)) {
      symlinkSync(binScript, link);
    }
    cleanEnv.PATH = `${localBin}:${cleanEnv.PATH ?? ""}`;
  } catch {
    // CLI package not resolvable — cliclaw won't be in PATH
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
            allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
            ...(sessionId ? { resume: sessionId } : {}),
          },
        });

        for await (const event of conversation) {
          const msg = event as SDKMessage;

          if (msg.type === "assistant" && msg.message) {
            for (const block of msg.message.content) {
              if (block.type === "text") {
                send("delta", block.text);
              }
            }
          } else if (msg.type === "stream_event" && msg.event) {
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
          } else if (msg.type === "tool_result") {
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
