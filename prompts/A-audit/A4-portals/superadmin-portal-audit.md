Tu es un **auditeur senior Architecture + UX + Complétude** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif du portal Superadmin (`/s`)**, en vérifiant que **TOUS les éléments requis** sont présents, correctement implémentés, cohérents avec les autres portals, et conformes aux règles strictes du monorepo.

**⚠️ CRITICAL** : Superadmin Portal (`/s`) est **UNIQUEMENT** pour l'administration système (read-only access à toutes les données, plus system management). Superadmin bypass tous les checks de permissions et modules (sauf `requirePortal('superadmin')`).

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Portal Architecture** : `docs/01-architecture/portal/portal-architecture.md`
- **Portal Modules Matrix** : `docs/01-architecture/portal/portal-modules-matrix.md`
- **Navigation Registry** : `apps/api/src/services/navigation.registry.ts`
- **Superadmin Portal Routes** : `apps/api/src/routes/portals/superadmin.routes.ts` et sous-dossiers `superadmin/`
- **Superadmin Portal Pages** : `apps/web/app/[locale]/(superadmin)/s/**/*`
- **AccessMode Types** : `packages/shared-ts/src/types/access-mode.ts`
- **Permission & Access Control** : `.agent/prompts/A-audit/A6-security/permission-access-control.md`
- **Portal UX Guide** : `docs/09-ui-ux/05-portals/portal-experience-guide.md`
- **Mobile-First Rules** : `docs/09-ui-ux/02-responsive/mobile-first-rules.md`

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Portal** : `superadmin` (`/s`)
   - **Type** : `full-audit` | `module-specific` | `diff-only`
   - **Modules concernés** : Liste complète (ou `all`)
   - **Fichiers modifiés** : Liste complète (si diff-only)

2. **Routes applicatives** :
   - **Backend** : Liste complète des endpoints `/s/*` (méthode + chemin + guards)
   - **Frontend** : Liste complète des pages `/s/*` (chemin Next.js + guards)

3. **Modules disponibles** :
   - **System management** : Tenants, Companies, Users, Groups, Modules, Settings, Audit, Search
   - **Cross-portal** : Notifications (system-level), AI agents (system-level, chat + automation)
   - **⚠️ Read-only access** : Superadmin a read-only access à toutes les données opérationnelles (pas de CRUD sur invoices, orders, contacts, etc.)
   - **⚠️ System management** : Superadmin peut gérer les entités système (tenants, companies, users, groups, modules, settings)

---

## 🔍 1. COHÉRENCE AVEC REPO & AUTRES PORTALS

### 1.1 Patterns Backend Cohérents

**CRITICAL** : Vérifie que les patterns backend sont cohérents avec les autres portals.

**Checklist** :
- [ ] ✅ **Routes structure** : Routes organisées par portal (`apps/api/src/routes/portals/superadmin.routes.ts` et sous-dossiers `superadmin/`)
- [ ] ✅ **Guards order** : `requirePortal('superadmin')` → (pas de `requireModuleEnabled()`, `requirePermission()`, `requireActiveCompany()` - superadmin bypass tous les checks)
- [ ] ✅ **AccessMode extraction** : Routes extraient `AccessMode` de `req.accessMode` (jamais de headers)
- [ ] ✅ **Service calls** : Routes appellent services domain (pas de logique métier dans routes)
- [ ] ✅ **Validation Zod** : Tous les inputs validés via Zod
- [ ] ✅ **Error handling** : Erreurs utilisent `translate()` avec clés i18n
- [ ] ✅ **Audit logging** : Toutes les opérations write loggent des événements d'audit

**Comparaison avec autres portals** :
- [ ] ✅ **Company Portal** : Patterns similaires (validation, error handling) - **MAIS** Superadmin n'a PAS `requireModuleEnabled()`, `requirePermission()`, `requireActiveCompany()`
- [ ] ✅ **Tenant Portal** : Patterns similaires (validation, error handling) - **MAIS** Superadmin n'a PAS `requireModuleEnabled()`, `requirePermission()`
- [ ] ✅ **Partner Portal** : Patterns similaires (validation, error handling) - **MAIS** Superadmin n'a PAS `requireModuleEnabled()`, `requirePermission()`, `requireActiveCompany()`

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **Pas de `requireModuleEnabled()`** : Superadmin bypass module activation checks
- [ ] ✅ **Pas de `requirePermission()`** : Superadmin bypass permission checks
- [ ] ✅ **Pas de `requireActiveCompany()`** : Superadmin n'a pas de company, donc pas de check company status
- [ ] ✅ **Scoping superadmin** : Pas de scoping automatique (sauf filtres explicites via query parameters)

