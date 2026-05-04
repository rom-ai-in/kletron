import { ContextGraphStore } from "./ContextGraphStore";

const registry = new Map<string, ContextGraphStore>();

/**
 * Per-workspace context graph instance. Persists under `<rootPath>/.kletron/context_graph.json`.
 */
export function getContextGraphStore(workspaceId: string, rootPath: string): ContextGraphStore {
  let store = registry.get(workspaceId);
  if (!store) {
    store = new ContextGraphStore(rootPath);
    registry.set(workspaceId, store);
  } else {
    store.setRootPath(rootPath);
  }
  return store;
}

/** Test / admin: clear registry (e.g. after workspace delete). */
export function clearContextGraphRegistryEntry(workspaceId: string): void {
  registry.delete(workspaceId);
}
