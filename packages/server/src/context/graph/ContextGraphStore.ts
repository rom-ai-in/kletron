/**
 * ContextGraphStore - Stocke les ContextNode et ContextEdge en mémoire
 */

import type { ContextGraph, ContextNode, ContextEdge } from '@kletron/shared/context/graph';

export class ContextGraphStore {
  private graph: ContextGraph = {
    nodes: new Map(),
    edges: new Map()
  };

  getNodes(): Map<string, ContextNode> {
    return this.graph.nodes;
  }

  getAllNodes(): ContextNode[] {
    return Array.from(this.graph.nodes.values());
  }

  getEdges(): Map<string, ContextEdge[]> {
    return this.graph.edges;
  }

  addNode(node: ContextNode): void {
    this.graph.nodes.set(node.id, node);
  }

  addEdge(edge: ContextEdge): void {
    const edges = this.graph.edges.get(edge.sourceId) || [];
    edges.push(edge);
    this.graph.edges.set(edge.sourceId, edges);
  }

  getNeighborhood(id: string, maxDistance: number): Set<string> {
    // TODO: implémenter la recherche de voisinage
    return new Set([id]);
  }

  load(path?: string): boolean {
    // TODO: charger depuis JSON
    return true;
  }

  save(path?: string): void {
    // TODO: sauvegarder en JSON
  }

  clear(): void {
    this.graph.nodes.clear();
    this.graph.edges.clear();
  }
}

export const contextGraphStore = new ContextGraphStore();
