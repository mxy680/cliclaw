import type { AgentStore } from "@digitalpresence/cliclaw-auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAgentGrant(
  store: AgentStore,
  name: string,
  integration: string,
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
    return;
  }

  if (agent.integrations.includes(integration)) {
    outputError("integration_exists", `Agent "${name}" already has ${integration}`);
    return;
  }

  agent.integrations.push(integration);
  agent.updatedAt = new Date().toISOString();
  store.save(agent);
  store.regenerateContextMd(name);

  outputJson({ status: "granted", name, integration });
}

export async function handleAgentRevoke(
  store: AgentStore,
  name: string,
  integration: string,
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
    return;
  }

  const idx = agent.integrations.indexOf(integration);
  if (idx === -1) {
    outputError("integration_not_found", `Agent "${name}" does not have ${integration}`);
    return;
  }

  agent.integrations.splice(idx, 1);
  agent.updatedAt = new Date().toISOString();
  store.save(agent);
  store.regenerateContextMd(name);

  outputJson({ status: "revoked", name, integration });
}
