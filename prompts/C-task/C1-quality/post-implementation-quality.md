Réalise une analyse qualité exhaustive du travail effectué, en appliquant strictement toutes les règles du monorepo Numezis. Structure ta réponse en sections claires et actionnables.

📋 STRUCTURE DE L'ANALYSE

1. 🏗️ ARCHITECTURE & STRUCTURE
2. 🔐 ACCESSMODE & SÉCURITÉ
3. ✅ VALIDATION & ERREURS
4. 🌐 I18N & LOCALISATION
5. 🎨 FRONTEND & UX
6. 🔧 BACKEND & API
7. 📦 TYPES & TYPAGE
8. 🧪 QUALITÉ DU CODE
9. 🧩 COHÉRENCE & PATTERNS
10. 🚀 QUALITY CHECKS (4 TIERS)
11. 📝 SYNTHÈSE & VERDICT

---

## 1. 🏗️ ARCHITECTURE & STRUCTURE

### 1.1 Alignement Monorepo
- [ ] Vérifie que la structure respecte `apps/api`, `apps/web`, `packages/*` (pas de duplication)
- [ ] Contrôle que rien ne réinvente types/constants présents dans `@numezis/shared-ts`
- [ ] Vérifie l'absence de code legacy (`apps/api/src/legacy/`, `apps/api/src/business/` supprimés)
- [ ] Valide que les routes sont organisées par portal (`portals/company/`, `portals/tenant/`, etc.)

**Références** : `.cursor/rules/general.mdc` section "Architecture & Module Boundaries"

### 1.2 Patterns Backend (CRITICAL)
- [ ] Routes → Services → Repositories (pas de logique métier dans routes)
- [ ] Pas d'accès DB direct dans routes/services (toujours via repositories)
- [ ] Services acceptent `AccessMode` comme premier paramètre (pas de construction de contexte)
- [ ] Repositories utilisent `AccessMode` pour le scoping (jamais de headers)

**Références** : `.cursor/rules/backend-rules.mdc` section "Architecture"

### 1.3 ESM Only (CRITICAL)
- [ ] Backend (`apps/api`) : imports avec extension `.js` (ex: `import { x } from './file.js'`)
- [ ] Frontend (`apps/web`) : imports SANS extension `.js` (ex: `import { x } from './file'`)
- [ ] Aucun `require/module.exports` (CommonJS interdit)
- [ ] `package.json` avec `"type": "module"`
- [ ] `tsconfig.json` avec `"module": "ESNext"`

**Références** : `.cursor/rules/backend-rules.mdc` section "ESM Only", `.cursor/rules/frontend-rules.mdc` section "ESM Only"

---

## 2. 🔐 ACCESSMODE & SÉCURITÉ

### 2.1 AccessMode (CRITICAL - Single Source of Truth)
- [ ] Backend : lit UNIQUEMENT `req.accessMode`, JAMAIS de headers (`X-Tenant-Id`, `X-Company-Id`)
- [ ] Frontend : utilise `useAccessMode()` hook, JAMAIS de reconstruction depuis URL/storage
- [ ] AccessMode créé avec TOUTES les propriétés requises :
  - `CompanyAccessMode` : `portal`, `userId`, `tenantId`, `companyId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`, `country`
  - `TenantAccessMode` : `portal`, `userId`, `tenantId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`
- [ ] Type guards utilisés avant accès aux propriétés portal-spécifiques (`isCompanyAccessMode()`, etc.)
- [ ] AccessMode calculé par requête (jamais réutilisé entre requêtes)

**Références** : `.cursor/rules/general.mdc` section "AccessMode: Single Source of Truth"

### 2.2 Repository Scoping (CRITICAL)
- [ ] `/c` (Company) : filtres par `companyId` + `tenantId`
- [ ] `/t` (Tenant) : filtres par `tenantId` uniquement
- [ ] `/p` (Partner) : filtres par `companyId: { $in: accessMode.accessibleCompanyIds }`
- [ ] `/s` (Superadmin) : PAS de scoping automatique (sauf paramètres explicites)
- [ ] Conversions ObjectId ↔ Branded Types :
  - `ObjectId → Branded` : `toStringId(id) as UserId`
  - `Branded → ObjectId` : `toObjectId(id)` pour queries MongoDB

