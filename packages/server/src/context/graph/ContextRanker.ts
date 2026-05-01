/**
 * ContextRanker - Classe le contexte basé sur la pertinence pour l'agent
 */

import type { 
  RankedContextItem, 
  EditorState,
  ContextNode,
  ContextGraph
} from '@kletron/shared/context/graph';
import { contextGraphStore } from './ContextGraphStore';

// Scores de pondération constants
const SCORES = {
  DIRECT_MATCH: 1.0,           // Fichier actif ouvert
  NEIGHBOR: 0.5,              // Voisin dans le graphe
  EXPLICIT_MENTION: 0.3,      // Mention explicite dans le prompt
  RECENTLY_VIEWED_1H: 0.25,   // Vu il y a < 1h
  RECENTLY_VIEWED_6H: 0.15,   // Vu il y a < 6h
  RECENTLY_EDITED_1H: 0.3,    // Éditée il y a < 1h
};

export interface RankParams {
  userPrompt: string;
  editorState: EditorState;
  limit?: number;       // Nombre max de résultats (default: 15)
  tokenBudget?: number; // Budget en tokens (default: 30000)
}

export class ContextRanker {
  private graph: ContextGraph;
  
  constructor() {
    this.graph = {
      nodes: contextGraphStore.getNodes(),
      edges: contextGraphStore.getEdges()
    };
  }

  async rank(params: RankParams): Promise<RankedContextItem[]> {
    const { userPrompt, editorState, limit = 15, tokenBudget = 30000 } = params;
    
    // 1. Calculer les scores pour tous les nœuds
    const scoredNodes = this.calculateScores(userPrompt, editorState);
    
    // 2. Filtrer et trier par score décroissant
    const filteredAndSorted = scoredNodes
      .filter(item => item.score > 0.1) // Seuils minimum de pertinence
      .sort((a, b) => b.score - a.score);
    
    // 3. Estimer les tokens pour chaque nœud et appliquer le budget
    const itemsWithBudget = this.pruneToBudget(filteredAndSorted, tokenBudget);
    
    // 4. Rendre les top N résultats
    return itemsWithBudget.slice(0, limit);
  }

  private calculateScores(prompt: string, editorState: EditorState): RankedContextItem[] {
    const promptLower = prompt.toLowerCase();
    
    return Array.from(this.graph.nodes.values()).map(node => {
      let score = 0;
      const reasons: string[] = [];
      
      // 1. Match direct avec le fichier actif (le plus important)
      if (editorState.activeFile === node.id) {
        score += SCORES.DIRECT_MATCH;
        reasons.push('Fichier actif');
      }
      
      // 2. Mention explicite dans le prompt (nom de fichier)
      const fileName = node.metadata.name.toLowerCase();
      if (promptLower.includes(fileName)) {
        score += SCORES.EXPLICIT_MENTION;
        reasons.push(`Mentionné: ${fileName}`);
      }
      
      // 3. Récence - vu récemment
      const lastViewed = node.metadata.lastViewed || 0;
      if (lastViewed > 0) {
        const hoursAgo = (Date.now() - lastViewed) / (1000 * 60 * 60);
        if (hoursAgo < 1) {
          score += SCORES.RECENTLY_VIEWED_1H;
          reasons.push('Vu récemment (<1h)');
        } else if (hoursAgo < 6) {
          score += SCORES.RECENTLY_VIEWED_6H;
          reasons.push('Vu récemment (<6h)');
        }
      }
      
      // 4. Récence - modifié récemment
      const lastEdited = node.metadata.lastEdited || 0;
      if (lastEdited > 0) {
        const hoursAgo = (Date.now() - lastEdited) / (1000 * 60 * 60);
        if (hoursAgo < 1) {
          score += SCORES.RECENTLY_EDITED_1H;
          reasons.push('Modifié récemment (<1h)');
        }
      }
      
      // 5. Proximité dans le graphe - voisins du fichier actif
      if (editorState.activeFile && editorState.activeFile !== node.id) {
        const neighbors = this.getNeighbors(editorState.activeFile, 2);
        if (neighbors.has(node.id)) {
          score += SCORES.NEIGHBOR;
          reasons.push('Proche dans le graphe');
        }
      }
      
      return {
        ...node,
        score: Math.min(score, 1.0), // Cap à 1.0
        reasons: reasons.length > 0 ? reasons : ['Contexte général']
      };
    });
  }

  private getNeighbors(nodeId: string, maxDistance: number): Set<string> {
    const visited = new Set<string>();
    const queue: Array<{ id: string; distance: number }> = [{ id: nodeId, distance: 0 }];
    
    while (queue.length > 0) {
      const { id, distance } = queue.shift()!;
      
      if (visited.has(id)) continue;
      visited.add(id);
      
      if (distance < maxDistance) {
        const edges = this.graph.edges.get(id) || [];
        for (const edge of edges) {
          if (!visited.has(edge.targetId)) {
            queue.push({ id: edge.targetId, distance: distance + 1 });
          }
        }
      }
    }
    
    visited.delete(nodeId); // Retirer le nœud source
    return visited;
  }

  private pruneToBudget(items: RankedContextItem[], budget: number): RankedContextItem[] {
    let totalTokens = 0;
    const result: RankedContextItem[] = [];
    
    for (const item of items) {
      // Estimation approximative: 4 tokens par ligne
      const estimatedTokens = Math.ceil(item.stats.lineCount / 4);
      
      if (totalTokens + estimatedTokens <= budget) {
        totalTokens += estimatedTokens;
        result.push(item);
      } else {
        break; // Arrêter quand le budget est atteint
      }
    }
    
    return result;
  }
}

export const contextRanker = new ContextRanker();
