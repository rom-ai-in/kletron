Tu es un **auditeur senior Architecture + UX + Complétude** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif du portal Partner (`/p`)**, en vérifiant que **TOUS les éléments requis** sont présents, correctement implémentés, cohérents avec les autres portals, et conformes aux règles strictes du monorepo.

**⚠️ CRITICAL** : Partner Portal (`/p`) est **UNIQUEMENT** pour la gestion partner (clients list, partner users, partner groups, partner settings). Partners accèdent aux données opérationnelles des clients **EXCLUSIVEMENT** via Company Portal routes (`/c/companies/:companyId/*`) avec `CompanyAccessMode`, leur donnant **FULL CRUD access** à tous les modules opérationnels (invoices, orders, contacts, documents, etc.).

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Portal Architecture** : `docs/01-architecture/portal/portal-architecture.md`
- **Portal Modules Matrix** : `docs/01-architecture/portal/portal-modules-matrix.md`
- **Navigation Registry** : `apps/api/src/services/navigation.registry.ts`
- **Partner Portal Routes** : `apps/api/src/routes/portals/partner.routes.ts` et sous-dossiers `partner/`
- **Partner Portal Pages** : `apps/web/app/[locale]/(partner)/p/**/*`
- **AccessMode Types** : `packages/shared-ts/src/types/access-mode.ts`
- **Permission & Access Control** : `.agent/prompts/A-audit/A6-security/permission-access-control.md`
- **Portal UX Guide** : `docs/09-ui-ux/05-portals/portal-experience-guide.md`
- **Mobile-First Rules** : `docs/09-ui-ux/02-responsive/mobile-first-rules.md`

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Portal** : `partner` (`/p`)
   - **Type** : `full-audit` | `module-specific` | `diff-only`
   - **Modules concernés** : Liste complète (ou `all`)
   - **Fichiers modifiés** : Liste complète (si diff-only)

2. **Routes applicatives** :
   - **Backend** : Liste complète des endpoints `/p/*` (méthode + chemin + guards)
   - **Frontend** : Liste complète des pages `/p/*` (chemin Next.js + guards)

3. **Modules disponibles** :
   - **Partner management uniquement** : Clients list, Partner users, Partner groups, Partner settings, Partner audit, Search
   - **Modules cross-portal** : Notifications (partner-level), Tasks (partner-level only, NOT client company tasks), Comments (partner-level only, NOT client company comments), AI agents (partner-level)
   - **⚠️ Accès opérationnel via `/c/*`** : Partners accèdent aux données opérationnelles via Company Portal routes (`/c/companies/:companyId/*`) avec `CompanyAccessMode`

---

## 🔍 1. COHÉRENCE AVEC REPO & AUTRES PORTALS

### 1.1 Patterns Backend Cohérents

**CRITICAL** : Vérifie que les patterns backend sont cohérents avec les autres portals.

**Checklist** :
- [ ] ✅ **Routes structure** : Routes organisées par portal (`apps/api/src/routes/portals/partner.routes.ts` et sous-dossiers `partner/`)
- [ ] ✅ **Guards order pour routes `/p/*`** : `requirePortal('partner')` → `requireModuleEnabled()` → `requirePermission()` (pas de `requireActiveCompany()` - routes `/p/*` sont pour partner management, pas company)
- [ ] ✅ **Guards order pour routes `/c/*`** : `requirePortal('company')` → `requireModuleEnabled()` → `requirePermission()` → `requireActiveCompany()` (write only - routes `/c/*` utilisées par partners pour données opérationnelles)
- [ ] ✅ **AccessMode extraction** : Routes extraient `AccessMode` de `req.accessMode` (jamais de headers)
- [ ] ✅ **Service calls** : Routes appellent services domain (pas de logique métier dans routes)
- [ ] ✅ **Validation Zod** : Tous les inputs validés via Zod
- [ ] ✅ **Error handling** : Erreurs utilisent `translate()` avec clés i18n
- [ ] ✅ **Audit logging** : Toutes les opérations write loggent des événements d'audit

**Comparaison avec autres portals** :
- [ ] ✅ **Company Portal** : Patterns similaires (guards, validation, error handling) - Partners utilisent routes `/c/*` avec `CompanyAccessMode`
- [ ] ✅ **Tenant Portal** : Patterns similaires (guards, validation, error handling) - **MAIS** Partner a `requireActiveCompany()` pour routes `/c/*`
- [ ] ✅ **Superadmin Portal** : Patterns similaires (sauf `requireActiveCompany()`)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Routes `/p/*`** : Partner management uniquement (clients list, partner users, partner groups, partner settings) - **PAS de `requireActiveCompany()`** (pas de company)
- [ ] ✅ **Routes `/c/*`** : Partners utilisent routes Company Portal avec `CompanyAccessMode` pour accéder aux données opérationnelles - **DOIT avoir `requireActiveCompany()`** pour write operations
- [ ] ✅ **Scoping partner** : Routes `/p/*` filtrent par `accessMode.accessibleCompanyIds` (si applicable)
- [ ] ✅ **Scoping company** : Routes `/c/*` utilisées par partners filtrent par `accessMode.companyId` (CompanyAccessMode)

**Violations détectées** :
- ❌ Routes avec logique métier (au lieu de services) → **BLOQUANT**
- ❌ Routes qui lisent headers (`X-Tenant-Id`, `X-Company-Id`) → **BLOQUANT**
- ❌ Routes `/p/*` avec modules opérationnels (interdit) → **BLOQUANT**
- ❌ Guards dans ordre incorrect → **BLOQUANT**
- ❌ Erreurs hardcodées (pas i18n) → **BLOQUANT**

### 1.2 Patterns Frontend Cohérents

**CRITICAL** : Vérifie que les patterns frontend sont cohérents avec les autres portals.

