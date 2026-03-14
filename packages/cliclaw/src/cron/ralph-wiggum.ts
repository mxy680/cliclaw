import { spawn } from "child_process";
import { createInterface } from "readline";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";
import type { AgentStore, CronJobConfig } from "@digitalpresence/cliclaw-auth";
import { generateUniversalClaudeMd, generateContextMd } from "@digitalpresence/cliclaw-auth";
import { getProgressFilePath, ensureCronDirs, writeRunningMarker, clearRunningMarker } from "./progress.js";
import { cronLog } from "./logger.js";

const CONTINUE_MARKER = "NEEDS_MORE_ITERATIONS";
const CONTAINER_IMAGE = "cliclaw-agent";
const CONTAINER_TIMEOUT_MS = 300_000; // 5 minutes per iteration

export type TranscriptBlock =
  | { type: "assistant"; content: string }
  | { type: "tool"; name: string; input?: string; done: boolean };

export interface RalphWiggumResult {
  completed: boolean;
  iterations: number;
  totalCostUsd: number;
  transcript: TranscriptBlock[];
}

function loadTaskContent(store: AgentStore, agentName: string, job: CronJobConfig): string {
  const taskFilePath = join(store.workspacePath(agentName), "cron-tasks", job.taskFile);
  if (existsSync(taskFilePath)) {
    return readFileSync(taskFilePath, "utf-8");
  }
  return `Task file not found: ${job.taskFile}`;
}

/**
 * Run a single iteration inside a Docker container.
 * Returns parsed NDJSON events.
 */
async function runContainerIteration(
  instancePath: string,
  prompt: string,
  sessionId?: string,
): Promise<{ events: any[]; exitCode: number }> {
  // Write session.json
  writeFileSync(
    join(instancePath, "session.json"),
    JSON.stringify({ prompt, ...(sessionId ? { sessionId } : {}) }),
    "utf-8",
  );

  // Ensure persistent Claude state directory for session resumption
  const claudeStatePath = join(instancePath, ".claude-state");
  if (!existsSync(claudeStatePath)) {
    mkdirSync(claudeStatePath, { recursive: true });
  }

  // Mount cliclaw config if available (portal injects this for Google OAuth)
  const cliclawConfigPath = join(instancePath, ".cliclaw-config");

  const args = [
    "run", "--rm", "-i",
    "-v", `${instancePath}:/instance`,
    "-v", `${claudeStatePath}:/home/agent/.claude`,
    ...(existsSync(cliclawConfigPath)
      ? ["-v", `${cliclawConfigPath}:/home/agent/.cliclaw`]
      : []),
    "--network=host",
    "--cpus=2", "--memory=2g",
  ];

  // Pass auth env vars
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) {
    args.push("-e", `CLAUDE_CODE_OAUTH_TOKEN=${process.env.CLAUDE_CODE_OAUTH_TOKEN}`);
  } else if (process.env.ANTHROPIC_API_KEY) {
    args.push("-e", `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY}`);
  }

  // Pass tokens path if set (portal injects this for client integrations)
  if (process.env.CLICLAW_TOKENS_PATH) {
    const containerTokensPath = process.env.CLICLAW_TOKENS_PATH.replace(instancePath, "/instance");
    args.push("-e", `CLICLAW_TOKENS_PATH=${containerTokensPath}`);
  }

  args.push(CONTAINER_IMAGE);

  return new Promise((resolve) => {
    const child = spawn("docker", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
    }, CONTAINER_TIMEOUT_MS);

    const events: any[] = [];
    const rl = createInterface({ input: child.stdout! });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      try {
        events.push(JSON.parse(line));
      } catch {
        // skip malformed lines
      }
    });

    let stderr = "";
    child.stderr!.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      rl.close();
      if (stderr.trim()) {
        console.error(`[ralph-wiggum] container stderr: ${stderr.trim()}`);
      }
      resolve({ events, exitCode: code ?? 1 });
    });
  });
}

