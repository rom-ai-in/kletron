Maintenant, réalise une **analyse complète** de la **complétude** du travail que tu viens d'effectuer.  
Tu dois appliquer STRICTEMENT les règles du **monorepo Numezis** (architecture, qualité, checks, i18n, portals, backend, frontend, ESM, types, etc.).

### 🎯 1. Analyse structurelle & alignement architecture
* Vérifie que **tout respecte l'architecture du monorepo** (API, Web, packages, portals) selon `docs/01-architecture/portal/portal-architecture.md`.
* Contrôle que **rien ne réinvente** des **types/constants présents dans `shared-ts`**.
* Vérifie que les **patterns backend** (routes → validation → services → repositories) sont respectés : 
  - Pas de logique métier dans les routes
  - Pas d'accès DB direct dans les services (`db.collection()` interdit)
  - Pas d'appels repository depuis routes (toujours via services)
* Valide que le code ne brise **aucune règle du modèle Portal** (company/tenant/partner/superadmin).
* Vérifie que **tout reste full ESM** : imports `.js`, pas de `require`, pas de CommonJS.
* Vérifie l'**absence de portal branching** dans les domain services (services portal-neutral).

### 🔐 2. **AccessMode, permissions, modules**
* Vérifie que le code **lit uniquement `req.accessMode`** et **jamais de headers contextuels** (interdit) selon les règles du backend.
* Vérifie la présence des **guards obligatoires** :
  * `requirePortal()` (pour routes business)
  * `requirePermission()` (pour opérations sensibles)
  * `requireModuleEnabled()` (pour modules spécifiques)
  * `requireActiveCompany()` (pour les writes côté company)
* Vérifie que le **scoping DB** est correct pour chaque type de portal (company/tenant/partner/superadmin).
* Vérifie les **conversions branded types** : `toStringId()` pour ObjectId → UserId/TenantId/CompanyId, `toObjectId()` pour l'inverse.
* Vérifie que **CompanyAccessMode** inclut toutes les propriétés requises (country, locale, etc.).

### 🧪 3. **Validation des inputs / erreurs / i18n**
* Vérifie que **tous les inputs** (body, query, params) sont validés via **Zod**.
* Contrôle l'usage correct de **`ApiError`** + clés i18n (backend rules).
* Contrôle que les erreurs et **UI copy** respectent la **checklist de traduction** :
  - Nouvelles clés dans `/i18n/messages` pour **tous les locales** (de, en, fr, it)
  - Pas de fallbacks hardcodés (`t("key") || "texte"` interdit)
  - Vérification : `npm run i18n:verify && npm run i18n:lint`
  - **CRITICAL** : Backend charge JSON directement (pas de compilation)

### 🧩 4. **Cohérence des types & absence de duplication**
* Vérifie que **tous les types globaux proviennent de `@numezis/shared-ts`**.
* Vérifie la **cohérence des types FE/BE** (types-consistency check).
* Vérifie **l'absence de `any` non justifié** (frontend: ZERO `any`, backend: évité).
* Vérifie les **return types explicites** sur toutes les fonctions exportées.
* Vérifie l'**absence de types redéfinis** (toujours importer depuis shared-ts).

