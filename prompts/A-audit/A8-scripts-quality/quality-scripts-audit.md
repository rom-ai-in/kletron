Tu es un **Expert Quality Engineering & CI/CD Architect** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de tous les scripts de qualité** pour garantir que **100% des scripts** sont fonctionnels, optimisés, et parfaitement intégrés dans la CI.

**Objectif Final**: Atteindre **100% de couverture** (tous les scripts doivent être testés, fonctionnels, optimisés, et intégrés dans CI).

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Documentation principale** : `docs/02-development/quality/quality-architecture.md`
- **Scripts CI** : `scripts/01-quality/ci/run-all-checks.ts`
- **Scripts Pre-commit** : `scripts/01-quality/quick-checks/run-fast-checks.ts`
- **Scripts Watch** : `scripts/01-quality/watch/watch-quality.ts`
- **Scripts Audit** : `scripts/01-quality/audit/run-nightly-audit.ts`
- **CI Configuration** : `cloudbuild.yaml`
- **Package.json scripts** : `package.json` (section "scripts")
- **README CI** : `scripts/01-quality/ci/README.md`
- **README Quick-checks** : `scripts/01-quality/quick-checks/README.md`
- **README Watch** : `scripts/01-quality/watch/README.md`
- **README Audit** : `scripts/01-quality/audit/README.md`

---

## 🎯 Scope de l'Audit

### 1. 📊 Inventaire Complet des Scripts (CRITICAL)

**Objectif**: Identifier TOUS les scripts de qualité et leur statut.

#### 1.1 TIER 1: Pre-commit (Quick Checks)

**Localisation** : `scripts/01-quality/quick-checks/`

**Scripts à auditer** :
- ✅ `check-no-console.ts` - Détecte `console.log/error/warn/debug`
- ✅ `check-no-any.ts` - Détecte usage de `any` (frontend uniquement)
- ✅ `check-no-todo.ts` - Détecte `TODO/FIXME/TEMPORARY/HACK/XXX`
- ✅ `check-esm-only.ts` - Détecte patterns CommonJS
- ✅ `check-syntax-swc.ts` - Détecte erreurs de syntaxe TypeScript/JS
- ✅ `check-types-fast.ts` - Détecte erreurs TypeScript (max 50 fichiers)
- ✅ `check-i18n-hardcoded.ts` - Détecte strings hardcodées (i18n)
- ✅ `check-navigation-routes.ts` - Vérifie routes navigation (global)
- ✅ `check-architectural-patterns.ts` - Vérifie patterns architecturaux (global)
- ✅ `run-fast-checks.ts` - Orchestrateur

**Vérifications** :
- ✅ Tous les scripts existent et sont exécutables
- ✅ Tous les scripts sont listés dans `run-fast-checks.ts`
- ✅ Tous les scripts sont intégrés dans `lint-staged` (package.json)
- ✅ Tous les scripts sont intégrés dans Husky pre-commit hook
- ✅ Tous les scripts ont des tests unitaires (si applicable)
- ✅ Performance : <500ms total (vérifier avec `time npm run check:fast`)

**Métriques attendues** :
```
Script | Existe | Dans orchestrateur | Dans lint-staged | Dans Husky | Tests | Performance | Statut
check-no-console.ts | ✅ | ✅ | ✅ | ✅ | ✅ | 45ms | ✅
check-no-any.ts | ✅ | ✅ | ✅ | ✅ | ✅ | 89ms | ✅
...
TOTAL | 10/10 | 10/10 | 10/10 | 10/10 | 8/10 | <500ms | ✅
```

#### 1.2 TIER 2: Dev-time (Watch)

**Localisation** : `scripts/01-quality/watch/`

**Scripts à auditer** :
- ✅ `check-req-body.ts` - Détecte accès direct à `req.body` sans Zod
- ✅ `check-fetch-client-route.ts` - Détecte `fetch()` dans `/c` sans `clientRoute()`
- ✅ `check-legacy-proxy.ts` - Détecte anciennes routes `/api/proxy/*`
- ✅ `check-cross-portal-imports.ts` - Détecte imports entre portails
- ✅ `check-pages-i18n.ts` - Détecte pages Next.js sans i18n
- ✅ `check-cta-links.ts` - Détecte Button onClick pour navigation
- ✅ `check-i18n-fallbacks.ts` - Détecte fallbacks hardcodés dans i18n
- ✅ `check-no-direct-fetch.ts` - Détecte `fetch()` direct au lieu de `apiFetch()`
- ✅ `check-standardized-imports.ts` - Détecte extensions `.js` manquantes
- ✅ `check-zod-validation-pattern.ts` - Détecte pattern try/catch manuel
- ✅ `watch-quality.ts` - Orchestrateur

