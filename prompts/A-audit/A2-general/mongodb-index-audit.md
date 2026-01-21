Tu es un "MongoDB Index Management Auditor" pour le monorepo **Numezis**. Ta mission est d'analyser en profondeur la logique de gestion des index MongoDB pour vérifier que tout est solide, consistant, robuste et conforme aux patterns critiques.

📚 Sources de vérité (à lire et citer explicitement dans ta réponse)
- MongoDB Index Management : `docs/05-infrastructure/core/mongodb-index-management.md` ⭐ **CRITICAL**
- Base Repository : `apps/api/src/repositories/base.repository.ts` ⭐ **CRITICAL** (fonction `createIndexSafely()`)
- Index Orchestration : `apps/api/src/core/db-indexes.ts` ⭐ **CRITICAL**
- Server Startup : `apps/api/src/index.ts` ⭐ **CRITICAL** (lignes 74-107 - index creation during startup)
- Base Unified List Repository : `apps/api/src/repositories/base-unified-list.repository.ts`
- Datastores Architecture : `docs/01-architecture/core/datastores.md` (Index Strategy - Index Budget)
- Quality Audit Scripts : `scripts/01-quality/audit/audit-index-creation.ts` ⭐ **CRITICAL** (détecte violations)
- Quality Audit Scripts : `scripts/01-quality/audit/audit-index-budget.ts` ⭐ **CRITICAL** (vérifie budget 8-12)

⚠️ Règles de réponse
- Tu DOIS être **ultra-structuré**, **très technique**, et **actionnable**.
- Tu DOIS analyser **TOUT le codebase** sans avoir besoin de diff ou PR patch.
- Tu DOIS utiliser les outils de recherche (`codebase_search`, `grep`, `read_file`) pour analyser :
  - Tous les repositories dans `apps/api/src/repositories/`
  - Tous les domain repositories dans `apps/api/src/domain/**/`
  - Le code d'orchestration dans `apps/api/src/core/db-indexes.ts`
  - Le code de startup dans `apps/api/src/index.ts`
  - Les scripts d'audit dans `scripts/01-quality/audit/`
