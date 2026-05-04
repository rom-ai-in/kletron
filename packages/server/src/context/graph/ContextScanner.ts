/**
 * ContextScanner - Scanne l'arborescence pour construire le graphe de contexte
 */

import { glob } from 'glob';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { ContextNode, ContextGraph } from '@kletron/shared/context/graph';
import type { ContextScannerOptions } from '@kletron/shared/context/graph/ContextGraphTypes';
import { contextGraphStore } from './ContextGraphStore';

// Extensions supportées pour l'analyse
const SUPPORTED_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', 
  '.md', '.json', '.yml', '.yaml',
  '.html', '.css', '.scss', '.less',
  '.vue', '.svelte', '.astro'
];

// Patterns à exclure
const EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.next/**',
  '**/dist/**',
  '**/build/**',
  '**/*.min.js',
  '**/coverage/**'
];

export class ContextScanner {
  private options: ContextScannerOptions;

  constructor(options: ContextScannerOptions = {}) {
    this.options = {
      excludePatterns: EXCLUDE_PATTERNS,
      includeExtensions: SUPPORTED_EXTENSIONS,
      maxDepth: 20,
      ...options
    };
  }

  async scan(rootPath: string): Promise<ContextGraph> {
    const nodes: Map<string, ContextNode> = new Map();
    
    console.log(`[ContextScanner] Starting scan of ${rootPath}...`);
    
    // Trouver tous les fichiers pertinents
    const files = await this.findFiles(rootPath);
    console.log(`[ContextScanner] Found ${files.length} relevant files`);
    
    // Créer des nœuds pour chaque fichier
    for (const filePath of files) {
      try {
        const node = await this.createNode(filePath, rootPath);
        nodes.set(node.id, node);
      } catch (err) {
        console.warn(`[ContextScanner] Failed to create node for ${filePath}:`, err);
      }
    }
    
    // Analyser les imports pour construire le graphe
    await this.buildImportGraph(nodes, rootPath);
    
    console.log(`[ContextScanner] Scan complete: ${nodes.size} nodes`);
    
    contextGraphStore.clear();
    for (const [id, node] of nodes) {
      contextGraphStore.addNode(node);
    }
    
    return { 
      nodes: new Map(nodes), 
      edges: contextGraphStore.getEdges() 
    };
  }

  async scanWorkspace(workspaceRoot: string): Promise<ContextGraph> {
    // Alias pour scanner avec le chemin de workspace
    return this.scan(workspaceRoot);
  }

  private async findFiles(rootPath: string): Promise<string[]> {
    const patterns = this.options.includeExtensions?.map(ext => `**/*${ext}`) || [];
    
    if (patterns.length === 0) {
      return [];
    }
    
    try {
      const files = await glob(patterns, {
        cwd: rootPath,
        absolute: true,
        nodir: true,
        ignore: this.options.excludePatterns || EXCLUDE_PATTERNS,
        maxDepth: this.options.maxDepth || 20
      });
      
      return files.filter(f => f.startsWith(rootPath));
    } catch (err) {
      console.error(`[ContextScanner] Failed to find files in ${rootPath}:`, err);
      return [];
    }
  }

  private async createNode(filePath: string, rootPath: string): Promise<ContextNode> {
    const relativePath = path.relative(rootPath, filePath);
    const fileName = path.basename(filePath);
    
    // Déterminer le type de nœud
    let nodeType: 'file' | 'symbol' | 'folder';
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      nodeType = 'file';
    } else {
      nodeType = 'file';
    }
    
    // Lire les métadonnées du fichier
    let lineCount = 0;
    let fileSize = 0;
    
    try {
      const stats = await fs.stat(filePath);
      fileSize = stats.size;
      
      const content = await fs.readFile(filePath, 'utf-8');
      lineCount = content.split('\n').length;
    } catch (err) {
      console.warn(`[ContextScanner] Failed to read ${filePath}:`, err);
    }
    
    return {
      id: filePath,
      type: nodeType,
      label: relativePath,
      metadata: {
        name: fileName,
        path: relativePath,
        language: this.getLanguage(filePath),
        lastViewed: Date.now(), // Timestamp initial
        viewCount: 0,
        editCount: 0
      },
      stats: {
        size: fileSize,
        lineCount,
        tokenEstimate: Math.ceil(lineCount / 4)
      }
    };
  }

  private getLanguage(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript-react',
      '.js': 'javascript',
      '.jsx': 'javascript-react',
      '.md': 'markdown',
      '.json': 'json',
      '.yml': 'yaml',
      '.yaml': 'yaml',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.vue': 'vue'
    };
    
    return languageMap[ext];
  }

  private async buildImportGraph(nodes: Map<string, ContextNode>, rootPath: string): Promise<void> {
    // Analyser les imports relatifs entre fichiers
    for (const [id, node] of nodes) {
      if (!node.metadata.language?.includes('typescript') && 
          !node.metadata.language?.includes('javascript')) {
        continue;
      }
      
      try {
        const content = await fs.readFile(id, 'utf-8');
        const imports = this.parseImports(content, path.dirname(id), rootPath);
        
        for (const importNode of imports) {
          if (nodes.has(importNode.targetId)) {
            contextGraphStore.addEdge({
              sourceId: id,
              targetId: importNode.targetId,
              type: 'imports'
            });
            
            // Mettre à jour les stats de vue/édition
            const targetNode = nodes.get(importNode.targetId);
            if (targetNode) {
              targetNode.metadata.viewCount = (targetNode.metadata.viewCount || 0) + 1;
              targetNode.metadata.lastViewed = Date.now();
              contextGraphStore.addNode(targetNode);
            }
          }
        }
      } catch (err) {
        console.warn(`[ContextScanner] Failed to parse imports for ${id}:`, err);
      }
    }
  }

  private parseImports(content: string, currentDir: string, rootPath: string): Array<{ sourceId: string; targetId: string }> {
    const imports: Array<{ sourceId: string; targetId: string }> = [];
    
    // Regex pour les import ES6 et CommonJS
    const importRegex = /import\s+(?:[\w{},\s*]+\s+from\s+['"]|require\s*\(\s*['"])(.+?)['"]/g;
    const exportFromRegex = /export\s+\*\s+from\s+['"](.+)['"]/g;
    
    let match;
    const regexes = [importRegex, exportFromRegex];
    
    for (const regex of regexes) {
      while ((match = regex.exec(content)) !== null) {
        const importPath = match[1].trim();
        
        // Résoudre les chemins relatifs
        if (importPath.startsWith('.')) {
          try {
            let resolvedPath = path.resolve(currentDir, importPath);
            
            // Essayer d'ajouter des extensions si nécessaire
            const possiblePaths = [
              resolvedPath,
              resolvedPath + '.ts',
              resolvedPath + '.tsx',
              resolvedPath + '.js',
              resolvedPath + '/index.ts',
              resolvedPath + '/index.tsx',
              resolvedPath + '/index.js'
            ];
            
            for (const possiblePath of possiblePaths) {
              if (possiblePath.startsWith(rootPath)) {
                imports.push({ sourceId: currentDir, targetId: possiblePath });
                break;
              }
            }
          } catch (err) {
            // Ignorer les chemins qui ne peuvent pas être résolus
          }
        }
      }
    }
    
    return imports;
  }
}

export const contextScanner = new ContextScanner();
