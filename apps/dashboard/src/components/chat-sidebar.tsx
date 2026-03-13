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
      <div className="flex-shrink-0 pr-3 mr-3 border-r border-border/50">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1.5 text-muted-foreground/50 hover:text-amber transition-colors"
          title="Expand sidebar"
        >
          <svg className="size-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
      </div>
    );
  }

  const hasCronRuns = cronJobs.length > 0 && cronJobs.some((cj) => cj.runs.length > 0);

  return (
    <div className="w-56 flex-shrink-0 pr-3 mr-3 border-r border-border/50 flex flex-col min-h-0">
      {/* New Chat + collapse */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onNewChat}
          className="flex-1 py-1.5 px-2.5 border border-dashed border-border/60 rounded-sm font-mono text-[10px] text-muted-foreground tracking-wider uppercase hover:border-amber/40 hover:text-amber transition-colors"
        >
          + New Chat
        </button>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 text-muted-foreground/40 hover:text-amber transition-colors"
          title="Collapse"
        >
          <svg className="size-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10 3l-5 5 5 5" />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto -mr-1 pr-1">
        {/* Sessions */}
        <div className="mb-4">
          <span className="font-mono text-[9px] text-muted-foreground/50 tracking-[0.15em] uppercase block mb-1.5">
            Sessions
          </span>
          {sessions.length === 0 ? (
            <p className="font-mono text-[10px] text-muted-foreground/30 pl-0.5">
              No previous chats
            </p>
          ) : (
            <div className="space-y-0.5">
              {sessions.map((s) => (
                <div
                  key={s.sessionId}
                  className={`group relative flex flex-col gap-0 py-1.5 px-2 rounded-sm cursor-pointer transition-all duration-150 ${
                    activeSessionId === s.sessionId
                      ? "bg-amber/5 border-l-2 border-l-amber/40 pl-2"
                      : "hover:bg-muted/20 border-l-2 border-l-transparent"
                  }`}
                  onClick={() => onLoadSession(s.sessionId)}
                >
                  <span className="text-[11px] text-foreground/80 truncate pr-4 leading-tight">
                    {s.title}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] text-muted-foreground/40">
                      {formatRelativeTime(s.updatedAt)}
                    </span>
                    <span className="font-mono text-[9px] text-muted-foreground/25">
                      {s.turnCount}t
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
                    className="absolute top-1.5 right-1 font-mono text-[10px] text-muted-foreground/30 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  >
                    {deletingId === s.sessionId ? "..." : "×"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cron Runs */}
        {hasCronRuns && (
          <div className="pt-3 border-t border-border/30">
            <span className="font-mono text-[9px] text-muted-foreground/50 tracking-[0.15em] uppercase block mb-1.5">
              Cron Runs
            </span>
            <div className="space-y-0.5">
              {cronJobs
                .flatMap((cj) =>
                  cj.runs.map((run) => ({ job: cj.job, run }))
                )
                .sort((a, b) => new Date(b.run.startedAt).getTime() - new Date(a.run.startedAt).getTime())
                .slice(0, 5)
                .map(({ job, run }) => (
                  <div
                    key={`${job.id}-${run.startedAt}`}
                    className="flex flex-col gap-0 py-1.5 px-2 rounded-sm hover:bg-muted/20 cursor-pointer transition-colors duration-150"
                    onClick={() =>
                      setExpandedRunJob(
                        expandedRunJob === `${job.id}-${run.startedAt}` ? null : `${job.id}-${run.startedAt}`
                      )
                    }
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className={`size-1 rounded-full flex-shrink-0 ${
                          run.completed ? "bg-emerald-500/70" : "bg-destructive/70"
                        }`}
                      />
                      <span className="text-[11px] text-foreground/70 truncate flex-1 leading-tight">
                        {job.task.length > 35 ? job.task.slice(0, 35) + "…" : job.task}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pl-2.5">
                      <span className="font-mono text-[9px] text-muted-foreground/40">
                        {formatRelativeTime(run.startedAt)}
                      </span>
                      <span className="font-mono text-[9px] text-muted-foreground/25">
                        {formatDuration(run.startedAt, run.finishedAt)}
                      </span>
                    </div>
                    {expandedRunJob === `${job.id}-${run.startedAt}` && (
                      <div className="mt-0.5 pl-2.5 space-y-0.5">
                        <p className="font-mono text-[9px] text-muted-foreground/40">
                          {run.iterations} iter
                        </p>
                        {run.error && (
                          <p className="font-mono text-[9px] text-destructive/50 truncate">
                            {run.error}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