**Checklist** :
- [ ] ✅ **Page structure** : Pages utilisent `ListView`, `DetailView`, `FormView` (pas de composants manuels)
- [ ] ✅ **Guards frontend** : `PortalGuard` → `ModuleGate` → `PermissionGate` → `ActiveCompanyGate` (write only, pour pages `/c/*` utilisées par partners)
- [ ] ✅ **AccessMode usage** : Pages utilisent `useAccessMode()` hook (jamais de reconstruction depuis URL/localStorage)
- [ ] ✅ **Navigation** : Pages utilisent `@/navigation` (pas de `next/link` direct)
- [ ] ✅ **Breadcrumbs** : Pages utilisent hooks (`usePartnerBreadcrumbs`, etc.)
- [ ] ✅ **Loading states** : Pages utilisent skeletons standardisés (pas de `Spinner` manuels)
- [ ] ✅ **Error boundaries** : Layout inclut `ErrorBoundaryWrapper`
- [ ] ✅ **Empty states** : Pages définissent empty states avec CTA actionnable

**Comparaison avec autres portals** :
- [ ] ✅ **Company Portal** : Patterns similaires (page structure, guards, navigation) - Partners utilisent pages `/c/*` avec `CompanyAccessMode`
- [ ] ✅ **Tenant Portal** : Patterns similaires (page structure, guards, navigation) - **MAIS** Partner a `ActiveCompanyGate` pour pages `/c/*`
- [ ] ✅ **Superadmin Portal** : Patterns similaires (sauf `ActiveCompanyGate`)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Pages `/p/*`** : Partner management uniquement (clients list, partner users, partner groups, partner settings)
- [ ] ✅ **Pages `/c/*`** : Partners utilisent pages Company Portal avec `CompanyAccessMode` pour accéder aux données opérationnelles
- [ ] ✅ **AccessMode switching** : Partners peuvent switcher entre `PartnerAccessMode` (pour `/p/*`) et `CompanyAccessMode` (pour `/c/*`)

**Violations détectées** :
- ❌ Pages avec composants manuels (au lieu de Page Views) → **BLOQUANT**
- ❌ Pages qui lisent `companyId` depuis URL params → **BLOQUANT**
- ❌ Pages qui stockent contexte dans localStorage → **BLOQUANT**
- ❌ Guards frontend manquants ou incomplets → **BLOQUANT**

### 1.3 Repository Scoping Cohérent

**CRITICAL** : Vérifie que le scoping des repositories est cohérent avec les autres portals.

**Checklist** :
- [ ] ✅ **Scoping Partner (routes `/p/*`)** : Repositories filtrent par `accessMode.accessibleCompanyIds` (si applicable)
- [ ] ✅ **Scoping Company (routes `/c/*`)** : Repositories filtrent par `accessMode.companyId` ET `accessMode.tenantId` (CompanyAccessMode)
- [ ] ✅ **Validation scoping** : Repositories valident `companyId IN accessibleCompanyIds` avant query
- [ ] ✅ **Pas de headers** : Repositories n'utilisent JAMAIS headers pour scoping
- [ ] ✅ **Indexes MongoDB** : Indexes incluent `companyId` (selon besoins)

**Comparaison avec autres portals** :
- [ ] ✅ **Company Portal** : Scoping par `tenantId` ET `companyId` (Company a besoin des deux)
- [ ] ✅ **Tenant Portal** : Scoping par `tenantId` uniquement (pas de `companyId`)
- [ ] ✅ **Superadmin Portal** : Pas de scoping automatique (sauf filtres explicites)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Routes `/p/*`** : Scoping par `accessibleCompanyIds` (partner management)
- [ ] ✅ **Routes `/c/*`** : Scoping par `companyId` ET `tenantId` (CompanyAccessMode, données opérationnelles)

**Violations détectées** :
- ❌ Repository lit headers pour scoping → **BLOQUANT**
- ❌ Scoping incorrect (manque validation `companyId IN accessibleCompanyIds`) → **BLOQUANT**
- ❌ Scoping manquant (pas de filtre `companyId` pour routes `/c/*`) → **BLOQUANT**

### 1.4 Service Domain Portal-Neutral

**CRITICAL** : Vérifie que les services domain sont portal-neutral (pas de branching par portal).

**Checklist** :
- [ ] ✅ **Pas de branching** : Services n'ont PAS de `if (portal === 'partner')` ou similaire
- [ ] ✅ **AccessMode usage** : Services utilisent propriétés `AccessMode` directement
- [ ] ✅ **Portal-neutral** : Services fonctionnent avec tous les portals (Company, Tenant, Partner, Superadmin)

**Violations détectées** :
- ❌ Service fait du branching par portal → **BLOQUANT**

### 1.5 Modules Opérationnels via `/c/*` Routes

**CRITICAL** : Vérifie que les modules opérationnels sont accessibles UNIQUEMENT via routes `/c/*` avec `CompanyAccessMode`.

**Modules opérationnels** (accessibles via `/c/*` uniquement) :
- ✅ **Sales** : `invoices`, `orders`, `quotes`
- ✅ **Purchases** : `expenses`, `supplier_invoices`
- ✅ **Accounting** : `banking`
- ✅ **Projects** : `projects`, `tasks`
- ✅ **HR** : `employees`, `payroll`
- ✅ **Inventory** : `products`, `warehouses`
- ✅ **Intelligence** : `reports`, `analytics`
- ✅ **Communication** : `messages`, `notifications`
- ✅ **Foundation** : `contacts`

