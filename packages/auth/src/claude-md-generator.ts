import type { AgentConfig } from "./agent-store.js";
import type { MemoryEntry } from "./memory-store.js";

export function generateClaudeMd(config: AgentConfig, memories: MemoryEntry[] = []): string {
  const { displayName, permissions } = config;

  const gmailPermissions = permissions.filter((p) => p.integration === "gmail");
  const gdrivePermissions = permissions.filter((p) => p.integration === "gdrive");
  const gslidesPermissions = permissions.filter((p) => p.integration === "gslides");
  const hasPermissions = permissions.length > 0;

  const lines: string[] = [];

  lines.push(`# ${displayName}`);
  lines.push("");
  lines.push("Read SOUL.md for your identity and personality.");
  lines.push("Read ROLE.md for your capabilities and instructions.");
  lines.push("");
  lines.push("## Permissions");
  lines.push("You have access to these integrations via the `cliclaw` CLI:");

  if (!hasPermissions) {
    lines.push("No permissions granted yet.");
  } else {
    for (const perm of permissions) {
      lines.push(`- \`cliclaw ${perm.integration} ... --account ${perm.account}\``);
    }
    lines.push("");
    lines.push("IMPORTANT: ONLY access accounts listed above.");
    lines.push("");
    lines.push("## Available Commands");

    if (gmailPermissions.length > 0) {
      lines.push("### Gmail");
      lines.push(
        "cliclaw gmail inbox/search/get/send/reply/forward/modify/drafts/labels/threads --account <account>"
      );
    }

    if (gdrivePermissions.length > 0) {
      lines.push("### Google Drive");
      lines.push(
        "cliclaw gdrive list/get/download/upload/search/mkdir/share/move/copy/rename --account <account>"
      );
    }

    if (gslidesPermissions.length > 0) {
      lines.push("### Google Slides");
      lines.push(
        "cliclaw gslides list/get/create/delete/get-slide/add-slide/delete-slide/add-text/add-image/add-shape/duplicate-slide --account <account>"
      );
    }
  }

  lines.push("");
  lines.push("## Memory");
  lines.push("");
  lines.push("### How to Use Memory");
  lines.push("Save important knowledge across conversations:");
  lines.push(`  cliclaw agent memory add ${config.name} --fact "description" --tags "tag1,tag2" --source agent`);
  lines.push("Search memories:");
  lines.push(`  cliclaw agent memory search ${config.name} "query"`);
  lines.push("Remove outdated:");
  lines.push(`  cliclaw agent memory remove ${config.name} <id>`);
  lines.push("");

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
