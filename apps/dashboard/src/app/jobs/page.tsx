import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { randomBytes } from "crypto";
import { existsSync, readdirSync, readFileSync, rmSync, unlinkSync } from "fs";
import { join } from "path";
import { revalidatePath } from "next/cache";
import { Separator } from "@/components/ui/separator";
import { JobsList } from "@/components/jobs-list";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";

type TranscriptBlock =
  | { type: "assistant"; content: string }
  | { type: "tool"; name: string; input?: string; done: boolean };

interface CronRunLog {
  jobId: string;
  agentName: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  completed: boolean;
  totalCostUsd: number;
  error?: string;
  transcript?: TranscriptBlock[];
}

async function addJob(agentName: string, schedule: string, task: string, maxIterations: number) {
  "use server";
  const store = new AgentStore(getAgentsDir());
  store.addCronJob(agentName, {
    id: randomBytes(6).toString("hex"),
    schedule,
    task,
    maxIterations,
    completionPromise: "TASK_COMPLETE",
    enabled: true,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/jobs");
}

async function removeJob(agentName: string, jobId: string) {
  "use server";
  const store = new AgentStore(getAgentsDir());
  store.removeCronJob(agentName, jobId);
  revalidatePath("/jobs");
}

async function toggleJob(agentName: string, jobId: string, enabled: boolean) {
  "use server";
  const store = new AgentStore(getAgentsDir());
  store.toggleCronJob(agentName, jobId, enabled);
  revalidatePath("/jobs");
}

async function runJob(agentName: string, jobId: string) {
  "use server";
  const child = spawn("cliclaw", ["cron", "run", agentName, jobId], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  revalidatePath("/jobs");
}

async function getRunLogs(agentName: string, jobId: string): Promise<{ logs: CronRunLog[]; progress: string | null }> {
  "use server";
  const agentsDir = getAgentsDir();
  const cronDir = join(agentsDir, agentName, "cron", jobId);
  const runsDir = join(cronDir, "runs");

  let logs: CronRunLog[] = [];
  if (existsSync(runsDir)) {
    logs = readdirSync(runsDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse()
      .slice(0, 10)
      .map((f) => {
        try {
          return JSON.parse(readFileSync(join(runsDir, f), "utf-8")) as CronRunLog;
        } catch {
          return null;
        }
      })
      .filter((l): l is CronRunLog => l !== null);
  }

  let progress: string | null = null;
  const progressPath = join(cronDir, "progress.md");
  if (existsSync(progressPath)) {
    progress = readFileSync(progressPath, "utf-8");
  }

  return { logs, progress };
}

async function deleteRunLogs(agentName: string, jobId: string) {
  "use server";
  const agentsDir = getAgentsDir();
  const runsDir = join(agentsDir, agentName, "cron", jobId, "runs");
  if (existsSync(runsDir)) {
    rmSync(runsDir, { recursive: true });
  }
  revalidatePath("/jobs");
}

async function deleteRunLog(agentName: string, jobId: string, startedAt: string) {
  "use server";
  const agentsDir = getAgentsDir();
  const runsDir = join(agentsDir, agentName, "cron", jobId, "runs");
  const filename = `${startedAt.replace(/[:.]/g, "-")}.json`;
  const filePath = join(runsDir, filename);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
  revalidatePath("/jobs");
}

export default async function JobsPage() {
  const store = new AgentStore(getAgentsDir());
  const agents = store.list();

  const jobs = agents.flatMap((agent) =>
    (agent.cronJobs ?? []).map((job) => ({
      agentName: agent.name,
      agentDisplayName: agent.displayName,
      job,
    }))
  );

  const agentOptions = agents.map((a) => ({
    name: a.name,
    displayName: a.displayName,
  }));

  return (
    <div>
      {/* Header */}
      <div className="mb-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-light tracking-wide text-foreground">Jobs</h1>
          <span className="font-mono text-[10px] text-muted-foreground tracking-wider mt-1">
            / SCHEDULED TASKS
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Manage scheduled cron jobs across all agents.
        </p>
      </div>

      <Separator className="bg-border mb-8" />

      <div className="animate-fade-in-up" style={{ animationDelay: "100ms" }}>
        <JobsList
          jobs={jobs}
          agents={agentOptions}
          addAction={addJob}
          removeAction={removeJob}
          toggleAction={toggleJob}
          runAction={runJob}
          getRunLogs={getRunLogs}
          deleteRunLogs={deleteRunLogs}
          deleteRunLog={deleteRunLog}
        />
      </div>
    </div>
  );
}