**Vérifications** :
- ✅ Tous les scripts existent et sont exécutables
- ✅ Tous les scripts sont listés dans `watch-quality.ts`
- ✅ Tous les scripts sont intégrés dans `npm run dev` (dev-stack.js)
- ✅ Performance : <100ms par check, non-bloquant
- ✅ Debounce configuré (2s par défaut)

**Métriques attendues** :
```
Script | Existe | Dans orchestrateur | Dans dev-stack | Performance | Statut
check-req-body.ts | ✅ | ✅ | ✅ | 67ms | ✅
check-fetch-client-route.ts | ✅ | ✅ | ✅ | 89ms | ✅
...
TOTAL | 10/10 | 10/10 | 10/10 | <100ms/check | ✅
```

#### 1.3 TIER 3: CI Quality Gate

**Localisation** : `scripts/01-quality/ci/`

**Scripts à auditer** : Voir `run-all-checks.ts` pour la liste complète (150+ checks)

**Catégories critiques** :
- ✅ Architecture & Security (portal-architecture, api-auth, forbidden-imports, etc.)
- ✅ TypeScript & Build (typescript-build-api, typescript-build-web)
- ✅ API Quality (api-quality, api-routes, api-tenant-guards, etc.)
- ✅ Frontend Quality (portal-pages, hydration, react-hooks, etc.)
- ✅ i18n Quality (i18n-messages, i18n-imports, i18n-verify-locales, etc.)
- ✅ Module & Navigation (module-consistency, navigation-routeids, etc.)
- ✅ Page Patterns (page-coverage, form-views, list-views, etc.)

**Vérifications** :
- ✅ Tous les scripts existent et sont exécutables
- ✅ Tous les scripts sont listés dans `run-all-checks.ts` (CHECKS array)
- ✅ Tous les scripts critiques ont `critical: true`
- ✅ Tous les scripts non-critiques ont `critical: false`
- ✅ Tous les scripts sont intégrés dans `cloudbuild.yaml` (quality-gate step)
- ✅ Tous les scripts sont accessibles via `npm run check:3` (avec build)
- ✅ Tous les scripts sont accessibles via `npm run check:all` (sans build)
- ✅ Performance : <5 minutes total (vérifier avec `time npm run check:3`)
- ✅ Timeouts configurés pour les checks lents (10 min pour typescript-build-web)
- ✅ Parallel execution configurée pour les checks indépendants

**Métriques attendues** :
```
Catégorie | Scripts | Critiques | Non-critiques | Dans CI | Performance | Statut
Architecture | 12 | 12 | 0 | ✅ | 45s | ✅
TypeScript | 2 | 2 | 0 | ✅ | 120s | ✅
API Quality | 15 | 15 | 0 | ✅ | 90s | ✅
Frontend | 25 | 20 | 5 | ✅ | 180s | ✅
i18n | 12 | 8 | 4 | ✅ | 60s | ✅
...
TOTAL | 150+ | 120+ | 30+ | ✅ | <5min | ✅
```

#### 1.4 TIER 4: Nightly Audits

**Localisation** : `scripts/01-quality/audit/`

**Scripts à auditer** :
- ✅ `audit-ui-snapshot.ts` - Diff de snapshots UI complets
- ✅ `audit-sitemap.ts` - Tests de sitemap complets
- ✅ `audit-i18n-full.ts` - Analyse i18n complète
- ✅ `audit-responsive.ts` - Tests mobile + desktop
- ✅ `audit-lighthouse.ts` - Audit de performance
- ✅ `audit-react-renders.ts` - Analyse des re-renders React
- ✅ `audit-heavy-components.ts` - Analyse de taille de bundle
- ✅ `audit-scrollytelling-performance.ts` - Performance scrollytelling
- ✅ `audit-repository-scoping.ts` - Audit scoping repositories
- ✅ `audit-zod-validation.ts` - Audit validation Zod
- ✅ `audit-any-usage.ts` - Baseline usage de `any`
- ✅ `audit-accessmode-scoping.ts` - Audit AccessMode scoping
- ✅ `audit-branded-types.ts` - Audit branded types
- ✅ `audit-index-budget.ts` - Audit budget indexes MongoDB
- ✅ `audit-index-creation.ts` - Audit création indexes
- ✅ `audit-page-consistency.ts` - Audit cohérence pages
- ✅ `audit-portal-page-usage.ts` - Audit usage pages portails
- ✅ `audit-validation-errors-i18n-types.ts` - Audit erreurs validation i18n
- ✅ `run-nightly-audit.ts` - Orchestrateur

