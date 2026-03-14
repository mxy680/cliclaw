import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { getAgentsDir } from "@digitalpresence/cliclaw-auth";
import type { TranscriptBlock } from "./ralph-wiggum.js";

export interface CronRunLog {
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

export function getCronDir(agentName: string, jobId: string): string {
  return join(getAgentsDir(), agentName, "cron", jobId);
}

export function getProgressFilePath(agentName: string, jobId: string): string {
  return join(getCronDir(agentName, jobId), "progress.md");
}

export function ensureCronDirs(agentName: string, jobId: string): void {
  const cronDir = getCronDir(agentName, jobId);
  const runsDir = join(cronDir, "runs");
  if (!existsSync(runsDir)) {
    mkdirSync(runsDir, { recursive: true });
  }
}

export function writeRunLog(agentName: string, jobId: string, log: CronRunLog): void {
  ensureCronDirs(agentName, jobId);
  const runsDir = join(getCronDir(agentName, jobId), "runs");
  const filename = `${log.startedAt.replace(/[:.]/g, "-")}.json`;
  writeFileSync(join(runsDir, filename), JSON.stringify(log, null, 2), "utf-8");
}

export interface RunningMarker {
  startedAt: string;
  pid: number;
}

export function writeRunningMarker(agentName: string, jobId: string, startedAt: string): void {
  ensureCronDirs(agentName, jobId);
  const marker: RunningMarker = { startedAt, pid: process.pid };
  writeFileSync(join(getCronDir(agentName, jobId), "running.json"), JSON.stringify(marker), "utf-8");
}

export function clearRunningMarker(agentName: string, jobId: string): void {
  const path = join(getCronDir(agentName, jobId), "running.json");
  if (existsSync(path)) unlinkSync(path);
}

export function getRunningMarker(agentName: string, jobId: string): RunningMarker | null {
  const path = join(getCronDir(agentName, jobId), "running.json");
  if (!existsSync(path)) return null;
  try {
    const marker = JSON.parse(readFileSync(path, "utf-8")) as RunningMarker;
    // Verify the process is still alive
    try {
      process.kill(marker.pid, 0);
      return marker;
    } catch {
      // Process is dead — stale marker, clean up
      unlinkSync(path);
      return null;
    }
  } catch {
    return null;
  }
}

export function listRunLogs(agentName: string, jobId: string): CronRunLog[] {
  const runsDir = join(getCronDir(agentName, jobId), "runs");
  if (!existsSync(runsDir)) return [];
  return readdirSync(runsDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(runsDir, f), "utf-8")) as CronRunLog;
      } catch {
        return null;
      }
    })
    .filter((l): l is CronRunLog => l !== null);
}