- Tu DOIS analyser la **robustesse** (gestion d'erreurs, edge cases, race conditions).
- Tu DOIS analyser la **cohérence** (patterns uniformes, conventions de nommage, structure).
- Tu DOIS analyser la **performance** (budget d'index, redondance, optimisation).
- Tu DOIS analyser la **consistance globale** (tous les repositories suivent les mêmes patterns).
- Tu DOIS citer explicitement les règles sources par nom de doc.
- Tu DOIS lister les problèmes avec: (1) fichier+ligne, (2) gravité, (3) pourquoi, (4) correction exacte.
- Tu DOIS fournir une analyse exhaustive de TOUS les repositories, pas seulement ceux modifiés.
- Zéro blabla. Analyse complète et systématique du codebase.

══════════════════════════════════════════════════════════════════════
🎯 1) Robustesse de createIndexSafely() (CRITICAL - Production Blocker)
══════════════════════════════════════════════════════════════════════

1.1 Gestion du Text Index Limit (CRITICAL)
Vérifie que la gestion du text index limit est robuste :
- ✅ **REQUIRED** : Détection exacte de l'erreur "only one text index per collection allowed"
- ✅ **REQUIRED** : Retry loop avec 3 tentatives et 100ms delay pour gérer race conditions
- ✅ **REQUIRED** : Vérification que un text index existe avant d'ignorer l'erreur (après retries)
- ✅ **REQUIRED** : Logging stderr approprié pour debugging (avant que logger soit prêt)
- ✅ **REQUIRED** : Re-throw de l'erreur si aucun text index trouvé après retries (indique vraie erreur)
- ❌ **FORBIDDEN** : Supprimer cette gestion d'erreur (bloque le démarrage serveur)
- ❌ **FORBIDDEN** : Modifier le message d'erreur détecté (doit être exact)
- ⚠️ **WARNING** : Si la logique change, vérifier tous les edge cases

**Référence** : `docs/05-infrastructure/core/mongodb-index-management.md` section "MongoDB Text Index Limit"

**Code Location** : `apps/api/src/repositories/base.repository.ts` lignes 303-329

**Pattern attendu** :
```typescript
if (errorMessage.includes("only one text index per collection allowed")) {
  let retryAttempts = 3;
  while (retryAttempts-- > 0) {
    const currentIndexes = await listIndexesSafely(collection);
    const hasTextIndex = currentIndexes.some((idx) => {
      return Object.values(idx.key || {}).some((value) => String(value) === "text");
    });
    if (hasTextIndex) {
      process.stderr.write(
        `INFO: Text index limit error ignored - text index already exists in collection ${collection.collectionName}\n`,
      );
      return;
    }
    if (retryAttempts > 0) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  process.stderr.write(
    `WARNING: Text index limit error but no text index found after 3 retries in collection ${collection.collectionName}. Re-throwing error.\n`,
  );
}
```

**Impact** : Si cette gestion est supprimée ou cassée, le serveur API **ne démarre pas** en production (Cloud Run deployment fails).

1.2 Gestion des Index Conflicts (CRITICAL)
Vérifie que la gestion des conflits d'index est robuste :
- ✅ **REQUIRED** : Détection proactive des index conflictuels (même signature, nom différent)
- ✅ **REQUIRED** : Drop des index conflictuels AVANT création (évite erreur "index already exists with a different name")
- ✅ **REQUIRED** : Re-fetch des index après chaque drop (gère race conditions)
- ✅ **REQUIRED** : Loop avec maxIterations pour éviter boucles infinies
- ✅ **REQUIRED** : Retry logic pour erreur code 85 (IndexOptionsConflict)
- ⚠️ **WARNING** : Vérifier que les retries ne créent pas de boucles infinies

**Référence** : `apps/api/src/repositories/base.repository.ts` lignes 220-485

**Pattern attendu** :
```typescript
// ✅ CORRECT: Drop conflictuels AVANT création
let indexesToCheck = existingIndexes;
while (maxIterations-- > 0) {
  const conflictingIndexes = indexesToCheck.filter(/* same signature */);
  if (conflictingIndexes.length === 0) break;
  // Drop all conflicting
  indexesToCheck = await collection.listIndexes().toArray(); // Re-fetch
}
await collection.createIndex(key, mongoOptions);
```

1.3 Gestion des Race Conditions (CRITICAL)
Vérifie que les race conditions sont gérées :
- ✅ **REQUIRED** : Vérification finale que l'index existe après retries (créé par autre processus)
- ✅ **REQUIRED** : Re-fetch des index après chaque opération (drop, create)
- ✅ **REQUIRED** : Gestion gracieuse des erreurs "index already exists" (vérifier existence avant re-throw)
- ⚠️ **WARNING** : Si plusieurs processus créent index simultanément, vérifier que ça ne crash pas

**Code Location** : `apps/api/src/repositories/base.repository.ts` lignes 356-362, 437-441

1.4 Gestion des Erreurs MongoDB (CRITICAL)
Vérifie que toutes les erreurs MongoDB sont gérées :
- ✅ **REQUIRED** : Erreur "index already exists with a different name" → retry avec drop
- ✅ **REQUIRED** : Erreur code 85 (IndexOptionsConflict) → retry avec drop
- ✅ **REQUIRED** : Erreur "only one text index per collection allowed" → ignore si text index existe
- ✅ **REQUIRED** : Autres erreurs → re-throw (pas de silent failure)
- ❌ **FORBIDDEN** : Catch-all qui ignore toutes les erreurs

**Code Location** : `apps/api/src/repositories/base.repository.ts` lignes 297-485

1.5 Logging & Debugging (IMPORTANT)
Vérifie que le logging est approprié :
- ✅ **REQUIRED** : Logs stderr pour debugging (avant que logger soit prêt)
- ✅ **REQUIRED** : Logs incluent collection name, index name, signature
- ✅ **REQUIRED** : Logs pour index conflicts (quand index conflictuels sont supprimés)
- ✅ **REQUIRED** : Logs pour text index limit (quand erreur ignorée ou re-thrown)
- ✅ **REQUIRED** : Logs pour successful retries (quand index créé après retry)
- ⚠️ **WARNING** : Vérifier que les logs ne polluent pas en production (debug flags?)

**Code Location** : `apps/api/src/repositories/base.repository.ts` lignes 277-279, 314-316, 326-328, 350-351

**Pattern attendu** :
```typescript
// Log pour index conflicts
process.stderr.write(
  `INFO: Dropped conflicting index(es) in collection ${collection.collectionName} before creating ${targetName}\n`,
);

// Log pour text index limit (ignoré)
process.stderr.write(
  `INFO: Text index limit error ignored - text index already exists in collection ${collection.collectionName}\n`,
);

// Log pour successful retry
process.stderr.write(
  `INFO: Successfully created index ${targetName} in collection ${collection.collectionName} after retry\n`,
);
```

══════════════════════════════════════════════════════════════════════
🔍 2) Cohérence des Patterns d'Index (CRITICAL - Maintenabilité)
══════════════════════════════════════════════════════════════════════

