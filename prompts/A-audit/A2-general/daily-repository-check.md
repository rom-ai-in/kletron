Tu es un **auditeur senior Architecture + Qualité + UX + Sécurité** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit complet et exhaustif** du repository pour détecter :

- **Drifts architecturaux** et incohérences
- **Violations de règles** (architecture, qualité, sécurité, portals, ESM, i18n)
- **Features incomplètes** ou non terminées
- **Problèmes UI/UX** (user flows, discoverability, navigation)
- **Problèmes de sécurité** (guards manquants, scoping incorrect, headers interdits)
- **Duplications** et anti-patterns
- **Incohérences** entre frontend et backend
- **Routes orphelines** sans points d'entrée
- **Code mort** et dépendances inutilisées

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Architecture globale** : `docs/01-architecture/core/monorepo-architecture.md`
- **Portal architecture** : `docs/01-architecture/portal/portal-architecture.md`
- **Quality tiers** : `docs/02-development/quality/quality-architecture.md`
- **Backend rules** : `docs/02-development/rules/backend-rules-and-checklist.md`
- **Feature discoverability** : `docs/09-ui-ux/04-product/feature-discoverability-rule.md`
- **User journey audit** : `docs/09-ui-ux/04-product/feature-user-journey-audit.md`
- **Navigation rules** : `docs/01-architecture/navigation/navigation-rules.md`
- **Audit exceptions** : `docs/02-development/quality/audit-exceptions.md`
- **Invariants** : `scripts/01-quality/invariants.ts` (liste canonique)
- **Portals docs** : `docs/09-ui-ux/05-portals/portal-*.md` (company, tenant, partner, superadmin)

---

## 🔧 Quality Checks Automatisés (Référence Obligatoire)

**CRITICAL** : Avant de lancer un audit manuel, vérifier que les quality checks automatisés passent. L'audit manuel doit se concentrer sur les aspects **non couverts** par l'automatisation.

### Tier 1 (Pre-commit) - `npm run check:1`
- ✅ `check-no-console.ts` : Détecte `console.log/error/warn/debug`
- ✅ `check-no-any.ts` : Détecte usage de `any` (frontend uniquement)
- ✅ `check-no-todo.ts` : Détecte `TODO/FIXME/TEMPORARY/HACK/XXX`
- ✅ `check-syntax-swc.ts` : Erreurs de syntaxe TypeScript/JS
- ✅ `check-types-fast.ts` : Erreurs TypeScript (max 50 fichiers)
- ✅ `check-esm-only.ts` : Patterns CommonJS interdits

### Tier 2 (Dev-time) - `npm run watch:quality`
- ✅ `check-req-body.ts` : Accès direct à `req.body` sans Zod
- ✅ `check-fetch-client-route.ts` : `fetch()` dans `/c` sans `clientRoute()`
- ✅ `check-legacy-proxy.ts` : Anciennes routes `/api/proxy/*`
- ✅ `check-cross-portal-imports.ts` : Imports entre portails
- ✅ `check-pages-i18n.ts` : Pages Next.js sans i18n
- ✅ `check-cta-links.ts` : Button onClick pour navigation (devrait être Link)
- ✅ `check-i18n-fallbacks.ts` : Fallbacks hardcodés dans i18n
- ✅ `check-no-direct-fetch.ts` : `fetch()` direct au lieu de `apiFetch()`
- ✅ `check-standardized-imports.ts` : Extensions `.js` sur imports locaux

### Tier 3 (CI Quality Gate) - `npm run check:3`
**Critiques (bloquent CI)** :
- ✅ `check-async-await.ts` : Appels async non-awaited
- ✅ `check-promise-catch.ts` : Promesses non catchées
- ✅ `check-portal-architecture.ts` : Violations architecture multi-portal
- ✅ `check-api-auth.ts` : Routes API non protégées
- ✅ `check-forbidden-imports.ts` : Imports interdits
- ✅ `check-api-tenant-guards.ts` : Scoping tenant manquant
- ✅ `check-dangerous-patterns.ts` : Opérations DB dangereuses
- ✅ `check-api-quality.ts` : Checks API complets (routes → repos, db.collection)
- ✅ `check-react-hooks.ts` : Problèmes hooks React
- ✅ `check-infinite-loops.ts` : Patterns boucles infinies
- ✅ `check-server-components.ts` : Pages avec "use client" inutile
- ✅ `check-accessmode-validation.ts` : Reconstruction contexte depuis headers
- ✅ `check-repository-scoping.ts` : Repositories utilisent AccessMode

