"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import cronstrue from "cronstrue";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { CronJobConfig } from "@cliclaw/auth";

interface CronRunLog {
  jobId: string;
  agentName: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  completed: boolean;
  totalCostUsd: number;
  error?: string;
}

interface JobWithAgent {
  agentName: string;
  agentDisplayName: string;
  job: CronJobConfig;
}

interface JobsListProps {
  jobs: JobWithAgent[];
  agents: { name: string; displayName: string }[];
  addAction: (agentName: string, schedule: string, task: string, maxIterations: number) => Promise<void>;
  removeAction: (agentName: string, jobId: string) => Promise<void>;
  toggleAction: (agentName: string, jobId: string, enabled: boolean) => Promise<void>;
  runAction: (agentName: string, jobId: string) => Promise<void>;
  getRunLogs: (agentName: string, jobId: string) => Promise<{ logs: CronRunLog[]; progress: string | null }>;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

function humanCron(schedule: string): string | null {
  try {
    return cronstrue.toString(schedule, { use24HourTimeFormat: false });
  } catch {
    return null;
  }
}

export function JobsList({ jobs, agents, addAction, removeAction, toggleAction, runAction, getRunLogs }: JobsListProps) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [agentName, setAgentName] = useState(agents[0]?.name ?? "");
  const [schedule, setSchedule] = useState("");
  const [task, setTask] = useState("");
  const [maxIterations, setMaxIterations] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runData, setRunData] = useState<Record<string, { logs: CronRunLog[]; progress: string | null }>>({});
  const [loadingRuns, setLoadingRuns] = useState<string | null>(null);
  const [showProgress, setShowProgress] = useState<Record<string, boolean>>({});

  async function handleAdd() {
    if (!agentName || !schedule.trim() || !task.trim()) return;
    setSubmitting(true);
    await addAction(agentName, schedule.trim(), task.trim(), maxIterations);
    setAdding(false);
    setSchedule("");
    setTask("");
    setMaxIterations(10);
    setSubmitting(false);
    router.refresh();
  }

  async function handleToggle(agent: string, jobId: string, enabled: boolean) {
    setTogglingId(jobId);
    await toggleAction(agent, jobId, enabled);
    router.refresh();
    setTogglingId(null);
  }

  async function handleRemove(agent: string, jobId: string) {
    setRemovingId(jobId);
    await removeAction(agent, jobId);
    router.refresh();
    setRemovingId(null);
  }

  async function handleRun(agent: string, jobId: string) {
    setRunningId(jobId);
    await runAction(agent, jobId);
    setTimeout(() => setRunningId(null), 1500);
  }

  async function handleExpand(agent: string, jobId: string) {
    if (expandedId === jobId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(jobId);
    setLoadingRuns(jobId);
    const data = await getRunLogs(agent, jobId);
    setRunData((prev) => ({ ...prev, [jobId]: data }));
    setLoadingRuns(null);
  }

  return (
    <div>
      {/* Actions bar */}
      <div className="mb-6">
        {adding ? (
          <div className="border border-border rounded-sm p-5 bg-surface-raised space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase">
                New Job
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase block mb-1.5">
                  Agent
                </label>
                <select
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="w-full h-9 px-3 rounded-sm border border-border bg-input font-mono text-sm text-foreground focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/20"
                >
                  {agents.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.displayName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase block mb-1.5">
                  Schedule
                </label>
                <Input
                  type="text"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="*/30 * * * *"
                  className="font-mono text-sm bg-input border-border focus:border-amber focus:ring-amber/20"
                />
              </div>
            </div>

            <div>
              <label className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase block mb-1.5">
                Task
              </label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder="Describe what this job should do..."
                rows={3}
                className="w-full px-3 py-2 rounded-sm border border-border bg-input font-mono text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/20 resize-none"
              />
            </div>

            <div className="w-32">
              <label className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase block mb-1.5">
                Max Iterations
              </label>
              <Input
                type="number"
                value={maxIterations}
                onChange={(e) => setMaxIterations(Number(e.target.value))}
                min={1}
                max={100}
                className="font-mono text-sm bg-input border-border focus:border-amber focus:ring-amber/20"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleAdd}
                disabled={submitting || !agentName || !schedule.trim() || !task.trim()}
                size="sm"
                className="bg-amber text-background hover:bg-amber/90 font-mono text-xs tracking-wider uppercase"
              >
                {submitting ? "Adding..." : "Add Job"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setAdding(false); setSchedule(""); setTask(""); setMaxIterations(10); }}
                className="font-mono text-xs text-muted-foreground"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={() => setAdding(true)}
            variant="outline"
            size="sm"
            className="font-mono text-xs tracking-wider uppercase border-border hover:border-amber/40 hover:text-amber"
          >
            + Add Job
          </Button>
        )}
      </div>

      {/* Job list */}
      {jobs.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm py-12 flex flex-col items-center gap-3">
          <div className="size-2 rounded-full bg-muted-foreground/30" />
          <p className="font-mono text-xs text-muted-foreground tracking-wider uppercase">
            No scheduled jobs
          </p>
          <p className="text-sm text-muted-foreground">
            Add a job to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {jobs.map(({ agentName: agent, agentDisplayName, job }, i) => {
            const human = humanCron(job.schedule);
            const isExpanded = expandedId === job.id;
            const data = runData[job.id];

            return (
              <div
                key={job.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div
                  className={`group relative flex items-center justify-between py-3 px-4 bg-surface-raised border border-border rounded-sm hover:border-amber/20 transition-all duration-200 cursor-pointer ${isExpanded ? "border-amber/30" : ""}`}
                  onClick={() => handleExpand(agent, job.id)}
                >
                  {/* Left accent */}
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-amber/0 group-hover:bg-amber/50 transition-colors duration-300" />

                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`size-1.5 rounded-full flex-shrink-0 ${job.enabled ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />

                    <Badge variant="secondary" className="font-mono text-[10px] text-muted-foreground bg-muted border-0 flex-shrink-0">
                      {agentDisplayName}
                    </Badge>

                    <div className="flex flex-col gap-0 flex-shrink-0">
                      <span className="font-mono text-[11px] text-amber/70">
                        {job.schedule}
                      </span>
                      {human && (
                        <span className="font-mono text-[10px] text-muted-foreground/60">
                          {human}
                        </span>
                      )}
                    </div>

                    <span className="text-sm text-foreground truncate">
                      {job.task}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleToggle(agent, job.id, !job.enabled)}
                      disabled={togglingId === job.id}
                      className="font-mono text-[10px] text-muted-foreground hover:text-amber tracking-wider uppercase"
                    >
                      {togglingId === job.id ? "..." : job.enabled ? "Disable" : "Enable"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRun(agent, job.id)}
                      disabled={runningId === job.id}
                      className="font-mono text-[10px] text-amber hover:text-amber/80 tracking-wider uppercase"
                    >
                      {runningId === job.id ? "Running..." : "Run"}
                    </Button>

                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemove(agent, job.id)}
                      disabled={removingId === job.id}
                      className="font-mono text-[10px] text-muted-foreground hover:text-destructive tracking-wider uppercase opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      {removingId === job.id ? "..." : "Remove"}
                    </Button>
                  </div>
                </div>

                {/* Expanded run history panel */}
                {isExpanded && (
                  <div className="border border-t-0 border-border rounded-b-sm bg-surface-raised/50 px-4 py-4 space-y-4">
                    {loadingRuns === job.id ? (
                      <p className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
                        Loading...
                      </p>
                    ) : data && data.logs.length > 0 ? (
                      <>
                        <div>
                          <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase">
                            Recent Runs
                          </span>
                          <div className="mt-2 space-y-1">
                            {data.logs.map((log) => (
                              <div
                                key={log.startedAt}
                                className="flex items-center gap-4 py-1.5 px-3 rounded-sm bg-muted/30 font-mono text-[11px]"
                              >
                                <span className="text-muted-foreground w-36 flex-shrink-0">
                                  {new Date(log.startedAt).toLocaleString()}
                                </span>
                                <span className="text-muted-foreground/70 w-16 flex-shrink-0">
                                  {formatDuration(log.startedAt, log.finishedAt)}
                                </span>
                                <span className="text-muted-foreground/70 w-20 flex-shrink-0">
                                  {log.iterations} iter
                                </span>
                                <span className={`w-20 flex-shrink-0 ${log.completed ? "text-emerald-500" : "text-destructive"}`}>
                                  {log.completed ? "completed" : log.error ? "failed" : "incomplete"}
                                </span>
                                <span className="text-amber/60">
                                  ${log.totalCostUsd.toFixed(2)}
                                </span>
                                {log.error && (
                                  <span className="text-destructive/70 truncate ml-auto">
                                    {log.error}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {data.progress && (
                          <div>
                            <button
                              onClick={() => setShowProgress((prev) => ({ ...prev, [job.id]: !prev[job.id] }))}
                              className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase hover:text-amber transition-colors cursor-pointer"
                            >
                              {showProgress[job.id] ? "Hide Progress" : "Show Progress"}
                            </button>
                            {showProgress[job.id] && (
                              <div className="mt-2 p-3 rounded-sm bg-muted/30 border border-border prose prose-sm prose-invert max-w-none font-mono text-xs">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {data.progress}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
                        No runs yet
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