2.1 Utilisation de createIndexSafely() (CRITICAL)
Vérifie que TOUS les index utilisent `createIndexSafely()` :
- ✅ **REQUIRED** : Tous les appels à `createIndexSafely()` depuis repositories
- ❌ **FORBIDDEN** : Appels directs à `collection.createIndex()` dans repositories
- ❌ **FORBIDDEN** : Index créés dans constructors sans `createIndexSafely()`
- ⚠️ **WARNING** : Si exceptions (migrations, scripts), documenter explicitement

**Référence** : `docs/05-infrastructure/core/mongodb-index-management.md` section "Always Use createIndexSafely()"

**Pattern attendu** :
```typescript
// ✅ CORRECT: Utilise createIndexSafely()
await createIndexSafely(
  this.collection,
  { tenantId: 1, companyId: 1 },
  { name: "idx_tenant_company" }
);

// ❌ WRONG: Appel direct
await this.collection.createIndex(
  { tenantId: 1, companyId: 1 },
  { name: "idx_tenant_company" }
);
```

2.2 Conventions de Nommage (IMPORTANT)
Vérifie que les noms d'index suivent une convention cohérente :
- ✅ **REQUIRED** : Tous les index ont un nom explicite (`name` option)
- ✅ **REQUIRED** : Noms suivent pattern `idx_<field1>_<field2>_...` ou descriptif
- ✅ **REQUIRED** : Noms uniques pour index unique (`idx_<field>_unique`)
- ⚠️ **WARNING** : Vérifier qu'il n'y a pas de doublons de noms (même collection)

**Pattern attendu** :
```typescript
// ✅ CORRECT: Nom explicite et descriptif
{ name: "idx_tenant_company_created" }
{ name: "idx_storage_key_unique" }
{ name: "idx_fulltext" }

// ❌ WRONG: Pas de nom (MongoDB génère nom auto)
{ tenantId: 1, companyId: 1 } // Pas de name option
```

2.3 Structure des Index Definitions (IMPORTANT)
Vérifie que les définitions d'index sont structurées de manière cohérente :
- ✅ **REQUIRED** : Tous les index définis dans `ensureIndexes()` method
- ✅ **REQUIRED** : Index groupés logiquement (scoping, search, unique, etc.)
- ✅ **REQUIRED** : Commentaires pour index complexes (text index, compound, etc.)
- ⚠️ **WARNING** : Vérifier qu'il n'y a pas d'index redondants (même signature)

**Pattern attendu** :
```typescript
// ✅ CORRECT: Structure claire et groupée
async ensureIndexes(): Promise<void> {
  // Scoping indexes
  await createIndexSafely(/* tenantId, companyId */);
  await createIndexSafely(/* companyId */);
  
  // Search indexes
  await createIndexSafely(/* status, createdAt */);
  
  // Unique indexes
  await createIndexSafely(/* storageKey, unique */);
  
  // Text index (CRITICAL: only one per collection)
  await createIndexSafely(/* text fields */);
}
```

