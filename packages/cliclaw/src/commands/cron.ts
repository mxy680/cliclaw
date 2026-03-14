import { Command } from "commander";
import type { AgentStore } from "@digitalpresence/cliclaw-auth";
import {
  handleCronAdd,
  handleCronRemove,
  handleCronList,
  handleCronToggle,
} from "../cron/handlers.js";
import { startDaemon } from "../cron/daemon.js";
import { executeRalphWiggumLoop } from "../cron/ralph-wiggum.js";
import { writeRunLog, type CronRunLog } from "../cron/progress.js";
import { cronLog } from "../cron/logger.js";
import { outputJson, outputError } from "../lib/output.js";

type AgentStoreFactory = () => AgentStore;

export function registerCronCommands(program: Command, getAgentStore: AgentStoreFactory): void {
  const cron = program.command("cron").description("Manage scheduled cron jobs");

  cron
    .command("add")
    .description("Add a cron job to an agent")
    .argument("<agent>", "Agent name")
    .requiredOption("--schedule <schedule>", "Cron expression (e.g. \"0 9 * * *\")")
    .requiredOption("--task <task>", "Task description (written to markdown file)")
    .option("--task-file <taskFile>", "Custom task file name (default: {jobId}.md)")
    .option("--max-iterations <n>", "Maximum loop iterations", "10")
    .action(async (agent, opts) => {
      await handleCronAdd(
        getAgentStore(),
        agent,
        opts.schedule,
        opts.taskFile || "",
        opts.task,
        parseInt(opts.maxIterations, 10),
      );
    });

  cron
    .command("remove")
    .description("Remove a cron job")
    .argument("<agent>", "Agent name")
    .argument("<jobId>", "Job ID")
    .action(async (agent, jobId) => {
      await handleCronRemove(getAgentStore(), agent, jobId);
    });

  cron
    .command("list")
    .description("List cron jobs")
    .argument("[agent]", "Agent name (optional, lists all if omitted)")
    .action(async (agent) => {
      await handleCronList(getAgentStore(), agent);
    });

  cron
    .command("enable")
    .description("Enable a cron job")
    .argument("<agent>", "Agent name")
    .argument("<jobId>", "Job ID")
    .action(async (agent, jobId) => {
      await handleCronToggle(getAgentStore(), agent, jobId, true);
    });

  cron
    .command("disable")
    .description("Disable a cron job")
    .argument("<agent>", "Agent name")
    .argument("<jobId>", "Job ID")
    .action(async (agent, jobId) => {
      await handleCronToggle(getAgentStore(), agent, jobId, false);
    });

  cron
    .command("start")
    .description("Start the cron daemon")
    .action(async () => {
      await startDaemon(getAgentStore());
    });

  cron
    .command("run")
    .description("Manually trigger a cron job")
    .argument("<agent>", "Agent name")
    .argument("<jobId>", "Job ID")
    .action(async (agent, jobId) => {
      const store = getAgentStore();
      const config = store.get(agent);
      if (!config) outputError("agent_not_found", `Agent "${agent}" not found`);

      const job = config!.cronJobs.find((j) => j.id === jobId);
      if (!job) outputError("job_not_found", `Job "${jobId}" not found`);

      cronLog("info", `Manual trigger: ${job!.taskFile}`, agent, jobId);

      const startedAt = new Date().toISOString();
      try {
        const result = await executeRalphWiggumLoop(store, agent, job!, startedAt);
        const log: CronRunLog = {
          jobId,
          agentName: agent,
          startedAt,
          finishedAt: new Date().toISOString(),
          iterations: result.iterations,
          completed: result.completed,
          totalCostUsd: result.totalCostUsd,
          report: result.report,
          transcript: result.transcript,
        };
        writeRunLog(agent, jobId, log);
        outputJson(log);
      } catch (err) {
        const log: CronRunLog = {
          jobId,
          agentName: agent,
          startedAt,
          finishedAt: new Date().toISOString(),
          iterations: 0,
          completed: false,
          totalCostUsd: 0,
          error: err instanceof Error ? err.message : String(err),
        };
        writeRunLog(agent, jobId, log);
        outputError("cron_run_error", log.error!);
      }
    });
}