**Checklist** :
- [ ] ✅ **Aucun module opérationnel dans `/p/*`** : Aucune route `/p/*` pour modules opérationnels
- [ ] ✅ **Navigation registry** : Aucune entrée avec `moduleCode` opérationnel pour portal `partner` dans routes `/p/*`
- [ ] ✅ **Pages frontend** : Aucune page `/p/*` pour modules opérationnels
- [ ] ✅ **Routes `/c/*` accessibles** : Partners peuvent accéder aux routes `/c/companies/:companyId/*` avec `CompanyAccessMode`
- [ ] ✅ **AccessMode switching** : Partners peuvent switcher entre `PartnerAccessMode` (pour `/p/*`) et `CompanyAccessMode` (pour `/c/*`)

**Violations détectées** :
- ❌ Route `/p/*` pour module opérationnel → **BLOQUANT**
- ❌ Navigation registry avec `moduleCode` opérationnel pour portal `partner` dans routes `/p/*` → **BLOQUANT**
- ❌ Page frontend `/p/*` pour module opérationnel → **BLOQUANT**
- ❌ Partners ne peuvent pas accéder aux routes `/c/*` → **BLOQUANT**

---

## 🧭 2. MENU LOGIC & NAVIGATION

### 2.1 Navigation Registry Complétude

**CRITICAL** : Vérifie que toutes les routes Partner Portal sont dans le navigation registry.

**Checklist** :
- [ ] ✅ **Routes structurelles** : Toutes les list pages, dashboards, settings sont dans registry
- [ ] ✅ **Routes dérivées** : Toutes les detail pages, forms sont dans registry avec `excludeFromMenu: true`
- [ ] ✅ **Propriétés complètes** :
  - `id` : Unique et cohérent
  - `labelKey` : Existe dans i18n (tous les locales)
  - `hrefTemplate` : Correct avec placeholders (`:companyId` pour routes `/c/*`)
  - `icon` : Défini (si applicable)
  - `moduleCode` : Correspond au module (partner management uniquement pour `/p/*`)
  - `requiredPermission` : Format correct (`MODULE:ACTION`)
  - `portal` : Contient `"partner"` dans array (pour routes `/p/*`) ou `"company"` (pour routes `/c/*` utilisées par partners)
  - `order` : Défini pour tri
- [ ] ✅ **Routes structurelles** : `excludeFromMenu` absent ou `false` (dans menu)
- [ ] ✅ **Routes dérivées** : `excludeFromMenu: true` (pas dans menu)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Routes `/p/*`** : Partner management uniquement (clients list, partner users, partner groups, partner settings)
- [ ] ✅ **Routes `/c/*`** : Partners peuvent avoir entry points vers routes `/c/*` (via clients list ou navigation)

**Méthode** :
1. Scanner toutes les pages frontend (`apps/web/app/[locale]/(partner)/p/**/*`)
2. Pour chaque page, vérifier la présence dans navigation registry
3. Vérifier que les propriétés sont correctes
4. **⚠️ Vérifier qu'aucun module opérationnel n'est présent dans routes `/p/*`**

**Violations détectées** :
- ❌ Route sans entry point dans navigation registry → **BLOQUANT**
- ❌ `labelKey` n'existe pas dans i18n → **BLOQUANT**
- ❌ `hrefTemplate` incorrect → **BLOQUANT**
- ❌ Route structurelle avec `excludeFromMenu: true` → **BLOQUANT**
- ❌ Route `/p/*` avec `moduleCode` opérationnel → **BLOQUANT**

### 2.2 Menu Visibility Logic

**CRITICAL** : Vérifie que la logique de visibilité du menu est cohérente.

**Checklist** :
- [ ] ✅ **List pages** : `excludeFromMenu !== true` (dans menu par défaut)
- [ ] ✅ **Detail pages** : `excludeFromMenu: true` (pas dans menu)
- [ ] ✅ **Forms** : `excludeFromMenu: true` (pas dans menu)
- [ ] ✅ **Dashboards** : `excludeFromMenu !== true` (dans menu par défaut)
- [ ] ✅ **Settings** : `excludeFromMenu !== true` (dans menu par défaut)

**Module filtering** :
- [ ] ✅ **Items avec `moduleCode`** : Filtrés si module non activé (sauf superadmin)
- [ ] ✅ **Items avec `requiredPermission`** : Filtrés si permission manquante (sauf superadmin)
- [ ] ✅ **Superadmin bypass** : Superadmin voit tous les items (pas de filtrage)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Clients list** : Entry point vers routes `/c/*` (switch vers CompanyAccessMode)
- [ ] ✅ **Company selection** : Partners peuvent sélectionner company depuis clients list

**Violations détectées** :
- ❌ List pages avec `excludeFromMenu: true` → **BLOQUANT**
- ❌ Detail pages sans `excludeFromMenu: true` → **BLOQUANT**
- ❌ Items visibles même si module non activé (sauf superadmin) → **BLOQUANT**

### 2.3 Breadcrumb Generation

**CRITICAL** : Vérifie que toutes les routes ont des breadcrumbs corrects.

**Checklist** :
- [ ] ✅ **Toutes les routes** : Ont `labelKey` pour breadcrumbs
- [ ] ✅ **Breadcrumbs** : Utilisent `getRouteMetadata()` depuis navigation registry
- [ ] ✅ **Hiérarchie** : Breadcrumbs affichent hiérarchie correcte (parent → child)
- [ ] ✅ **i18n** : Breadcrumbs utilisent i18n (pas de texte hardcodé)
- [ ] ✅ **Hooks** : Pages utilisent `usePartnerBreadcrumbs()` ou équivalent

**⚠️ Spécificités Partner** :
- [ ] ✅ **Routes `/p/*`** : Breadcrumbs pour partner management
- [ ] ✅ **Routes `/c/*`** : Breadcrumbs pour données opérationnelles (avec company context)

**Violations détectées** :
- ❌ Routes sans `labelKey` (breadcrumbs vides) → **BLOQUANT**
- ❌ Breadcrumbs qui n'utilisent pas navigation registry → **BLOQUANT**
- ❌ Breadcrumbs avec texte hardcodé (pas i18n) → **BLOQUANT**