**Références** : `.cursor/rules/general.mdc` section "Repository Scoping Rules", section "TypeScript Branded Types & Conversions"

### 2.3 Guards & Permissions (CRITICAL)
- [ ] `requirePermission('MODULE:ACTION')` sur toutes les routes nécessitant permissions
- [ ] `requireModuleEnabled('module')` sur toutes les routes module-spécifiques
- [ ] `requireActiveCompany()` sur toutes les routes write (`/c` et `/p`)
- [ ] Frontend : `ModuleGate` + `PermissionGate` utilisés ensemble (pas l'un sans l'autre)
- [ ] Permissions au format `MODULE:ACTION` (ex: `INVOICES:CREATE`, `CONTACTS:READ`)

**Références** : `.cursor/rules/backend-rules.mdc` section "AccessMode & Middleware", `.cursor/rules/frontend-rules.mdc` section "Access Control"

### 2.4 Company Status & Impersonation
- [ ] Write operations vérifient `status === "active"` (via `requireActiveCompany()`)
- [ ] Impersonation : utilise `getAuditActor()` helper pour `realUserId` vs `impersonatedUserId`
- [ ] Audit logs utilisent toujours `realUserId` comme actor (jamais `inner.userId` quand impersonation)

**Références** : `.cursor/rules/general.mdc` section "Company Status Enforcement", section "Impersonation Audit Pattern"

---

## 3. ✅ VALIDATION & ERREURS

### 3.1 Validation Zod (CRITICAL)
- [ ] Tous les inputs validés via Zod : `req.body`, `req.query`, `req.params`
- [ ] Schemas dans `domain/*/schemas.ts` (pas dans routes)
- [ ] Utilise `validationFromZod(error)` pour erreurs de validation
- [ ] Pas de `try/catch` manuel autour de `schema.parse()` (validation directe)

**Références** : `.cursor/rules/backend-rules.mdc` section "Validation Zod"

### 3.2 Error Handling Backend (CRITICAL)
- [ ] Utilise `ApiError` (de `core/errors`) pour toutes les erreurs API
- [ ] JAMAIS `throw new Error()` (toujours `ApiError` avec codes typés)
- [ ] Toutes les erreurs localisées via `translate()` de `core/i18n.ts`
- [ ] JAMAIS de messages hardcodés en anglais (ex: `"Invalid credentials"`)

**Références** : `.cursor/rules/backend-rules.mdc` section "Error Handling", section "i18n Backend"

### 3.3 Error Handling Frontend (CRITICAL)
- [ ] Utilise `ApiFetchError` et `getErrorMessage()` de `@/lib/api/errors`
- [ ] Pattern : `catch (err: unknown)`, JAMAIS `catch (err: any)`
- [ ] Type guard OBLIGATOIRE avant accès à `error.code` ou `error.status` :
  
  if (isApiFetchError(error) && error.status === 401) {
    // Safe to use error.status and error.code
  }
  - [ ] JAMAIS `error.message` directement dans JSX (utilise `getTranslatedErrorMessage()`)
- [ ] Tous les layouts incluent `ErrorBoundaryWrapper`

**Références** : `.cursor/rules/frontend-rules.mdc` section "Error Handling (CRITICAL)"

---

## 4. 🌐 I18N & LOCALISATION

### 4.1 Backend i18n (CRITICAL)
- [ ] Utilise `translate()` de `core/i18n.ts` via DI (`dependencies/i18n.ts`)
- [ ] Détecte locale via headers/query (`Accept-Language`, `?locale=fr`)
- [ ] Vérifie que les clés existent dans tous les locales (de, en, fr, it)
- [ ] JAMAIS de messages hardcodés en anglais dans les réponses API

**Références** : `.cursor/rules/backend-rules.mdc` section "i18n Backend (CRITICAL)"

