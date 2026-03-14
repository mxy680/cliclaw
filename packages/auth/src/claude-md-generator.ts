import type { AgentConfig } from "./agent-store.js";
import type { MemoryEntry } from "./memory-store.js";

/**
 * Generates the universal ~/.cliclaw/CLAUDE.md shared by all agents.
 * Contains safety rules, CLI usage patterns, memory instructions, and behavioral guidelines.
 * When soul/role/context are provided, they are inlined so the agent doesn't waste turns reading files.
 */
export function generateUniversalClaudeMd(sections?: {
  soul?: string;
  role?: string;
  context?: string;
}): string {
  const lines: string[] = [];

  lines.push("# Agent Instructions");
  lines.push("");

  if (sections?.soul || sections?.role || sections?.context) {
    if (sections.soul) {
      lines.push(sections.soul.trim());
      lines.push("");
    }
    if (sections.role) {
      lines.push(sections.role.trim());
      lines.push("");
    }
    if (sections.context) {
      lines.push(sections.context.trim());
      lines.push("");
    }
  }


  lines.push("## Safety Rules");
  lines.push("- Never access files outside your workspace directory");
  lines.push("- Never modify or read system files, environment files, or credentials outside your workspace");
  lines.push("- Never attempt to escalate permissions or bypass security boundaries");
  lines.push("- Never share credentials, tokens, or sensitive data in your responses");
  lines.push("- If a task requires access you don't have, say so — don't try to work around it");
  lines.push("");

  lines.push("## CLI Usage");
  lines.push("All integrations are accessed via the `cliclaw` CLI. Always pass `--account <account>` to specify which account to use.");
  lines.push("");
  lines.push("For detailed usage of any command, run:");
  lines.push("  `cliclaw <command> --help` or `cliclaw <command> <subcommand> --help`");
  lines.push("");

  lines.push("## Memory");
  lines.push("Save, search, and remove memories with `cliclaw agent memory --help`.");
  lines.push("Your agent name is in CONTEXT.md — use it for all memory commands.");
  lines.push("");
  lines.push("### Memory Guidelines");
  lines.push("- Save important facts, preferences, and context that will be useful across conversations");
  lines.push("- Use descriptive tags to categorize memories for easy retrieval");
  lines.push("- Search existing memories before adding duplicates");
  lines.push("- Use importance levels: 1 (low), 2 (normal), 3 (critical)");
  lines.push("");

  lines.push("## General Guidelines");
  lines.push("- Be concise and direct in responses");
  lines.push("- When running CLI commands, check `--help` first if unsure about options");
  lines.push("- When in a client workspace, read CLIENT_INTEGRATIONS.md for available account names");
  lines.push("- If no CLIENT_INTEGRATIONS.md exists, use `--account default`");

  return lines.join("\n");
}

/**
 * Generates per-instance CONTEXT.md with agent-specific context:
 * name, integrations, cron schedules, and current memories.
 */
export function generateContextMd(config: AgentConfig, memories: MemoryEntry[] = []): string {
  const lines: string[] = [];

  lines.push(`# ${config.displayName} — Context`);
  lines.push("");
  lines.push(`Agent name: \`${config.name}\``);
  lines.push("");

  lines.push("## Permitted Integrations");
  if (config.integrations.length === 0) {
    lines.push("No integrations configured.");
  } else {
    for (const integration of config.integrations) {
      lines.push(`- \`cliclaw ${integration}\``);
    }
  }
  lines.push("");

  if (config.cronJobs && config.cronJobs.length > 0) {
    lines.push("## Scheduled Tasks");
    lines.push("");
    for (const job of config.cronJobs) {
      const status = job.enabled ? "enabled" : "disabled";
      lines.push(`- **${job.id}** (${status}): \`${job.schedule}\``);
      lines.push(`  Task file: ${job.taskFile}`);
      lines.push(`  Max iterations: ${job.maxIterations}`);
    }
    lines.push("");
  }

  if (memories.length === 0) {
    lines.push("## Current Memories");
    lines.push("No memories yet.");
  } else {
    lines.push("## Current Memories");

    let displayMemories: MemoryEntry[];
    let truncated = false;

    if (memories.length > 50) {
      const critical = memories.filter((m) => m.importance === 3);
      const recent = memories.slice(-30);
      const seen = new Set<string>();
      displayMemories = [];
      for (const m of [...critical, ...recent]) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          displayMemories.push(m);
        }
      }
      truncated = true;
    } else {
      displayMemories = memories;
    }

    for (const m of displayMemories) {
      const tags = m.tags.length > 0 ? " " + m.tags.map((t) => `#${t}`).join(" ") : "";
      lines.push(`- [${m.id}] ${m.fact}${tags}`);
    }

    if (truncated) {
      lines.push("");
      lines.push(`(${memories.length} total memories — showing critical + 30 most recent. Use search to find more.)`);
    }
  }

  return lines.join("\n");
}
