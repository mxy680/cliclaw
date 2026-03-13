import type { AgentStore } from "@cliclaw/auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAgentCreate(
  store: AgentStore,
  name: string,
  displayName: string,
  role: string,
): Promise<void> {
  if (store.get(name)) {
    outputError("agent_exists", `Agent "${name}" already exists`);
  }

  const now = new Date().toISOString();
  store.scaffoldWorkspace({
    name,
    displayName,
    role,
    permissions: [],
    memory: [],
    cronJobs: [],
    createdAt: now,
    updatedAt: now,
  });

  outputJson({ status: "created", name, displayName });
}

export async function handleAgentList(store: AgentStore): Promise<void> {
  const agents = store.list();
  outputJson(
    agents.map((a) => ({
      name: a.name,
      displayName: a.displayName,
      permissions: a.permissions.length,
      memory: a.memory.length,
    })),
  );
}

export async function handleAgentShow(store: AgentStore, name: string): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }
  outputJson(agent);
}

export async function handleAgentDelete(store: AgentStore, name: string): Promise<void> {
  if (!store.delete(name)) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }
  outputJson({ status: "deleted", name });
}
