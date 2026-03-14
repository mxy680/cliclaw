"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface RunLog {
  jobId: string;
  agentName: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  completed: boolean;
  totalCostUsd: number;
  error?: string;
  output?: string;
}

interface Job {
  id: string;
  agentName: string;
  agentDisplayName: string;
  schedule: string;
  taskFile: string;
  enabled: boolean;
  maxIterations: number;
  running: boolean;
  recentRuns: RunLog[];
}

function formatSchedule(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length !== 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const time = `${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;

  if (dom === "*" && mon === "*" && dow === "*") return `Daily at ${time}`;
  if (dom === "*" && mon === "*" && dow !== "*") {
    const dayNames = dow.split(",").map((d) => days[parseInt(d)] || d).join(", ");
    return `${dayNames} at ${time}`;
  }
  return `${cron} (${time})`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function RunEntry({ run }: { run: RunLog }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => run.output && setExpanded(!expanded)}
        className={`flex items-center gap-3 text-xs font-mono w-full text-left ${
          run.output ? "cursor-pointer hover:bg-white/[0.02] -mx-1 px-1 rounded" : ""
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            run.error
              ? "bg-red-500"
              : run.completed
              ? "bg-green-500"
              : "bg-amber"
          }`}
        />
        <span className="text-muted-foreground w-16 flex-shrink-0">
          {timeAgo(run.startedAt)}
        </span>
        <span className="text-foreground/70">
          {run.iterations} iter{run.iterations !== 1 ? "s" : ""}
        </span>
        {run.error && (
          <span className="text-red-400 truncate max-w-[200px]" title={run.error}>
            {run.error}
          </span>
        )}
        {run.output && (
          <span className="text-muted-foreground/40 ml-auto">
            {expanded ? "▾" : "▸"}
          </span>
        )}
      </button>
      {expanded && run.output && (
        <div className="mt-2 ml-5 p-3 rounded border border-border/30 bg-black/20 text-xs text-foreground/80 whitespace-pre-wrap font-mono max-h-[400px] overflow-y-auto">
          {run.output}
        </div>
      )}
    </div>
  );
}

function RunHistory({ runs }: { runs: RunLog[] }) {
  if (runs.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No runs yet</p>;
  }

  return (
    <div className="space-y-1.5">
      {runs.map((run, i) => (
        <RunEntry key={i} run={run} />
      ))}
    </div>
  );
}

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringJobs, setTriggeringJobs] = useState<Set<string>>(new Set());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchJobs().finally(() => setLoading(false));
  }, [fetchJobs]);

  // Poll while any job is running
  useEffect(() => {
    const anyRunning = jobs.some((j) => j.running) || triggeringJobs.size > 0;
    if (anyRunning && !pollRef.current) {
      pollRef.current = setInterval(fetchJobs, 5000);
    } else if (!anyRunning && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobs, triggeringJobs, fetchJobs]);

  async function clearRuns(agentName: string, jobId: string) {
    try {
      await fetch("/api/jobs/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, jobId }),
      });
      await fetchJobs();
    } catch {}
  }

  async function triggerJob(agentName: string, jobId: string) {
    const key = `${agentName}:${jobId}`;
    setTriggeringJobs((prev) => new Set(prev).add(key));

    try {
      const res = await fetch("/api/jobs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName, jobId }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error("Failed to trigger job:", data.error);
      }
      // Refresh immediately, then polling takes over
      await fetchJobs();
    } catch (err) {
      console.error("Failed to trigger job:", err);
    } finally {
      // Keep in triggering state briefly so polling starts
      setTimeout(() => {
        setTriggeringJobs((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 10000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground font-mono">Loading jobs...</p>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No scheduled jobs</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Jobs are created when agents have cron tasks configured
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const key = `${job.agentName}:${job.id}`;
        const isTriggering = triggeringJobs.has(key);

        return (
          <div
            key={key}
            className="border border-border rounded-sm bg-card p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono text-sm font-semibold text-foreground">
                    {job.agentDisplayName}
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    {job.id}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatSchedule(job.schedule)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => triggerJob(job.agentName, job.id)}
                  disabled={job.running || isTriggering}
                  className="text-muted-foreground hover:text-amber px-2"
                  title="Run now"
                >
                  {job.running || isTriggering ? (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3.05 3.05l2.12 2.12M10.83 10.83l2.12 2.12M3.05 12.95l2.12-2.12M10.83 5.17l2.12-2.12" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5 3l8 5-8 5V3z" />
                    </svg>
                  )}
                </Button>
                {job.running && (
                  <Badge variant="outline" className="border-amber text-amber text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse mr-1.5" />
                    Running
                  </Badge>
                )}
                <Badge
                  variant={job.enabled ? "default" : "secondary"}
                  className="text-xs"
                >
                  {job.enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mb-3 font-mono">
              Task: {job.taskFile} &middot; Max {job.maxIterations} iterations
            </div>

            <div className="border-t border-border/50 pt-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-mono text-muted-foreground/60">
                  Recent Runs
                </p>
                {job.recentRuns.length > 0 && (
                  <button
                    onClick={() => clearRuns(job.agentName, job.id)}
                    className="text-[10px] font-mono text-muted-foreground/40 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <RunHistory runs={job.recentRuns} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