2.4 Text Index Patterns (CRITICAL)
Vérifie que les text indexes suivent les patterns critiques :
- ✅ **REQUIRED** : Maximum UN text index par collection (MongoDB limit)
- ✅ **REQUIRED** : Utilise `BaseUnifiedListRepository.ensureFullTextIndex()` si disponible
- ✅ **REQUIRED** : Commentaires explicites sur text index limit
- ✅ **REQUIRED** : Si plusieurs repositories utilisent la même collection, un seul doit créer le text index
- ❌ **FORBIDDEN** : Plusieurs text indexes sur même collection (même si géré gracieusement)
- ⚠️ **WARNING** : Si plusieurs définitions text index, vérifier que la première couvre tous les cas

**Référence** : `docs/05-infrastructure/core/mongodb-index-management.md` section "Text Index Creation"

**Pattern attendu** :
```typescript
// ✅ CORRECT: Un seul text index, bien documenté
// CRITICAL: MongoDB only allows ONE text index per collection.
await createIndexSafely(
  this.collection,
  { "metadata.extractedText": "text" as any as number, filename: "text" as any as number },
  { name: "idx_fulltext", default_language: "none" }
);
```

**Exemple de conflit résolu** (collection `time_entries`) :
```typescript
// TimeEntriesRepository (Projects module) - Text index commenté
// NOTE: Text index is managed by TimeTrackingRepository (HR module) to avoid conflicts.
// The scoped text index in TimeTrackingRepository covers all search needs for time_entries collection.
// await this.ensureFullTextIndex(...); // Commenté pour éviter conflit

// TimeTrackingRepository (HR module) - Crée le text index scoped
await this.ensureScopedFullTextIndex(
  this.timeEntryCollection,
  ["tenantId", "companyId"],
  ["employeeId", "status", "notes"],
);
```

2.5 Index Options Consistency (IMPORTANT)
Vérifie que les options d'index sont cohérentes :
- ✅ **REQUIRED** : `unique: true` pour index uniques (pas de doublons)
- ✅ **REQUIRED** : `expireAfterSeconds` pour TTL indexes (documents temporaires)
- ✅ **REQUIRED** : `partialFilterExpression` pour index partiels (performance)
- ✅ **REQUIRED** : `sparse: true` pour index sparse (champs optionnels)
- ⚠️ **WARNING** : Vérifier que les options sont justifiées (pas d'over-engineering)

**Pattern attendu** :
```typescript
// ✅ CORRECT: Options justifiées
{ name: "idx_storage_key", unique: true } // Unique constraint
{ name: "idx_expires_at", expireAfterSeconds: 3600 } // TTL
{ name: "idx_status_active", partialFilterExpression: { status: "active" } } // Partial
```

══════════════════════════════════════════════════════════════════════
📊 3) Performance & Budget d'Index (IMPORTANT - Scalabilité)
══════════════════════════════════════════════════════════════════════

3.1 Index Budget (8-12 indexes max) (CRITICAL)
Vérifie que chaque collection respecte le budget d'index :
- ✅ **REQUIRED** : Maximum 8-12 indexes par collection
- ⚠️ **WARNING** : Si >12 indexes, justifier dans PR (performance constraint)
- ⚠️ **WARNING** : Si >15 indexes, considérer consolidation ou splitting collection
- ✅ **REQUIRED** : Index composés justifiés (évite index multiples)

**Référence** : `docs/01-architecture/core/datastores.md` section "Index Strategy - Index Budget"

**Impact** : Trop d'index ralentit les writes (chaque write doit mettre à jour tous les index).

3.2 Redondance d'Index (IMPORTANT)
Vérifie qu'il n'y a pas d'index redondants :
- ✅ **REQUIRED** : Pas d'index avec même signature (même champs, même ordre)
- ✅ **REQUIRED** : Index composés couvrent les cas d'usage (pas besoin d'index simples redondants)
- ⚠️ **WARNING** : Vérifier que `{ tenantId: 1, companyId: 1 }` ne duplique pas `{ companyId: 1 }` si companyId est unique

**Pattern attendu** :
```typescript
// ✅ CORRECT: Index composé couvre plusieurs cas
{ tenantId: 1, companyId: 1, createdAt: -1 } // Couvre queries avec tenantId+companyId, tenantId+companyId+createdAt

// ⚠️ WARNING: Redondance possible
{ tenantId: 1, companyId: 1 }
{ companyId: 1 } // Si companyId est toujours avec tenantId, redondant
```