**Non-critiques (warnings)** :
- ✅ `check-portal-pages.js` : Qualité frontend
- ✅ `check-hydration.js` : Erreurs hydratation React
- ✅ `check-i18n-messages.ts` : Usage messages i18n
- ✅ `check-swr-error-handling.ts` : Gestion erreurs SWR
- ✅ `check-dead-code.ts` : Code non utilisé
- ✅ `check-orphan-routes.ts` : Routes non utilisées
- ✅ `check-types-consistency.ts` : Cohérence types FE/BE
- ✅ `check-navigation-entry-points.ts` : Routes sans entry points

### Tier 4 (Nightly) - `npm run check:4`
- ✅ `audit-ui-snapshot.ts` : Diff snapshots UI
- ✅ `audit-sitemap.ts` : Validation sitemap
- ✅ `audit-i18n-full.ts` : Analyse i18n complète
- ✅ `audit-responsive.ts` : Tests responsive
- ✅ `audit-lighthouse.ts` : Performance/accessibility
- ✅ `audit-react-renders.ts` : Analyse re-renders React
- ✅ `audit-heavy-components.ts` : Composants lourds

**Règle** : Si un check automatisé existe et passe, ne pas dupliquer la vérification dans l'audit manuel. Se concentrer sur les aspects non automatisés.

---

## ⚠️ Exceptions Légitimes (Vérifier Avant de Signaler)

**CRITICAL** : Avant de signaler une violation, vérifier `docs/02-development/quality/audit-exceptions.md` :

### Headers Interdits - Exceptions
- ✅ **CORS** : Headers `X-Tenant-Id`/`X-Company-Id` listés pour compatibilité CORS uniquement (jamais utilisés pour contexte)
- ✅ **Agent Trigger** : Envoi de contexte au service externe depuis `AccessMode` (pas lecture depuis headers)
- ✅ **Access Mode Resolver** : Rejet explicite des headers pour sécurité (pas utilisation pour contexte)

### Scripts de Seed
- ✅ **`deleteMany({})`** : Autorisé dans scripts de seed/développement (jamais en production)

### Webhooks
- ✅ **Routes webhook** : Peuvent être non protégées (authentification via signature, ex: Stripe)

**Règle** : Si un pattern est documenté comme exception légitime, ne pas le signaler comme violation.

---

## 🏛️ Invariants Architecturaux (Non-Négociables)

Vérifier le respect des invariants documentés dans `docs/01-architecture/portal/portal-architecture.md` :

1. **Services ne lisent jamais `req`** : Services acceptent `AccessMode` et paramètres typés, jamais `req` object
2. **Repositories ne lisent jamais headers** : Repositories utilisent `AccessMode` pour scoping, jamais `X-Tenant-Id`/`X-Company-Id`
3. **Routes ne contournent jamais services** : Routes passent toujours par services pour logique métier
4. **Domain services sont portal-neutral** : Pas de branchement sur type de portal (`if (portal === 'company')`)
5. **Pas d'accès DB direct dans routes** : Routes utilisent repositories, jamais `db.collection()` directement

**Source** : `scripts/01-quality/invariants.ts` (liste canonique)

**Enforcement** : Quality checks automatiques (`check-api-quality.ts`, `check-portal-architecture.ts`)

---

## 🎯 Scope de l'Audit

### Fichiers à Analyser

- **Backend** : `apps/api/src/**/*.ts` (routes, services, repositories, domain, core)
- **Frontend** : `apps/web/app/**/*.tsx`, `apps/web/components/**/*.tsx`, `apps/web/hooks/**/*.ts`
- **Packages** : `packages/shared-ts/**/*.ts`, `packages/i18n/**/*.json`
- **Navigation** : `apps/api/src/services/navigation.registry.ts`, `apps/api/src/services/navigation.service.ts`
- **Routes** : Toutes les routes définies dans `apps/api/src/routes/portals/*.routes.ts`
- **Pages** : Toutes les pages Next.js dans `apps/web/app/[locale]/(portal)/**/*.tsx`

