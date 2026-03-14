import { spawnAgentContainer } from "./container-runner";

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
  instancePath: string;
  workspacePath: string;
  sessionId?: string;
  env: Record<string, string>;
  signal?: AbortSignal;
}

export async function* streamChat(
  opts: ChatOptions
): AsyncGenerator<ChatSSEEvent> {
  const { message, instancePath, sessionId, env, signal } = opts;

  yield* spawnAgentContainer({
    instancePath,
    message,
    sessionId,
    env,
    signal,
  });
}
