/**
 * ContextGraphStore — in-memory graph with JSON persistence under workspace root.
 */

import fs from "node:fs/promises";
import path from "node:path";

import type { ContextGraph, ContextNode, ContextEdge } from "@kletron/shared/context/graph";

const PERSIST_VERSION = 1;
const KLETRON_DIR = ".kletron";
const GRAPH_FILE = "context_graph.json";

type SerializedGraph = {
  version: number;
  rootPath: string;
  nodes: [string, ContextNode][];
  edgeEntries: [string, ContextEdge[]][];
};

export class ContextGraphStore {
  private graph: ContextGraph = {
    nodes: new Map(),
    edges: new Map(),
  };

  constructor(private rootPath: string) {}

  setRootPath(rootPath: string): void {
    this.rootPath = rootPath;
  }

  getRootPath(): string {
    return this.rootPath;
  }

  getPersistencePath(): string {
    return path.join(this.rootPath, KLETRON_DIR, GRAPH_FILE);
  }

  getNodes(): Map<string, ContextNode> {
    return this.graph.nodes;
  }

  getAllNodes(): ContextNode[] {
    return Array.from(this.graph.nodes.values());
  }

  getEdges(): Map<string, ContextEdge[]> {
    return this.graph.edges;
  }

  getEdgesForNode(nodeId: string): ContextEdge[] {
    return this.graph.edges.get(nodeId) || [];
  }

  addNode(node: ContextNode): void {
    this.graph.nodes.set(node.id, node);
  }

  addEdge(edge: ContextEdge): void {
    const withId: ContextEdge = {
      ...edge,
      id: edge.id ?? `${edge.sourceId}::${edge.targetId}::${edge.type}`,
    };
    const edges = this.graph.edges.get(withId.sourceId) || [];
    edges.push(withId);
    this.graph.edges.set(withId.sourceId, edges);
  }

  getNeighborhood(id: string, maxDistance: number): Set<string> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; distance: number }> = [{ id, distance: 0 }];
    while (queue.length > 0) {
      const { id: cur, distance } = queue.shift()!;
      if (visited.has(cur)) continue;
      visited.add(cur);
      if (distance >= maxDistance) continue;
      const out = this.graph.edges.get(cur) || [];
      for (const e of out) {
        if (!visited.has(e.targetId)) {
          queue.push({ id: e.targetId, distance: distance + 1 });
        }
      }
    }
    visited.delete(id);
    return visited;
  }

  async load(): Promise<boolean> {
    const filePath = this.getPersistencePath();
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(raw) as SerializedGraph;
      if (data.version !== PERSIST_VERSION || !Array.isArray(data.nodes)) {
        return false;
      }
      this.clear();
      for (const [id, node] of data.nodes) {
        this.graph.nodes.set(id, node);
      }
      this.graph.edges.clear();
      for (const [sourceId, list] of data.edgeEntries || []) {
        this.graph.edges.set(sourceId, list);
      }
      return this.graph.nodes.size > 0;
    } catch {
      return false;
    }
  }

  async save(): Promise<void> {
    const dir = path.join(this.rootPath, KLETRON_DIR);
    await fs.mkdir(dir, { recursive: true });
    const payload: SerializedGraph = {
      version: PERSIST_VERSION,
      rootPath: this.rootPath,
      nodes: Array.from(this.graph.nodes.entries()),
      edgeEntries: Array.from(this.graph.edges.entries()),
    };
    const filePath = this.getPersistencePath();
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload), "utf-8");
    await fs.rename(tmp, filePath);
  }

  clear(): void {
    this.graph.nodes.clear();
    this.graph.edges.clear();
  }
}