### Zones Critiques

1. **Routes API** : Vérifier guards, validation, scoping, AccessMode
2. **Pages Frontend** : Vérifier entry points, navigation, permissions, i18n
3. **Services Domain** : Vérifier portal-neutrality, AccessMode usage
4. **Repositories** : Vérifier scoping correct, pas de headers
5. **Navigation Registry** : Vérifier cohérence, entry points, permissions
6. **Types Shared** : Vérifier absence de duplication, cohérence FE/BE

---

## 🔍 1. AUDIT ARCHITECTURAL & STRUCTUREL

### 1.1 Placement des Fichiers (Monorepo Layout)

- ✅ Vérifier que chaque fichier est au **bon endroit** selon `monorepo-architecture.md`
  - `apps/api/src/core/` → middleware, auth, permissions, modules
  - `apps/api/src/domain/` → services métier portal-neutral
  - `apps/api/src/routes/portals/` → routes HTTP par portal
  - `apps/api/src/repositories/` → accès DB uniquement
  - `apps/web/app/[locale]/(portal)/` → pages Next.js par portal
  - `packages/shared-ts/` → types globaux uniquement
- ❌ Détecter fichiers "hors pattern" (ex: logique métier dans routes, UI dans shared mal placé)

### 1.2 Types & Constantes Partagés

- ✅ Vérifier que **tous les types globaux** proviennent de `@numezis/shared-ts`
  - `UserRole`, `Portal`, `AccessMode` (tous variants)
  - `ErrorCode`, `ApiErrorPayload`
  - `ModuleCode`, `PermissionCode`
  - `Status` (ACTIVE, SUSPENDED, etc.)
- ❌ Détecter toute **réinvention** de types existants dans `shared-ts`
- ❌ Détecter **duplication** de types entre API et Web

**Check automatisé** : `check-types-shared-ts-duplication.ts`

### 1.3 Backend Layering Strict

- ✅ Vérifier le pattern : **routes → validation Zod → services → repositories → DB**
- ❌ Détecter :
  - Logique métier dans routes
  - Accès DB direct dans routes/services (hors repositories)
  - Services qui lisent `req` ou headers
  - Repositories qui lisent headers

**Check automatisé** : `check-api-quality.ts`

### 1.4 Règles Portal / Séparation

- ✅ Vérifier que le code ne brise **aucune règle portal**
  - Pas de routes globales (toutes sous `/c`, `/t`, `/p`, `/s`)
  - Pas de layout transversal (chaque portal a son layout)
  - Pas de branching portal dans shared/domain
- ✅ Vérifier que les routes FE sont sous `app/[locale]/(portal)/<prefix>/...`
- ❌ Détecter cross-portal imports, routes incorrectes, layout partagé

**Check automatisé** : `check-portal-architecture.ts`, `check-cross-portal-imports.ts`

### 1.5 ESM Only

- ✅ Vérifier : imports en `.js` côté TS ESM, aucun `require`, aucun CommonJS
- ❌ Détecter : `require()`, `module.exports`, `"type": "commonjs"`, imports sans `.js`

**Check automatisé** : `check-esm-only.ts`, `check-standardized-imports.ts`

---

## 🔐 2. AUDIT ACCESSMODE, PERMISSIONS, MODULES, GUARDS

### 2.1 AccessMode = Source de Vérité

- ✅ Vérifier que le code backend utilise **UNIQUEMENT** `req.accessMode` pour scoping/auth
- ❌ Détecter : lecture de headers contextuels (`x-tenant-id`, `x-company-id`, `x-portal`) pour construire contexte
- ❌ Détecter : frontend qui construit `AccessMode` depuis URL ou localStorage

**Check automatisé** : `check-accessmode-validation.ts`

