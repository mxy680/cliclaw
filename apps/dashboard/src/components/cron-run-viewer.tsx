"use client";

import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

export function CronRunViewer({ run, output, displayName }: { run: CronRunLog; output?: string | null; displayName: string }) {
  const transcript = run.transcript ?? [];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "instant" });
  }, [run]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="mb-4 pb-3 border-b border-border/50">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground tracking-[0.15em] uppercase">
            Cron Run
          </span>
          <span className={`font-mono text-[10px] ${run.completed ? "text-emerald-500" : "text-destructive"}`}>
            {run.completed ? "completed" : run.error ? "failed" : "incomplete"}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 font-mono text-[10px] text-muted-foreground/60">
          <span>{new Date(run.startedAt).toLocaleString()}</span>
          <span>{formatDuration(run.startedAt, run.finishedAt)}</span>
          <span>{run.iterations} iter</span>
        </div>
        {run.error && (
          <p className="mt-1 font-mono text-[11px] text-destructive/80">{run.error}</p>
        )}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-4">
        {transcript.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="font-mono text-sm text-muted-foreground/50">
              No transcript available for this run
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.map((block, i) => {
              if (block.type === "tool") {
                const label = formatToolInput(block.name, block.input);
                return (
                  <div key={i} className="flex justify-start pl-2 animate-slide-in-left">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/20 border border-border/50 rounded-sm font-mono text-[11px] text-muted-foreground">
                      <svg className="size-3 text-amber/60" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 8.5l3.5 3.5 6.5-7" />
                      </svg>
                      <span className="text-amber/50">{block.name}</span>
                      <span className="text-foreground/70 max-w-md truncate">{label !== block.name ? label : ""}</span>
                    </div>
                  </div>
                );
              }

              // assistant
              return (
                <div key={i} className="flex justify-start animate-fade-in-up">
                  <div className="max-w-[80%] rounded-sm px-4 py-3 bg-card border border-border text-foreground">
                    <span className="font-mono text-[10px] text-amber tracking-wider uppercase block mb-1.5">
                      {displayName}
                    </span>
                    <div className="text-sm font-mono leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-foreground prose-headings:font-mono prose-headings:mt-3 prose-headings:mb-1.5 prose-strong:text-amber/90 prose-code:text-amber/80 prose-code:bg-amber/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-border prose-pre:rounded-sm prose-a:text-amber/70 prose-a:no-underline hover:prose-a:text-amber">
                      <Markdown remarkPlugins={[remarkGfm]}>{block.content}</Markdown>
                    </div>
                  </div>
                </div>
              );
            })}
            {output && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="max-w-[90%] rounded-sm px-4 py-3 bg-amber/5 border border-amber/20 text-foreground">
                  <span className="font-mono text-[10px] text-amber tracking-wider uppercase block mb-1.5">
                    Output
                  </span>
                  <div className="text-sm font-mono leading-relaxed prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-headings:text-foreground prose-headings:font-mono prose-headings:mt-3 prose-headings:mb-1.5 prose-strong:text-amber/90 prose-code:text-amber/80 prose-code:bg-amber/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded-sm prose-code:before:content-none prose-code:after:content-none prose-pre:bg-black/30 prose-pre:border prose-pre:border-border prose-pre:rounded-sm prose-a:text-amber/70 prose-a:no-underline hover:prose-a:text-amber">
                    <Markdown remarkPlugins={[remarkGfm]}>{output}</Markdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