**Violations détectées** :
- ❌ Routes avec logique métier (au lieu de services) → **BLOQUANT**
- ❌ Routes qui lisent headers (`X-Tenant-Id`, `X-Company-Id`) → **BLOQUANT**
- ❌ Routes avec `requireModuleEnabled()` ou `requirePermission()` (superadmin bypass) → **BLOQUANT**
- ❌ Routes avec `requireActiveCompany()` (superadmin n'a pas de company) → **BLOQUANT**
- ❌ Guards dans ordre incorrect → **BLOQUANT**
- ❌ Erreurs hardcodées (pas i18n) → **BLOQUANT**

### 1.2 Patterns Frontend Cohérents

**CRITICAL** : Vérifie que les patterns frontend sont cohérents avec les autres portals.

**Checklist** :
- [ ] ✅ **Page structure** : Pages utilisent `ListView`, `DetailView`, `FormView` (pas de composants manuels)
- [ ] ✅ **Guards frontend** : `PortalGuard` uniquement (pas de `ModuleGate`, `PermissionGate`, `ActiveCompanyGate` - superadmin bypass tous les checks)
- [ ] ✅ **AccessMode usage** : Pages utilisent `useAccessMode()` hook (jamais de reconstruction depuis URL/localStorage)
- [ ] ✅ **Navigation** : Pages utilisent `@/navigation` (pas de `next/link` direct)
- [ ] ✅ **Breadcrumbs** : Pages utilisent hooks (`useSuperadminBreadcrumbs`, etc.)
- [ ] ✅ **Loading states** : Pages utilisent skeletons standardisés (pas de `Spinner` manuels)
- [ ] ✅ **Error boundaries** : Layout inclut `ErrorBoundaryWrapper`
- [ ] ✅ **Empty states** : Pages définissent empty states avec CTA actionnable

**Comparaison avec autres portals** :
- [ ] ✅ **Company Portal** : Patterns similaires (page structure, navigation) - **MAIS** Superadmin n'a PAS `ModuleGate`, `PermissionGate`, `ActiveCompanyGate`
- [ ] ✅ **Tenant Portal** : Patterns similaires (page structure, navigation) - **MAIS** Superadmin n'a PAS `ModuleGate`, `PermissionGate`
- [ ] ✅ **Partner Portal** : Patterns similaires (page structure, navigation) - **MAIS** Superadmin n'a PAS `ModuleGate`, `PermissionGate`, `ActiveCompanyGate`

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **Pas de `ModuleGate`** : Superadmin bypass module activation checks
- [ ] ✅ **Pas de `PermissionGate`** : Superadmin bypass permission checks
- [ ] ✅ **Pas de `ActiveCompanyGate`** : Superadmin n'a pas de company, donc pas de check company status
- [ ] ✅ **Scoping superadmin** : Pages peuvent afficher toutes les données (pas de filtrage automatique)

**Violations détectées** :
- ❌ Pages avec composants manuels (au lieu de Page Views) → **BLOQUANT**
- ❌ Pages qui lisent `tenantId`/`companyId` depuis URL params → **BLOQUANT**
- ❌ Pages qui stockent contexte dans localStorage → **BLOQUANT**
- ❌ Guards frontend incorrects (`ModuleGate`, `PermissionGate`, `ActiveCompanyGate` présents) → **BLOQUANT**

### 1.3 Repository Scoping Cohérent

**CRITICAL** : Vérifie que le scoping des repositories est cohérent avec les autres portals.

**Checklist** :
- [ ] ✅ **Scoping Superadmin** : Pas de scoping automatique (repositories retournent toutes les données sauf filtres explicites)
- [ ] ✅ **Filtres explicites** : Superadmin peut filtrer par `tenantId`, `companyId` via query parameters
- [ ] ✅ **Pas de headers** : Repositories n'utilisent JAMAIS headers pour scoping
- [ ] ✅ **Indexes MongoDB** : Indexes appropriés pour queries cross-tenant/company

**Comparaison avec autres portals** :
- [ ] ✅ **Company Portal** : Scoping par `tenantId` ET `companyId` (automatique)
- [ ] ✅ **Tenant Portal** : Scoping par `tenantId` uniquement (automatique)
- [ ] ✅ **Partner Portal** : Scoping par `accessibleCompanyIds` (automatique)

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **Pas de scoping automatique** : Repositories retournent toutes les données (pas de filtrage automatique)
- [ ] ✅ **Filtres explicites** : Superadmin peut filtrer via query parameters (`?tenantId=...`, `?companyId=...`)

**Violations détectées** :
- ❌ Repository lit headers pour scoping → **BLOQUANT**
- ❌ Repository applique scoping automatique (superadmin doit voir toutes les données) → **BLOQUANT**
- ❌ Repository ne supporte pas filtres explicites → **BLOQUANT**

### 1.4 Service Domain Portal-Neutral

**CRITICAL** : Vérifie que les services domain sont portal-neutral (pas de branching par portal).

**Checklist** :
- [ ] ✅ **Pas de branching** : Services n'ont PAS de `if (portal === 'superadmin')` ou similaire
- [ ] ✅ **AccessMode usage** : Services utilisent propriétés `AccessMode` directement
- [ ] ✅ **Portal-neutral** : Services fonctionnent avec tous les portals (Company, Tenant, Partner, Superadmin)

**Violations détectées** :
- ❌ Service fait du branching par portal → **BLOQUANT**

### 1.5 Superadmin Bypass Logic

**CRITICAL** : Vérifie que Superadmin bypass tous les checks (sauf `requirePortal`).

**Checklist** :
- [ ] ✅ **Backend guards** : `requireModuleEnabled()` et `requirePermission()` bypass pour SuperadminAccessMode
- [ ] ✅ **Frontend gates** : `ModuleGate` et `PermissionGate` bypass pour SuperadminAccessMode
- [ ] ✅ **Repository scoping** : Pas de scoping automatique pour SuperadminAccessMode
- [ ] ✅ **Service logic** : Services ne filtrent pas par permissions/modules pour SuperadminAccessMode

**Violations détectées** :
- ❌ Guards backend ne bypass pas pour SuperadminAccessMode → **BLOQUANT**
- ❌ Gates frontend ne bypass pas pour SuperadminAccessMode → **BLOQUANT**
- ❌ Repository applique scoping automatique pour SuperadminAccessMode → **BLOQUANT**

---

## 🧭 2. MENU LOGIC & NAVIGATION

### 2.1 Navigation Registry Complétude

**CRITICAL** : Vérifie que toutes les routes Superadmin Portal sont dans le navigation registry.

**Checklist** :
- [ ] ✅ **Routes structurelles** : Toutes les list pages, dashboards, settings sont dans registry
- [ ] ✅ **Routes dérivées** : Toutes les detail pages, forms sont dans registry avec `excludeFromMenu: true`
- [ ] ✅ **Propriétés complètes** :
  - `id` : Unique et cohérent
  - `labelKey` : Existe dans i18n (tous les locales)
  - `hrefTemplate` : Correct (pas de placeholders obligatoires - superadmin peut voir toutes les données)
  - `icon` : Défini (si applicable)
  - `moduleCode` : Correspond au module (si applicable, mais pas de filtrage)
  - `requiredPermission` : Absent ou ignoré (superadmin bypass)
  - `portal` : Contient `"superadmin"` dans array
  - `order` : Défini pour tri
- [ ] ✅ **Routes structurelles** : `excludeFromMenu` absent ou `false` (dans menu)
- [ ] ✅ **Routes dérivées** : `excludeFromMenu: true` (pas dans menu)

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **Pas de filtrage module/permission** : Tous les items sont visibles (superadmin bypass)
- [ ] ✅ **hrefTemplate flexible** : Pas de placeholders obligatoires (superadmin peut voir toutes les données)

**Méthode** :
1. Scanner toutes les pages frontend (`apps/web/app/[locale]/(superadmin)/s/**/*`)
2. Pour chaque page, vérifier la présence dans navigation registry
3. Vérifier que les propriétés sont correctes
4. **⚠️ Vérifier qu'aucun filtrage module/permission n'est appliqué**

**Violations détectées** :
- ❌ Route sans entry point dans navigation registry → **BLOQUANT**
- ❌ `labelKey` n'existe pas dans i18n → **BLOQUANT**
- ❌ `hrefTemplate` incorrect → **BLOQUANT**
- ❌ Route structurelle avec `excludeFromMenu: true` → **BLOQUANT**
- ❌ Items filtrés par module/permission (superadmin doit voir tous les items) → **BLOQUANT**

### 2.2 Menu Visibility Logic

**CRITICAL** : Vérifie que la logique de visibilité du menu est cohérente.

**Checklist** :
- [ ] ✅ **List pages** : `excludeFromMenu !== true` (dans menu par défaut)
- [ ] ✅ **Detail pages** : `excludeFromMenu: true` (pas dans menu)
- [ ] ✅ **Forms** : `excludeFromMenu: true` (pas dans menu)
- [ ] ✅ **Dashboards** : `excludeFromMenu !== true` (dans menu par défaut)
- [ ] ✅ **Settings** : `excludeFromMenu !== true` (dans menu par défaut)

**Module filtering** :
- [ ] ✅ **Aucun filtrage** : Tous les items sont visibles (superadmin bypass tous les filtres)
- [ ] ✅ **Pas de `moduleCode` filtering** : Items avec `moduleCode` sont toujours visibles
- [ ] ✅ **Pas de `requiredPermission` filtering** : Items avec `requiredPermission` sont toujours visibles

**Violations détectées** :
- ❌ List pages avec `excludeFromMenu: true` → **BLOQUANT**
- ❌ Detail pages sans `excludeFromMenu: true` → **BLOQUANT**
- ❌ Items filtrés par module/permission (superadmin doit voir tous les items) → **BLOQUANT**

### 2.3 Breadcrumb Generation

**CRITICAL** : Vérifie que toutes les routes ont des breadcrumbs corrects.

**Checklist** :
- [ ] ✅ **Toutes les routes** : Ont `labelKey` pour breadcrumbs
- [ ] ✅ **Breadcrumbs** : Utilisent `getRouteMetadata()` depuis navigation registry
- [ ] ✅ **Hiérarchie** : Breadcrumbs affichent hiérarchie correcte (parent → child)
- [ ] ✅ **i18n** : Breadcrumbs utilisent i18n (pas de texte hardcodé)
- [ ] ✅ **Hooks** : Pages utilisent `useSuperadminBreadcrumbs()` ou équivalent

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
- [ ] ✅ **Entry points** : Sont visibles (superadmin voit tous les items)

**Violations détectées** :
- ❌ Routes sans entry point (violation Feature Discoverability Rule) → **BLOQUANT**
- ❌ Routes accessibles uniquement via URL directe → **BLOQUANT**

---

## 📋 3. FEATURES & PAGES COMPLÈTES

### 3.1 Modules System Management Complétude

**CRITICAL** : Vérifie que tous les modules system management ont des pages complètes.

**Modules à vérifier** :
- **Tenants** : `tenants` (system tenants management)
- **Companies** : `companies` (system companies management)
- **Users** : `users` (system users management)
- **Groups** : `groups` (system groups management)
- **Modules** : `modules` (system modules management)
- **Settings** : `settings` (system settings)
- **Audit** : `audit` (system audit logs)
- **Search** : `search` (cross-portal search)
- **Notifications** : `notifications` (system-level, cross-portal, always available)
- **AI agents** : `agents` (system-level, cross-portal, chat + automation)

**Checklist par module** :
- [ ] ✅ **List page** : Existe avec `ListView` (ou `UnifiedListView`)
- [ ] ✅ **Detail page** : Existe avec `DetailView` (si applicable)
- [ ] ✅ **Create page** : Existe avec `FormView` (mode create, si applicable)
- [ ] ✅ **Edit page** : Existe avec `FormView` (mode edit, si applicable)
- [ ] ✅ **API client** : Existe avec fonctions CRUD typées
- [ ] ✅ **Guards** : Frontend et backend cohérents (uniquement `PortalGuard`)
- [ ] ✅ **i18n** : Clés i18n présentes (tous les locales)
- [ ] ✅ **Navigation** : Entry point dans navigation registry

**⚠️ Spécificités par module** :
- **Tenants** : List, Detail, Create, Edit (CRUD complet)
- **Companies** : List, Detail, Create, Edit (CRUD complet)
- **Users** : List, Detail, Create, Edit (CRUD complet)
- **Groups** : List, Detail, Create, Edit (CRUD complet)
- **Modules** : List, Detail, Edit (pas de Create - modules sont créés système)
- **Settings** : Detail, Edit (pas de List/Create - settings est singleton)
- **Audit** : List, Detail (Read-only, pas de Create/Edit/Delete)
- **Search** : Page de recherche (pas de CRUD)
- **Notifications** : List, Detail (CRUD complet, system-level)
- **AI agents** : List, Detail, Create, Edit (CRUD complet, system-level)

**Violations détectées** :
- ❌ Module sans list page → **BLOQUANT**
- ❌ Module sans detail page (si applicable) → **BLOQUANT**
- ❌ Module sans create/edit pages (si applicable) → **BLOQUANT**
- ❌ Module sans API client → **BLOQUANT**

### 3.2 Read-Only Access to Operational Data

**CRITICAL** : Vérifie que Superadmin a read-only access à toutes les données opérationnelles.

**Checklist** :
- [ ] ✅ **Read access** : Superadmin peut lire toutes les données (invoices, orders, contacts, etc.)
- [ ] ✅ **Pas de write access** : Superadmin ne peut PAS créer/modifier/supprimer données opérationnelles (sauf via system management)
- [ ] ✅ **Filtres explicites** : Superadmin peut filtrer par `tenantId`, `companyId` via query parameters
- [ ] ✅ **Scoping correct** : Repositories ne filtrent pas automatiquement (superadmin voit toutes les données)

**Modules opérationnels accessibles (read-only)** :
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
- ❌ Superadmin ne peut pas lire toutes les données → **BLOQUANT**
- ❌ Superadmin peut créer/modifier/supprimer données opérationnelles (interdit) → **BLOQUANT**
- ❌ Repositories filtrent automatiquement (superadmin doit voir toutes les données) → **BLOQUANT**

### 3.3 CRUD Operations Complétude

**CRITICAL** : Vérifie que toutes les opérations CRUD sont implémentées (selon besoins).

**Checklist** :
- [ ] ✅ **Create** : Toutes les entités système peuvent être créées (form + API endpoint, si applicable)
- [ ] ✅ **Read** : Toutes les entités peuvent être lues (list + detail)
- [ ] ✅ **Update** : Toutes les entités système peuvent être mises à jour (form + API endpoint, si applicable)
- [ ] ✅ **Delete** : Toutes les entités système peuvent être supprimées (si applicable)
- [ ] ✅ **Bulk operations** : Opérations en masse supportées (si applicable)
- [ ] ✅ **Validation** : Validation Zod côté backend ET frontend
- [ ] ✅ **Error handling** : Gestion d'erreurs complète (réseau, validation, permissions)

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **System management** : CRUD pour entités système (tenants, companies, users, groups, modules, settings)
- [ ] ✅ **Read-only operational** : Read-only pour données opérationnelles (invoices, orders, contacts, etc.)
- [ ] ✅ **Pas de `requireActiveCompany()`** : Superadmin n'a pas de company, donc pas de check company status

**Violations détectées** :
- ❌ Opération CRUD manquante (si applicable) → **BLOQUANT**
- ❌ Validation manquante → **BLOQUANT**
- ❌ Error handling incomplet → **BLOQUANT**

### 3.4 User Journeys Complétude

**CRITICAL** : Vérifie que tous les user journeys sont complets.

**User journeys à vérifier** :
- **Tenant management** : List → Create → Detail → Edit → Delete
- **Company management** : List → Create → Detail → Edit → Delete
- **User management** : List → Create → Detail → Edit → Delete
- **Group management** : List → Create → Detail → Edit → Delete
- **Module management** : List → Detail → Edit (activation/désactivation)
- **Settings** : Detail → Edit (system settings)
- **Audit exploration** : List → Detail → Filter by tenant/company

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
- [ ] ✅ **requirePortal('superadmin')** : Présent sur toutes les routes `/s/*`
- [ ] ✅ **⚠️ Pas de `requireModuleEnabled()`** : Superadmin bypass module activation checks
- [ ] ✅ **⚠️ Pas de `requirePermission()`** : Superadmin bypass permission checks
- [ ] ✅ **⚠️ Pas de `requireActiveCompany()`** : Superadmin n'a pas de company, donc pas de check company status
- [ ] ✅ **Guard order** : Ordre correct (`requirePortal` uniquement)

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **Uniquement `requirePortal('superadmin')`** : Superadmin n'a besoin que de `requirePortal`
- [ ] ✅ **Bypass tous les autres checks** : Superadmin bypass `requireModuleEnabled()`, `requirePermission()`, `requireActiveCompany()`

**Violations détectées** :
- ❌ Route sans `requirePortal('superadmin')` → **BLOQUANT**
- ❌ Route avec `requireModuleEnabled()` ou `requirePermission()` (superadmin bypass) → **BLOQUANT**
- ❌ Route avec `requireActiveCompany()` (superadmin n'a pas de company) → **BLOQUANT**
- ❌ Guards dans ordre incorrect → **BLOQUANT**

### 4.2 Guards Frontend Complétude

**CRITICAL** : Vérifie que tous les guards frontend sont présents et corrects.

**Checklist** :
- [ ] ✅ **PortalGuard** : Présent sur toutes les pages `/s/*`
- [ ] ✅ **⚠️ Pas de `ModuleGate`** : Superadmin bypass module activation checks
- [ ] ✅ **⚠️ Pas de `PermissionGate`** : Superadmin bypass permission checks
- [ ] ✅ **⚠️ Pas de `ActiveCompanyGate`** : Superadmin n'a pas de company, donc pas de check company status
- [ ] ✅ **Guard order** : Ordre correct (`PortalGuard` uniquement)

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **Uniquement `PortalGuard`** : Superadmin n'a besoin que de `PortalGuard`
- [ ] ✅ **Bypass tous les autres checks** : Superadmin bypass `ModuleGate`, `PermissionGate`, `ActiveCompanyGate`

**Violations détectées** :
- ❌ Page sans `PortalGuard` → **BLOQUANT**
- ❌ Page avec `ModuleGate` ou `PermissionGate` (superadmin bypass) → **BLOQUANT**
- ❌ Page avec `ActiveCompanyGate` (superadmin n'a pas de company) → **BLOQUANT**
- ❌ Guards dans ordre incorrect → **BLOQUANT**

### 4.3 AccessMode Usage

**CRITICAL** : Vérifie que `AccessMode` est utilisé correctement.

**Checklist** :
- [ ] ✅ **Backend** : Routes utilisent `req.accessMode` (jamais de headers)
- [ ] ✅ **Frontend** : Pages utilisent `useAccessMode()` hook (jamais de reconstruction depuis URL/localStorage)
- [ ] ✅ **Repositories** : Utilisent `AccessMode` pour scoping (jamais de headers)
- [ ] ✅ **Services** : Acceptent `AccessMode` comme premier paramètre
- [ ] ✅ **Type guards** : Utilisés avant accès aux propriétés portal-specific

**⚠️ Spécificités Superadmin** :
- [ ] ✅ **SuperadminAccessMode** : Pages utilisent `SuperadminAccessMode` (pas de `CompanyAccessMode`, `TenantAccessMode`, `PartnerAccessMode`)
- [ ] ✅ **Pas de `companyId`/`tenantId`** : Pages n'utilisent PAS `companyId`/`tenantId` (superadmin n'a pas de company/tenant)
- [ ] ✅ **Scoping superadmin** : Repositories ne filtrent pas automatiquement (superadmin voit toutes les données)
- [ ] ✅ **Filtres explicites** : Superadmin peut filtrer via query parameters (`?tenantId=...`, `?companyId=...`)

**Violations détectées** :
- ❌ Code lit headers (`X-Tenant-Id`, `X-Company-Id`) → **BLOQUANT**
- ❌ Frontend construit contexte depuis URL → **BLOQUANT**
- ❌ Repository lit headers pour scoping → **BLOQUANT**
- ❌ Page utilise `companyId`/`tenantId` (superadmin n'a pas de company/tenant) → **BLOQUANT**
- ❌ Repository applique scoping automatique (superadmin doit voir toutes les données) → **BLOQUANT**

### 4.4 Permission & Module Checks

**CRITICAL** : Vérifie que les checks de permissions et modules sont bypass pour Superadmin.

**Checklist** :
- [ ] ✅ **Backend guards** : `requireModuleEnabled()` et `requirePermission()` bypass pour SuperadminAccessMode
- [ ] ✅ **Frontend gates** : `ModuleGate` et `PermissionGate` bypass pour SuperadminAccessMode
- [ ] ✅ **Menu filtering** : Pas de filtrage par module/permission (tous les items visibles)
- [ ] ✅ **Error messages** : Messages d'erreur utilisent i18n (pas de hardcode)

**Violations détectées** :
- ❌ Guards backend ne bypass pas pour SuperadminAccessMode → **BLOQUANT**
- ❌ Gates frontend ne bypass pas pour SuperadminAccessMode → **BLOQUANT**
- ❌ Menu filtré par module/permission (superadmin doit voir tous les items) → **BLOQUANT**

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
1. Comparer avec autres portals (Company, Tenant, Partner)
2. Comparer avec modules similaires (Tenants vs Companies vs Users)
3. Identifier patterns manquants (bulk operations, exports, etc.)
4. Proposer nouvelles features avec justification

**Exemples de gaps** :
- **Bulk operations** : Opérations en masse manquantes (bulk delete, bulk update)
- **Exports** : Exports manquants (PDF, CSV, Excel)
- **Advanced filters** : Filtres avancés manquants (date ranges, multi-select)
- **Search** : Recherche globale manquante ou incomplète
- **Notifications** : Notifications manquantes ou incomplètes
- **System health** : Dashboard système avec métriques (tenants, companies, users, etc.)
- **Impersonation** : Impersonation d'utilisateurs pour debugging (si applicable)

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
- **Filtering UI** : UI améliorée pour filtres explicites (tenant/company selection)

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
   | Cohérence | Backend | Route avec `requirePermission()` | 🔴 Bloquant | Route `/s/users` utilise `requirePermission()` alors que superadmin bypass | Retirer `requirePermission()` | Portal Architecture |
   | Access | AccessMode | Repository applique scoping automatique | 🔴 Bloquant | Repository filtre par `tenantId` alors que superadmin doit voir toutes les données | Retirer scoping automatique, utiliser filtres explicites | Portal Architecture |

3. **🟡 Violations Non-Critiques** (Liste à puces)
   - Mobile : Patterns mobile manquants (drawer, bottom sheets)
   - UX : Améliorations possibles (skeletons, empty states)

4. **📁 Matrice Cohérence** (Tableau)
   | Pattern | Superadmin Portal | Company Portal | Tenant Portal | Partner Portal | Status |
   |---------|-------------------|----------------|--------------|---------------|--------|
   | Guards order | ✅ (requirePortal uniquement) | ✅ (requirePortal → requireModuleEnabled → requirePermission → requireActiveCompany) | ✅ (requirePortal → requireModuleEnabled → requirePermission) | ✅ (requirePortal → requireModuleEnabled → requirePermission pour `/p/*`, + requireActiveCompany pour `/c/*` write) | ✅ Conforme |
   | AccessMode usage | ✅ (SuperadminAccessMode) | ✅ (CompanyAccessMode) | ✅ (TenantAccessMode) | ✅ (PartnerAccessMode pour `/p/*`, CompanyAccessMode pour `/c/*`) | ✅ Conforme |
   | Repository scoping | ✅ (pas de scoping automatique) | ✅ (tenantId + companyId) | ✅ (tenantId uniquement) | ✅ (accessibleCompanyIds pour `/p/*`, companyId pour `/c/*`) | ✅ Conforme |
   | requireModuleEnabled | ❌ (bypass) | ✅ | ✅ | ✅ | ✅ Conforme |
   | requirePermission | ❌ (bypass) | ✅ | ✅ | ✅ | ✅ Conforme |
   | requireActiveCompany | ❌ (pas de company) | ✅ (write only) | ❌ (pas de company) | ❌ (pas de company pour `/p/*`), ✅ (write only pour `/c/*`) | ✅ Conforme |

5. **🧭 Matrice Menu Logic** (Tableau)
   | Route | Navigation Registry | excludeFromMenu | Module Filter | Permission Filter | Entry Point | Status |
   |-------|---------------------|-----------------|---------------|------------------|-------------|--------|
   | /s/tenants | ✅ | ✅ | ❌ (bypass) | ❌ (bypass) | ✅ Sidebar | ✅ Conforme |
   | /s/companies | ✅ | ✅ | ❌ (bypass) | ❌ (bypass) | ✅ Sidebar | ✅ Conforme |
   | /s/invoices | ✅ | ✅ | ❌ (bypass) | ❌ (bypass) | ✅ Sidebar | ✅ Conforme |

6. **📋 Matrice Features Complétude** (Tableau)
   | Module | List | Detail | Create | Edit | Delete | API Client | Guards | i18n | Status |
   |--------|------|--------|--------|------|--------|------------|--------|------|--------|
   | tenants | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complet |
   | companies | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complet |
   | users | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ Complet |
   | invoices (read-only) | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ Complet (read-only) |

7. **🔐 Matrice Access Control** (Tableau)
   | Route | requirePortal | requireModuleEnabled | requirePermission | requireActiveCompany | Frontend Guards | Status |
   |-------|---------------|----------------------|-------------------|---------------------|----------------|--------|
   | GET /s/tenants | ✅ | ❌ (bypass) | ❌ (bypass) | ❌ | ✅ (PortalGuard uniquement) | ✅ Conforme |
   | POST /s/tenants | ✅ | ❌ (bypass) | ❌ (bypass) | ❌ | ✅ (PortalGuard uniquement) | ✅ Conforme |
   | GET /s/invoices | ✅ | ❌ (bypass) | ❌ (bypass) | ❌ | ✅ (PortalGuard uniquement) | ✅ Conforme |

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
     - System health dashboard (P1 - Haute priorité)
     - Bulk operations manquantes (P2 - Moyenne priorité)
   - **Améliorations UX** :
     - Filtering UI améliorée (P2 - Moyenne priorité)
     - Skeletons au lieu de spinners (P2 - Moyenne priorité)

10. **📌 Actions Prioritaires** (Checklist)
    - [ ] **Priorité 1** : Guards incorrects (sécurité)
    - [ ] **Priorité 1** : Repository scoping automatique (architecture)
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
- Guards incorrects (sécurité)
- Repository scoping automatique (architecture)
- Routes sans entry point (Feature Discoverability Rule)
- AccessMode incorrect (SuperadminAccessMode vs autres)
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
- Les **comparaisons inter-portals** (Superadmin vs Company vs Tenant vs Partner)
- Les **matrices de cohérence** (Cohérence, Menu, Features, Access, Mobile)
- Les **actions prioritaires** (fixes proposés avec code exact)
- Les **nouvelles features** (gaps identifiés, améliorations UX)

**Focus** : Uniquement **complétude, cohérence, access control, UX mobile, et nouvelles features** pour le portal Superadmin, pas **features métier optionnelles**.

**⚠️ CRITICAL** : Superadmin Portal (`/s`) est **UNIQUEMENT** pour l'administration système. Superadmin bypass tous les checks (sauf `requirePortal`).

**Verdict final** :
- 🟥 **CRITIQUE** : Guards incorrects, repository scoping automatique, routes sans entry point, AccessMode incorrect, pages non mobile-first
- 🟨 **ATTENTION** : Corrections nécessaires mais non-bloquantes
- 🟩 **OK** : Portal Superadmin complet et cohérent (rare)

