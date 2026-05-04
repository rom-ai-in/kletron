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

import type { 
  RankedContextItem, 
  EditorState,
  ContextNode,
  ContextGraph
} from '@kletron/shared/context/graph';
import { contextGraphStore } from './ContextGraphStore';

// Scores de pondération constants - Définit l'importance relative de chaque critère
const SCORES = {
  DIRECT_MATCH: 1.0,           // Fichier actif ouvert (priorité absolue)
  NEIGHBOR: 0.5,              // Voisin dans le graphe d'imports
  EXPLICIT_MENTION: 0.3,      // Mention explicite dans le prompt utilisateur
  RECENTLY_VIEWED_1H: 0.25,   // Vu il y a < 1 heure
  RECENTLY_VIEWED_6H: 0.15,   // Vu il y a < 6 heures
  RECENTLY_EDITED_1H: 0.3,    // Éditée il y a < 1 heure (priorité élevée)
};

/**
 * Paramètres pour le ranking du contexte
 */
export interface RankParams {
  /** Prompt utilisateur - utilisé pour détecter les mentions explicites de fichiers */
  userPrompt: string;
  
  /** État actuel de l'éditeur - fichier actif, fichiers ouverts, etc. */
  editorState: EditorState;
  
  /** Nombre maximum de résultats à retourner (default: 15) */
  limit?: number;
  
  /** Budget en tokens pour le contexte injecté au LLM (default: 30000) */
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
  private graph: ContextGraph;
  
  /**
   * Constructeur du ContextRanker
   * 
   * Initialise le graphe à partir du store global. Le scanner doit être exécuté
   * avant d'utiliser ce class pour garantir que le graphe contient des données.
   */
  constructor() {
    this.graph = {
      nodes: contextGraphStore.getNodes(),
      edges: contextGraphStore.getEdges()
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
    
    console.log(`[ContextRanker] Ranking ${this.graph.nodes.size} nodes for prompt: "${userPrompt}"`);
    
    // 1. Calculer les scores pour tous les nœuds
    const scoredNodes = this.calculateScores(userPrompt, editorState);
    console.log(`[ContextRanker] Scored ${scoredNodes.length} items, max score: ${(Math.max(...scoredNodes.map(s => s.score)) * 100).toFixed(1)}%`);
    
    // 2. Filtrer et trier par score décroissant
    const filteredAndSorted = scoredNodes
      .filter(item => item.score > 0.1) // Seuils minimum de pertinence
      .sort((a, b) => b.score - a.score);
    
    console.log(`[ContextRanker] After filtering: ${filteredAndSorted.length} items with score > 0.1`);
    
    // 3. Estimer les tokens pour chaque nœud et appliquer le budget
    const itemsWithBudget = this.pruneToBudget(filteredAndSorted, tokenBudget);
    
    console.log(`[ContextRanker] After budget pruning: ${itemsWithBudget.length} items (budget: ${tokenBudget} tokens)`);
    
    // 4. Rendre les top N résultats
    return itemsWithBudget.slice(0, limit);
  }

  /**
   * Calcule les scores de pertinence pour chaque nœud du graphe
   * 
   * Critères de scoring :
   * - **Fichier actif** (DIRECT_MATCH): +1.0 point - priorité absolue
   * - **Mention explicite** (EXPLICIT_MENTION): +0.3 point si le nom du fichier est dans le prompt
   * - **Vu récemment < 1h** (RECENTLY_VIEWED_1H): +0.25 point
   * - **Vu récemment < 6h** (RECENTLY_VIEWED_6H): +0.15 point
   * - **Éditée récemment < 1h** (RECENTLY_EDITED_1H): +0.3 point
   * - **Voisin dans le graphe** (NEIGHBOR): +0.5 point si proche du fichier actif
   * 
   * @param prompt - Prompt utilisateur pour détecter les mentions explicites
   * @param editorState - État de l'éditeur pour vérifier le fichier actif et la proximité
   * @returns Tableau d'items avec scores calculés et raisons associées
   */
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
        score: Math.min(score, 1.0), // Cap à 1.0 pour normalisation
        reasons: reasons.length > 0 ? reasons : ['Contexte général']
      };
    });
  }

  /**
   * Trouve les nœuds voisins dans le graphe d'imports jusqu'à une distance maximale
   * 
   * Utilise un BFS (Breadth-First Search) pour explorer le graphe à partir du nœud source.
   * 
   * @param nodeId - ID du nœud de départ
   * @param maxDistance - Distance maximale en sauts d'imports
   * @returns Ensemble des IDs des nœuds voisins
   */
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

  /**
   * Prune les items en fonction du budget de tokens disponible
   * 
   * Estime le nombre de tokens par fichier (approximativement: lignes / 4) et sélectionne
   * les items prioritaires jusqu'à épuisement du budget.
   * 
   * @param items - Items classés par pertinence décroissante
   * @param budget - Budget maximum en tokens
   * @returns Items filtrés qui tiennent dans le budget
   */
  private pruneToBudget(items: RankedContextItem[], budget: number): RankedContextItem[] {
    let totalTokens = 0;
    const result: RankedContextItem[] = [];
    
    for (const item of items) {
      // Estimation approximative: 4 tokens par ligne (moyenne pour le TypeScript/JavaScript)
      const estimatedTokens = Math.ceil(item.stats.lineCount / 4);
      
      if (totalTokens + estimatedTokens <= budget) {
        totalTokens += estimatedTokens;
        result.push(item);
      } else {
        break; // Arrêter quand le budget est atteint
      }
    }
    
    console.log(`[ContextRanker] Budget used: ${totalTokens}/${budget} tokens, items included: ${result.length}`);
    
    return result;
  }
}

/**
 * Instance singleton du ContextRanker
 * 
 * Utiliser cette instance plutôt que de créer un nouveau ContextRanker à chaque fois.
 */
export const contextRanker = new ContextRanker();

    
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
