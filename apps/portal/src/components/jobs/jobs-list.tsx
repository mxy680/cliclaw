"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";

interface RunLog {
  jobId: string;
  agentName: string;
  startedAt: string;
  finishedAt: string;
  iterations: number;
  completed: boolean;
  totalCostUsd: number;
  error?: string;
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

function RunHistory({ runs }: { runs: RunLog[] }) {
  if (runs.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No runs yet</p>;
  }

  return (
    <div className="space-y-1.5">
      {runs.map((run, i) => (
        <div
          key={i}
          className="flex items-center gap-3 text-xs font-mono"
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
          {run.totalCostUsd > 0 && (
            <span className="text-muted-foreground">
              ${run.totalCostUsd.toFixed(3)}
            </span>
          )}
          {run.error && (
            <span className="text-red-400 truncate max-w-[200px]" title={run.error}>
              {run.error}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function JobsList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => setJobs(data.jobs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
      {jobs.map((job) => (
        <div
          key={`${job.agentName}-${job.id}`}
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
            <p className="text-xs font-mono text-muted-foreground/60 mb-2">
              Recent Runs
            </p>
            <RunHistory runs={job.recentRuns} />
          </div>
        </div>
      ))}
    </div>
  );
}
