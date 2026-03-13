import { AgentStore, getAgentsDir } from "@cliclaw/auth";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { Separator } from "@/components/ui/separator";
import { JobsList } from "@/components/jobs-list";

export const dynamic = "force-dynamic";

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
        />
      </div>
    </div>
  );
}
