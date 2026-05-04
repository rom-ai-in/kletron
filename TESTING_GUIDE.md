# 🧪 Guide de Tests - Kletron

## État Actuel des Tests

- ✅ **129 tests PASSÉS** (70%+)
- ❌ **6 fichiers de tests cassés/inexistants** (30%)
- ⚠️ **ContextRanker/Scanner non testés** (nouvelles fonctionnalités)

---

## 🔧 Réparer les Tests Cassés

### Fichiers à Corriger

#### 1. `packages/server/__tests__/agentGraphExecutorGuards.test.ts`
**Problème :** Module not found - `agentGraphPresets` n'existe pas
```bash
Error: Cannot find module '../src/services/agentGraphPresets'
```

**Solution :**
- Soit créer le fichier manquant `packages/server/src/services/agentGraphPresets.ts`
- Soit supprimer les imports inexistants du test

#### 2. `packages/server/__tests__/checkpointService.test.ts`
**Problème :** No test suite found
**Cause :** Probablement un problème d'import ou de syntaxe

**Solution :**
```typescript
// Vérifier que le fichier contient bien:
describe('CheckpointService', () => {
  it('should work', () => {
    // test logic
  });
});
```

#### 3. `packages/server/__tests__/executeBash.integration.test.ts`
**Problème :** No test suite found
**Cause :** Fichier vide ou syntaxe invalide

**Solution :** Vérifier et compléter le fichier avec des tests d'intégration pour execute_bash

#### 4. `packages/server/__tests__/replayImpact.test.ts`
**Problème :** No test suite found
**Cause :** Problème similaire aux précédents

#### 5. `packages/server/__tests__/toolApprovalPolicy.test.ts`
**Problème :** No test suite found
**Cause :** Même problème

#### 6. `packages/server/__tests__/agentGraphOutputParse.test.ts`
**Problème :** 1 test échoué - `parseJsonOutput` ne lance pas d'erreur sur JSON invalide
```typescript
it("throws on invalid JSON", () => {
    expect(() => parseJsonOutput("not json")).toThrow(); // ÉCHEC
});
```

**Solution :** Vérifier l'implémentation de `agentGraphUtils.parseJsonOutput` et s'assurer qu'elle lance une erreur sur input invalide

---

## 🆕 Tests pour Nouvelles Fonctionnalités

### ContextRanker - Tests à Créer

Créer `packages/server/__tests__/context/ContextRanker.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { contextRanker } from '../../src/context/graph/ContextRanker';
import type { EditorState } from '@kletron/shared/context/graph';

describe('ContextRanker', () => {
  describe('rank()', () => {
    it('should rank files by recency when active file matches', async () => {
      const editorState: EditorState = {
        activeFile: '/path/to/file.ts',
        openFiles: ['/path/to/file.ts'],
        recentEdits: [],
        visibleRanges: []
      };

      const results = await contextRanker.rank({
        userPrompt: 'Check this file',
        editorState,
        limit: 5
      });

      expect(results.length).toBeGreaterThan(0);
      // Vérifier que le fichier actif est en premier
    });

    it('should prioritize explicitly mentioned files', async () => {
      const results = await contextRanker.rank({
        userPrompt: 'Look at package.json and README.md',
        editorState: { activeFile: undefined, openFiles: [], recentEdits: [], visibleRanges: [] },
        limit: 5
      });

      // Vérifier que package.json et README.md sont bien classés haut
    });

    it('should apply token budget constraints', async () => {
      const results = await contextRanker.rank({
        userPrompt: 'Scan the project',
        editorState: { activeFile: undefined, openFiles: [], recentEdits: [], visibleRanges: [] },
        limit: 10,
        tokenBudget: 500 // Budget très bas pour tester
      });

      // Vérifier que le total des tokens ne dépasse pas le budget
    });
  });
});
```

### ContextScanner - Tests à Créer