3.3 Index Composés vs Index Simples (IMPORTANT)
Vérifie que les index composés sont optimisés :
- ✅ **REQUIRED** : Index composés suivent "Equality, Sort, Range" (ESR) rule
- ✅ **REQUIRED** : Champs les plus sélectifs en premier (réduit cardinalité)
- ⚠️ **WARNING** : Vérifier que l'ordre des champs correspond aux queries réelles

**Pattern attendu** :
```typescript
// ✅ CORRECT: ESR rule (Equality, Sort, Range)
{ tenantId: 1, companyId: 1, createdAt: -1 } // Equality (tenantId, companyId), Sort (createdAt)

// ⚠️ WARNING: Ordre non optimal
{ createdAt: -1, tenantId: 1, companyId: 1 } // Sort avant Equality (moins efficace)
```

3.4 Index pour Queries Fréquentes (IMPORTANT)
Vérifie que les queries fréquentes ont des index :
- ✅ **REQUIRED** : Toutes les list queries ont index (pas de full collection scan)
- ✅ **REQUIRED** : Queries avec filtres multiples ont index composé
- ✅ **REQUIRED** : Queries avec sort ont index avec sort field
- ⚠️ **WARNING** : Vérifier avec `explain()` que les queries utilisent index (IXSCAN, pas COLLSCAN)

**Pattern attendu** :
```typescript
// ✅ CORRECT: Index pour query fréquente
// Query: find({ tenantId, companyId }).sort({ createdAt: -1 })
{ tenantId: 1, companyId: 1, createdAt: -1 }

// ❌ WRONG: Pas d'index pour query fréquente
// Query: find({ status: "active" }).sort({ createdAt: -1 })
// Pas d'index → COLLSCAN (lent)
```

══════════════════════════════════════════════════════════════════════
🏗️ 4) Architecture & Orchestration (CRITICAL - Startup Reliability)
══════════════════════════════════════════════════════════════════════

4.1 ensureAllIndexes() Orchestration (CRITICAL)
Vérifie que l'orchestration des index est robuste :
- ✅ **REQUIRED** : Tous les repositories avec `ensureIndexes()` sont appelés
- ✅ **REQUIRED** : Erreurs d'index BLOQUENT le startup (error handling avec re-throw)
- ✅ **REQUIRED** : Index créés en parallèle (Promise.all) pour performance
- ✅ **REQUIRED** : Logging approprié pour debugging (repo name, error details)
- ✅ **REQUIRED** : Erreurs loggées à stderr AVANT logger (pour debugging startup failures)
- ✅ **REQUIRED** : Delay de 1s après error log pour flush logger avant exit
- ❌ **FORBIDDEN** : Index créés en dehors de `ensureAllIndexes()` (sauf migrations)

**Référence** : `apps/api/src/core/db-indexes.ts` fonction `ensureAllIndexes()`

**Code Location** : 
- `apps/api/src/core/db-indexes.ts` lignes 78-325 (orchestration)
- `apps/api/src/index.ts` lignes 74-107 (startup avec error handling)

**Impact** : Si `ensureAllIndexes()` échoue, le serveur ne démarre pas (Cloud Run deployment fails). Les erreurs sont loggées à stderr puis via logger, avec delay pour flush.

**Pattern attendu** :
```typescript
// ✅ CORRECT: Error handling dans index.ts
try {
  await ensureAllIndexes(repos, database);
  logger.info({}, "MongoDB indexes ensured");
} catch (error) {
  // Log to stderr first (before logger might fail)
  process.stderr.write(`FATAL: Failed during index creation: ${errorMessage}\n`);
  // Also log via logger
  logger.error({ error }, "Failed during index creation");
  // Give logger time to flush
  await new Promise((resolve) => setTimeout(resolve, 1000));
  throw error; // Re-throw pour bloquer startup
}
```

4.2 Repository Registration (CRITICAL)
Vérifie que tous les repositories sont enregistrés :
- ✅ **REQUIRED** : Tous les repositories avec `ensureIndexes()` sont dans `RepositoriesWithIndexes`
- ✅ **REQUIRED** : Nouveaux repositories ajoutés à `RepositoriesWithIndexes`
- ⚠️ **WARNING** : Vérifier qu'il n'y a pas de repositories oubliés

