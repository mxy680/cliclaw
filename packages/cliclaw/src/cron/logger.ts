type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  agent?: string;
  job?: string;
  message: string;
}

export function cronLog(level: LogLevel, message: string, agent?: string, job?: string): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    ...(agent ? { agent } : {}),
    ...(job ? { job } : {}),
    message,
  };
  process.stderr.write(JSON.stringify(entry) + "\n");
}
