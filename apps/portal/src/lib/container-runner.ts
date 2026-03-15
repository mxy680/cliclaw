import { spawn, execSync, type ChildProcess } from "child_process";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import type { ChatSSEEvent } from "./chat-service";
import { writeOAuthConfig } from "./token-injector";

const AGENT_UID = 1001; // matches 'agent' user in cliclaw-agent container

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
    JSON.stringify(sessionData),
    "utf-8",
  );

  // Ensure persistent Claude state directory exists for session resumption
  const claudeStatePath = join(instancePath, ".claude-state");
  try { mkdirSync(claudeStatePath, { recursive: true }); } catch {}

  // Write OAuth credentials so the Google auth library can refresh tokens
  const containerCliclawDir = join(instancePath, ".cliclaw-config");
  writeOAuthConfig(containerCliclawDir, "/home/agent/.cliclaw/client_secret.json");

  // Ensure instance dirs are writable by the container's agent user (uid 1001)
  try { execSync(`chown -R ${AGENT_UID}:${AGENT_UID} ${instancePath}`, { stdio: "ignore" }); } catch {}

  // Build docker run args
  const args = [
    "run",
    "--rm",
    "-i",
    "-v", `${instancePath}:/instance`,
    "-v", `${claudeStatePath}:/home/agent/.claude`,
    "-v", `${containerCliclawDir}:/home/agent/.cliclaw`,
    "--network=bridge",
    "--cpus=2",
    "--memory=2g",
    "--tmpfs", "/tmp:rw,noexec,nosuid",
    "--tmpfs", "/home/agent/.config:rw,nosuid",
    "--tmpfs", "/home/agent/.local:rw,nosuid",
  ];

  // Pass auth env vars
  if (env.CLAUDE_CODE_OAUTH_TOKEN) {
    args.push("-e", `CLAUDE_CODE_OAUTH_TOKEN=${env.CLAUDE_CODE_OAUTH_TOKEN}`);
  } else if (env.ANTHROPIC_API_KEY) {
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

  // Collect stderr throughout the process lifetime
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  // Parse NDJSON from stdout
  const rl = createInterface({ input: child.stdout! });

  let currentToolInput = "";
  let hasToolInput = false;
  let hasContent = false;

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
            hasContent = true;
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
  }

  // Clean up
  clearTimeout(timeout);
  rl.close();

  // Wait for process to exit, then surface errors if no content was streamed
  const exitCode = await new Promise<number | null>((resolve) => {
    if (child.exitCode !== null) {
      resolve(child.exitCode);
    } else {
      child.on("exit", (code) => resolve(code));
    }
  });

  if (stderr.trim()) {
    console.error(`[container-runner] stderr: ${stderr.trim()}`);
  }

  if (!hasContent && exitCode !== 0) {
    yield {
      event: "error",
      data: stderr.trim() || `Agent container exited with code ${exitCode}`,
    };
  }
}
