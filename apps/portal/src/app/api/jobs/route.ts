import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { requireAuth } from "@/lib/auth";
import { getStmts } from "@/lib/db-statements";
import { errorResponse } from "@/lib/errors";
import { getAgentStore } from "@/lib/agents";
import { getAgentsDir } from "@digitalpresence/cliclaw-auth";

export const dynamic = "force-dynamic";

interface RunLog {
  jobId: string;
  agentName: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  completed: boolean;
  totalCostUsd: number;
  error?: string;
  report?: string;
}

function getRecentRuns(agentsDir: string, agentName: string, jobId: string, limit = 5): RunLog[] {
  const runsDir = join(agentsDir, agentName, "cron", jobId, "runs");
  if (!existsSync(runsDir)) return [];
  const files = readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .reverse()
    .slice(0, limit);
  const results: RunLog[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(readFileSync(join(runsDir, f), "utf-8"));
      results.push({
        jobId: raw.jobId,
        agentName: raw.agentName,
        startedAt: raw.startedAt,
        finishedAt: raw.finishedAt,
        iterations: raw.iterations,
        completed: raw.completed,
        totalCostUsd: raw.totalCostUsd,
        error: raw.error,
        report: raw.report || undefined,
      });
    } catch { /* skip malformed */ }
  }
  return results;
}

function isRunning(agentsDir: string, agentName: string, jobId: string): boolean {
  const markerPath = join(agentsDir, agentName, "cron", jobId, "running.json");
  if (!existsSync(markerPath)) return false;
  try {
    const marker = JSON.parse(readFileSync(markerPath, "utf-8"));
    process.kill(marker.pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    const user = await requireAuth();

    const accessRows = getStmts().getUserAccess.all(user.id) as { agent_name: string }[];
    const accessSet = new Set(accessRows.map((r) => r.agent_name));

    const allAgents = getAgentStore().list();
    const agentsDir = getAgentsDir();

    const jobs = [];
    for (const agent of allAgents) {
      if (!accessSet.has(agent.name)) continue;
      for (const job of agent.cronJobs || []) {
        jobs.push({
          id: job.id,
          agentName: agent.name,
          agentDisplayName: agent.displayName,
          schedule: job.schedule,
          taskFile: job.taskFile,
          enabled: job.enabled,
          maxIterations: job.maxIterations,
          running: isRunning(agentsDir, agent.name, job.id),
          recentRuns: getRecentRuns(agentsDir, agent.name, job.id),
        });
      }
    }

    return Response.json({ jobs });
  } catch (err) {
    return errorResponse(err);
  }
}
