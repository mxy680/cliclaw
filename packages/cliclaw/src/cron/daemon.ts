import cron from "node-cron";
import { existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import type { AgentStore, CronJobConfig } from "@cliclaw/auth";
import { getAgentsDir } from "@cliclaw/auth";
import { executeRalphWiggumLoop } from "./ralph-wiggum.js";
import { writeRunLog, type CronRunLog } from "./progress.js";
import { cronLog } from "./logger.js";

const PID_FILE = join(getAgentsDir(), "..", "cron.pid");
const SYNC_INTERVAL_MS = 30_000;

type ScheduleKey = string; // "{agent}:{jobId}"

function scheduleKey(agent: string, jobId: string): ScheduleKey {
  return `${agent}:${jobId}`;
}

export async function startDaemon(store: AgentStore): Promise<void> {
  // Prevent duplicate daemons
  if (existsSync(PID_FILE)) {
    const existingPid = readFileSync(PID_FILE, "utf-8").trim();
    try {
      process.kill(parseInt(existingPid, 10), 0);
      cronLog("error", `Daemon already running (PID ${existingPid})`);
      process.exit(1);
    } catch {
      // PID file stale, continue
    }
  }

  writeFileSync(PID_FILE, String(process.pid), "utf-8");
  cronLog("info", `Cron daemon started (PID ${process.pid})`);

  const schedules = new Map<ScheduleKey, cron.ScheduledTask>();
  const running = new Set<ScheduleKey>();

  function scheduleJob(agentName: string, job: CronJobConfig): void {
    const key = scheduleKey(agentName, job.id);
    if (schedules.has(key)) return;

    if (!cron.validate(job.schedule)) {
      cronLog("error", `Invalid cron expression: ${job.schedule}`, agentName, job.id);
      return;
    }

    const task = cron.schedule(job.schedule, async () => {
      if (running.has(key)) {
        cronLog("warn", "Skipping: previous run still active", agentName, job.id);
        return;
      }

      running.add(key);
      cronLog("info", `Executing: ${job.task}`, agentName, job.id);
      const startedAt = new Date().toISOString();

      try {
        const result = await executeRalphWiggumLoop(store, agentName, job);
        const log: CronRunLog = {
          jobId: job.id,
          agentName,
          startedAt,
          finishedAt: new Date().toISOString(),
          iterations: result.iterations,
          completed: result.completed,
          totalCostUsd: result.totalCostUsd,
        };
        writeRunLog(agentName, job.id, log);
        cronLog("info", `Finished: ${result.completed ? "completed" : "incomplete"} in ${result.iterations} iterations`, agentName, job.id);
      } catch (err) {
        const log: CronRunLog = {
          jobId: job.id,
          agentName,
          startedAt,
          finishedAt: new Date().toISOString(),
          iterations: 0,
          completed: false,
          totalCostUsd: 0,
          error: err instanceof Error ? err.message : String(err),
        };
        writeRunLog(agentName, job.id, log);
        cronLog("error", `Failed: ${log.error}`, agentName, job.id);
      } finally {
        running.delete(key);
      }
    });

    schedules.set(key, task);
    cronLog("info", `Scheduled: "${job.task}" at ${job.schedule}`, agentName, job.id);
  }

  function syncSchedules(): void {
    const agents = store.list();
    const activeKeys = new Set<ScheduleKey>();

    for (const agent of agents) {
      for (const job of agent.cronJobs) {
        const key = scheduleKey(agent.name, job.id);
        if (job.enabled) {
          activeKeys.add(key);
          scheduleJob(agent.name, job);
        }
      }
    }

    // Remove schedules for deleted/disabled jobs
    for (const [key, task] of schedules) {
      if (!activeKeys.has(key)) {
        task.stop();
        schedules.delete(key);
        cronLog("info", `Unscheduled: ${key}`);
      }
    }
  }

  // Initial sync
  syncSchedules();

  // Periodic sync
  const syncTimer = setInterval(syncSchedules, SYNC_INTERVAL_MS);

  // Graceful shutdown
  function cleanup(): void {
    cronLog("info", "Shutting down cron daemon");
    clearInterval(syncTimer);
    for (const [, task] of schedules) {
      task.stop();
    }
    schedules.clear();
    try {
      unlinkSync(PID_FILE);
    } catch {
      // ignore
    }
    process.exit(0);
  }

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);

  cronLog("info", `Daemon running. ${schedules.size} job(s) scheduled. Syncing every ${SYNC_INTERVAL_MS / 1000}s.`);
}