### 2.4 Feature Discoverability

**CRITICAL** : Vérifie que toutes les routes applicatives ont un point d'entrée (Feature Discoverability Rule).

**Checklist** :
- [ ] ✅ **Routes structurelles** : Entry point direct (sidebar, dashboard, settings)
- [ ] ✅ **Routes dérivées** : Entry point indirect (CTA contextuel, breadcrumb parent, deep-link documenté ET exposé via UI)
- [ ] ✅ **Toutes les routes** : Ont au moins un entry point
- [ ] ✅ **Entry points** : Sont visibles pour le rôle cible (permissions, modules)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Clients list** : Entry point vers routes `/c/*` (via company selection)
- [ ] ✅ **Company switching** : Partners peuvent switcher entre companies depuis clients list

**Violations détectées** :
- ❌ Routes sans entry point (violation Feature Discoverability Rule) → **BLOQUANT**
- ❌ Routes accessibles uniquement via URL directe → **BLOQUANT**
- ❌ Entry points non visibles pour le rôle cible → **BLOQUANT**

---

## 📋 3. FEATURES & PAGES COMPLÈTES

### 3.1 Modules Partner Management Complétude

**CRITICAL** : Vérifie que tous les modules partner management ont des pages complètes.

**Modules à vérifier** :
- **Clients** : `clients` (partner clients list)
- **Users** : `users` (partner users management)
- **Groups** : `groups` (partner groups management)
- **Settings** : `settings` (partner settings)
- **Audit** : `audit` (partner audit logs)
- **Search** : `search` (cross-portal search)
- **Notifications** : `notifications` (partner-level notifications)
- **Tasks** : `tasks` (partner-level tasks only, NOT client company tasks)
- **Comments** : `comments` (partner-level comments only, NOT client company comments)
- **AI agents** : `agents` (partner-level agents)

**Checklist par module** :
- [ ] ✅ **List page** : Existe avec `ListView` (ou `UnifiedListView`)
- [ ] ✅ **Detail page** : Existe avec `DetailView` (si applicable)
- [ ] ✅ **Create page** : Existe avec `FormView` (mode create, si applicable)
- [ ] ✅ **Edit page** : Existe avec `FormView` (mode edit, si applicable)
- [ ] ✅ **API client** : Existe avec fonctions CRUD typées
- [ ] ✅ **Guards** : Frontend et backend cohérents
- [ ] ✅ **i18n** : Clés i18n présentes (tous les locales)
- [ ] ✅ **Navigation** : Entry point dans navigation registry

**⚠️ Spécificités par module** :
- **Clients** : List, Detail (pas de Create/Edit - clients sont liés via PartnerClientLink)
- **Users** : List, Detail, Create, Edit (CRUD complet)
- **Groups** : List, Detail, Create, Edit (CRUD complet)
- **Settings** : Detail, Edit (pas de List/Create - settings est singleton)
- **Audit** : List, Detail (Read-only, pas de Create/Edit/Delete)
- **Search** : Page de recherche (pas de CRUD)
- **Notifications** : List, Detail (CRUD complet, partner-level uniquement)
- **Tasks** : List, Detail, Create, Edit (CRUD complet, partner-level uniquement, NOT client company tasks)
- **Comments** : List, Detail, Create, Edit (CRUD complet, partner-level uniquement, NOT client company comments)
- **AI agents** : List, Detail, Create, Edit (CRUD complet, partner-level)

**Violations détectées** :
- ❌ Module sans list page → **BLOQUANT**
- ❌ Module sans detail page (si applicable) → **BLOQUANT**
- ❌ Module sans create/edit pages (si applicable) → **BLOQUANT**
- ❌ Module sans API client → **BLOQUANT**

### 3.2 Accès Opérationnel via `/c/*` Routes

**CRITICAL** : Vérifie que les partners peuvent accéder aux données opérationnelles via routes `/c/*`.

**Checklist** :
- [ ] ✅ **Company selection** : Partners peuvent sélectionner company depuis clients list
- [ ] ✅ **AccessMode switching** : Partners peuvent switcher de `PartnerAccessMode` à `CompanyAccessMode`
- [ ] ✅ **Routes `/c/*` accessibles** : Partners peuvent accéder aux routes `/c/companies/:companyId/*` avec `CompanyAccessMode`
- [ ] ✅ **Full CRUD access** : Partners ont full CRUD access à tous les modules opérationnels via routes `/c/*`
- [ ] ✅ **Guards cohérents** : Routes `/c/*` utilisées par partners ont guards corrects (`requirePortal('company')`, `requireActiveCompany()`, etc.)

**Modules opérationnels accessibles** :
- ✅ **Sales** : `invoices`, `orders`, `quotes`
- ✅ **Purchases** : `expenses`, `supplier_invoices`
- ✅ **Accounting** : `banking`
- ✅ **Projects** : `projects`, `tasks`
- ✅ **HR** : `employees`, `payroll`
- ✅ **Inventory** : `products`, `warehouses`
- ✅ **Intelligence** : `reports`, `analytics`
- ✅ **Communication** : `messages`, `notifications`
- ✅ **Foundation** : `contacts`

**Violations détectées** :
- ❌ Partners ne peuvent pas sélectionner company → **BLOQUANT**
- ❌ Partners ne peuvent pas switcher vers `CompanyAccessMode` → **BLOQUANT**
- ❌ Routes `/c/*` non accessibles pour partners → **BLOQUANT**
- ❌ Partners n'ont pas full CRUD access → **BLOQUANT**

### 3.3 CRUD Operations Complétude

**CRITICAL** : Vérifie que toutes les opérations CRUD sont implémentées (selon besoins).

