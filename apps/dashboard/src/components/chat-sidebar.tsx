"use client";

import { useState } from "react";
import type { CronJobConfig } from "@cliclaw/auth";

interface ChatSessionSummary {
  sessionId: string;
  title: string;
  updatedAt: string;
  turnCount: number;
}

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

interface CronJobWithRuns {
  job: CronJobConfig;
  runs: CronRunLog[];
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
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

export interface ChatSidebarProps {
  sessions: ChatSessionSummary[];
  cronJobs: CronJobWithRuns[];
  activeSessionId: string | null;
  onLoadSession: (sessionId: string) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatSidebar({
  sessions,
  cronJobs,
  activeSessionId,
  onLoadSession,
  onNewChat,
  onDeleteSession,
}: ChatSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedRunJob, setExpandedRunJob] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (collapsed) {
    return (
      <div className="w-10 flex-shrink-0 border-r border-border bg-surface-raised flex flex-col items-center pt-3">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 text-muted-foreground hover:text-amber transition-colors"
          title="Expand sidebar"
        >
          <svg className="size-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="w-72 flex-shrink-0 border-r border-border bg-surface-raised flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase">
          History
        </span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-muted-foreground hover:text-amber transition-colors"
          title="Collapse sidebar"
        >
          <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3l-5 5 5 5" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* New Chat button */}
        <div className="px-3 py-3">
          <button
            onClick={onNewChat}
            className="w-full py-2 px-3 border border-dashed border-border rounded-sm font-mono text-[10px] text-muted-foreground tracking-wider uppercase hover:border-amber/40 hover:text-amber transition-colors"
          >
            + New Chat
          </button>
        </div>

        {/* Sessions */}
        <div className="px-3 pb-4">
          <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase block mb-2">
            Sessions
          </span>
          {sessions.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground/50 px-1">
              No previous chats
            </p>
          ) : (
            <div className="space-y-1">
              {sessions.map((s) => (
                <div
                  key={s.sessionId}
                  className={`group relative flex flex-col gap-0.5 py-2 px-2.5 rounded-sm cursor-pointer transition-all duration-200 ${
                    activeSessionId === s.sessionId
                      ? "bg-amber/5 border border-amber/30"
                      : "border border-transparent hover:bg-muted/30 hover:border-border"
                  }`}
                  onClick={() => onLoadSession(s.sessionId)}
                >
                  <span className="text-xs text-foreground truncate pr-5">
                    {s.title}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {formatRelativeTime(s.updatedAt)}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground/40">
                      {s.turnCount} turn{s.turnCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingId(s.sessionId);
                      onDeleteSession(s.sessionId);
                      setTimeout(() => setDeletingId(null), 500);
                    }}
                    disabled={deletingId === s.sessionId}
                    className="absolute top-2 right-2 font-mono text-[10px] text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  >
                    {deletingId === s.sessionId ? "..." : "×"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cron Runs */}
        <div className="px-3 pb-4 border-t border-border pt-4">
          <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase block mb-2">
            Cron Runs
          </span>
          {cronJobs.length === 0 || cronJobs.every((cj) => cj.runs.length === 0) ? (
            <p className="font-mono text-[10px] text-muted-foreground/50 px-1">
              No recent runs
            </p>
          ) : (
            <div className="space-y-1">
              {cronJobs
                .flatMap((cj) =>
                  cj.runs.map((run) => ({ job: cj.job, run }))
                )
                .sort((a, b) => new Date(b.run.startedAt).getTime() - new Date(a.run.startedAt).getTime())
                .slice(0, 5)
                .map(({ job, run }) => (
                  <div
                    key={`${job.id}-${run.startedAt}`}
                    className="flex flex-col gap-0.5 py-2 px-2.5 rounded-sm border border-transparent hover:bg-muted/30 hover:border-border cursor-pointer transition-all duration-200"
                    onClick={() =>
                      setExpandedRunJob(
                        expandedRunJob === `${job.id}-${run.startedAt}` ? null : `${job.id}-${run.startedAt}`
                      )
                    }
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-1.5 rounded-full flex-shrink-0 ${
                          run.completed ? "bg-emerald-500" : "bg-destructive"
                        }`}
                      />
                      <span className="text-xs text-foreground truncate flex-1">
                        {job.task.length > 40 ? job.task.slice(0, 40) + "…" : job.task}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-3.5">
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        {formatRelativeTime(run.startedAt)}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/40">
                        {formatDuration(run.startedAt, run.finishedAt)}
                      </span>
                    </div>
                    {expandedRunJob === `${job.id}-${run.startedAt}` && (
                      <div className="mt-1 pl-3.5 space-y-0.5">
                        <p className="font-mono text-[10px] text-muted-foreground/60">
                          {run.iterations} iteration{run.iterations !== 1 ? "s" : ""} · ${run.totalCostUsd.toFixed(2)}
                        </p>
                        {run.error && (
                          <p className="font-mono text-[10px] text-destructive/70 truncate">
                            {run.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
