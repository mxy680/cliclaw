import type { AgentStore } from "@cliclaw/auth";
import { outputJson, outputError } from "../lib/output.js";

export async function handleAgentMemory(
  store: AgentStore,
  name: string,
  opts?: { tag?: string; recent?: number },
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }
  const memoryStore = store.getMemoryStore(name);
  const entries = memoryStore.list({ tag: opts?.tag, limit: opts?.recent });
  outputJson({ name, count: entries.length, memories: entries });
}

export async function handleAgentMemoryAdd(
  store: AgentStore,
  name: string,
  fact: string,
  opts?: { tags?: string; source?: string; importance?: string },
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  const memoryStore = store.getMemoryStore(name);
  const tags = opts?.tags ? opts.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const source = (opts?.source as "user" | "agent" | "system") ?? "user";
  const importance = opts?.importance ? (parseInt(opts.importance, 10) as 1 | 2 | 3) : 2;

  const entry = memoryStore.add(fact, { tags, source, importance });
  store.regenerateClaudeMd(name);

  outputJson({ status: "added", name, entry });
}

export async function handleAgentMemoryRemove(
  store: AgentStore,
  name: string,
  id?: string,
  tag?: string,
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  const memoryStore = store.getMemoryStore(name);

  if (tag) {
    const removed = memoryStore.removeByTag(tag);
    store.regenerateClaudeMd(name);
    outputJson({ status: "removed", name, removedByTag: tag, count: removed });
  } else if (id) {
    const removed = memoryStore.remove(id);
    if (!removed) {
      outputError("memory_not_found", `Memory "${id}" not found`);
    }
    store.regenerateClaudeMd(name);
    outputJson({ status: "removed", name, id });
  } else {
    outputError("invalid_args", "Provide an ID or --tag to remove");
  }
}

export async function handleAgentMemorySearch(
  store: AgentStore,
  name: string,
  query: string,
): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  const memoryStore = store.getMemoryStore(name);
  const results = memoryStore.search(query);
  outputJson({ name, query, count: results.length, memories: results });
}

export async function handleAgentMemoryClear(store: AgentStore, name: string): Promise<void> {
  const agent = store.get(name);
  if (!agent) {
    outputError("agent_not_found", `Agent "${name}" not found`);
  }

  const memoryStore = store.getMemoryStore(name);
  const cleared = memoryStore.clear();
  store.regenerateClaudeMd(name);

  outputJson({ status: "cleared", name, cleared });
}