**Vérifications** :
- ✅ Tous les scripts existent et sont exécutables
- ✅ Tous les scripts sont listés dans `run-nightly-audit.ts` (AUDITS array)
- ✅ Tous les scripts uploadent leurs résultats vers Cloud Storage
- ✅ Tous les scripts sont intégrés dans Cloud Scheduler (3am UTC)
- ✅ Tous les scripts sont accessibles via `npm run check:4`
- ✅ Tous les scripts sont accessibles via `npm run audit:nightly`
- ✅ Performance : <15 minutes total (acceptable pour nocturne)
- ✅ Non-bloquant : tous les scripts exit avec code 0

**Métriques attendues** :
```
Script | Existe | Dans orchestrateur | Dans Cloud Scheduler | Upload GCS | Performance | Statut
audit-ui-snapshot.ts | ✅ | ✅ | ✅ | ✅ | 8min | ✅
audit-sitemap.ts | ✅ | ✅ | ✅ | ✅ | 4min | ✅
...
TOTAL | 19/19 | 19/19 | ✅ | ✅ | <15min | ✅
```

---

## 2. 🧪 Tests Fonctionnels (CRITICAL)

**Objectif**: Vérifier que chaque script fonctionne correctement.

### 2.1 Tests d'Exécution

Pour chaque script, exécuter :

```bash
# TIER 1: Pre-commit
npm run check:fast  # Staged files only
npm run check:1    # All files

# TIER 2: Watch
npm run check:2    # One-shot mode

# TIER 3: CI Quality Gate
npm run check:3    # With build (recommandé)
npm run check:all # Without build

# TIER 4: Nightly Audits
npm run check:4
npm run audit:nightly
```

**Vérifications** :
- ✅ Tous les scripts s'exécutent sans erreur de syntaxe
- ✅ Tous les scripts s'exécutent sans erreur d'import
- ✅ Tous les scripts produisent une sortie valide
- ✅ Tous les scripts exit avec le bon code (0 = success, 1 = failure)
- ✅ Tous les scripts gèrent les erreurs correctement (try/catch, error handling)
- ✅ Tous les scripts respectent les timeouts configurés

### 2.2 Tests de Détection

Pour chaque script de détection, vérifier :

- ✅ **Détecte les violations** : Script détecte correctement les patterns interdits
- ✅ **Ignore les exclusions** : Script ignore correctement les fichiers exclus (backend, scripts, tests)
- ✅ **Pas de faux positifs** : Script ne détecte pas de violations dans le code valide
- ✅ **Pas de faux négatifs** : Script détecte toutes les violations réelles

**Méthode** :
1. Créer un fichier de test avec des violations connues
2. Exécuter le script
3. Vérifier que toutes les violations sont détectées
4. Vérifier qu'aucune fausse violation n'est détectée

### 2.3 Tests de Performance

Pour chaque script, mesurer :

- ✅ **Temps d'exécution** : Script respecte les limites de performance
  - TIER 1: <500ms total
  - TIER 2: <100ms par check
  - TIER 3: <5 minutes total
  - TIER 4: <15 minutes total
- ✅ **Utilisation mémoire** : Script n'utilise pas trop de mémoire
- ✅ **Scalabilité** : Script fonctionne avec le codebase complet (pas seulement quelques fichiers)

**Méthode** :
```bash
# Mesurer le temps d'exécution
time npm run check:fast
time npm run check:1
time npm run check:3

# Mesurer l'utilisation mémoire (si nécessaire)
node --max-old-space-size=4096 scripts/01-quality/ci/run-all-checks.ts
```

---

## 3. 🔗 Intégration CI (CRITICAL)

**Objectif**: Vérifier que tous les scripts sont parfaitement intégrés dans la CI.

### 3.1 Cloud Build Integration

**Fichier** : `cloudbuild.yaml`