**Checklist** :
- [ ] ✅ **Create** : Toutes les entités peuvent être créées (form + API endpoint, si applicable)
- [ ] ✅ **Read** : Toutes les entités peuvent être lues (list + detail)
- [ ] ✅ **Update** : Toutes les entités peuvent être mises à jour (form + API endpoint, si applicable)
- [ ] ✅ **Delete** : Toutes les entités peuvent être supprimées (si applicable)
- [ ] ✅ **Bulk operations** : Opérations en masse supportées (si applicable)
- [ ] ✅ **Validation** : Validation Zod côté backend ET frontend
- [ ] ✅ **Error handling** : Gestion d'erreurs complète (réseau, validation, permissions)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Routes `/p/*`** : CRUD pour partner management (clients, users, groups, settings)
- [ ] ✅ **Routes `/c/*`** : CRUD pour données opérationnelles (invoices, orders, contacts, etc.)
- [ ] ✅ **requireActiveCompany()** : Présent sur routes write `/c/*` (partners doivent respecter company status)

**Violations détectées** :
- ❌ Opération CRUD manquante (si applicable) → **BLOQUANT**
- ❌ Validation manquante → **BLOQUANT**
- ❌ Error handling incomplet → **BLOQUANT**

### 3.4 User Journeys Complétude

**CRITICAL** : Vérifie que tous les user journeys sont complets.

**User journeys à vérifier** :
- **Client management** : List → Detail → Switch to CompanyAccessMode → Access operational data
- **User management** : List → Create → Detail → Edit → Delete
- **Group management** : List → Create → Detail → Edit → Delete
- **Settings** : Detail → Edit (partner settings)
- **Company switching** : Clients list → Select company → Switch to CompanyAccessMode → Access operational data

**Checklist** :
- [ ] ✅ **User journeys complets** : Entry point → Action → Résultat
- [ ] ✅ **Error states** : Gestion d'erreurs à chaque étape
- [ ] ✅ **Empty states** : États vides gérés (listes vides, détails manquants)
- [ ] ✅ **Loading states** : Loading states appropriés (skeletons, spinners)
- [ ] ✅ **Feedback** : Feedback immédiat (toasts, messages)

**Violations détectées** :
- ❌ User journey incomplet (étapes manquantes) → **BLOQUANT**
- ❌ Error states manquants → **BLOQUANT**
- ❌ Empty states manquants → **BLOQUANT**

---

## 🔐 4. ACCESS CONTROL

### 4.1 Guards Backend Complétude

**CRITICAL** : Vérifie que tous les guards backend sont présents et corrects.

**Checklist** :
- [ ] ✅ **requirePortal('partner')** : Présent sur toutes les routes `/p/*`
- [ ] ✅ **requireModuleEnabled()** : Présent sur toutes les routes module-specific
- [ ] ✅ **requirePermission()** : Présent sur toutes les routes avec permissions requises
- [ ] ✅ **⚠️ Pas de `requireActiveCompany()` pour routes `/p/*`** : Routes `/p/*` sont pour partner management (pas de company), donc pas de `requireActiveCompany()`
- [ ] ✅ **requireActiveCompany()** : Présent sur toutes les routes write `/c/*` utilisées par partners (pour données opérationnelles)
- [ ] ✅ **Guard order pour routes `/p/*`** : Ordre correct (`requirePortal` → `requireModuleEnabled` → `requirePermission`)
- [ ] ✅ **Guard order pour routes `/c/*`** : Ordre correct (`requirePortal` → `requireModuleEnabled` → `requirePermission` → `requireActiveCompany`)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Routes `/p/*`** : Guards pour partner management (`requirePortal('partner')`, `requireModuleEnabled()`, `requirePermission()`) - **PAS de `requireActiveCompany()`**
- [ ] ✅ **Routes `/c/*`** : Guards pour données opérationnelles (`requirePortal('company')`, `requireModuleEnabled()`, `requirePermission()`, `requireActiveCompany()` pour write)

