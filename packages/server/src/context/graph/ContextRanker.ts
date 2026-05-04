/**
 * ContextRanker - Classe le contexte basé sur la pertinence pour l'agent IA
 * 
 * Ce module implémente un algorithme de ranking intelligent qui priorise les fichiers
 * en fonction de plusieurs critères :
 * - Récence (vu/édité récemment)
 * - Proximité dans le graphe d'imports
 * - Mentions explicites dans le prompt utilisateur
 * - Fichier actif actuellement ouvert
 * 
 * L'algorithme calcule un score pour chaque nœud du contexte et retourne les top N
 * résultats en respectant un budget de tokens configurable.
 * 
 * @example
 * ```typescript
 * const ranker = new ContextRanker();
 * const results = await ranker.rank({
 *   userPrompt: "Check package.json",
 *   editorState: { activeFile: "/path/to/file.ts" },
 *   limit: 10,
 *   tokenBudget: 25000
 * });
 * // results[0] = fichier le plus pertinent
 * ```
 */

import type { RankedContextItem, EditorState, ContextGraph } from "@kletron/shared/context/graph";
import type { ContextGraphStore } from "./ContextGraphStore";

const SCORES = {
  DIRECT_MATCH: 1.0,
  NEIGHBOR: 0.5,
  EXPLICIT_MENTION: 0.3,
  RECENTLY_VIEWED_1H: 0.25,
  RECENTLY_VIEWED_6H: 0.15,
  RECENTLY_EDITED_1H: 0.3,
};

/**
 * Paramètres pour le ranking du contexte
 */
export interface RankParams {
  /** Prompt utilisateur - utilisé pour détecter les mentions explicites de fichiers */
  userPrompt: string;
  
  /** État actuel de l'éditeur - fichier actif, fichiers ouverts, etc. */
  editorState: EditorState;
  limit?: number;
  tokenBudget?: number;
}

/**
 * Classe principale du ContextRanker
 * 
 * Responsabilités :
 * - Calculer les scores de pertinence pour chaque fichier
 * - Filtrer et trier par score décroissant
 * - Appliquer les contraintes de budget en tokens
 * - Retourner les fichiers les plus pertinents
 */
export class ContextRanker {
  constructor(private readonly store: ContextGraphStore) {}

  private snapshotGraph(): ContextGraph {
    return {
      nodes: this.store.getNodes(),
      edges: this.store.getEdges(),
    };
  }

  /**
   * Classe les fichiers par pertinence et retourne les top N résultats
   * 
   * @param params - Paramètres de ranking
   * @returns Tableau trié des items classés, limité par le budget en tokens
   * 
   * @example
   * ```typescript
   * const ranker = new ContextRanker();
   * const results = await ranker.rank({
   *   userPrompt: "Look at src/App.tsx",
   *   editorState: { activeFile: "/src/index.ts" },
   *   limit: 10,
   *   tokenBudget: 20000
   * });
   * 
   * // results = [
   * //   { id: "/src/App.tsx", score: 0.8, reasons: ["Mentionné dans le prompt"] },
   * //   ...
   * // ]
   * ```
   */
  async rank(params: RankParams): Promise<RankedContextItem[]> {
    const { userPrompt, editorState, limit = 15, tokenBudget = 30000 } = params;

    const graph = this.snapshotGraph();
    const scoredNodes = this.calculateScores(graph, userPrompt, editorState);

    const filteredAndSorted = scoredNodes
      .filter((item) => item.score > 0.1)
      .sort((a, b) => b.score - a.score);

    const itemsWithBudget = this.pruneToBudget(filteredAndSorted, tokenBudget);

    return itemsWithBudget.slice(0, limit);
  }

  private calculateScores(
    graph: ContextGraph,
    prompt: string,
    editorState: EditorState
  ): RankedContextItem[] {
    const promptLower = prompt.toLowerCase();

    return Array.from(graph.nodes.values()).map((node) => {
      let score = 0;
      const reasons: string[] = [];

      if (editorState.activeFile === node.id) {
        score += SCORES.DIRECT_MATCH;
        reasons.push("Active file");
      }

      const fileName = node.metadata.name.toLowerCase();
      if (promptLower.includes(fileName)) {
        score += SCORES.EXPLICIT_MENTION;
        reasons.push(`Mentioned: ${fileName}`);
      }

      const lastViewed = node.metadata.lastViewed || 0;
      if (lastViewed > 0) {
        const hoursAgo = (Date.now() - lastViewed) / (1000 * 60 * 60);
        if (hoursAgo < 1) {
          score += SCORES.RECENTLY_VIEWED_1H;
          reasons.push("Viewed recently (<1h)");
        } else if (hoursAgo < 6) {
          score += SCORES.RECENTLY_VIEWED_6H;
          reasons.push("Viewed recently (<6h)");
        }
      }

      const lastEdited = node.metadata.lastEdited || 0;
      if (lastEdited > 0) {
        const hoursAgo = (Date.now() - lastEdited) / (1000 * 60 * 60);
        if (hoursAgo < 1) {
          score += SCORES.RECENTLY_EDITED_1H;
          reasons.push("Edited recently (<1h)");
        }
      }

      if (editorState.activeFile && editorState.activeFile !== node.id) {
        const neighbors = this.getNeighbors(graph, editorState.activeFile, 2);
        if (neighbors.has(node.id)) {
          score += SCORES.NEIGHBOR;
          reasons.push("Graph neighbor");
        }
      }

      return {
        ...node,
        score: Math.min(score, 1.0),
        reasons: reasons.length > 0 ? reasons : ["General context"],
      };
    });
  }

  private getNeighbors(graph: ContextGraph, nodeId: string, maxDistance: number): Set<string> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; distance: number }> = [{ id: nodeId, distance: 0 }];

    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;

      if (visited.has(id)) continue;
      visited.add(id);

      if (distance < maxDistance) {
        const edges = graph.edges.get(id) || [];
        for (const edge of edges) {
          if (!visited.has(edge.targetId)) {
            queue.push({ id: edge.targetId, distance: distance + 1 });
          }
        }
      }
    }

    visited.delete(nodeId);
    return visited;
  }

  private pruneToBudget(items: RankedContextItem[], budget: number): RankedContextItem[] {
    let totalTokens = 0;
    const result: RankedContextItem[] = [];

    for (const item of items) {
      const estimatedTokens = Math.ceil(item.stats.lineCount / 4);

      if (totalTokens + estimatedTokens <= budget) {
        totalTokens += estimatedTokens;
        result.push(item);
      } else {
        break;
      }
    }

    return result;
  }
}
