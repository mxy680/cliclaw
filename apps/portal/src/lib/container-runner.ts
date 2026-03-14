import { spawn, type ChildProcess } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import type { ChatSSEEvent } from "./chat-service";

interface ContainerOptions {
  instancePath: string;
  message: string;
  sessionId?: string;
  model?: string;
  env: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

const CONTAINER_IMAGE = "cliclaw-agent";
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Spawns an agent in a Docker container, parsing NDJSON stdout into ChatSSEEvents.
 */
export async function* spawnAgentContainer(
  opts: ContainerOptions
): AsyncGenerator<ChatSSEEvent> {
  const {
    instancePath,
    message,
    sessionId,
    model,
    env,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts;

  // Write session.json for the container entrypoint
  const sessionData = {
    prompt: message,
    ...(sessionId ? { sessionId } : {}),
    ...(model ? { model } : {}),
  };
  writeFileSync(
    join(instancePath, "session.json"),
    JSON.stringify(sessionData, null, 2),
    "utf-8",
  );

  // Build docker run args
  const args = [
    "run",
    "--rm",
    "-i",
    "-v", `${instancePath}:/instance`,
    "--network=host",
    "--cpus=2",
    "--memory=2g",
  ];

  // Pass required env vars
  if (env.ANTHROPIC_API_KEY) {
    args.push("-e", `ANTHROPIC_API_KEY=${env.ANTHROPIC_API_KEY}`);
  }
  if (env.CLICLAW_TOKENS_PATH) {
    // Map host tokens path to container path
    args.push("-e", `CLICLAW_TOKENS_PATH=${env.CLICLAW_TOKENS_PATH.replace(instancePath, "/instance")}`);
  }

  args.push(CONTAINER_IMAGE);

  let child: ChildProcess;
  try {
    child = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    yield {
      event: "error",
      data: `Failed to spawn Docker container: ${err instanceof Error ? err.message : String(err)}`,
    };
    return;
  }

  // Timeout handling
  const timeout = setTimeout(() => {
    child.kill("SIGTERM");
  }, timeoutMs);

  // Abort signal handling
  if (signal) {
    signal.addEventListener("abort", () => {
      child.kill("SIGTERM");
    }, { once: true });
  }

  // Parse NDJSON from stdout
  const rl = createInterface({ input: child.stdout! });

  let currentToolInput = "";
  let hasToolInput = false;

  try {
    for await (const line of rl) {
      if (signal?.aborted) break;
      if (!line.trim()) continue;

      let event: any;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }

      // Map SDK events to ChatSSEEvents (same logic as chat-service.ts)
      if (event.type === "stream_event" && event.event) {
        const streamEvent = event.event;

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
          data: JSON.stringify({ summary: event.summary || "" }),
        };
      } else if (event.type === "result") {
        yield {
          event: "session",
          data: event.session_id || "",
        };
        yield {
          event: "result",
          data: JSON.stringify({
            costUsd: event.total_cost_usd || 0,
            turnCount: event.num_turns || 0,
            sessionId: event.session_id || "",
          }),
        };
      }
    }
  } catch (err) {
    yield {
      event: "error",
      data: err instanceof Error ? err.message : "Container stream error",
    };
  } finally {
    clearTimeout(timeout);
    rl.close();

    // Collect stderr for error reporting
    if (child.stderr) {
      let stderr = "";
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.stderr.on("end", () => {
        if (stderr.trim()) {
          console.error(`[container-runner] stderr: ${stderr.trim()}`);
        }
      });
    }
  }
}