**Violations détectées** :
- ❌ Route `/p/*` sans `requirePortal('partner')` → **BLOQUANT**
- ❌ Route module-specific sans `requireModuleEnabled()` → **BLOQUANT**
- ❌ Route avec permission requise sans `requirePermission()` → **BLOQUANT**
- ❌ Route `/p/*` avec `requireActiveCompany()` (routes `/p/*` n'ont pas de company) → **BLOQUANT**
- ❌ Route write `/c/*` sans `requireActiveCompany()` → **BLOQUANT**
- ❌ Guards dans ordre incorrect → **BLOQUANT**

### 4.2 Guards Frontend Complétude

**CRITICAL** : Vérifie que tous les guards frontend sont présents et corrects.

**Checklist** :
- [ ] ✅ **PortalGuard** : Présent sur toutes les pages `/p/*` et `/c/*` utilisées par partners
- [ ] ✅ **ModuleGate** : Présent sur toutes les pages module-specific
- [ ] ✅ **PermissionGate** : Présent sur toutes les pages avec permissions requises
- [ ] ✅ **⚠️ Pas de `ActiveCompanyGate` pour pages `/p/*`** : Pages `/p/*` sont pour partner management (pas de company), donc pas de `ActiveCompanyGate`
- [ ] ✅ **ActiveCompanyGate** : Présent sur toutes les pages write `/c/*` utilisées par partners (pour données opérationnelles)
- [ ] ✅ **Guard order pour pages `/p/*`** : Ordre correct (`PortalGuard` → `ModuleGate` → `PermissionGate`)
- [ ] ✅ **Guard order pour pages `/c/*`** : Ordre correct (`PortalGuard` → `ModuleGate` → `PermissionGate` → `ActiveCompanyGate`)

**⚠️ Spécificités Partner** :
- [ ] ✅ **Pages `/p/*`** : Guards pour partner management (`PortalGuard`, `ModuleGate`, `PermissionGate`) - **PAS de `ActiveCompanyGate`**
- [ ] ✅ **Pages `/c/*`** : Guards pour données opérationnelles (`PortalGuard`, `ModuleGate`, `PermissionGate`, `ActiveCompanyGate` pour write)

**Violations détectées** :
- ❌ Page `/p/*` sans `PortalGuard` → **BLOQUANT**
- ❌ Page module-specific sans `ModuleGate` → **BLOQUANT**
- ❌ Page avec permission requise sans `PermissionGate` → **BLOQUANT**
- ❌ Page `/p/*` avec `ActiveCompanyGate` (pages `/p/*` n'ont pas de company) → **BLOQUANT**
- ❌ Page write `/c/*` sans `ActiveCompanyGate` → **BLOQUANT**
- ❌ Guards dans ordre incorrect → **BLOQUANT**

### 4.3 AccessMode Usage

**CRITICAL** : Vérifie que `AccessMode` est utilisé correctement.

**Checklist** :
- [ ] ✅ **Backend** : Routes utilisent `req.accessMode` (jamais de headers)
- [ ] ✅ **Frontend** : Pages utilisent `useAccessMode()` hook (jamais de reconstruction depuis URL/localStorage)
- [ ] ✅ **Repositories** : Utilisent `AccessMode` pour scoping (jamais de headers)
- [ ] ✅ **Services** : Acceptent `AccessMode` comme premier paramètre
- [ ] ✅ **Type guards** : Utilisés avant accès aux propriétés portal-specific

**⚠️ Spécificités Partner** :
- [ ] ✅ **PartnerAccessMode** : Pages `/p/*` utilisent `PartnerAccessMode` (pour partner management)
- [ ] ✅ **CompanyAccessMode** : Pages `/c/*` utilisent `CompanyAccessMode` (pour données opérationnelles)
- [ ] ✅ **AccessMode switching** : Partners peuvent switcher entre `PartnerAccessMode` et `CompanyAccessMode`
- [ ] ✅ **Scoping partner** : Repositories filtrent par `accessibleCompanyIds` pour routes `/p/*`
- [ ] ✅ **Scoping company** : Repositories filtrent par `companyId` ET `tenantId` pour routes `/c/*`

**Violations détectées** :
- ❌ Code lit headers (`X-Tenant-Id`, `X-Company-Id`) → **BLOQUANT**
- ❌ Frontend construit contexte depuis URL → **BLOQUANT**
- ❌ Repository lit headers pour scoping → **BLOQUANT**
- ❌ Page `/p/*` utilise `CompanyAccessMode` (incohérence) → **BLOQUANT**
- ❌ Page `/c/*` utilise `PartnerAccessMode` (incohérence) → **BLOQUANT**

### 4.4 Permission & Module Checks

**CRITICAL** : Vérifie que les checks de permissions et modules sont cohérents.

**Checklist** :
- [ ] ✅ **Permissions cohérentes** : Frontend et backend utilisent mêmes permission codes
- [ ] ✅ **Modules cohérents** : Frontend et backend utilisent mêmes module codes
- [ ] ✅ **Superadmin bypass** : Superadmin bypass tous les checks (sauf `requirePortal`)
- [ ] ✅ **Error messages** : Messages d'erreur utilisent i18n (pas de hardcode)

**Violations détectées** :
- ❌ Permission codes incohérents (frontend ≠ backend) → **BLOQUANT**
- ❌ Module codes incohérents (frontend ≠ backend) → **BLOQUANT**
- ❌ Superadmin filtré par module/permission (bug) → **BLOQUANT**

---

## 📱 5. MOBILE VIEW LOGIC

### 5.1 Mobile-First Design

**CRITICAL** : Vérifie que toutes les pages sont mobile-first (375px+).

**Checklist** :
- [ ] ✅ **Baseline 375px** : Design commence à 375px (pas de desktop-first)
- [ ] ✅ **Pas de overflow horizontal** : Pas de `min-w-*` traps, strings longues clampées
- [ ] ✅ **Pas de `vh` fragiles** : Pas de `vh` sur iOS Safari (préférer content-driven height)
- [ ] ✅ **Breakpoints appropriés** : Utilise breakpoints standards (375px, 768px, 1280px+)
- [ ] ✅ **Testé** : Pages testées à 375×667, 390×844, 768×1024, 1280px+

**Violations détectées** :
- ❌ Pages non mobile-first (desktop-first) → **BLOQUANT**
- ❌ Overflow horizontal → **BLOQUANT**
- ❌ `vh` fragiles sur iOS Safari → **BLOQUANT**

### 5.2 Responsive Layouts

**CRITICAL** : Vérifie que tous les layouts sont responsive.

**Checklist** :
- [ ] ✅ **Sidebar** : Sidebar responsive (mobile: drawer, desktop: sidebar)
- [ ] ✅ **Tables** : Tables responsive (mobile: stacked, desktop: table)
- [ ] ✅ **Forms** : Forms responsive (mobile: stacked, desktop: grid)
- [ ] ✅ **Navigation** : Navigation responsive (mobile: hamburger, desktop: menu)
- [ ] ✅ **Breadcrumbs** : Breadcrumbs responsive (mobile: truncated, desktop: full)

**Violations détectées** :
- ❌ Layouts non responsive → **BLOQUANT**
- ❌ Tables non responsive (overflow horizontal) → **BLOQUANT**
- ❌ Forms non responsive (champs trop larges) → **BLOQUANT**

### 5.3 Touch Interactions

**CRITICAL** : Vérifie que toutes les interactions sont touch-friendly.

**Checklist** :
- [ ] ✅ **Touch targets** : Boutons et liens ≥ 44×44px (iOS guidelines)
- [ ] ✅ **Spacing** : Espacement suffisant entre éléments interactifs
- [ ] ✅ **Gestures** : Gestures supportées (swipe, pull-to-refresh si applicable)
- [ ] ✅ **Feedback** : Feedback visuel immédiat (hover states, active states)

**Violations détectées** :
- ❌ Touch targets trop petits (< 44×44px) → **BLOQUANT**
- ❌ Espacement insuffisant entre éléments → **BLOQUANT**

### 5.4 Mobile-Specific Patterns

**CRITICAL** : Vérifie que les patterns mobile sont implémentés.

**Checklist** :
- [ ] ✅ **Drawer navigation** : Drawer pour navigation mobile (si applicable)
- [ ] ✅ **Bottom sheets** : Bottom sheets pour actions secondaires (si applicable)
- [ ] ✅ **Sticky headers** : Headers sticky sur mobile (si applicable)
- [ ] ✅ **Infinite scroll** : Infinite scroll pour listes longues (si applicable)

**Violations détectées** :
- ❌ Patterns mobile manquants (drawer, bottom sheets) → **ATTENTION**

---

## 💡 6. IDÉES DE NOUVELLES FEATURES

### 6.1 Gaps Identifiés

**CRITICAL** : Identifie les gaps fonctionnels et propose des nouvelles features.

**Méthode** :
1. Comparer avec autres portals (Company, Tenant, Superadmin)
2. Comparer avec modules similaires (Clients vs Users vs Groups)
3. Identifier patterns manquants (bulk operations, exports, etc.)
4. Proposer nouvelles features avec justification

**Exemples de gaps** :
- **Company switching** : Switch rapide entre companies (amélioration UX)
- **Bulk operations** : Opérations en masse manquantes (bulk delete, bulk update)
- **Exports** : Exports manquants (PDF, CSV, Excel)
- **Advanced filters** : Filtres avancés manquants (date ranges, multi-select)
- **Search** : Recherche globale manquante ou incomplète
- **Notifications** : Notifications manquantes ou incomplètes
- **Client dashboard** : Dashboard par client avec métriques opérationnelles

**Format** :
- **Gap identifié** : Description du gap
- **Impact** : Impact utilisateur (haute/moyenne/faible)
- **Priorité** : Priorité (P1/P2/P3)
- **Proposition** : Proposition de feature avec justification

### 6.2 Améliorations UX

**CRITICAL** : Identifie les améliorations UX possibles.

**Méthode** :
1. Comparer avec best practices UX
2. Identifier patterns UX manquants (skeletons, empty states, error states)
3. Proposer améliorations avec justification

**Exemples d'améliorations** :
- **Loading states** : Skeletons au lieu de spinners
- **Empty states** : Empty states plus engageants avec CTAs
- **Error states** : Error states plus informatifs avec retry
- **Feedback** : Feedback plus immédiat (optimistic updates)
- **Navigation** : Navigation plus fluide (prefetch, transitions)
- **Company context** : Indicateur visuel du company actuel (quand en mode CompanyAccessMode)

**Format** :
- **Amélioration identifiée** : Description de l'amélioration
- **Impact** : Impact utilisateur (haute/moyenne/faible)
- **Priorité** : Priorité (P1/P2/P3)
- **Proposition** : Proposition d'amélioration avec justification

---

## 📊 7. FORMAT DE RÉPONSE ATTENDU

### Structure Minimale (Priorité)

1. **📊 Résumé Exécutif** (1-2 paragraphes)
   - Nombre total de violations par catégorie (Cohérence, Menu, Features, Access, Mobile)
   - Top 5 problèmes critiques
   - Verdict global : 🟥 **CRITIQUE** | 🟨 **ATTENTION** | 🟩 **OK**

2. **🔴 Violations Critiques** (Tableau)
   | Catégorie | Module | Problème | Gravité | Description | Fix | Source |
   |-----------|--------|----------|---------|-------------|-----|--------|
   | Cohérence | Backend | Route `/p/*` avec module opérationnel | 🔴 Bloquant | Route `/p/invoices` existe alors que invoices est un module opérationnel (interdit) | Supprimer route ou déplacer vers `/c/*` | Portal Modules Matrix |
   | Access | AccessMode | Page `/c/*` utilise PartnerAccessMode | 🔴 Bloquant | Page `/c/companies/:companyId/invoices` utilise PartnerAccessMode au lieu de CompanyAccessMode | Utiliser CompanyAccessMode pour routes `/c/*` | Portal Architecture |

3. **🟡 Violations Non-Critiques** (Liste à puces)
   - Mobile : Patterns mobile manquants (drawer, bottom sheets)
   - UX : Améliorations possibles (skeletons, empty states)

4. **📁 Matrice Cohérence** (Tableau)
   | Pattern | Partner Portal | Company Portal | Tenant Portal | Superadmin Portal | Status |
   |---------|---------------|----------------|--------------|-------------------|--------|
   | Guards order | ✅ (requirePortal → requireModuleEnabled → requirePermission pour `/p/*`, + requireActiveCompany pour `/c/*` write) | ✅ (requirePortal → requireModuleEnabled → requirePermission → requireActiveCompany) | ✅ (requirePortal → requireModuleEnabled → requirePermission) | ✅ (requirePortal uniquement) | ✅ Conforme |
   | AccessMode usage | ✅ (PartnerAccessMode pour `/p/*`, CompanyAccessMode pour `/c/*`) | ✅ (CompanyAccessMode) | ✅ (TenantAccessMode) | ✅ (SuperadminAccessMode) | ✅ Conforme |
   | Repository scoping | ✅ (accessibleCompanyIds pour `/p/*`, companyId pour `/c/*`) | ✅ (tenantId + companyId) | ✅ (tenantId uniquement) | ✅ (pas de scoping automatique) | ✅ Conforme |
   | requireActiveCompany | ❌ (pas de company pour `/p/*`), ✅ (write only pour `/c/*`) | ✅ (write only) | ❌ (pas de company) | ❌ (pas de company) | ✅ Conforme |

5. **🧭 Matrice Menu Logic** (Tableau)
   | Route | Navigation Registry | excludeFromMenu | Module Filter | Permission Filter | Entry Point | Status |
   |-------|---------------------|-----------------|---------------|------------------|-------------|--------|
   | /p/clients | ✅ | ✅ | ✅ | ✅ | ✅ Sidebar | ✅ Conforme |
   | /p/invoices | ❌ | N/A | N/A | N/A | ❌ | ❌ Interdit (module opérationnel) |
   | /c/companies/:companyId/invoices | ✅ | ✅ | ✅ | ✅ | ✅ Via clients list | ✅ Conforme |

6. **📋 Matrice Features Complétude** (Tableau)
   | Module | List | Detail | Create | Edit | Delete | API Client | Guards | i18n | Status |
   |--------|------|--------|--------|------|--------|------------|--------|------|--------|
   | clients | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ Complet (pas de Create/Edit/Delete) |
   | users | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complet |
   | invoices (via `/c/*`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complet |

7. **🔐 Matrice Access Control** (Tableau)
   | Route | requirePortal | requireModuleEnabled | requirePermission | requireActiveCompany | Frontend Guards | Status |
   |-------|---------------|----------------------|-------------------|---------------------|----------------|--------|
   | GET /p/clients | ✅ (partner) | ✅ | ✅ | ❌ (pas de company) | ✅ | ✅ Conforme |
   | POST /p/users | ✅ (partner) | ✅ | ✅ | ❌ (pas de company) | ✅ | ✅ Conforme |
   | GET /c/companies/:companyId/invoices | ✅ (company) | ✅ | ✅ | ❌ (read) | ✅ | ✅ Conforme |
   | POST /c/companies/:companyId/invoices | ✅ (company) | ✅ | ✅ | ✅ (write) | ✅ | ✅ Conforme |

8. **📱 Matrice Mobile View** (Liste structurée)
   - **Mobile-First** :
     - ✅ Toutes les pages sont mobile-first (375px+)
     - ⚠️ Certaines pages ont overflow horizontal
   - **Responsive Layouts** :
     - ✅ Sidebar responsive (mobile: drawer)
     - ⚠️ Certaines tables non responsive
   - **Touch Interactions** :
     - ✅ Touch targets ≥ 44×44px
     - ⚠️ Espacement insuffisant sur certaines pages

9. **💡 Nouvelles Features Proposées** (Liste structurée)
   - **Gaps identifiés** :
     - Company switching amélioré (P1 - Haute priorité)
     - Bulk operations manquantes (P2 - Moyenne priorité)
   - **Améliorations UX** :
     - Company context indicator (P2 - Moyenne priorité)
     - Skeletons au lieu de spinners (P2 - Moyenne priorité)

10. **📌 Actions Prioritaires** (Checklist)
    - [ ] **Priorité 1** : Guards manquants (sécurité)
    - [ ] **Priorité 1** : Modules opérationnels interdits dans `/p/*` (architecture)
    - [ ] **Priorité 1** : Routes sans entry point (Feature Discoverability Rule)
    - [ ] **Priorité 2** : Patterns mobile manquants (UX)
    - [ ] **Priorité 2** : Features incomplètes (complétude)
    - [ ] **Priorité 3** : Améliorations UX (qualité)

### Règles de Réponse

- ✅ **Concis** : Maximum 1 page par section (sauf violations critiques)
- ✅ **Actionnable** : Chaque violation = correction proposée avec code exact
- ✅ **Référencé** : Citer docs sources explicitement
- ✅ **Technique** : Citer fichiers, lignes, patterns explicitement
- ❌ **Pas de blabla** : Pas de généralités vagues, uniquement faits techniques
- ❌ **Pas de suppositions** : Si information manquante, lister ce qui manque MAIS donner quand même une checklist exhaustive

---

## 🎯 Priorisation

### Priorité 1 (Bloquant - Corriger Immédiatement)
- Guards manquants (sécurité)
- Modules opérationnels interdits dans `/p/*` (architecture)
- AccessMode incorrect (PartnerAccessMode vs CompanyAccessMode)
- Routes sans entry point (Feature Discoverability Rule)
- Pages non mobile-first (UX)

### Priorité 2 (Important - Corriger Avant Prochaine Release)
- Features incomplètes (complétude)
- Patterns mobile manquants (UX)
- Menu logic incohérente (UX)

### Priorité 3 (Amélioration Continue)
- Améliorations UX (qualité)
- Nouvelles features (innovation)

---

## ➤ Résultat Attendu

Une réponse **ultra-structurée, détaillée, très technique, directement exploitable**, utilisant :
- Les **patterns établis** (guards, AccessMode, navigation)
- Les **comparaisons inter-portals** (Partner vs Company vs Tenant vs Superadmin)
- Les **matrices de cohérence** (Cohérence, Menu, Features, Access, Mobile)
- Les **actions prioritaires** (fixes proposés avec code exact)
- Les **nouvelles features** (gaps identifiés, améliorations UX)

**Focus** : Uniquement **complétude, cohérence, access control, UX mobile, et nouvelles features** pour le portal Partner, pas **features métier optionnelles**.

**⚠️ CRITICAL** : Partner Portal (`/p`) est **UNIQUEMENT** pour la gestion partner. Partners accèdent aux données opérationnelles **EXCLUSIVEMENT** via routes `/c/*` avec `CompanyAccessMode`.

**Verdict final** :
- 🟥 **CRITIQUE** : Guards manquants, modules opérationnels interdits dans `/p/*`, AccessMode incorrect, routes sans entry point, pages non mobile-first
- 🟨 **ATTENTION** : Corrections nécessaires mais non-bloquantes
- 🟩 **OK** : Portal Partner complet et cohérent (rare)

