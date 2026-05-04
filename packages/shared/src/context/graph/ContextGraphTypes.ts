/**
 * Types pour le Context Graph - Mémoire structurée du dépôt
 */

export type ContextNodeType = 'file' | 'symbol' | 'folder';

export interface ContextNode {
  id: string; // chemin absolu pour les fichiers
  type: ContextNodeType;
  label: string; // nom affiché (ex: fichier ou dossier)
  metadata: {
    name: string;
    path?: string;
    language?: string;
    lastViewed?: number;
    lastEdited?: number;
    viewCount?: number;
    editCount?: number;
  };
  stats: {
    size: number;
    lineCount: number;
    tokenEstimate: number;
  };
}

export interface RankedContextItem extends ContextNode {
  score: number;
  reasons: string[];
}

export interface ContextEdge {
  sourceId: string;
  targetId: string;
  type: 'imports' | 'referenced_in' | 'contains' | 'extends';
  metadata?: Record<string, unknown>;
}

export interface ContextGraph {
  nodes: Map<string, ContextNode>;
  edges: Map<string, ContextEdge[]>;
}

export interface ContextRankResult {
  items: RankedContextItem[];
  totalNodes: number;
  budgetUsed: number;
}

export interface EditorState {
  activeFile?: string;
  openFiles: string[];
  cursorPosition?: { line: number; column: number };
  recentEdits: Array<{ path: string; timestamp: number }>;
  visibleRanges: Array<{ file: string; startLine: number; endLine: number }>;
}

export interface ContextScannerOptions {
  excludePatterns?: string[];
  includeExtensions?: string[];
  maxDepth?: number;
}
