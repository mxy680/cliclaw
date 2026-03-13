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
  deleteRunLogs: (agentName: string, jobId: string) => Promise<void>;
  deleteRunLog: (agentName: string, jobId: string, startedAt: string) => Promise<void>;
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

function formatToolInput(name: string, input?: string): string {
  if (!input) return name;
  try {
    const parsed = JSON.parse(input);
    if (name === "Bash" && parsed.command) return parsed.command;
    if (name === "Read" && parsed.file_path) return `Read ${parsed.file_path}`;
    if (name === "Write" && parsed.file_path) return `Write ${parsed.file_path}`;
    if (name === "Edit" && parsed.file_path) return `Edit ${parsed.file_path}`;
    if (name === "Glob" && parsed.pattern) return `Glob ${parsed.pattern}`;
    if (name === "Grep" && parsed.pattern) return `Grep "${parsed.pattern}"`;
    return `${name} ${JSON.stringify(parsed)}`;
  } catch {
    return name;
  }
}

export function JobsList({ jobs, agents, addAction, removeAction, toggleAction, runAction, getRunLogs, deleteRunLogs, deleteRunLog }: JobsListProps) {
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
  const [expandedRun, setExpandedRun] = useState<string | null>(null);

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

  async function handleDeleteRun(agent: string, jobId: string, startedAt: string) {
    await deleteRunLog(agent, jobId, startedAt);
    setRunData((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        logs: prev[jobId]?.logs.filter((l) => l.startedAt !== startedAt) ?? [],
      },
    }));
    if (expandedRun === startedAt) setExpandedRun(null);
    router.refresh();
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

                  <div className="flex items-center gap-1 flex-shrink-0 ml-4" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleToggle(agent, job.id, !job.enabled)}
                      disabled={togglingId === job.id}
                      className="text-muted-foreground hover:text-amber p-1.5"
                      title={job.enabled ? "Pause" : "Resume"}
                    >
                      {togglingId === job.id ? (
                        <span className="text-[10px]">...</span>
                      ) : job.enabled ? (
                        <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>
                      ) : (
                        <svg className="size-3.5" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5a.5.5 0 01.77-.42l9 5.5a.5.5 0 010 .84l-9 5.5A.5.5 0 014 13.5V2.5z" /></svg>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRun(agent, job.id)}
                      disabled={runningId === job.id}
                      className="text-amber hover:text-amber/80 p-1.5"
                      title="Run now"
                    >
                      {runningId === job.id ? (
                        <svg className="size-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="6" strokeDasharray="28" strokeDashoffset="8" /></svg>
                      ) : (
                        <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 2.5a.5.5 0 01.77-.42l9 5.5a.5.5 0 010 .84l-9 5.5A.5.5 0 014 13.5V2.5z" fill="currentColor" /></svg>
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemove(agent, job.id)}
                      disabled={removingId === job.id}
                      className="text-muted-foreground hover:text-destructive p-1.5"
                      title="Delete job"
                    >
                      {removingId === job.id ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" /></svg>
                      )}
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
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase">
                              Recent Runs
                            </span>
                            <button
                              onClick={async () => {
                                await deleteRunLogs(agent, job.id);
                                setRunData((prev) => ({ ...prev, [job.id]: { logs: [], progress: prev[job.id]?.progress ?? null } }));
                                setExpandedRun(null);
                                router.refresh();
                              }}
                              className="font-mono text-[10px] text-muted-foreground hover:text-destructive tracking-[0.15em] uppercase transition-colors cursor-pointer"
                            >
                              Clear runs
                            </button>
                          </div>
                          <div className="space-y-1">
                            {data.logs.map((log) => {
                              const isRunExpanded = expandedRun === log.startedAt;
                              return (
                                <div key={log.startedAt}>
                                  <div
                                    className={`flex items-center gap-4 py-1.5 px-3 rounded-sm bg-muted/30 font-mono text-[11px] cursor-pointer hover:bg-muted/50 transition-colors ${isRunExpanded ? "bg-muted/50 border-l-2 border-l-amber/40" : ""}`}
                                    onClick={() => setExpandedRun(isRunExpanded ? null : log.startedAt)}
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
                                    {log.error && (
                                      <span className="text-destructive/70 truncate flex-1">
                                        {log.error}
                                      </span>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteRun(agent, job.id, log.startedAt);
                                      }}
                                      className="text-muted-foreground/40 hover:text-destructive transition-colors p-0.5 flex-shrink-0"
                                      title="Delete run"
                                    >
                                      <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4m2 0v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" /></svg>
                                    </button>
                                  </div>

                                  {/* Expanded transcript */}
                                  {isRunExpanded && log.transcript && log.transcript.length > 0 && (
                                    <div className="ml-4 mt-2 mb-3 space-y-2 border-l-2 border-border/50 pl-4">
                                      {log.transcript.map((block, bi) => {
                                        if (block.type === "tool") {
                                          const label = formatToolInput(block.name, block.input);
                                          return (
                                            <div key={bi} className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/20 border border-border/50 rounded-sm font-mono text-[11px] text-muted-foreground">
                                              <svg className="size-3 text-amber/60" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M3 8.5l3.5 3.5 6.5-7" />
                                              </svg>
                                              <span className="text-amber/50">{block.name}</span>
                                              <span className="text-foreground/70 max-w-lg truncate">{label !== block.name ? label : ""}</span>
                                            </div>
                                          );
                                        }
                                        // assistant
                                        return (
                                          <div key={bi} className="rounded-sm px-4 py-3 bg-card border border-border">
                                            <div className="text-sm font-mono leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-foreground prose-headings:font-mono prose-headings:mt-3 prose-headings:mb-1.5 prose-strong:text-amber/90 prose-code:text-amber/80 prose-code:bg-amber/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-border prose-pre:rounded-sm prose-a:text-amber/70 prose-a:no-underline hover:prose-a:text-amber">
                                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.content}</ReactMarkdown>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {isRunExpanded && (!log.transcript || log.transcript.length === 0) && (
                                    <div className="ml-4 mt-2 mb-3 pl-4 border-l-2 border-border/50">
                                      <p className="font-mono text-[10px] text-muted-foreground/50 tracking-wider uppercase">
                                        No transcript available
                                      </p>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {data.progress && (
                          <div>
                            <button
                              onClick={() => setShowProgress((prev) => ({ ...prev, [job.id]: !prev[job.id] }))}
                              className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase hover:text-amber transition-colors cursor-pointer"
                            >
                              {showProgress[job.id] ? "Hide Prompt" : "Prompt"}
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