**Vérifications** :
- ✅ Step `quality-gate` existe et exécute `npm run check:3` (ou équivalent)
- ✅ Step `quality-gate` bloque le build si un check critique échoue
- ✅ Step `quality-gate` s'exécute AVANT les builds Docker
- ✅ Tous les packages locaux sont construits avant les checks (shared-ts, i18n, etc.)
- ✅ OpenAPI validation s'exécute après les quality checks
- ✅ Architecture security audits s'exécutent après les quality checks

**Structure attendue** :
```yaml
steps:
  - name: "node:20-slim"
    id: "quality-gate"
    entrypoint: "bash"
    args:
      - "-c"
      - |
        npm ci
        # Build local packages
        # Run quality checks
        npm run check:3  # Or: npx tsx scripts/01-quality/ci/run-all-checks.ts
        # OpenAPI validation
        # Architecture audits
```

### 3.2 Pre-commit Integration

**Fichier** : `.husky/pre-commit`

**Vérifications** :
- ✅ Hook existe et exécute `lint-staged`
- ✅ Hook bloque le commit si un check échoue
- ✅ Performance : <500ms total

**Structure attendue** :
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# 🟦 TIER 1: Pre-commit (FAST checks)
npx lint-staged
```

**Fichier** : `package.json` (section `lint-staged`)

**Vérifications** :
- ✅ Configuration `lint-staged` existe
- ✅ Tous les scripts TIER 1 sont listés
- ✅ Configuration `stash: false` (pas de stash automatique)
- ✅ ESLint avec `--no-fix` (pas de modification automatique)

### 3.3 Dev-time Integration

**Fichier** : `scripts/04-utilities/dev/dev-stack.js`

**Vérifications** :
- ✅ Service `watch` existe et exécute `npm run watch:quality`
- ✅ Service `watch` est optionnel (`optional: true`)
- ✅ Service `watch` ne bloque pas le dev server

**Structure attendue** :
```javascript
{
  name: "watch",
  displayName: "Quality Watch",
  script: "watch:quality",
  optional: true,
}
```

### 3.4 Nightly Audit Integration

**Fichier** : `cloudbuild-nightly-audit.yaml`

**Vérifications** :
- ✅ Configuration Cloud Build existe pour les audits nocturnes
- ✅ Cloud Scheduler est configuré (3am UTC)
- ✅ Tous les audits uploadent vers Cloud Storage
- ✅ Tous les audits sont non-bloquants (exit 0)

**Vérification Cloud Scheduler** :
```bash
gcloud scheduler jobs list --location=europe-west6
# Doit lister le job "nightly-audit"
```

---

## 4. ⚡ Optimisation (CRITICAL)

**Objectif**: Optimiser tous les scripts pour la performance et la maintenabilité.

### 4.1 Optimisation Performance

Pour chaque script, vérifier :

- ✅ **Cache** : Script utilise le cache si applicable (quality-check-cache.ts)
- ✅ **Parallel execution** : Scripts indépendants s'exécutent en parallèle
- ✅ **Incremental checks** : Scripts ne re-scannent que les fichiers modifiés (si applicable)
- ✅ **Early exit** : Scripts s'arrêtent dès qu'une violation critique est trouvée (si applicable)
- ✅ **File filtering** : Scripts filtrent les fichiers exclus avant le scan
- ✅ **AST optimization** : Scripts utilisent des parsers optimisés (ts-morph, SWC)

**Vérifications spécifiques** :

**TIER 1 (Pre-commit)** :
- ✅ Scripts vérifient uniquement les fichiers staged (via lint-staged)
- ✅ Scripts utilisent des patterns de matching rapides (regex optimisées)
- ✅ Scripts limitent le nombre de fichiers scannés (ex: check-types-fast.ts limite à 50 fichiers)

**TIER 3 (CI)** :
- ✅ `run-all-checks.ts` exécute les checks en parallèle quand possible
- ✅ Checks indépendants sont groupés (architecture, i18n, modules, etc.)
- ✅ Checks critiques s'exécutent en premier (fail-fast)
- ✅ Timeouts configurés pour éviter les blocages

**TIER 4 (Nightly)** :
- ✅ Audits uploadent directement vers Cloud Storage (pas de fichiers temporaires)
- ✅ Audits sont non-bloquants (toujours exit 0)
- ✅ Audits peuvent s'exécuter en parallèle (si indépendants)

### 4.2 Optimisation Code

Pour chaque script, vérifier :

- ✅ **Code quality** : Script respecte les standards du projet (ESM, TypeScript strict, etc.)
- ✅ **Error handling** : Script gère les erreurs correctement (try/catch, error messages clairs)
- ✅ **Logging** : Script utilise `scriptLogger` pour un logging structuré
- ✅ **Documentation** : Script a des commentaires JSDoc clairs
- ✅ **Reusability** : Script réutilise les helpers partagés (shared/, utils/)
- ✅ **Type safety** : Script utilise des types explicites (pas de `any`)

**Vérifications spécifiques** :

- ✅ Scripts utilisent `import/export` (ESM, pas CommonJS)
- ✅ Scripts utilisent `scriptLogger` au lieu de `console.log`
- ✅ Scripts utilisent les helpers partagés (`shared/check-output.ts`, `shared/quality-types.ts`, etc.)
- ✅ Scripts ont des types explicites pour les paramètres et retours
- ✅ Scripts gèrent les erreurs avec des messages clairs

### 4.3 Optimisation Maintenance

Pour chaque script, vérifier :

- ✅ **Configuration centralisée** : Scripts utilisent des configs centralisées (CHECKS array, etc.)
- ✅ **DRY principle** : Scripts évitent la duplication de code
- ✅ **Modularité** : Scripts sont modulaires et réutilisables
- ✅ **Tests** : Scripts ont des tests unitaires (si applicable)

**Vérifications spécifiques** :

- ✅ `run-all-checks.ts` utilise un array `CHECKS` centralisé
- ✅ `run-fast-checks.ts` utilise un array `CHECKS` centralisé
- ✅ `run-nightly-audit.ts` utilise un array `AUDITS` centralisé
- ✅ Scripts partagent des helpers communs (`shared/` directory)
- ✅ Scripts ont des tests dans `__tests__/` (si applicable)

---

## 5. 📋 Checklist Complète

### 5.1 Inventaire

- [ ] **TIER 1 (Pre-commit)** : Tous les scripts listés et vérifiés (10 scripts)
- [ ] **TIER 2 (Watch)** : Tous les scripts listés et vérifiés (10 scripts)
- [ ] **TIER 3 (CI)** : Tous les scripts listés et vérifiés (150+ scripts)
- [ ] **TIER 4 (Nightly)** : Tous les scripts listés et vérifiés (19 scripts)

### 5.2 Tests Fonctionnels

- [ ] **Exécution** : Tous les scripts s'exécutent sans erreur
- [ ] **Détection** : Tous les scripts détectent correctement les violations
- [ ] **Performance** : Tous les scripts respectent les limites de performance
- [ ] **Error handling** : Tous les scripts gèrent les erreurs correctement

### 5.3 Intégration CI

- [ ] **Cloud Build** : Tous les scripts TIER 3 sont intégrés dans `cloudbuild.yaml`
- [ ] **Pre-commit** : Tous les scripts TIER 1 sont intégrés dans Husky + lint-staged
- [ ] **Dev-time** : Tous les scripts TIER 2 sont intégrés dans `dev-stack.js`
- [ ] **Nightly** : Tous les scripts TIER 4 sont intégrés dans Cloud Scheduler

### 5.4 Optimisation

- [ ] **Performance** : Tous les scripts sont optimisés (cache, parallel, early exit)
- [ ] **Code quality** : Tous les scripts respectent les standards du projet
- [ ] **Maintenance** : Tous les scripts sont maintenables (DRY, modularité, tests)

---

## 6. 🔧 Actions Correctives

### 6.1 Scripts Manquants

Si un script est référencé mais n'existe pas :

1. **Créer le script** dans le bon répertoire
2. **Ajouter le script** à l'orchestrateur correspondant
3. **Tester le script** avec des violations connues
4. **Intégrer le script** dans CI (si applicable)

### 6.2 Scripts Non Intégrés

Si un script existe mais n'est pas intégré dans CI :

1. **Identifier le tier** (1, 2, 3, ou 4)
2. **Ajouter le script** à l'orchestrateur correspondant
3. **Intégrer le script** dans CI (cloudbuild.yaml, Husky, dev-stack.js, Cloud Scheduler)
4. **Tester l'intégration** en exécutant la CI localement

### 6.3 Scripts Non Optimisés

Si un script est lent ou non optimisé :

1. **Identifier le bottleneck** (file scanning, AST parsing, etc.)
2. **Optimiser le script** (cache, parallel, early exit, file filtering)
3. **Mesurer l'amélioration** (avant/après performance)
4. **Documenter l'optimisation** (commentaires, README)

### 6.4 Scripts avec Erreurs

Si un script échoue ou produit des erreurs :

1. **Identifier l'erreur** (syntaxe, import, runtime, etc.)
2. **Corriger l'erreur** (fix syntax, add import, handle error, etc.)
3. **Tester la correction** (exécuter le script avec violations connues)
4. **Vérifier l'intégration** (exécuter la CI localement)

---

## 7. 📊 Rapport Final

### 7.1 Résumé Exécutif

**Métriques globales** :
```
Tier | Scripts | Fonctionnels | Intégrés CI | Optimisés | Couverture
TIER 1 | 10 | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | ✅ 100%
TIER 2 | 10 | 10/10 (100%) | 10/10 (100%) | 10/10 (100%) | ✅ 100%
TIER 3 | 150+ | 150+/150+ (100%) | 150+/150+ (100%) | 150+/150+ (100%) | ✅ 100%
TIER 4 | 19 | 19/19 (100%) | 19/19 (100%) | 19/19 (100%) | ✅ 100%
TOTAL | 189+ | 189+/189+ (100%) | 189+/189+ (100%) | 189+/189+ (100%) | ✅ 100%
```

### 7.2 Détails par Tier

**TIER 1 (Pre-commit)** :
- ✅ Tous les scripts fonctionnent
- ✅ Tous les scripts sont intégrés dans Husky + lint-staged
- ✅ Performance : <500ms total
- ✅ Aucune action corrective nécessaire

**TIER 2 (Watch)** :
- ✅ Tous les scripts fonctionnent
- ✅ Tous les scripts sont intégrés dans dev-stack.js
- ✅ Performance : <100ms par check
- ✅ Aucune action corrective nécessaire

**TIER 3 (CI)** :
- ✅ Tous les scripts fonctionnent
- ✅ Tous les scripts sont intégrés dans cloudbuild.yaml
- ✅ Performance : <5 minutes total
- ✅ Parallel execution configurée
- ✅ Aucune action corrective nécessaire

**TIER 4 (Nightly)** :
- ✅ Tous les scripts fonctionnent
- ✅ Tous les scripts sont intégrés dans Cloud Scheduler
- ✅ Performance : <15 minutes total
- ✅ Upload Cloud Storage configuré
- ✅ Aucune action corrective nécessaire

### 7.3 Optimisations Appliquées

**Performance** :
- ✅ Cache implémenté pour les checks répétitifs
- ✅ Parallel execution pour les checks indépendants
- ✅ Early exit pour les checks critiques
- ✅ File filtering optimisé

**Code Quality** :
- ✅ ESM uniquement (pas de CommonJS)
- ✅ TypeScript strict
- ✅ Error handling complet
- ✅ Logging structuré

**Maintenance** :
- ✅ Configuration centralisée
- ✅ Helpers partagés
- ✅ Documentation complète
- ✅ Tests unitaires (si applicable)

### 7.4 Problèmes Identifiés et Résolus

**Problèmes** :
- ❌ [Problème 1] → ✅ [Solution 1]
- ❌ [Problème 2] → ✅ [Solution 2]
- ...

**Actions Correctives** :
- ✅ [Action 1] : [Description]
- ✅ [Action 2] : [Description]
- ...

---

## 8. ✅ Validation Finale

### 8.1 Tests Locaux

Exécuter tous les tests localement :

```bash
# TIER 1
npm run check:fast  # Staged files
npm run check:1     # All files