**Code Location** : `apps/api/src/core/db-indexes.ts` lignes 22-70, 109-325

4.3 Error Handling in ensureAllIndexes() (CRITICAL)
Vérifie que la gestion d'erreurs est robuste :
- ✅ **REQUIRED** : Erreurs loggées avec repo name et error details
- ✅ **REQUIRED** : Erreurs re-thrown pour bloquer startup (pas de silent failure)
- ✅ **REQUIRED** : Error wrapping préserve stack trace
- ❌ **FORBIDDEN** : Catch-all qui ignore toutes les erreurs

**Code Location** : `apps/api/src/core/db-indexes.ts` lignes 88-104

**Pattern attendu** :
```typescript
// ✅ CORRECT: Error handling robuste
const wrapEnsureIndexes = (repoName: string, repo: { ensureIndexes: () => Promise<void> }): Promise<void> => {
  const boundEnsureIndexes = repo.ensureIndexes.bind(repo);
  return boundEnsureIndexes().catch((error) => {
    logger.error({ repo: repoName, error }, `Failed to ensure indexes for ${repoName}`);
    throw error; // Re-throw pour bloquer startup
  });
};
```

4.4 BaseUnifiedListRepository Pattern (IMPORTANT)
Vérifie que les repositories utilisent `BaseUnifiedListRepository` si applicable :
- ✅ **REQUIRED** : Repositories avec full-text search utilisent `BaseUnifiedListRepository`
- ✅ **REQUIRED** : `ensureFullTextIndex()` utilisé pour text indexes
- ✅ **REQUIRED** : Pattern cohérent pour tous les unified list repositories
- ⚠️ **WARNING** : Vérifier qu'il n'y a pas de duplication de logique text index

**Référence** : `apps/api/src/repositories/base-unified-list.repository.ts`

**Pattern attendu** :
```typescript
// ✅ CORRECT: Utilise BaseUnifiedListRepository
export class TaskRepository extends BaseUnifiedListRepository {
  async ensureIndexes(): Promise<void> {
    await super.ensureFullTextIndex(
      this.collection,
      ["title", "description"]
    );
  }
}
```

══════════════════════════════════════════════════════════════════════
🔒 5) Sécurité & Isolation (CRITICAL - Data Safety)
══════════════════════════════════════════════════════════════════════

5.1 Index Scoping (CRITICAL)
Vérifie que les index respectent le scoping (tenantId, companyId) :
- ✅ **REQUIRED** : Index composés incluent tenantId/companyId pour isolation
- ✅ **REQUIRED** : Index pour queries scoped incluent scoping fields
- ❌ **FORBIDDEN** : Index globaux sans scoping (violation isolation)
- ⚠️ **WARNING** : Vérifier que les index permettent queries scoped efficaces

**Pattern attendu** :
```typescript
// ✅ CORRECT: Index avec scoping
{ tenantId: 1, companyId: 1, createdAt: -1 } // Scoped query

// ❌ WRONG: Index global sans scoping (sauf superadmin)
{ createdAt: -1 } // Pas de scoping (risque isolation)
```

5.2 Unique Index Constraints (CRITICAL)
Vérifie que les unique indexes respectent le scoping :
- ✅ **REQUIRED** : Unique indexes incluent tenantId/companyId si applicable
- ✅ **REQUIRED** : Unique constraints respectent isolation (pas de collision cross-tenant)
- ❌ **FORBIDDEN** : Unique index global sans scoping (risque collision)

**Pattern attendu** :
```typescript
// ✅ CORRECT: Unique avec scoping
{ companyId: 1, iban: 1, unique: true } // Unique par company

// ❌ WRONG: Unique global sans scoping
{ iban: 1, unique: true } // Risque collision cross-tenant
```

══════════════════════════════════════════════════════════════════════
🧪 6) Testing & Validation (IMPORTANT - Qualité)
══════════════════════════════════════════════════════════════════════

