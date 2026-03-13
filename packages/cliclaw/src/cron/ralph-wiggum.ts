import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync, writeFileSync, readFileSync, realpathSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { AgentStore, CronJobConfig } from "@cliclaw/auth";
import { getProgressFilePath, ensureCronDirs } from "./progress.js";
import { cronLog } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONTINUE_MARKER = "NEEDS_MORE_ITERATIONS";

export type TranscriptBlock =
  | { type: "assistant"; content: string }
  | { type: "tool"; name: string; input?: string; done: boolean };

export interface RalphWiggumResult {
  completed: boolean;
  iterations: number;
  totalCostUsd: number;
  transcript: TranscriptBlock[];
}

export async function executeRalphWiggumLoop(
  store: AgentStore,
  agentName: string,
  job: CronJobConfig,
): Promise<RalphWiggumResult> {
  ensureCronDirs(agentName, job.id);

  const workspacePath = store.workspacePath(agentName);
  const progressFile = getProgressFilePath(agentName, job.id);

  // Ensure cliclaw CLI is in PATH
  const cleanEnv = { ...process.env };
  delete cleanEnv.CLAUDECODE;

  const monorepoRoot = join(__dirname, "..", "..", "..");
  const binScript = join(monorepoRoot, "packages", "cliclaw", "dist", "cli.js");
  if (existsSync(binScript)) {
    const resolvedBin = realpathSync(binScript);
    const localBin = join(workspacePath, ".bin");
    if (!existsSync(localBin)) mkdirSync(localBin, { recursive: true });
    const wrapper = join(localBin, "cliclaw");
    writeFileSync(wrapper, `#!/bin/sh\nexec node "${resolvedBin}" "$@"\n`, { mode: 0o755 });
    cleanEnv.PATH = `${localBin}:${cleanEnv.PATH ?? ""}`;
  }

  let totalCostUsd = 0;
  let sessionId: string | undefined;
  const transcript: TranscriptBlock[] = [];

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
        `${job.task}`,
        ``,
        `Write your output/progress to: ${progressFile}`,
        ``,
        `If you CANNOT finish the task in this iteration and need to be re-invoked, write "${CONTINUE_MARKER}" anywhere in ${progressFile}. Otherwise, just complete the task normally — no special signal is needed.`,
      ].join("\n");
    } else {
      prompt = [
        `You are continuing a scheduled task. Read your progress file at: ${progressFile}`,
        `Continue from where you left off.`,
        ``,
        `Original task: ${job.task}`,
        ``,
        `If you CANNOT finish the task in this iteration and need to be re-invoked, write "${CONTINUE_MARKER}" anywhere in ${progressFile}. Otherwise, just complete the task normally — no special signal is needed.`,
      ].join("\n");
    }

    const conversation = query({
      prompt,
      options: {
        cwd: workspacePath,
        env: cleanEnv,
        systemPrompt: { type: "preset" as const, preset: "claude_code" as const },
        settingSources: ["project"],
        includePartialMessages: true,
        allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });

    let currentToolInput = "";

    for await (const event of conversation) {
      const msg = event as SDKMessage;

      if (msg.type === "stream_event" && (msg as any).event) {
        const streamEvent = (msg as any).event as {
          type: string;
          content_block?: { type: string; name?: string; id?: string };
          delta?: { type: string; text?: string; partial_json?: string };
        };

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
          // Attach parsed input to the last tool block
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
      } else if ((msg as any).type === "tool_result") {
        // Mark last pending tool as done
        const lastTool = [...transcript].reverse().find((b) => b.type === "tool" && !b.done);
        if (lastTool && lastTool.type === "tool") {
          lastTool.done = true;
        }
      } else if (msg.type === "result") {
        if ("total_cost_usd" in msg) {
          totalCostUsd += (msg.total_cost_usd as number) ?? 0;
        }
        if (msg.session_id) {
          sessionId = msg.session_id;
        }
      }
    }

    // Check if the agent needs more iterations by reading the progress file
    const needsMore = existsSync(progressFile) &&
      readFileSync(progressFile, "utf-8").includes(CONTINUE_MARKER);

    if (!needsMore) {
      cronLog("info", `Task completed at iteration ${iteration}`, agentName, job.id);
      return { completed: true, iterations: iteration, totalCostUsd, transcript };
    }

    cronLog("info", `Agent requested continuation (${CONTINUE_MARKER} found in progress file)`, agentName, job.id);
  }

  cronLog("warn", `Max iterations (${job.maxIterations}) reached`, agentName, job.id);
  return { completed: false, iterations: job.maxIterations, totalCostUsd, transcript };
}