export async function executeRalphWiggumLoop(
  store: AgentStore,
  agentName: string,
  job: CronJobConfig,
  startedAt?: string,
): Promise<RalphWiggumResult> {
  ensureCronDirs(agentName, job.id);
  writeRunningMarker(agentName, job.id, startedAt ?? new Date().toISOString());

  // Use the cron instance path
  const instancesDir = join(store.workspacePath(agentName), "..", "..", "instances");
  const cronInstancePath = join(instancesDir, agentName, "_cron");

  // Ensure cron instance exists with unified CLAUDE.md
  mkdirSync(join(cronInstancePath, "workspace"), { recursive: true });
  mkdirSync(join(cronInstancePath, "memory"), { recursive: true });

  // Generate unified CLAUDE.md with soul/role/context inlined
  const config = store.get(agentName)!;
  const agentDir = store.workspacePath(agentName);
  const soul = existsSync(join(agentDir, "SOUL.md")) ? readFileSync(join(agentDir, "SOUL.md"), "utf-8") : "";
  const role = existsSync(join(agentDir, "ROLE.md")) ? readFileSync(join(agentDir, "ROLE.md"), "utf-8") : "";
  const context = generateContextMd(config, []);
  writeFileSync(
    join(cronInstancePath, "CLAUDE.md"),
    generateUniversalClaudeMd({ soul, role, context }),
    "utf-8",
  );

  const progressFile = getProgressFilePath(agentName, job.id);
  const taskContent = loadTaskContent(store, agentName, job);

  let totalCostUsd = 0;
  let sessionId: string | undefined;
  const transcript: TranscriptBlock[] = [];

  try {
    for (let iteration = 1; iteration <= job.maxIterations; iteration++) {
      cronLog("info", `Iteration ${iteration}/${job.maxIterations}`, agentName, job.id);

      // Clear the continue marker before each iteration
      if (existsSync(progressFile)) {
        const content = readFileSync(progressFile, "utf-8");
        if (content.includes(CONTINUE_MARKER)) {
          writeFileSync(progressFile, content.replace(CONTINUE_MARKER, "").trim() + "\n", "utf-8");
        }
      }

      let prompt: string;
      if (iteration === 1) {
        prompt = [
          `You are executing a scheduled task. Here are your instructions:`,
          ``,
          taskContent,
          ``,
          `Write your output/progress to: /instance/workspace/progress.md`,
          ``,
          `If you CANNOT finish the task in this iteration and need to be re-invoked, write "${CONTINUE_MARKER}" anywhere in the progress file. Otherwise, just complete the task normally — no special signal is needed.`,
        ].join("\n");
      } else {
        prompt = [
          `You are continuing a scheduled task. Read your progress file at: /instance/workspace/progress.md`,
          `Continue from where you left off.`,
          ``,
          `Original task:`,
          taskContent,
          ``,
          `If you CANNOT finish the task in this iteration and need to be re-invoked, write "${CONTINUE_MARKER}" anywhere in the progress file. Otherwise, just complete the task normally — no special signal is needed.`,
        ].join("\n");
      }

      const { events } = await runContainerIteration(cronInstancePath, prompt, sessionId);

      // Process events into transcript
      let currentToolInput = "";
      for (const event of events) {
        if (event.type === "stream_event" && event.event) {
          const streamEvent = event.event;

          if (streamEvent.type === "content_block_start" && streamEvent.content_block?.type === "tool_use") {
            transcript.push({ type: "tool", name: streamEvent.content_block.name ?? "unknown", done: false });
            currentToolInput = "";
          } else if (streamEvent.type === "content_block_delta") {
            if (streamEvent.delta?.type === "text_delta" && streamEvent.delta.text) {
              const last = transcript[transcript.length - 1];
              if (last?.type === "assistant") {
                last.content += streamEvent.delta.text;
              } else {
                transcript.push({ type: "assistant", content: streamEvent.delta.text });
              }
            } else if (streamEvent.delta?.type === "input_json_delta" && streamEvent.delta.partial_json) {
              currentToolInput += streamEvent.delta.partial_json;
            }
          } else if (streamEvent.type === "content_block_stop" && currentToolInput) {
            const lastTool = [...transcript].reverse().find((b) => b.type === "tool" && !b.done);
            if (lastTool && lastTool.type === "tool") {
              try {
                lastTool.input = JSON.stringify(JSON.parse(currentToolInput));
              } catch {
                // incomplete JSON
              }
            }
            currentToolInput = "";
          }
        } else if (event.type === "assistant" && event.message?.content) {
          // Full assistant message — extract text blocks
          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              const last = transcript[transcript.length - 1];
              if (last?.type === "assistant") {
                last.content = block.text; // Replace with full text
              } else {
                transcript.push({ type: "assistant", content: block.text });
              }
            }
          }
        } else if (event.type === "tool_result" || event.type === "tool_use_summary") {
          const lastTool = [...transcript].reverse().find((b) => b.type === "tool" && !b.done);
          if (lastTool && lastTool.type === "tool") {
            lastTool.done = true;
          }
        } else if (event.type === "result") {
          if (event.total_cost_usd) {
            totalCostUsd += event.total_cost_usd;
          }
          if (event.session_id) {
            sessionId = event.session_id;
          }
        }
      }

      // Check if the agent needs more iterations by reading the progress file
      // In container mode, progress is written to workspace/progress.md
      const containerProgressFile = join(cronInstancePath, "workspace", "progress.md");
      const needsMore = existsSync(containerProgressFile) &&
        readFileSync(containerProgressFile, "utf-8").includes(CONTINUE_MARKER);

      // Also check the original progress file location
      const needsMoreOriginal = existsSync(progressFile) &&
        readFileSync(progressFile, "utf-8").includes(CONTINUE_MARKER);

      if (!needsMore && !needsMoreOriginal) {
        cronLog("info", `Task completed at iteration ${iteration}`, agentName, job.id);
        return { completed: true, iterations: iteration, totalCostUsd, transcript };
      }

      cronLog("info", `Agent requested continuation (${CONTINUE_MARKER} found in progress file)`, agentName, job.id);
    }

    cronLog("warn", `Max iterations (${job.maxIterations}) reached`, agentName, job.id);
    return { completed: false, iterations: job.maxIterations, totalCostUsd, transcript };
  } finally {
    clearRunningMarker(agentName, job.id);
  }
}