**Exception** : Vérifier `audit-exceptions.md` pour usages légitimes (CORS, agent trigger, rejet sécurité)

### 2.2 Guards Obligatoires

Pour **chaque endpoint**, vérifier présence et ordre correct :
- `requirePermission()` (pour toutes les opérations sensibles)
- `requireModuleEnabled()` (pour opérations dépendantes d'un module)
- `requireActiveCompany()` (pour writes côté company)
- ❌ Si absent → **BLOQUANT** + proposer patch exact

**Check automatisé** : `check-api-auth.ts`, `check-api-tenant-guards.ts`, `check-active-company-gate.ts`

### 2.3 Scoping DB Correct par Portal

- **Company** (`/c`) : filtre `tenantId + companyId` obligatoires
- **Tenant** (`/t`) : filtre `tenantId` uniquement (jamais `companyId`)
- **Partner** (`/p`) : filtre `companyId IN accessibleCompanyIds` + validation d'accès avant DB
- **Superadmin** (`/s`) : pas de scoping automatique (sauf filtres explicites)
- ❌ Détecter queries/repositories qui violent ces invariants

**Check automatisé** : `check-repository-scoping.ts`

### 2.4 Portal-Neutral Domain Services

- ✅ Vérifier que les services domain sont **portal-neutral** (pas de `if (portal === 'company')`)
- ❌ Détecter branching portal dans services domain

**Check automatisé** : `check-portal-architecture.ts`

### 2.5 Impersonation

**CRITICAL** : Vérifier que l'impersonation est gérée correctement.

- ✅ Utiliser `getAccessMode(req)` qui gère automatiquement `ImpersonatedAccessMode`
- ✅ Utiliser `inner` AccessMode pour data access
- ✅ Utiliser `realUserId` pour audit logs (jamais `inner.userId`)
- ❌ Utiliser `req.accessMode as AccessMode` sans gérer `ImpersonatedAccessMode`
- ❌ Utiliser `inner.userId` comme `actorUserId` dans audit logs

**Source** : `docs/01-architecture/portal/portal-architecture.md` section "Impersonation Audit Pattern"

---

## 🧪 3. AUDIT VALIDATION INPUTS / ERREURS / I18N

### 3.1 Validation Zod Partout

- ✅ Vérifier que **tous les inputs** (body, query, params) sont validés via Zod
- ❌ Détecter : `req.body` brut, `req.query` sans validation, `req.params` sans schéma

**Check automatisé** : `check-req-body.ts`, `audit-zod-validation.ts`

### 3.2 Erreurs Backend (ApiError + i18n)

- ✅ Vérifier usage correct de `ApiError` + codes stables + message i18n
- ❌ Détecter : strings hardcodées user-facing, erreurs sans clés i18n

**Check automatisé** : `check-api-i18n-errors.ts`

### 3.3 Checklist i18n FE/BE

- ✅ UI copy : aucune string hardcodée
- ✅ Nouvelles clés : ajoutées dans `packages/i18n/messages/*.json` pour toutes les locales
- ❌ Détecter : clés manquantes, namespaces inconsistants, duplication, fallbacks hardcodés

**Check automatisé** : `check-i18n-messages.ts`, `check-i18n-fallbacks.ts`, `check-pages-i18n.ts`

---

## 🧩 4. AUDIT COHÉRENCE TYPES & DUPLICATION

### 4.1 Types Partagés

- ✅ Vérifier que tous les types globaux proviennent de `@numezis/shared-ts`
- ✅ Vérifier cohérence FE/BE (DTO identiques, pas de divergence de shape)
- ❌ Détecter : `any` non justifié, casts dangereux, types redéfinis, enums dupliqués

**Check automatisé** : `check-types-consistency.ts`, `check-types-shared-ts-duplication.ts`

### 4.2 Branded Types & Conversions

**CRITICAL** : Vérifier l'usage correct des branded types (`UserId`, `TenantId`, `CompanyId`).

**Patterns Corrects** :
- ✅ `toStringId(id) as UserId` : Conversion ObjectId → branded type
- ✅ `toObjectId(id)` : Conversion branded type → ObjectId pour MongoDB
- ✅ `id as UserId` : Cast string → branded type (depuis params/req.user)

**Patterns Incorrects** :
- ❌ Utilisation directe de `string` au lieu de branded type
- ❌ Utilisation directe de branded type dans queries MongoDB (doit être ObjectId)
- ❌ Duplication de types au lieu d'importer depuis `@numezis/shared-ts`

**Source** : Règles TypeScript dans `.cursor/rules/general.mdc` section "TypeScript Branded Types & Conversions"

### 4.3 Return Types Explicites

- ✅ Vérifier que toutes les fonctions exportées ont des return types explicites
- ❌ Détecter : fonctions exportées sans return type

**Check automatisé** : `check-return-types.ts`

---

## 🧹 5. AUDIT QUALITÉ CODE & PATTERNS INTERDITS

### Backend

**Checks automatisés** (ne pas dupliquer) :
- ✅ `check-no-console.ts` : `console.log` (bloqué pre-commit)
- ✅ `check-async-await.ts` : Promises non catchées, async non awaited
- ✅ `check-forbidden-imports.ts` : Imports interdits
- ✅ `check-api-quality.ts` : Accès DB direct dans services/routes
- ✅ `check-dangerous-patterns.ts` : Patterns DB dangereux

**Audit manuel** : Patterns subtils non détectés automatiquement

### Frontend

**Checks automatisés** (ne pas dupliquer) :
- ✅ `check-react-hooks.ts` : Hooks React incorrects (deps manquantes, boucles infinies)
- ✅ `check-hydration.js` : Hydration unsafe
- ✅ `check-portal-pages.js` : Pages sans loading states
- ✅ `check-no-direct-fetch.ts` : `fetch()` direct au lieu de `apiFetch()`
- ✅ `check-cta-links.ts` : CTA avec `Button onClick` au lieu de `Link`

**Audit manuel** : Patterns UX subtils, cohérence visuelle

### Portals

**Check automatisé** : `check-cross-portal-imports.ts`

---

## 🧪 6. VÉRIFICATION QUALITY CHECKS AUTOMATISÉS

**Avant l'audit manuel** : Exécuter `npm run check:3` et documenter les résultats.

**Pendant l'audit** : Se concentrer sur les aspects **non couverts** par l'automatisation :
- User flows et discoverability (non automatisés)
- Drifts architecturaux subtils (non détectés par checks)
- Incohérences UX (non automatisées)
- Features incomplètes (détection manuelle requise)
- Patterns complexes nécessitant analyse contextuelle

**Règle** : Ne pas dupliquer les vérifications déjà couvertes par les checks automatisés.

---

## 🗺️ 7. AUDIT USER FLOWS & DISCOVERABILITY

**Sources de vérité** :
- `docs/09-ui-ux/04-product/feature-discoverability-rule.md` : Règle canonique
- `docs/09-ui-ux/04-product/feature-user-journey-audit.md` : Template d'audit
- `docs/01-architecture/navigation/navigation-rules.md` : Règles navigation

**Check automatisé** : `check-navigation-entry-points.ts` (détecte routes sans entry points)

### 7.1 Feature Discoverability

Pour **chaque route applicative** (frontend), vérifier :

- ✅ **Au moins un entry point** visible et logique :
  - Sidebar navigation (`excludeFromMenu !== true`)
  - Dashboard widget
  - CTA contextuel
  - Entry dans Settings
  - Deep-link documenté ET exposé via UI
- ❌ Détecter : routes accessibles uniquement via URL directe (bug bloquant)

**Règle** : Si une route existe, elle doit être découvrable. Si elle n'est pas découvrable, elle n'existe pas du point de vue utilisateur.

### 7.2 User Journey (de bout en bout)

Pour **chaque feature/module**, analyser :

1. **Entrée** : D'où vient l'utilisateur ? Pourquoi il clique là ?
2. **Préconditions** : Portal actif, permissions, modules, données nécessaires → **sont-elles VISIBLES** ?
3. **Étapes du flow** : Chaque écran, action, validation, feedback, appel API
4. **États UI** : loading, empty, error, disabled, success, retry, abandon possible
5. **Sorties** : Que se passe-t-il après succès ? Où arrive l'utilisateur ?

**Template** : Utiliser `docs/09-ui-ux/04-product/feature-user-journey-audit.md`

### 7.3 Navigation & Continuité

- ✅ Vérifier : breadcrumb, lien "retour" logique, conservation du contexte (filtres, scope)
- ✅ Vérifier : deep-link fonctionne, contexte invalide géré
- ❌ Détecter : flows incomplets, états non gérés, navigation cassée

### 7.4 Portal & Role Awareness

- ✅ Vérifier : feature visible quand elle doit l'être, absente quand elle ne doit pas l'être
- ✅ Vérifier : wording adapté au rôle, CTA adaptés au niveau de responsabilité
- ❌ Détecter : feature superadmin accessible mais invisible dans navigation

---

## 🔍 8. AUDIT DRIFT & INCOHÉRENCES "REPO-LEVEL"

Au-delà du code individuel, détecter les drifts structurels :

- **Duplication de patterns** : nouvelle approche vs approche existante
- **Déviation des conventions** : nommage, folders, registries
- **Endpoints orphelins** : non montés, routes FE orphelines
- **Incohérences navigation** : backend-driven vs hardcoded
- **Violations separation portal** : ex: Tenant page utilisant Company breadcrumb pattern
- **Routes sans entry points** : routes applicatives sans point d'entrée UI
- **Features incomplètes** : routes créées mais logique métier manquante, tests manquants, i18n incomplet

**Check automatisé** : `check-orphan-routes.ts`, `check-dead-code.ts`

---

## 🔒 9. AUDIT SÉCURITÉ

### 9.1 Guards & Permissions

- ✅ Vérifier : tous les endpoints sensibles ont `requirePermission()`
- ✅ Vérifier : opérations module-specific ont `requireModuleEnabled()`
- ✅ Vérifier : writes company ont `requireActiveCompany()`
- ❌ Détecter : routes non protégées, guards manquants, permissions insuffisantes

**Check automatisé** : `check-api-auth.ts`, `check-api-tenant-guards.ts`, `check-active-company-gate.ts`

### 9.2 Scoping & Isolation

- ✅ Vérifier : repositories scopen correctement selon `AccessMode`
- ✅ Vérifier : pas de fuite de données entre tenants/companies
- ❌ Détecter : queries sans scoping, scoping incorrect par portal

**Check automatisé** : `check-repository-scoping.ts`

### 9.3 Headers & Context

- ✅ Vérifier : aucun code ne lit `X-Tenant-Id` ou `X-Company-Id` pour construire contexte
- ✅ Vérifier : frontend ne construit jamais `AccessMode` depuis URL/localStorage
- ❌ Détecter : reconstruction de contexte depuis headers (vulnérabilité sécurité)

**Check automatisé** : `check-accessmode-validation.ts`

**Exception** : Vérifier `audit-exceptions.md` pour usages légitimes

### 9.4 Validation & Sanitization

- ✅ Vérifier : tous les inputs validés via Zod
- ✅ Vérifier : pas de PII/credentials/tokens dans logs
- ❌ Détecter : validation manquante, sanitization insuffisante

**Check automatisé** : `check-req-body.ts`, `check-no-console.ts`

---

## 🧾 10. FORMAT DE RÉPONSE ATTENDU

### Structure Minimale (Priorité)

1. **📊 Résumé Exécutif** (1-2 paragraphes)
   - Nombre total de violations par catégorie (Architecture, Sécurité, UX, Qualité)
   - Top 3 problèmes critiques
   - Verdict global : 🟥 **CRITIQUE** | 🟨 **ATTENTION** | 🟩 **OK**

2. **🔴 Violations Critiques** (Tableau)
   | Fichier | Ligne | Gravité | Description | Fix | Source |
   |---------|-------|---------|-------------|-----|--------|
   | `path/to/file.ts` | 42 | 🔴 Bloquant | Description précise | Correction exacte | `portal-architecture.md §2.3` |

3. **🟡 Violations Non-Critiques** (Liste à puces)
   - `path/to/file.ts:42` : Description + suggestion

4. **🔍 Drifts & Incohérences** (Liste structurée)
   - **Type de drift** : Description + impact + correction

5. **🗺️ User Flows Problématiques** (Liste)
   - **Route** : `GET /c/companies/:companyId/invoices`
   - **Problème** : Pas d'entry point visible
   - **Correction** : Ajouter dans sidebar navigation registry

6. **📌 Actions Prioritaires** (Checklist)
   - [ ] **Priorité 1** : Action bloquante (ex: Guards manquants)
   - [ ] **Priorité 2** : Action importante (ex: Validation manquante)
   - [ ] **Priorité 3** : Amélioration continue (ex: Code mort)

### Règles de Réponse

- ✅ **Concis** : Maximum 1 page par section (sauf violations critiques)
- ✅ **Actionnable** : Chaque violation = correction proposée avec code exact
- ✅ **Référencé** : Citer docs sources explicitement (ex: "violates `portal-architecture.md` section 2.3")
- ✅ **Technique** : Citer fichiers, lignes, règles sources explicitement
- ❌ **Pas de blabla** : Pas de généralités vagues, uniquement faits techniques
- ❌ **Pas de suppositions** : Si information manquante, lister ce qui manque MAIS donner quand même une checklist exhaustive

### Exemple de Format

## 📊 Résumé Exécutif

**Total violations** : 12 (8 critiques, 4 non-critiques)
- Architecture : 5 critiques
- Sécurité : 3 critiques
- UX : 2 non-critiques
- Qualité : 2 non-critiques

**Top 3 problèmes** :
1. Routes API sans guards (`/c/companies/:companyId/invoices` POST)
2. Repository lit headers (`user.repository.ts:45`)
3. Route sans entry point (`/s/zefix/companies/:uid`)

**Verdict** : 🟥 **CRITIQUE** - Corrections nécessaires avant merge

## 🔴 Violations Critiques

| Fichier | Ligne | Gravité | Description | Fix | Source |
|---------|-------|---------|-------------|-----|--------|
| `apps/api/src/routes/portals/company.routes.ts` | 142 | 🔴 Bloquant | Route POST sans `requirePermission()` | Ajouter `requirePermission('INVOICES:CREATE')` avant handler | `backend-rules-and-checklist.md §2.2` |
| `apps/api/src/repositories/user.repository.ts` | 45 | 🔴 Bloquant | Lecture de `req.headers['x-tenant-id']` | Utiliser `accessMode.tenantId` depuis paramètre | `portal-architecture.md §2.1` |---

## 🎯 Priorisation

### Priorité 1 (Bloquant - Corriger Immédiatement)
- Violations sécurité (guards manquants, scoping incorrect)
- Violations architecture (cross-portal, headers interdits)
- Routes sans entry points (feature discoverability)
- Accès DB direct dans routes/services

### Priorité 2 (Important - Corriger Avant Prochaine Release)
- Validation manquante (Zod)
- i18n incomplet (clés manquantes)
- Types dupliqués
- User flows incomplets

### Priorité 3 (Amélioration Continue)
- Code mort
- Duplications mineures
- Warnings qualité
- Optimisations UX

---

## ➤ Résultat Attendu

Une réponse **ultra-structurée, détaillée, très technique, directement exploitable**, utilisant :
- Les **règles backend** (`backend-rules-and-checklist.md`)
- Les **règles frontend** (navigation, portals, i18n)
- L'**architecture globale** du monorepo (`monorepo-architecture.md`)
- La **qualité 4 tiers** (`quality-architecture.md`)
- Les **checks automatisés** (référencer plutôt que dupliquer)
- Les **exceptions légitimes** (`audit-exceptions.md`)
- Les **invariants architecturaux** (`scripts/01-quality/invariants.ts`)
- La **checklist i18n** (messages, verify, lint)
- Les **règles produit** (feature discoverability, user journey)

**Verdict final** :
- 🟥 **CRITIQUE** : Violations bloquantes détectées
- 🟨 **ATTENTION** : Corrections nécessaires mais non-bloquantes
- 🟩 **OK** : Repository en bon état (rare)