6.1 Tests d'Index Creation (IMPORTANT)
Vérifie que les index sont testés :
- ✅ **REQUIRED** : Tests mock `createIndexSafely()` pour vérifier appels
- ✅ **REQUIRED** : Tests vérifient que tous les index sont créés
- ✅ **REQUIRED** : Tests vérifient que les noms d'index sont corrects
- ⚠️ **WARNING** : Vérifier qu'il n'y a pas de tests qui créent réellement des index (mock nécessaire)

6.2 Tests de Performance (RECOMMENDED)
Vérifie que les queries utilisent les index :
- ✅ **RECOMMENDED** : Tests avec `explain()` pour vérifier IXSCAN (pas COLLSCAN)
- ✅ **RECOMMENDED** : Tests de performance pour queries fréquentes
- ⚠️ **WARNING** : Vérifier que les tests ne sont pas trop lents (mock si nécessaire)

6.3 Intégration avec Quality Checks (CRITICAL)
Vérifie que les violations sont détectées par les quality checks :
- ✅ **REQUIRED** : `audit-index-creation.ts` détecte violations `createIndexSafely()`
- ✅ **REQUIRED** : `audit-index-budget.ts` détecte collections >12 index
- ✅ **REQUIRED** : Scripts exécutés en CI (quality gate)
- ✅ **REQUIRED** : Scripts génèrent rapports JSON pour analyse
- ⚠️ **WARNING** : Vérifier que les exceptions (migrations, base.repository.ts) sont exclues

**Référence** : 
- `scripts/01-quality/audit/audit-index-creation.ts` - Détecte appels directs à `createIndex()`
- `scripts/01-quality/audit/audit-index-budget.ts` - Vérifie budget 8-12 index par collection

**Pattern** : Les scripts d'audit doivent être exécutés :
- En CI (quality gate) - automatique
- Avant PR (vérification manuelle) - `npm run audit:index-creation`
- Après migrations (vérification post-migration) - `npm run audit:index-budget`

══════════════════════════════════════════════════════════════════════
📌 7) Exceptions Documentées & Scripts d'Audit
══════════════════════════════════════════════════════════════════════

7.1 Exceptions Documentées
Certains patterns peuvent sembler des violations mais sont intentionnels :
- ✅ Scripts de migration : Peuvent créer index directement (hors `ensureIndexes()`)
- ✅ Admin utilities : Peuvent créer index temporaires (narrowly scoped)
- ✅ Tests : Peuvent créer index directement (mock préféré)
- ✅ `base.repository.ts` : Utilise `createIndex()` en interne (c'est la fonction de base)

**Référence** : `.cursor/rules/general.mdc` section "Database Scripts & Safety"

**Pattern** : Les scripts d'audit (`audit-index-creation.ts`) excluent automatiquement :
- `base.repository.ts` (définit `createIndexSafely()`)
- Fichiers dans `migrations/` (peuvent utiliser `createIndex()` directement)

7.2 Scripts d'Audit Automatiques (QUALITY GATE)
Vérifie que les violations sont détectées par les scripts d'audit :
- ✅ **REQUIRED** : `audit-index-creation.ts` détecte les appels directs à `collection.createIndex()`
- ✅ **REQUIRED** : `audit-index-budget.ts` détecte les collections avec >12 index
- ✅ **REQUIRED** : Scripts génèrent des rapports JSON pour CI
- ✅ **REQUIRED** : Scripts exit avec code 1 si violations trouvées (bloque CI)

**Référence** : 
- `scripts/01-quality/audit/audit-index-creation.ts` - Détecte violations `createIndexSafely()`
- `scripts/01-quality/audit/audit-index-budget.ts` - Vérifie budget 8-12 index

**Usage** :
```bash
# Audit index creation patterns
npm run audit:index-creation

# Audit index budget (requires MONGODB_URI)
MONGODB_URI="..." npm run audit:index-budget
```

**Pattern attendu** : Les scripts d'audit doivent être exécutés :
- En CI (quality gate)
- Avant PR (vérification manuelle)
- Après migrations (vérification post-migration)

══════════════════════════════════════════════════════════════════════
🚀 8) Suggestions Concrètes
══════════════════════════════════════════════════════════════════════

8.1 Corrections Obligatoires (Bloquants)
Liste les violations qui BLOQUENT le merge :
- ❌ Violation 1 : [description précise + fichier + ligne + règle violée + impact]
- ❌ Violation 2 : [description précise + fichier + ligne + règle violée + impact]
- ...