### 4.2 Frontend i18n (CRITICAL)
- [ ] Client components : `useTranslations()` de `@/lib/i18n/client`
- [ ] Server components : `getServerTranslations()` de `@/lib/i18n/server`
- [ ] Route-colocated : utilise `messages.ts` files
- [ ] JAMAIS de strings hardcodées dans JSX (tous les textes utilisent `t()`)
- [ ] Vérifie clés dans tous les locales (de, en, fr, it)
- [ ] Avant commit : `npm run i18n:verify && npm run i18n:lint` (pas de compilation nécessaire)

**Références** : `.cursor/rules/frontend-rules.mdc` section "Internationalization (CRITICAL)"

### 4.3 Locale Extraction (CRITICAL)
- [ ] Pour breadcrumbs/URLs : utilise `useParams()` → `params.locale` (URL locale)
- [ ] JAMAIS `accessMode.locale` pour construire URLs/breadcrumbs (préférence utilisateur, pas URL)
- [ ] `accessMode.locale` uniquement pour logique préférence utilisateur (ex: formatage dates)

**Références** : `.cursor/rules/frontend-rules.mdc` section "Locale Extraction for URLs (CRITICAL)"

---

## 5. 🎨 FRONTEND & UX

### 5.1 Mobile-First (CRITICAL)
- [ ] Mobile (375px) est le baseline, desktop est enhancement
- [ ] Toutes les pages utilisables à 375px (pas de scroll horizontal)
- [ ] CTA tap targets >= 44×44px
- [ ] Pas d'interactions hover-only
- [ ] Évite layouts `vh` fragiles sur iOS Safari (préfère content-driven height)
- [ ] Patterns "desktop-only" ont un UX mobile (guided/accordion/stacked)
- [ ] Teste sur : 375×667, 390×844, 768×1024, 1280px+

**Références** : `.cursor/rules/frontend-rules.mdc` section "Mobile-first UX (CRITICAL)"

### 5.2 Portal Pages (CRITICAL)
- [ ] Utilise `PortalPage` ou `PortalPageHeader` (pas de layout manuel)
- [ ] JAMAIS de prop `title` dans `PortalPage` ou `PortalPageHeader`
- [ ] JAMAIS de tags `<h1>` manuels dans portal pages
- [ ] Utilise `breadcrumbItems` prop - le dernier item sert de titre de page
- [ ] Utilise `PortalPageShell`, `PortalContent` pour layouts cohérents

**Références** : `.cursor/rules/frontend-rules.mdc` section "Portal Page Titles (CRITICAL)"

### 5.3 Page Views Consistency (CRITICAL)
- [ ] **Forms** : utilise `FormView`, `SettingsView`, `EditPageLayout`, ou `useFormSubmitState` hook
  - JAMAIS de `<form>` raw sans un de ces composants/hook
- [ ] **List Pages** : utilise `ListView` component
  - JAMAIS de `<DataTable>` direct dans portal pages
- [ ] **Page Actions** : utilise `PageAction[]` + `ActionBar`
  - JAMAIS de `<Button>` dans page headers sans `ActionBar`
- [ ] **Empty States** : utilise `EmptyState` component ou `emptyState` prop
  - JAMAIS de messages "No data" hardcodés
- [ ] **Loading States** : utilise skeletons standardisés (`SkeletonTable`, `SkeletonCard`) ou `isLoading` prop
  - JAMAIS de `<Spinner>` ou `<Loader>` dans pages
- [ ] **Detail Pages** : utilise `DetailView` component
  - JAMAIS de `<MetadataGrid>` direct sans `DetailView`

**Références** : `.cursor/rules/frontend-rules.mdc` section "Page Views Consistency (CRITICAL)", `docs/09-ui-ux/02-views/page-views-architecture.md`

### 5.4 Navigation & Data Fetching
- [ ] Utilise `useNavigationRouter()` de `@/navigation` (pas `next/link` direct)
- [ ] Utilise `useBreadcrumbNavigation()` ou `useDetailPageBreadcrumbs()` pour breadcrumbs
- [ ] Data fetching : SWR hooks dans `/hooks/` avec `clientSWRConfig`
- [ ] JAMAIS de `fetch()` direct dans components (centralise dans `lib/api/*.ts`)
- [ ] Include `X-Portal` header, JAMAIS `X-Tenant-Id` ou `X-Company-Id`

