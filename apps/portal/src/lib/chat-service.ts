import { query } from "@anthropic-ai/claude-agent-sdk";

export type ChatSSEEvent =
  | { event: "delta"; data: string }
  | { event: "tool_start"; data: string }
  | { event: "tool_input"; data: string }
  | { event: "tool_result"; data: string }
  | { event: "session"; data: string }
  | { event: "result"; data: string }
  | { event: "error"; data: string };

interface ChatOptions {
  message: string;
  workspacePath: string;
  sessionId?: string;
  env: Record<string, string>;
  signal?: AbortSignal;
}

export async function* streamChat(
  opts: ChatOptions
): AsyncGenerator<ChatSSEEvent> {
  const { message, workspacePath, sessionId, env, signal } = opts;

  // Strip CLAUDECODE from env to prevent nested Claude detection
  const cleanEnv = { ...env };
  for (const key of Object.keys(cleanEnv)) {
    if (key.startsWith("CLAUDECODE")) {
      delete cleanEnv[key];
    }
  }

  let currentToolInput = "";
  let hasToolInput = false;

  try {
    const conversation = query({
      prompt: message,
      options: {
        cwd: workspacePath,
        env: cleanEnv,
        systemPrompt: { type: "preset", preset: "claude_code" },
        settingSources: ["project"],
        includePartialMessages: true,
        permissionMode: "bypassPermissions",
        model: "claude-sonnet-4-6",
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });

    for await (const event of conversation) {
      if (signal?.aborted) break;

      if (event.type === "stream_event") {
        const streamEvent = (event as any).event;

        if (
          streamEvent.type === "content_block_start" &&
          streamEvent.content_block?.type === "tool_use"
        ) {
          yield {
            event: "tool_start",
            data: JSON.stringify({
              name: streamEvent.content_block.name,
              id: streamEvent.content_block.id,
            }),
          };
          currentToolInput = "";
          hasToolInput = false;
        } else if (streamEvent.type === "content_block_delta") {
          if (streamEvent.delta?.type === "text_delta" && streamEvent.delta.text) {
            yield { event: "delta", data: streamEvent.delta.text };
          } else if (
            streamEvent.delta?.type === "input_json_delta" &&
            streamEvent.delta.partial_json
          ) {
            currentToolInput += streamEvent.delta.partial_json;
            hasToolInput = true;
          }
        } else if (streamEvent.type === "content_block_stop") {
          if (hasToolInput) {
            yield { event: "tool_input", data: currentToolInput };
            currentToolInput = "";
            hasToolInput = false;
          }
        }
      } else if (event.type === "tool_use_summary") {
        yield {
          event: "tool_result",
          data: JSON.stringify({ summary: (event as any).summary || "" }),
        };
      } else if (event.type === "result") {
        const result = event as any;
        yield {
          event: "session",
          data: result.session_id || "",
        };
        yield {
          event: "result",
          data: JSON.stringify({
            costUsd: result.total_cost_usd || 0,
            turnCount: result.num_turns || 0,
            sessionId: result.session_id || "",
          }),
        };
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    yield { event: "error", data: msg };
  }
}
