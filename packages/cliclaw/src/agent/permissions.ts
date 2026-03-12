import type { AgentStore } from "@cliclaw/auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAgentGrant(
  store: AgentStore,
  name: string,
  integration: string,
  account: string,
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  const exists = agent.permissions.some(
    (p) => p.integration === integration && p.account === account,
  );
  if (exists) {
    outputError("permission_exists", `Agent "${name}" already has ${integration}:${account}`);
  }

  agent.permissions.push({ integration, account });
  agent.updatedAt = new Date().toISOString();
  store.save(agent);
  store.regenerateClaudeMd(name);

  outputJson({ status: "granted", name, integration, account });
}

export async function handleAgentRevoke(
  store: AgentStore,
  name: string,
  integration: string,
  account: string,
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  const idx = agent.permissions.findIndex(
    (p) => p.integration === integration && p.account === account,
  );
  if (idx === -1) {
    outputError("permission_not_found", `Agent "${name}" does not have ${integration}:${account}`);
  }

  agent.permissions.splice(idx, 1);
  agent.updatedAt = new Date().toISOString();
  store.save(agent);
  store.regenerateClaudeMd(name);

  outputJson({ status: "revoked", name, integration, account });
}