# TIER 2
npm run check:2     # One-shot

# TIER 3
npm run check:3     # With build (recommandé)
npm run check:all   # Without build

# TIER 4
npm run check:4
npm run audit:nightly
```

**Vérifications** :
- ✅ Tous les tests passent
- ✅ Performance respectée
- ✅ Aucune erreur

### 8.2 Tests CI

Exécuter la CI localement avec Docker :

```bash
npm run ci:local          # Quality gate dans Docker
npm run ci:local:full     # Cloud Build complet localement
```

**Vérifications** :
- ✅ Quality gate passe
- ✅ Builds Docker réussissent
- ✅ Déploiements réussissent

### 8.3 Vérification Cloud

Vérifier les intégrations Cloud :

```bash
# Cloud Build triggers
gcloud builds triggers list --region=europe-west6

# Cloud Scheduler jobs
gcloud scheduler jobs list --location=europe-west6

# Cloud Storage (nightly audits)
gsutil ls gs://numezis-audit-results/nightly-audits/
```

**Vérifications** :
- ✅ Cloud Build triggers actifs
- ✅ Cloud Scheduler jobs configurés (3am UTC)
- ✅ Cloud Storage accessible

---

## 9. 📝 Documentation

### 9.1 Mise à Jour Documentation

Mettre à jour les documents suivants :

- ✅ `docs/02-development/quality/quality-architecture.md` - Architecture complète
- ✅ `scripts/01-quality/ci/README.md` - Documentation CI checks
- ✅ `scripts/01-quality/quick-checks/README.md` - Documentation pre-commit
- ✅ `scripts/01-quality/watch/README.md` - Documentation watch
- ✅ `scripts/01-quality/audit/README.md` - Documentation audits

### 9.2 Ajout de Commentaires

Ajouter des commentaires JSDoc aux scripts si manquants :

- ✅ Description du script
- ✅ Paramètres d'entrée
- ✅ Sortie attendue
- ✅ Exemples d'utilisation
- ✅ Notes de performance

---

## 10. 🎯 Objectifs de Qualité

### 10.1 Métriques Cibles

**Couverture** :
- ✅ 100% des scripts fonctionnent
- ✅ 100% des scripts sont intégrés dans CI
- ✅ 100% des scripts sont optimisés

**Performance** :
- ✅ TIER 1: <500ms total
- ✅ TIER 2: <100ms par check
- ✅ TIER 3: <5 minutes total
- ✅ TIER 4: <15 minutes total

**Fiabilité** :
- ✅ 0% de faux positifs
- ✅ 0% de faux négatifs
- ✅ 100% de détection des violations

### 10.2 Validation Continue

**Monitoring** :
- ✅ Suivre les performances des checks dans CI
- ✅ Suivre les taux d'échec des checks
- ✅ Suivre les optimisations appliquées

**Amélioration Continue** :
- ✅ Optimiser les checks lents (>10s)
- ✅ Ajouter des checks manquants
- ✅ Améliorer la détection des violations

---

## 🚀 Commandes Rapides

### Exécution Locale

```bash
# TIER 1: Pre-commit (staged files)
npm run check:fast

