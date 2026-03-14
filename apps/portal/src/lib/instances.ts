import { InstanceStore } from "@digitalpresence/cliclaw-auth";
import { INSTANCES_DIR } from "./constants";
import { getAgentStore } from "./agents";

let _store: InstanceStore | null = null;

export function getInstanceStore(): InstanceStore {
  if (!_store) {
    _store = new InstanceStore(INSTANCES_DIR, getAgentStore());
  }
  return _store;
}
