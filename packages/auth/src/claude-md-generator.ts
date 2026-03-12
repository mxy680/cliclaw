import type { AgentConfig } from "./agent-store.js";

export function generateClaudeMd(config: AgentConfig): string {
  const { displayName, permissions, memory } = config;

  const gmailPermissions = permissions.filter((p) => p.integration === "gmail");
  const gdrivePermissions = permissions.filter((p) => p.integration === "gdrive");
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
  }

  lines.push("");
  lines.push("## Memory");

  if (memory.length === 0) {
    lines.push("No memories yet.");
  } else {
    for (const fact of memory) {
      lines.push(`- ${fact}`);
    }
  }

  return lines.join("\n");
}