# TIER 1: Pre-commit (all files)
npm run check:1

# TIER 2: Watch (one-shot)
npm run check:2

# TIER 3: CI Quality Gate (with build)
npm run check:3

# TIER 3: CI Quality Gate (without build)
npm run check:all

# TIER 4: Nightly Audits
npm run check:4
npm run audit:nightly
```

### Tests CI Locaux

```bash
# Quality gate dans Docker
npm run ci:local

# Cloud Build complet localement
npm run ci:local:full
```

### Vérification Cloud

```bash
# Cloud Build triggers
gcloud builds triggers list --region=europe-west6

# Cloud Scheduler jobs
gcloud scheduler jobs list --location=europe-west6

# Cloud Storage (nightly audits)
gsutil ls gs://numezis-audit-results/nightly-audits/
```

---

## 📌 Notes Importantes

1. **Performance Critique** : Les scripts TIER 1 doivent être <500ms pour ne pas bloquer les commits
2. **CI Blocking** : Les scripts TIER 3 critiques bloquent le build si ils échouent
3. **Non-Bloquant** : Les scripts TIER 4 sont toujours non-bloquants (exit 0)
4. **Parallel Execution** : Les scripts indépendants doivent s'exécuter en parallèle
5. **Cache** : Utiliser le cache pour les checks répétitifs
6. **Error Handling** : Tous les scripts doivent gérer les erreurs correctement
7. **Documentation** : Tous les scripts doivent être documentés

---

## ✅ Critères de Succès

L'audit est considéré comme **réussi** si :

- ✅ **100% des scripts** sont fonctionnels
- ✅ **100% des scripts** sont intégrés dans CI
- ✅ **100% des scripts** sont optimisés
- ✅ **Performance** respectée pour tous les tiers
- ✅ **Aucune erreur** dans les tests locaux et CI
- ✅ **Documentation** complète et à jour

---

**Objectif Final** : Atteindre **100% de couverture** pour tous les scripts de qualité, garantissant une qualité de code maximale et une intégration CI parfaite.