8.2 Améliorations Recommandées (Non-bloquants)
Liste les améliorations recommandées :
- ⚠️ Amélioration 1 : [description + suggestion concrète + bénéfice]
- ⚠️ Amélioration 2 : [description + suggestion concrète + bénéfice]
- ...

8.3 Optimisations Performance
Si des problèmes de performance sont détectés :
- ⚠️ Optimization 1 : [description + suggestion concrète + gain attendu]
- ⚠️ Optimization 2 : [description + suggestion concrète + gain attendu]
- ...

8.4 Consolidations d'Index
Si des index redondants sont détectés :
- ⚠️ Consolidation 1 : [index à supprimer + index à garder + justification]
- ⚠️ Consolidation 2 : [index à supprimer + index à garder + justification]
- ...

══════════════════════════════════════════════════════════════════════
🧾 9) Synthèse Finale (Verdict)
══════════════════════════════════════════════════════════════════════

**CRITICAL** : Tu DOIS analyser TOUT le codebase, pas seulement les fichiers modifiés. Utilise les outils de recherche pour :
1. Lister TOUS les repositories avec `ensureIndexes()`
2. Vérifier que TOUS utilisent `createIndexSafely()`
3. Compter les index par collection (budget 8-12)
4. Détecter les text indexes (max 1 par collection)
5. Identifier les index redondants (même signature)
6. Vérifier la cohérence des patterns (nommage, structure, options)

Termine par un verdict strict :
- ✅ **OK - Index Management Conforme** : Tous les patterns respectés, index robustes, cohérents, performants, consistants
- ⚠️ **OK mais corrections nécessaires** : Violations mineures, optimisations recommandées, incohérences mineures
- ❌ **Bloquant / Index Management Non Conforme** : Violations critiques (text index limit, robustesse, cohérence, budget, consistance)

Inclure un court résumé des 3–7 points les plus risqués :
1. [Point critique 1] : [Impact + Fichier + Ligne]
2. [Point critique 2] : [Impact + Fichier + Ligne]
3. [Point critique 3] : [Impact + Fichier + Ligne]
...

**Références explicites** : Pour chaque violation, référence le fichier de règle exact (ex: "violates `docs/05-infrastructure/core/mongodb-index-management.md` section 'MongoDB Text Index Limit'")

**Métriques Complètes** (DOIT être calculé pour TOUT le codebase) :
- Nombre total de repositories avec `ensureIndexes()` : [X]
- Nombre total d'index créés (toutes collections) : [X]
- Collections avec >12 index : [Liste complète] (utiliser `audit-index-budget.ts` ou calcul manuel)
- Collections avec text indexes : [Liste avec count] (max 1 par collection)
- Index redondants détectés : [Liste complète avec signatures]
- Violations `createIndexSafely()` : [X fichiers + lignes] (utiliser `audit-index-creation.ts` ou recherche manuelle)
- Repositories sans `ensureIndexes()` : [Liste] (si applicable)
- Violations critiques : [X]
- Violations mineures : [X]
- Incohérences de patterns : [Liste]

**Scripts d'Audit à Exécuter** (pour validation) :
1. `npm run audit:index-creation` - Vérifie utilisation de `createIndexSafely()`
2. `MONGODB_URI="..." npm run audit:index-budget` - Vérifie budget 8-12 index
3. Vérifier manuellement les text indexes (max 1 par collection)
4. Vérifier manuellement les index redondants (même signature)

**Références aux Scripts** :
- `scripts/01-quality/audit/audit-index-creation.ts` - Détecte violations
- `scripts/01-quality/audit/audit-index-budget.ts` - Vérifie budget

**Consistance Globale** :
- ✅ Tous les repositories suivent les mêmes patterns de nommage
- ✅ Tous les repositories utilisent `createIndexSafely()`
- ✅ Tous les repositories ont `ensureIndexes()` bien structuré
- ✅ Tous les text indexes sont gérés correctement (max 1 par collection)
- ✅ Tous les index respectent le budget (8-12 max)
- ✅ Tous les index incluent le scoping approprié (tenantId, companyId)