### 🧹 5. **Qualité du code & patterns interdits**
* Vérifie l'**absence** :
  - de `console.log` (bloqué en pre-commit)
  - d'appels `async` non `awaited`
  - de `promises` sans `catch`
  - de **forbidden imports** (matrice d'imports respectée)
  - de **direct DB access** dans les services/routes
  - de **legacy proxy**, **fetch incorrect**, **cross-portal imports** (dev-time checks)
  - de **header-based context reconstruction** (`X-Tenant-Id`, `X-Company-Id` interdits)
* Vérifie l'**usage correct** des **hooks React**, **absence de boucles infinies**.
* Vérifie les **exceptions légitimes documentées** (voir `docs/02-development/quality/audit-exceptions.md`).

### 🧪 6. **Exécution mentale de tous les quality checks**
Effectue un **run complet** de tous les tiers décrits dans `docs/02-development/quality/quality-architecture.md` :
- 🟦 **Tier 1 (pre-commit)** : no-console, no-any, no-todo, syntax SWC, fast types, ESM-only
- 🟩 **Tier 2 (dev-time)** : req.body sans Zod, legacy proxy, client route, pages i18n, CTA links, i18n fallbacks, direct fetch, standardized imports
- 🟧 **Tier 3 (CI)** : async/await, forbidden imports, tenant guards, API auth, portal architecture, hydration, dead code, orphan routes, types consistency, console-prod, formatting, server components, navigation routeIds, runtime error patterns, return types, types shared-ts duplication
- 🟥 **Tier 4 (nightly)** : snapshots, sitemap, responsive, i18n full, lighthouse, React renders, heavy components, scrollytelling performance
Signale précisément **tout ce qui échouerait**. Référence explicitement les règles provenant des fichiers sources.

### 🗄️ 7. **MongoDB & Persistence**
* Vérifie que les **indexes MongoDB** sont définis dans `ensureIndexes()` du repository.
* Vérifie que les **indexes respectent le budget** (8-12 indexes max par collection).
* Vérifie que les **indexes de scoping** sont présents (tenantId, companyId selon portal).
* Vérifie la **limite text index** (un seul text index par collection, gestion d'erreur via `createIndexSafely()`).
* Vérifie que **tous les repositories** utilisent `AccessMode` pour le scoping (pas de headers).
* Vérifie l'**absence de `deleteMany({})`** sans filtres (sécurité des données).
* Si migrations nécessaires : vérifie qu'elles sont documentées et testées.

### 🧪 8. **Tests (CRITICAL)**
* Vérifie que les **tests appropriés** sont présents selon `docs/07-testing/architecture/architecture-testing.md` :
  - **Unit tests** : fonctions pures, helpers, logique locale
  - **Integration tests** : services, repositories, middleware, AccessMode, RBAC (Mongo in-memory)
  - **Integration globaux** : flux métiers transverses (Mongo réel)
  - **E2E API** : routes Express, pipeline middleware complet
  - **Frontend tests** : composants, hooks, guards (Vitest + RTL)
  - **E2E UI** : parcours utilisateurs portails (Playwright)
* Vérifie que les **tests utilisent AccessMode** (pas de reconstruction depuis headers).
* Vérifie que les **tests utilisent repositories** (pas de `db.collection()` direct).
* Vérifie la **couverture** (>70% business logic, >50% overall).
* Vérifie que les **tests passent** : `npm --workspace apps/api run test && npm --workspace apps/web run test`.

### 🧭 9. **Navigation & Routing**
* Vérifie que les **routes** sont ajoutées au **navigation registry** (`apps/api/src/services/navigation.registry.ts`) si nécessaire.
* Vérifie que les **routeIds** utilisés dans le frontend existent dans le registry.
* Vérifie que les **breadcrumbs** sont générés correctement (via `getRouteMetadata()`).
* Vérifie que les **items de menu** ont `excludeFromMenu: true` si approprié (detail pages, forms, aliases).
* Vérifie que les **i18n keys** existent pour tous les `labelKey` du registry (tous les locales).
* Vérifie l'**usage de `@/navigation`** au lieu de `next/link` directement.
* Vérifie l'**usage de Page Views** (`ListView`, `DetailView`, `FormView`, etc.) si applicable.

### 🎨 10. **Frontend & UX**
* Vérifie que le code respecte **mobile-first** (375px baseline, pas de `min-w-*` traps, pas de `vh` fragiles).
* Vérifie l'**usage de `PortalPage`** / `PortalPageHeader` avec `breadcrumbItems` (pas de `title` prop, pas de `<h1>` manuel).
* Vérifie l'**usage de `useAccessMode()`** (jamais de reconstruction depuis URL/localStorage).
* Vérifie l'**usage de SWR** avec `clientSWRConfig` (pas de loops infinis).
* Vérifie l'**error handling** avec `ApiFetchError` et `getErrorMessage()` (pas de `any`).
* Vérifie l'**accessibilité** (ARIA, keyboard navigation, WCAG AA+).
* Vérifie l'**absence de `fetch` direct** (toujours via `apiFetch()` ou hooks SWR).

### 🔄 11. **Cache & Performance**
* Vérifie que les **invalidations de cache** sont présentes si données modifiées :
  - AccessMode cache (TTL 5min, invalidation via `invalidateUser()`, `invalidateTenant()`, `invalidateCompany()`)
  - Permissions cache (si implémenté)
  - Module resolution cache (si implémenté)
* Vérifie l'**absence de leaks** (cleanup dans `useEffect`, pas de subscriptions non fermées).
* Vérifie la **performance** (bundle size, lazy loading si nécessaire).

### 🔒 12. **Sécurité**
* Vérifie que les **headers de sécurité** sont corrects (pas de tokens exposés au browser).
* Vérifie que les **cookies** sont HttpOnly, Secure, SameSite=Strict.
* Vérifie que les **tokens** ne sont jamais loggés ou exposés.
* Vérifie que les **PII** ne sont jamais loggées.
* Vérifie que les **rate limits** sont présents pour login/register/reset/refresh.
* Vérifie que les **audit logs** sont émis pour les actions sensibles (voir pattern d'impersonation si applicable).

### 📝 13. **Documentation & Migration**
* Vérifie si la **documentation** doit être mise à jour :
  - Architecture docs si patterns changés
  - API docs si nouveaux endpoints
  - Feature docs si nouvelle fonctionnalité
* Vérifie si des **migrations** sont nécessaires :
  - Schémas MongoDB modifiés
  - Indexes ajoutés/modifiés
  - Données existantes à migrer
* Vérifie que les **exceptions légitimes** sont documentées dans `docs/02-development/quality/audit-exceptions.md` si nécessaire.

### 🔍 14. **Qualité fonctionnelle**
* Vérifie que la **fonctionnalité est complète et cohérente**.
* Vérifie l'**absence d'incohérences** dans le flux **UX** et le **comportement attendu**.
* Vérifie que la **logique respecte les patterns existants du repo** (pas de "nouvelle approche").
* Vérifie que les **edge cases** sont gérés (erreurs réseau, timeouts, données manquantes).

### 🚀 15. **Suggestions concrètes**
* Liste clairement les **améliorations obligatoires et optionnelles**.
* Propose des **refactorings précis** : fonctions, fichiers, validations, typages, endpoints, composants, hooks.
* Identifie les **dettes techniques** si présentes.

### 📌 16. **Si tout n'est pas terminé**
* Liste les **next steps concrètes**, actionnables, ordonnées par priorité.
* Indique **ce qui manque côté FE, BE, tests, i18n, navigation, AccessMode, modules, architectures, MongoDB, cache, sécurité**, etc.

### 🧾 17. **Synthèse finale**
* Conclus par un verdict structuré :
  - **✅ OK pour merge** (rare - tous les checks passent, tests complets, documentation à jour)
  - **⚠️ OK mais corrections nécessaires avant merge** (quelques points à corriger)
  - **❌ Bloquant / ne respecte pas architecture** (violations critiques, tests manquants, architecture drift)

---

### ➤ **Résultat attendu**
Une réponse ultra-structurée, détaillée, très technique, directement exploitable, utilisant :
- Les **règles backend** (`docs/02-development/rules/backend-rules-and-checklist.md`)
- Les **règles frontend** (`docs/02-development/rules/frontend-rules-and-checklist.md`)
- L'**architecture globale du monorepo** (`docs/01-architecture/portal/portal-architecture.md`)
- La **qualité 4 tiers** (`docs/02-development/quality/quality-architecture.md`)
- La **checklist i18n** (tous les locales, pas de fallbacks)
- Les **patterns de tests** (`docs/07-testing/architecture/architecture-testing.md`)
- Les **patterns MongoDB** (`docs/05-infrastructure/core/mongodb-index-management.md`)
- Les **patterns navigation** (`docs/01-architecture/navigation/navigation-registry.md`)

