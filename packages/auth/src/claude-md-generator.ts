import type { AgentConfig } from "./agent-store.js";
import type { MemoryEntry } from "./memory-store.js";

export function generateClaudeMd(config: AgentConfig, memories: MemoryEntry[] = []): string {
  const { displayName, permissions } = config;

  const hasPermissions = permissions.length > 0;

  // Deduplicate integrations for the summary
  const integrations = [...new Set(permissions.map((p) => p.integration))];

  const lines: string[] = [];

  lines.push(`# ${displayName}`);
  lines.push("");
  lines.push("Read SOUL.md for your identity and personality.");
  lines.push("Read ROLE.md for your capabilities and instructions.");
  lines.push("");
  lines.push("## CLI Usage");
  lines.push("All integrations are accessed via the `cliclaw` CLI. Always pass `--account <account>` to specify which account to use.");
  lines.push("");
  lines.push("For detailed usage of any command, run:");
  lines.push("  `cliclaw <command> --help` or `cliclaw <command> <subcommand> --help`");
  lines.push("");
  lines.push("## Permitted Integrations");

  if (!hasPermissions) {
    lines.push("No permissions granted yet.");
  } else {
    for (const perm of permissions) {
      lines.push(`- **${perm.integration}** — account: \`${perm.account}\``);
    }
    lines.push("");
    lines.push("IMPORTANT: ONLY access accounts listed above.");
    lines.push("");
    lines.push("Available integrations: " + integrations.map((i) => `\`cliclaw ${i}\``).join(", "));
  }

  lines.push("");
  lines.push("## Memory");
  lines.push(`Save, search, and remove memories with \`cliclaw agent memory --help\`. Your agent name is \`${config.name}\`.`);
  lines.push("");

  if (config.cronJobs && config.cronJobs.length > 0) {
    lines.push("## Scheduled Tasks");
    lines.push("");
    for (const job of config.cronJobs) {
      const status = job.enabled ? "enabled" : "disabled";
      lines.push(`- **${job.id}** (${status}): \`${job.schedule}\``);
      lines.push(`  Task: ${job.task}`);
      lines.push(`  Completion word: ${job.completionPromise} | Max iterations: ${job.maxIterations}`);
    }
    lines.push("");
  }

  if (memories.length === 0) {
    lines.push("### Current Memories");
    lines.push("No memories yet.");
  } else {
    lines.push("### Current Memories");

    let displayMemories: MemoryEntry[];
    let truncated = false;

    if (memories.length > 50) {
      const critical = memories.filter((m) => m.importance === 3);
      const recent = memories.slice(-30);
      // Merge critical + recent, deduplicate by id
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