**Références** : `.cursor/rules/frontend-rules.mdc` section "Navigation", section "Data Fetching"

---

## 6. 🔧 BACKEND & API

### 6.1 Routes & Middleware
- [ ] Routes organisées par portal : `portals/company/`, `portals/tenant/`, etc.
- [ ] Middleware pipeline : `auth → accessMode → permission → module → activeCompany`
- [ ] Routes extraient `AccessMode` de `req.accessMode` et passent aux services
- [ ] Pas de logique métier dans routes (délègue aux services)

**Références** : `.cursor/rules/backend-rules.mdc` section "Architecture", `.cursor/rules/general.mdc` section "Backend (Express.js/Node.js)"

### 6.2 Logging
- [ ] Utilise `packages/logging` (ex: `logger.info('msg', { metadata })`)
- [ ] JAMAIS `console.log`, `console.error`, `console.warn`
- [ ] Logging structuré avec metadata : `{ userId, portal, tenantId, companyId }`
- [ ] JAMAIS de credentials, tokens, reset tokens, ou PII dans logs

**Références** : `.cursor/rules/backend-rules.mdc` section "Logging"

### 6.3 Module Activation & Groups
- [ ] Module activation cascade : modules activés au niveau tenant avant company
- [ ] Default group assignment lors création users :
  - `TENANT_ADMIN` → `TENANT_FULL_ADMIN` (tenant-level)
  - `COMPANY_ADMIN` → `COMPANY_FULL_ADMIN` (company-level)
  - `PARTNER_ADMIN` → `PARTNER_FULL_ADMIN` (partner-level)
  - `PARTNER_STAFF` → `PARTNER_DEFAULT_SUPPORT` (partner-level)
  - `COMPANY_USER` : pas de groupe par défaut (doit être assigné explicitement)

**Références** : `.cursor/rules/backend-rules.mdc` section "Module Activation & Groups"

---

## 7. 📦 TYPES & TYPAGE

### 7.1 TypeScript Strict (CRITICAL)
- [ ] Frontend : ZÉRO `any` toléré (strictement interdit)
- [ ] Backend : `any` autorisé pour legacy, mais nouveau code l'évite
- [ ] Utilise `unknown` + type guards au lieu de `any`
- [ ] Types explicites sur toutes les fonctions exportées :
  - Services : `Promise<ReturnType>` avec types domain explicites
  - Repositories : `Promise<Entity[]>` ou `Promise<Entity | null>`
  - Routes : `Promise<void>` ou `Promise<Response>`
  - Components : `JSX.Element` ou `Promise<JSX.Element>`
  - Hooks : types explicites

**Références** : `.cursor/rules/backend-rules.mdc` section "TypeScript Strict", `.cursor/rules/frontend-rules.mdc` section "TypeScript Strict"

### 7.2 Types Partagés (CRITICAL)
- [ ] Tous les types globaux importés de `@numezis/shared-ts` (jamais recréés)
- [ ] Types locaux uniquement pour DTOs route-spécifiques (ex: `CreateInvoicePayload`)
- [ ] Vérifie cohérence types FE/BE (pas de duplication)
- [ ] AccessMode types : `CompanyAccessMode`, `TenantAccessMode`, etc. depuis `@numezis/shared-ts`

**Références** : `.cursor/rules/general.mdc` section "TypeScript Branded Types & Conversions"

