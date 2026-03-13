import { randomBytes } from "crypto";
import type { AgentStore, CronJobConfig } from "@cliclaw/auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleCronAdd(
  store: AgentStore,
  agentName: string,
  schedule: string,
  task: string,
  maxIterations: number,
  completionPromise: string,
): Promise<void> {
  const agent = store.get(agentName);
  if (!agent) outputError("agent_not_found", `Agent "${agentName}" not found`);

  const job: CronJobConfig = {
    id: randomBytes(6).toString("hex"),
    schedule,
    task,
    maxIterations,
    completionPromise,
    enabled: true,
    createdAt: new Date().toISOString(),
  };

  store.addCronJob(agentName, job);
  outputJson({ status: "added", jobId: job.id, schedule, task });
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
