import type { AgentStore } from "@cliclaw/auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAgentMemory(store: AgentStore, name: string): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }
  outputJson({ name, memory: agent.memory });
}

export async function handleAgentMemoryAdd(
  store: AgentStore,
  name: string,
  fact: string,
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  agent.memory.push(fact);
  agent.updatedAt = new Date().toISOString();
  store.save(agent);

  outputJson({ status: "added", name, fact, total: agent.memory.length });
}

export async function handleAgentMemoryClear(store: AgentStore, name: string): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  const cleared = agent.memory.length;
  agent.memory = [];
  agent.updatedAt = new Date().toISOString();
  store.save(agent);

  outputJson({ status: "cleared", name, cleared });
}
