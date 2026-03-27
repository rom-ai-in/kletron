/**
 * Script de test pour ContextScanner - Lance un scan complet et affiche les résultats
 */

import { contextScanner } from '../packages/server/src/context/graph/ContextScanner';

async function runTest() {
  console.log('=== TEST CONTEXT SCANNER ===\n');
  
  // Workspace à scanner (le projet Kletron lui-même)
  const workspaceRoot = process.env.WORKSPACE_ROOT || '/home/romain/.openclaw/workspace/kletron';
  
  console.log(`Workspace: ${workspaceRoot}`);
  console.log('Starting scan...\n');
  
  try {
    const startTime = Date.now();
    
    // Lancer le scan
    const graph = await contextScanner.scan(workspaceRoot);
    
    const duration = Date.now() - startTime;
    
    console.log('\n=== RÉSULTATS ===\n');
    console.log(`Nodes: ${graph.nodes.size}`);
    console.log(`Edges: ${Array.from(graph.edges.values()).reduce((sum, arr) => sum + arr.length, 0)}`);
    console.log(`Duration: ${duration}ms`);
    
    console.log('\n--- TOP 10 FILES BY SIZE ---');
    const sortedNodes = Array.from(graph.nodes.values())
      .sort((a, b) => b.stats.size - a.stats.size)
      .slice(0, 10);
    
    for (const node of sortedNodes) {
      console.log(`\n${node.label}`);
      console.log(`  Size: ${(node.stats.size / 1024).toFixed(1)} KB`);
      console.log(`  Lines: ${node.stats.lineCount.toLocaleString()}`);
      console.log(`  Language: ${node.metadata.language || 'unknown'}`);
    }
    
    console.log('\n--- LANGUAGES DISTRIBUTION ---');
    const languageCounts = new Map<string, number>();
    for (const node of graph.nodes.values()) {
      const lang = node.metadata.language || 'unknown';
      languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
    }
    
    // Convert to array for sorting
    const sortedLanguages = Array.from(languageCounts.entries()).sort((a, b) => b[1] - a[1]);
    
    for (const [lang, count] of sortedLanguages) {
      console.log(`${lang}: ${count}`);
    }
    
    console.log('\n✅ Scan completed successfully!');
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Scan failed:', err);
    process.exit(1);
  }
}

runTest();
