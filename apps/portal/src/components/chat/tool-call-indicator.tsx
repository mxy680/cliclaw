"use client";

interface ToolCallIndicatorProps {
  name: string;
  input?: string;
  done: boolean;
}

function formatToolInput(name: string, input?: string): string | null {
  if (!input) return null;
  try {
    const parsed = JSON.parse(input);
    if (name === "Read" && parsed.file_path) return parsed.file_path;
    if (name === "Glob" && parsed.pattern) return parsed.pattern;
    if (name === "Grep" && parsed.pattern) return parsed.pattern;
    if (name === "Write" && parsed.file_path) return parsed.file_path;
    if (name === "Edit" && parsed.file_path) return parsed.file_path;
    if (name === "Bash" && parsed.command) {
      const cmd = parsed.command;
      return cmd.length > 200 ? cmd.slice(0, 200) + "..." : cmd;
    }
    return null;
  } catch {
    return null;
  }
}

export function ToolCallIndicator({ name, input, done }: ToolCallIndicatorProps) {
  const detail = formatToolInput(name, input);

  return (
    <div className="flex items-center gap-2 rounded-sm border border-border/50 bg-black/20 px-3 py-1.5 text-xs font-mono text-muted-foreground">
      {done ? (
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="text-green-500"
        >
          <path d="M2 6l3 3 5-5" />
        </svg>
      ) : (
        <span className="w-2 h-2 rounded-full bg-amber animate-glow-pulse" />
      )}
      <span className="text-foreground/80">{name}</span>
      {detail && (
        <span className="text-muted-foreground/60 truncate max-w-[600px]">
          {detail}
        </span>
      )}
    </div>
  );
}
