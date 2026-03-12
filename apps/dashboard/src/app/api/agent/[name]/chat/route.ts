import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const { message, sessionId } = (await request.json()) as {
    message: string;
    sessionId?: string;
  };

  const store = new AgentStore(getAgentsDir());
  const agent = store.get(name);
  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const workspacePath = store.workspacePath(name);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: string, data: string) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      }

      try {
        const conversation = query({
          prompt: message,
          options: {
            cwd: workspacePath,
            allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
            ...(sessionId ? { sessionId } : {}),
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
            // Streaming partial content
            const streamEvent = msg.event as { type: string; delta?: { type: string; text?: string } };
            if (streamEvent.type === "content_block_delta" && streamEvent.delta?.type === "text_delta" && streamEvent.delta.text) {
              send("delta", streamEvent.delta.text);
            }
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