### 7.3 Branded Types Conversions (CRITICAL)
- [ ] `ObjectId → Branded` : `toStringId(id) as UserId` (ou `TenantId`, `CompanyId`)
- [ ] `Branded → ObjectId` : `toObjectId(id)` pour queries MongoDB
- [ ] `String → Branded` : cast direct `req.user.id as UserId`
- [ ] Arrays : convert avec `.map((id) => toStringId(id) as UserId)`
- [ ] JAMAIS de branded types directement dans queries MongoDB (convertir en ObjectId d'abord)

**Références** : `.cursor/rules/backend-rules.mdc` section "Branded Types & Conversions (CRITICAL)"

---

## 8. 🧪 QUALITÉ DU CODE

### 8.1 Patterns Interdits (CRITICAL)
- [ ] Pas de `console.log/error/warn/debug` (bloqué en pre-commit)
- [ ] Pas d'appels async non-awaited
- [ ] Pas de promises sans catch
- [ ] Pas de forbidden imports (vérifie Import Rules Matrix)
- [ ] Pas d'accès DB direct dans services/routes (toujours repositories)
- [ ] Pas de legacy proxy (`/api/proxy/*`), fetch incorrect, cross-portal imports

**Références** : `.cursor/rules/general.mdc` section "Quality & Testing"

### 8.2 React Hooks & Performance
- [ ] Pas de violations de hooks React (boucles infinies)
- [ ] Pas de patterns de boucles infinies
- [ ] Server components par défaut (pas de "use client" inutile)
- [ ] Pas de problèmes d'hydratation React

**Références** : `docs/02-development/quality/quality-architecture.md` section "🟧 TIER 3"

### 8.3 Code Style
- [ ] Fonctions <40 lignes (extrait helpers si nécessaire)
- [ ] Naming descriptif : camelCase variables, PascalCase components
- [ ] Early returns plutôt que nesting profond
- [ ] Pas de try/catch large (gère erreurs connues explicitement)

**Références** : `.cursor/rules/general.mdc` section "Quality-first defaults"

---

## 9. 🧩 COHÉRENCE & PATTERNS

### 9.1 Import Rules Matrix
- [ ] Frontend (`apps/web`) : peut UNIQUEMENT importer depuis `packages/*` et `apps/web/lib/utils`
- [ ] Domain services : peut importer depuis repositories, core, utils (PAS portals)
- [ ] Repositories : peut importer depuis core, utils (PAS portals ou domain)
- [ ] Core : peut importer depuis utils et packages (PAS portals, domain, repositories)

**Références** : `.cursor/rules/backend-rules.mdc` section "Import Rules Matrix"

### 9.2 Architecture Drift Detection
- [ ] Pas de portal branching dans domain services (services portal-neutral)
- [ ] Pas de header-based context inference (toujours AccessMode)
- [ ] Pas de frontend context construction (toujours AccessMode depuis backend)
- [ ] Pas de direct `db.collection()` calls (toujours repositories)

**Références** : `.cursor/rules/general.mdc` section "Architecture Drift Detection (CRITICAL)"

---

## 10. 🚀 QUALITY CHECKS (4 TIERS)

### 10.1 🟦 TIER 1: Pre-commit (FAST)
Vérifie mentalement que le code passerait ces checks (<500ms) :
- [ ] No console (`check-no-console.ts`)
- [ ] No any frontend (`check-no-any.ts`)
- [ ] No TODO (`check-no-todo.ts`)
- [ ] Syntax SWC (`check-syntax-swc.ts`)
- [ ] Types fast (`check-types-fast.ts` - max 50 fichiers)
- [ ] Form Views fast (`check-form-views-fast.ts`)
- [ ] List Views fast (`check-list-views-fast.ts`)
- [ ] Page Actions fast (`check-page-actions-fast.ts`)

**Références** : `docs/02-development/quality/quality-architecture.md` section "🟦 TIER 1"

### 10.2 🟩 TIER 2: Dev-time (WATCH)
Vérifie mentalement que le code passerait ces checks (dev-time) :
- [ ] Req body sans Zod (`check-req-body.ts`)
- [ ] Fetch client route (`check-fetch-client-route.ts`)
- [ ] Legacy proxy (`check-legacy-proxy.ts`)
- [ ] Cross-portal imports (`check-cross-portal-imports.ts`)
- [ ] Pages i18n (`check-pages-i18n.ts`)
- [ ] CTA links (`check-cta-links.ts`)
- [ ] i18n fallbacks (`check-i18n-fallbacks.ts`)
- [ ] No direct fetch (`check-no-direct-fetch.ts`)
- [ ] Standardized imports (`check-standardized-imports.ts`)

**Références** : `docs/02-development/quality/quality-architecture.md` section "🟩 TIER 2"

### 10.3 🟧 TIER 3: CI Quality Gate (CRITICAL)
Vérifie mentalement que le code passerait ces checks critiques (bloquent CI) :
- [ ] Async await (`check-async-await.ts`)
- [ ] Promise catch (`check-promise-catch.ts`)
- [ ] Portal architecture (`check-portal-architecture.ts`)
- [ ] API auth (`check-api-auth.ts`)
- [ ] Forbidden imports (`check-forbidden-imports.ts`)
- [ ] API tenant guards (`check-api-tenant-guards.ts`)
- [ ] Dangerous patterns (`check-dangerous-patterns.ts`)
- [ ] API quality (`check-api-quality.ts`)
- [ ] TypeScript build API (`check-typescript-build.ts`)
- [ ] TypeScript build Web (`check-typescript-build-web.ts`)
- [ ] React hooks (`check-react-hooks.ts`)
- [ ] Infinite loops (`check-infinite-loops.ts`)
- [ ] Server components (`check-server-components.ts`)
- [ ] Form views (`check-form-views.ts`)
- [ ] List views (`check-list-views.ts`)
- [ ] Page actions (`check-page-actions.ts`)
- [ ] Empty states (`check-empty-states.ts`)
- [ ] Loading states (`check-loading-states.ts`)

**Références** : `docs/02-development/quality/quality-architecture.md` section "🟧 TIER 3"

### 10.4 🟥 TIER 4: Nocturne (DEEP AUDIT)
Vérifie mentalement les audits nocturnes (non-bloquants) :
- [ ] UI snapshots
- [ ] Sitemap validation
- [ ] i18n full analysis
- [ ] Responsive design testing
- [ ] Lighthouse performance
- [ ] React render analysis
- [ ] Bundle size analysis

**Références** : `docs/02-development/quality/quality-architecture.md` section "🟥 TIER 4"

---

## 11. 📝 SYNTHÈSE & VERDICT

### 11.1 Checklist Complète
- [ ] Tous les checks ci-dessus validés
- [ ] Tests passent : `npm --workspace apps/api run test` (backend) et `npm --workspace apps/web run test` (frontend)
- [ ] Quality checks passent : `npm run check:3` (inclut build, MANDATORY avant PR)
- [ ] i18n valide : `npm run i18n:verify && npm run i18n:lint` (pas de compilation nécessaire)
- [ ] Linting passe : `turbo run lint`

### 11.2 Améliorations Obligatoires
Liste clairement toutes les violations critiques qui BLOQUENT le merge :
- [ ] Violation 1 : [description précise + fichier + ligne + règle violée]
- [ ] Violation 2 : [description précise + fichier + ligne + règle violée]
- ...

### 11.3 Améliorations Optionnelles
Liste les améliorations non-bloquantes mais recommandées :
- [ ] Amélioration 1 : [description + suggestion concrète]
- [ ] Amélioration 2 : [description + suggestion concrète]
- ...

### 11.4 Next Steps (si incomplet)
Si le travail n'est pas terminé, liste les étapes restantes par priorité :
1. **Priorité 1 (Bloquant)** : [action concrète]
2. **Priorité 2 (Important)** : [action concrète]
3. **Priorité 3 (Nice-to-have)** : [action concrète]

### 11.5 Verdict Final
- ✅ **OK pour merge** : Tous les checks passent, code prêt pour PR
- ⚠️ **OK mais corrections nécessaires** : Corrections mineures requises avant merge
- ❌ **Bloquant / Ne respecte pas architecture** : Refactoring majeur requis, violations critiques

**Références explicites** : Pour chaque violation, référence le fichier de règle exact (ex: "violates `.cursor/rules/backend-rules.mdc` section 'AccessMode & Middleware (CRITICAL)'")

---

➤ RÉSULTAT ATTENDU

Une réponse ultra-structurée, détaillée, très technique, directement exploitable, avec :
- ✅ Références explicites aux fichiers de règles (`.cursor/rules/*.mdc`, `docs/02-development/quality/quality-architecture.md`)
- ✅ Checklist complète avec cases à cocher
- ✅ Violations précises avec fichiers + lignes + règles violées
- ✅ Suggestions concrètes et actionnables
- ✅ Verdict clair (OK/Bloquant/Corrections nécessaires)
- ✅ Next steps ordonnés par priorité si incomplet