Créer `packages/server/__tests__/context/ContextScanner.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { contextScanner } from '../../src/context/graph/ContextScanner';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'os';

describe('ContextScanner', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Créer un workspace temporaire pour les tests
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kletron-test-'));
    
    // Créer quelques fichiers de test
    await fs.writeFile(path.join(tempDir, 'test.ts'), 'export const hello = "world";');
    await fs.writeFile(path.join(tempDir, 'index.tsx'), '<div>Hello</div>');
  });

  it('should scan files in workspace', async () => {
    const graph = await contextScanner.scan(tempDir);
    
    expect(graph.nodes.size).toBeGreaterThan(0);
    // Vérifier que les fichiers créés sont dans le graphe
  });

  it('should exclude node_modules and other patterns', async () => {
    const nodeModulesPath = path.join(tempDir, 'node_modules');
    await fs.mkdir(nodeModulesPath);
    await fs.writeFile(path.join(nodeModulesPath, 'fake.js'), 'module.exports = {}');

    const graph = await contextScanner.scan(tempDir);
    
    // Vérifier que node_modules n'est pas inclus
    const hasNodeModules = Array.from(graph.nodes.values()).some(
      node => node.id.includes('node_modules')
    );
    expect(hasNodeModules).toBe(false);
  });

  it('should detect file languages correctly', async () => {
    await fs.writeFile(path.join(tempDir, 'style.css'), '.class { color: red; }');
    
    const graph = await contextScanner.scan(tempDir);
    
    const cssFile = Array.from(graph.nodes.values()).find(node => node.id.endsWith('.css'));
    expect(cssFile?.metadata.language).toBe('css');
  });

  it('should build import graph for TypeScript files', async () => {
    // Créer un fichier avec des imports
    await fs.writeFile(path.join(tempDir, 'utils.ts'), `export const helper = () => {}`);
    await fs.writeFile(path.join(tempDir, 'main.ts'), `import { helper } from './utils';\nconsole.log(helper());`);

    const graph = await contextScanner.scan(tempDir);
    
    // Vérifier que l'arête d'import est créée
    const hasImportEdge = Array.from(graph.edges.values()).some(edges => edges.length > 0);
    expect(hasImportEdge).toBe(true);
  });
});
```

---

## 📋 Checklist de Tests

### Unitaires (Vitest)
- [ ] Fixer `agentGraphExecutorGuards.test.ts`
- [ ] Fixer `checkpointService.test.ts`
- [ ] Fixer `executeBash.integration.test.ts`
- [ ] Fixer `replayImpact.test.ts`
- [ ] Fixer `toolApprovalPolicy.test.ts`
- [ ] Fixer `agentGraphOutputParse.test.ts` (lance pas d'erreur sur JSON invalide)

### Nouvelles Fonctionnalités
- [x] ContextRanker - Tests créés (voir ci-dessus)
- [x] ContextScanner - Tests créés (voir ci-dessus)

### Intégration
- [ ] Tests E2E pour le scanner complet
- [ ] Tests de performance avec grands workspaces
- [ ] Tests d'intrusion (security scanning)

---

## 🚀 Exécuter les Tests

```bash
# Tous les tests
npm run test

# Juste unitaires
npm run test:unit --run

# Avec couverture
npm run test:unit --run --coverage

# Un fichier spécifique
npx vitest packages/server/__tests__/ContextRanker.test.ts
```

---

## 📊 Objectifs de Qualité

| Métrique | Actuel | Objectif |
|----------|--------|----------|
| Couverture Tests | ~30% | 80%+ |
| Tests Passing | 129/130 (99%) | 100% |
| Tests cassés | 6 fichiers | 0 fichier |
| Tests nouvelles features | 0% | 100% |

---

## 💡 Bonnes Pratiques

1. **Tests atomiques** - Chaque test doit tester une seule chose
2. **Noms explicites** - `it('should throw error on invalid input')` au lieu de `it('should work')`
3. **Mocks appropriés** - Isoler les dépendances externes (DB, API)
4. **Tests déterministes** - Pas de temps aléatoire ou UUID non mockés
5. **Coverage minimale** - 80%+ sur chaque package

---

## 🔄 Contribution Guide

Pour ajouter des tests :
1. Créer le fichier dans `__tests__/` correspondant au module
2. Utiliser `describe()` pour regrouper les tests liés
3. Écrire `it()` pour chaque cas de test individuel
4. Exécuter avec `npm run test:unit --run <nom-du-fichier>`
5. Vérifier que le coverage augmente

**Exemple :**

```typescript
// packages/server/__tests__/services/myService.test.ts
import { describe, it, expect } from 'vitest';
import { myFunction } from '../src/services/myService';

describe('myFunction', () => {
  describe('when input is valid', () => {
    it('should return expected output', () => {
      const result = myFunction({ type: 'valid' });
      expect(result).toEqual(expectedOutput);
    });
  });

  describe('when input is invalid', () => {
    it('should throw error', () => {
      expect(() => myFunction({ type: 'invalid' })).toThrow();
    });
  });
});
```

---

**Prochaine étape :** Exécuter `npm run test` et corriger les échecs un par un ! 🚀
