import { AgentStore } from "@cliclaw/auth";
import { AGENTS_DIR } from "./constants";

let _store: AgentStore | null = null;

export function getAgentStore(): AgentStore {
  if (!_store) {
    _store = new AgentStore(AGENTS_DIR);
  }
  return _store;
}
