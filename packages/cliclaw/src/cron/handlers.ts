import { randomBytes } from "crypto";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import type { AgentStore, CronJobConfig } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleCronAdd(
  store: AgentStore,
  agentName: string,
  schedule: string,
  taskFile: string,
  taskContent: string,
  maxIterations: number,
): Promise<void> {
  const agent = store.get(agentName);
  if (!agent) outputError("agent_not_found", `Agent "${agentName}" not found`);

  const jobId = randomBytes(6).toString("hex");

  // Write task markdown file
  const cronTasksDir = join(store.workspacePath(agentName), "cron-tasks");
  if (!existsSync(cronTasksDir)) {
    mkdirSync(cronTasksDir, { recursive: true });
  }
  const taskFilePath = taskFile || `${jobId}.md`;
  writeFileSync(join(cronTasksDir, taskFilePath), taskContent, "utf-8");

  const job: CronJobConfig = {
    id: jobId,
    schedule,
    taskFile: taskFilePath,
    maxIterations,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  store.addCronJob(agentName, job);
  outputJson({ status: "added", jobId: job.id, schedule, taskFile: taskFilePath });
}

export async function handleCronRemove(
  store: AgentStore,
  agentName: string,
  jobId: string,
): Promise<void> {
  try {
    store.removeCronJob(agentName, jobId);
    outputJson({ status: "removed", jobId });
  } catch (err) {
    outputError("cron_error", err instanceof Error ? err.message : String(err));
  }
}

export async function handleCronList(
  store: AgentStore,
  agentName?: string,
): Promise<void> {
  if (agentName) {
    try {
      const jobs = store.listCronJobs(agentName);
      outputJson(jobs);
    } catch (err) {
      outputError("cron_error", err instanceof Error ? err.message : String(err));
    }
  } else {
    const agents = store.list();
    const result = agents
      .filter((a) => a.cronJobs.length > 0)
      .map((a) => ({
        agent: a.name,
        jobs: a.cronJobs,
      }));
    outputJson(result);
  }
}

export async function handleCronToggle(
  store: AgentStore,
  agentName: string,
  jobId: string,
  enabled: boolean,
): Promise<void> {
  try {
    store.toggleCronJob(agentName, jobId, enabled);
    outputJson({ status: enabled ? "enabled" : "disabled", jobId });
  } catch (err) {
    outputError("cron_error", err instanceof Error ? err.message : String(err));
  }
}
