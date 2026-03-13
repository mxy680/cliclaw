import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, mkdirSync, writeFileSync, realpathSync } from "fs";
import { join } from "path";
import type { AgentStore, CronJobConfig } from "@cliclaw/auth";
import { getProgressFilePath, ensureCronDirs } from "./progress.js";
import { cronLog } from "./logger.js";

export interface RalphWiggumResult {
  completed: boolean;
  iterations: number;
  totalCostUsd: number;
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
  let completed = false;
  let sessionId: string | undefined;

  for (let iteration = 1; iteration <= job.maxIterations; iteration++) {
    cronLog("info", `Iteration ${iteration}/${job.maxIterations}`, agentName, job.id);

    let prompt: string;
    if (iteration === 1) {
      prompt = [
        `You are executing a scheduled task. Here are your instructions:`,
        ``,
        `${job.task}`,
        ``,
        `Write your progress notes to: ${progressFile}`,
        `When you have fully completed the task, output the word "${job.completionPromise}" in your response.`,
        `If you cannot finish in this iteration, write your progress to the file above and stop. You will be re-invoked to continue.`,
      ].join("\n");
    } else {
      prompt = [
        `You are continuing a scheduled task. Read your progress file at: ${progressFile}`,
        `Continue from where you left off.`,
        ``,
        `Original task: ${job.task}`,
        ``,
        `When you have fully completed the task, output the word "${job.completionPromise}" in your response.`,
        `If you cannot finish in this iteration, update your progress file and stop.`,
      ].join("\n");
    }

    let iterationText = "";

    const conversation = query({
      prompt,
      options: {
        cwd: workspacePath,
        env: cleanEnv,
        systemPrompt: { type: "preset" as const, preset: "claude_code" as const },
        settingSources: ["project"],
        allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
        ...(sessionId ? { resume: sessionId } : {}),
      },
    });

    for await (const event of conversation) {
      const msg = event as SDKMessage;

      if (msg.type === "stream_event" && msg.event) {
        const streamEvent = msg.event as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (
          streamEvent.type === "content_block_delta" &&
          streamEvent.delta?.type === "text_delta" &&
          streamEvent.delta.text
        ) {
          iterationText += streamEvent.delta.text;
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

    if (iterationText.includes(job.completionPromise)) {
      cronLog("info", `Task completed at iteration ${iteration}`, agentName, job.id);
      completed = true;
      return { completed, iterations: iteration, totalCostUsd };
    }
  }

  cronLog("warn", `Max iterations (${job.maxIterations}) reached without completion`, agentName, job.id);
  return { completed, iterations: job.maxIterations, totalCostUsd };
}
