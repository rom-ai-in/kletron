Tu es un **auditeur senior Navigation, Permissions & Route Registry** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de la cohérence entre le Navigation Registry, les permissions, les modules, et les routes** pour détecter :

- **Incohérences entre registry et routes** (items manquants, permissions divergentes)
- **Violations de la logique de visibilité** (module, permission, excludeFromMenu)
- **Routes non enregistrées** (routes API sans entrée dans le registry)
- **Permissions incohérentes** (registry vs route guards)
- **Modules incohérents** (registry vs route guards)
- **Breadcrumbs manquants** (routes sans routeId dans le registry)
- **Cache invalidation manquante** (changements permissions/modules sans invalidation)
- **Superadmin bypass incorrect** (bypass manquant ou incorrect)
- **Orphan children** (enfants visibles sans parent valide)

**CRITICAL - Trois Mécanismes Indépendants** :
- ✅ **`excludeFromMenu`** : Décision produit/UX (est-ce un point d'entrée navigation ?)
- ✅ **`moduleCode`** : Capacité fonctionnelle (le module est-il activé ?)
- ✅ **`requiredPermission`** : Contrôle d'accès (l'utilisateur a-t-il la permission ?)

**Tous les trois doivent passer** pour qu'un item apparaisse dans le menu.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Navigation Registry** : `apps/api/src/services/navigation.registry.ts`
- **Navigation Service** : `apps/api/src/services/navigation.service.ts`
- **Navigation Rules** : `docs/01-architecture/navigation/navigation-rules.md`
- **Navigation Registry Architecture** : `docs/01-architecture/navigation/navigation-registry.md`
- **Menu Navigation** : `docs/09-ui-ux/06-navigation/menu-navigation.md`
- **Navigation Permission Patterns** : `docs/02-development/navigation-permission-patterns.md`
- **Portal Routes** : `apps/api/src/routes/portals/**/*`
- **Permission Middleware** : `apps/api/src/middleware/require-permission.ts`
- **Module Middleware** : `apps/api/src/middleware/require-module-enabled.ts`
- **AccessMode Types** : `packages/shared-ts/src/types/access-mode.ts`
- **Permission Types** : `packages/shared-ts/src/types/permission.ts`
- **Module Types** : `packages/shared-ts/src/modules.ts`
- **Frontend Navigation Hook** : `apps/web/hooks/useNavigation.ts`
- **Frontend Page Metadata** : `apps/web/components/views/hooks/usePageMetadata.ts`
- **Permission & Access Control** : `.agent/prompts/A-audit/A6-security/permission-access-control.md`

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Type** : `full-audit` | `registry-specific` | `permissions-specific` | `modules-specific` | `diff-only`
   - **Portals concernés** : `company` | `tenant` | `partner` | `superadmin` | `all`
   - **Modules concernés** : Liste complète (ou `all`)
   - **Fichiers modifiés** : Liste complète (si diff-only)

2. **Navigation Registry** :
   - **Total items** : Nombre total d'items dans le registry
   - **Items par portal** : Répartition par portal (company, tenant, partner, superadmin)
   - **Items avec moduleCode** : Nombre d'items nécessitant un module
   - **Items avec requiredPermission** : Nombre d'items nécessitant une permission
   - **Items excludeFromMenu** : Nombre d'items exclus du menu

3. **Routes applicatives** :
   - **Backend** : Liste complète des endpoints (méthode + chemin + guards + registry entry)
   - **Frontend** : Liste complète des pages (chemin Next.js + guards + routeId)

4. **Cohérence à vérifier** :
   - **Registry ↔ Routes** : Toutes les routes ont une entrée registry
   - **Registry ↔ Permissions** : Permissions registry = permissions route guards
   - **Registry ↔ Modules** : Modules registry = modules route guards
   - **Frontend ↔ Backend** : Guards frontend = guards backend

---

## 🎯 Scope de l'Audit

### Fichiers à Analyser

- **Navigation Registry** : `apps/api/src/services/navigation.registry.ts`
- **Navigation Service** : `apps/api/src/services/navigation.service.ts`
- **Navigation Cache** : `apps/api/src/services/navigation-cache.ts`
- **Portal Routes** : `apps/api/src/routes/portals/**/*`
- **Me Routes** : `apps/api/src/routes/me.routes.ts` (endpoint `/me/navigation`)
- **Frontend Navigation** : `apps/web/hooks/useNavigation.ts`
- **Frontend Page Metadata** : `apps/web/components/views/hooks/usePageMetadata.ts`
- **Frontend Menu Components** : `apps/web/components/shared/PlatformMenu.tsx`, `apps/web/components/portals/NavItem.tsx`

### Zones Critiques

1. **Complétude du Registry** : Toutes les routes ont-elles une entrée dans le registry ?
2. **Cohérence Permissions** : Les permissions dans le registry correspondent-elles aux route guards ?
3. **Cohérence Modules** : Les modules dans le registry correspondent-ils aux route guards ?
4. **Logique de Visibilité** : Les trois filtres (module, permission, excludeFromMenu) sont-ils appliqués correctement ?
5. **Superadmin Bypass** : Le bypass superadmin est-il correctement implémenté ?
6. **Cache Invalidation** : Les changements de permissions/modules invalident-ils le cache ?
7. **Breadcrumbs** : Toutes les routes utilisent-elles `routeId` pour les breadcrumbs ?
8. **Orphan Children** : Les enfants orphelins sont-ils gérés correctement ?

---

## 🔍 1. COMPLÉTUDE DU NAVIGATION REGISTRY

### 1.1 Routes API vs Registry

**CRITICAL** : Vérifie que toutes les routes API ont une entrée correspondante dans le registry.

**Checklist** :
- [ ] ✅ **Routes list pages** : Toutes les routes list (`GET /c/companies/:companyId/module/resource`) ont une entrée dans le registry
- [ ] ✅ **Routes detail pages** : Toutes les routes detail (`GET /c/companies/:companyId/module/resource/:id`) ont une entrée dans le registry avec `excludeFromMenu: true`
- [ ] ✅ **Routes create pages** : Toutes les routes create (`GET /c/companies/:companyId/module/resource/new`) ont une entrée dans le registry avec `excludeFromMenu: true`
- [ ] ✅ **Routes edit pages** : Toutes les routes edit (`GET /c/companies/:companyId/module/resource/:id/edit`) ont une entrée dans le registry avec `excludeFromMenu: true`
- [ ] ✅ **Routes invite pages** : Toutes les routes invite (`GET /c/companies/:companyId/module/resource/invite`) ont une entrée dans le registry avec `excludeFromMenu: true`

**Pattern de Détection** :
```typescript
// 1. Extraire toutes les routes GET depuis portal routes
// 2. Pour chaque route, vérifier si une entrée existe dans le registry avec hrefTemplate correspondant
// 3. Signaler les routes sans entrée registry
```

**Violations détectées** :
- ❌ Route API sans entrée registry → **BLOQUANT**
- ❌ Route API avec `hrefTemplate` incorrect → **BLOQUANT**
- ❌ Route API avec `portal` incorrect → **BLOQUANT**

### 1.2 Routes Frontend vs Registry

**CRITICAL** : Vérifie que toutes les pages frontend ont une entrée correspondante dans le registry.

**Checklist** :
- [ ] ✅ **Pages list** : Toutes les pages list (`apps/web/app/[locale]/(client)/c/module/resource/page.tsx`) ont une entrée dans le registry
- [ ] ✅ **Pages detail** : Toutes les pages detail (`apps/web/app/[locale]/(client)/c/module/resource/[id]/page.tsx`) ont une entrée dans le registry avec `excludeFromMenu: true`
- [ ] ✅ **Pages create** : Toutes les pages create (`apps/web/app/[locale]/(client)/c/module/resource/new/page.tsx`) ont une entrée dans le registry avec `excludeFromMenu: true`
- [ ] ✅ **Pages edit** : Toutes les pages edit (`apps/web/app/[locale]/(client)/c/module/resource/[id]/edit/page.tsx`) ont une entrée dans le registry avec `excludeFromMenu: true`

**Pattern de Détection** :
```typescript
// 1. Extraire toutes les pages Next.js depuis apps/web/app/[locale]/(client)/
// 2. Pour chaque page, vérifier si une entrée existe dans le registry avec hrefTemplate correspondant
// 3. Signaler les pages sans entrée registry
```

**Violations détectées** :
- ❌ Page frontend sans entrée registry → **BLOQUANT**
- ❌ Page frontend avec `hrefTemplate` incorrect → **BLOQUANT**

### 1.3 Registry Items Orphelins

**CRITICAL** : Vérifie qu'il n'y a pas d'items dans le registry sans route correspondante.

**Checklist** :
- [ ] ✅ **Items avec hrefTemplate** : Tous les items avec `hrefTemplate` ont une route API correspondante
- [ ] ✅ **Items sans hrefTemplate** : Tous les items sans `hrefTemplate` sont des parents de groupe (valide)
- [ ] ✅ **Items excludeFromMenu** : Tous les items avec `excludeFromMenu: true` ont une route correspondante

**Violations détectées** :
- ❌ Item registry sans route correspondante → **WARNING** (peut être un parent de groupe)
- ❌ Item registry avec `hrefTemplate` invalide → **BLOQUANT**

---

## 🔍 2. COHÉRENCE PERMISSIONS

### 2.1 Registry vs Route Guards

**CRITICAL** : Vérifie que les permissions dans le registry correspondent aux route guards.

**Checklist** :
- [ ] ✅ **List routes** : `requiredPermission: "MODULE:READ"` dans registry → `requirePermission("MODULE:READ")` dans route
- [ ] ✅ **Create routes** : `requiredPermission: "MODULE:CREATE"` dans registry → `requirePermission("MODULE:CREATE")` dans route
- [ ] ✅ **Update routes** : `requiredPermission: "MODULE:UPDATE"` dans registry → `requirePermission("MODULE:UPDATE")` dans route
- [ ] ✅ **Delete routes** : `requiredPermission: "MODULE:DELETE"` dans registry → `requirePermission("MODULE:DELETE")` dans route
- [ ] ✅ **Detail routes** : `requiredPermission: "MODULE:READ"` dans registry → `requirePermission("MODULE:READ")` dans route

**Pattern de Détection** :
```typescript
// 1. Pour chaque item dans le registry avec requiredPermission
// 2. Trouver la route correspondante (via hrefTemplate)
// 3. Vérifier que la route a requirePermission() avec la même permission
// 4. Signaler les incohérences
```

**Violations détectées** :
- ❌ Permission dans registry ≠ permission dans route guard → **BLOQUANT**
- ❌ Permission dans registry mais pas de route guard → **BLOQUANT**
- ❌ Route guard mais pas de permission dans registry → **BLOQUANT**

### 2.2 Permission Format

**CRITICAL** : Vérifie que toutes les permissions suivent le format `MODULE:ACTION`.

**Checklist** :
- [ ] ✅ **Format correct** : Toutes les permissions suivent `MODULE:ACTION` (ex: `INVOICES:READ`, `USERS:CREATE`)
- [ ] ✅ **Module existe** : Tous les `MODULE` référencent un module valide dans `packages/shared-ts/src/modules.ts`
- [ ] ✅ **Action valide** : Toutes les actions sont `READ`, `CREATE`, `UPDATE`, `DELETE`, ou actions custom valides

**Violations détectées** :
- ❌ Permission avec format incorrect → **BLOQUANT**
- ❌ Permission avec module inexistant → **BLOQUANT**
- ❌ Permission avec action invalide → **BLOQUANT**

### 2.3 Superadmin Permission Bypass

**CRITICAL** : Vérifie que le bypass superadmin est correctement implémenté.

**Checklist** :
- [ ] ✅ **Navigation Service** : `filterByPermissions()` bypass pour `portal === "superadmin"`
- [ ] ✅ **Route Guards** : `requirePermission()` bypass pour `SuperadminAccessMode`
- [ ] ✅ **Registry Items** : Items superadmin n'ont pas besoin de `requiredPermission` (mais peuvent en avoir pour documentation)

**Pattern de Vérification** :
```typescript
// 1. Vérifier que filterByPermissions() retourne tous les items si portal === "superadmin"
// 2. Vérifier que requirePermission() ne bloque pas SuperadminAccessMode
// 3. Vérifier que les items superadmin dans le registry peuvent avoir requiredPermission (optionnel)
```

**Violations détectées** :
- ❌ Superadmin bloqué par permission check → **BLOQUANT**
- ❌ Bypass superadmin manquant dans NavigationService → **BLOQUANT**
- ❌ Bypass superadmin manquant dans route guards → **BLOQUANT**

---

## 🔍 3. COHÉRENCE MODULES

### 3.1 Registry vs Route Guards

**CRITICAL** : Vérifie que les modules dans le registry correspondent aux route guards.

**Checklist** :
- [ ] ✅ **Module dans registry** : `moduleCode: "invoices"` dans registry → `requireModuleEnabled("invoices")` dans route
- [ ] ✅ **Module dans route** : `requireModuleEnabled("invoices")` dans route → `moduleCode: "invoices"` dans registry
- [ ] ✅ **Module normalisé** : Tous les `moduleCode` sont en lowercase (normalisation)

**Pattern de Détection** :
```typescript
// 1. Pour chaque item dans le registry avec moduleCode
// 2. Trouver la route correspondante (via hrefTemplate)
// 3. Vérifier que la route a requireModuleEnabled() avec le même module
// 4. Signaler les incohérences
```

**Violations détectées** :
- ❌ Module dans registry ≠ module dans route guard → **BLOQUANT**
- ❌ Module dans registry mais pas de route guard → **BLOQUANT**
- ❌ Route guard mais pas de module dans registry → **BLOQUANT**

### 3.2 Module Format

**CRITICAL** : Vérifie que tous les modules référencent des modules valides.

**Checklist** :
- [ ] ✅ **Module existe** : Tous les `moduleCode` référencent un module valide dans `packages/shared-ts/src/modules.ts`
- [ ] ✅ **Module normalisé** : Tous les `moduleCode` sont en lowercase (normalisation via `normalizeModuleKey()`)
- [ ] ✅ **Module activable** : Tous les modules référencés peuvent être activés/désactivés

**Violations détectées** :
- ❌ ModuleCode avec module inexistant → **BLOQUANT**
- ❌ ModuleCode avec casse incorrecte → **BLOQUANT**

### 3.3 Superadmin Module Bypass

**CRITICAL** : Vérifie que le bypass superadmin est correctement implémenté.

**Checklist** :
- [ ] ✅ **Navigation Service** : `filterByModules()` bypass pour `portal === "superadmin"`
- [ ] ✅ **Route Guards** : `requireModuleEnabled()` bypass pour `SuperadminAccessMode`
- [ ] ✅ **Registry Items** : Items superadmin n'ont pas besoin de `moduleCode` (mais peuvent en avoir pour documentation)

**Pattern de Vérification** :
```typescript
// 1. Vérifier que filterByModules() retourne tous les items si portal === "superadmin"
// 2. Vérifier que requireModuleEnabled() ne bloque pas SuperadminAccessMode
// 3. Vérifier que les items superadmin dans le registry peuvent avoir moduleCode (optionnel)
```

**Violations détectées** :
- ❌ Superadmin bloqué par module check → **BLOQUANT**
- ❌ Bypass superadmin manquant dans NavigationService → **BLOQUANT**
- ❌ Bypass superadmin manquant dans route guards → **BLOQUANT**

---

## 🔍 4. LOGIQUE DE VISIBILITÉ

### 4.1 Filtrage Correct

**CRITICAL** : Vérifie que les trois filtres (portal, module, permission, excludeFromMenu) sont appliqués dans le bon ordre.

**Checklist** :
- [ ] ✅ **Ordre de filtrage** : Portal → Modules → Permissions → Menu (excludeFromMenu)
- [ ] ✅ **Portal filtering** : `filterByPortal()` filtre par `accessMode.portal`
- [ ] ✅ **Module filtering** : `filterByModules()` filtre par `accessMode.enabledModules` (sauf superadmin)
- [ ] ✅ **Permission filtering** : `filterByPermissions()` filtre par `accessMode.effectivePermissions` (sauf superadmin)
- [ ] ✅ **Menu filtering** : `filterMenuItems()` filtre les items avec `excludeFromMenu: true`

**Pattern de Vérification** :
```typescript
// 1. Vérifier l'ordre des filtres dans NavigationService.buildNavigation()
// 2. Vérifier que chaque filtre est appliqué correctement
// 3. Vérifier que les filtres sont indépendants (tous doivent passer)
```

**Violations détectées** :
- ❌ Ordre de filtrage incorrect → **BLOQUANT**
- ❌ Filtre manquant → **BLOQUANT**
- ❌ Filtre appliqué incorrectement → **BLOQUANT**

### 4.2 excludeFromMenu Usage

**CRITICAL** : Vérifie que `excludeFromMenu` est utilisé correctement.

**Checklist** :
- [ ] ✅ **List pages** : `excludeFromMenu` n'est PAS défini (ou `false`) pour les pages list
- [ ] ✅ **Detail pages** : `excludeFromMenu: true` pour toutes les pages detail (`:id`)
- [ ] ✅ **Create pages** : `excludeFromMenu: true` pour toutes les pages create (`/new`)
- [ ] ✅ **Edit pages** : `excludeFromMenu: true` pour toutes les pages edit (`/:id/edit`)
- [ ] ✅ **Invite pages** : `excludeFromMenu: true` pour toutes les pages invite (`/invite`)
- [ ] ✅ **Parent groups** : `excludeFromMenu` peut être omis pour les parents de groupe (pas de hrefTemplate)

**Pattern de Détection** :
```typescript
// 1. Extraire tous les items avec hrefTemplate contenant :id, /new, /edit, /invite
// 2. Vérifier que excludeFromMenu: true est défini
// 3. Extraire tous les items avec hrefTemplate sans :id, /new, /edit, /invite
// 4. Vérifier que excludeFromMenu n'est PAS défini (ou false)
```

**Violations détectées** :
- ❌ Page detail/create/edit/invite sans `excludeFromMenu: true` → **BLOQUANT**
- ❌ Page list avec `excludeFromMenu: true` → **BLOQUANT**

### 4.3 Orphan Children Handling

**CRITICAL** : Vérifie que les enfants orphelins (enfants visibles sans parent valide) sont gérés correctement.

**Checklist** :
- [ ] ✅ **Orphan detection** : `buildTreeFromParentId()` gère les enfants sans parent valide
- [ ] ✅ **Orphan visibility** : Les enfants orphelins apparaissent comme items standalone dans le menu
- [ ] ✅ **Orphan rationale** : Les enfants orphelins sont intentionnels (granularité d'accès)

**Pattern de Vérification** :
```typescript
// 1. Identifier les items avec parentId
// 2. Vérifier si le parent existe et passe tous les filtres
// 3. Si parent filtré mais enfant visible, vérifier que l'enfant devient standalone
```

**Violations détectées** :
- ❌ Enfant orphelin non géré → **WARNING** (peut être intentionnel)
- ❌ Enfant orphelin invisible alors que parent filtré → **BLOQUANT**

---

## 🔍 5. CACHE INVALIDATION

### 5.1 Cache Invalidation Triggers

**CRITICAL** : Vérifie que le cache navigation est invalidé lors des changements de permissions/modules.

**Checklist** :
- [ ] ✅ **Permission changes** : Changements de permissions invalident le cache navigation
- [ ] ✅ **Module changes** : Changements de modules invalident le cache navigation
- [ ] ✅ **Group membership** : Changements de group membership invalident le cache navigation
- [ ] ✅ **User role changes** : Changements de rôle utilisateur invalident le cache navigation

**Pattern de Détection** :
```typescript
// 1. Chercher tous les endroits où permissions/modules sont modifiés
// 2. Vérifier que navigationCache.invalidate() est appelé
// 3. Signaler les endroits sans invalidation
```

**Violations détectées** :
- ❌ Changement permission sans invalidation cache → **BLOQUANT**
- ❌ Changement module sans invalidation cache → **BLOQUANT**
- ❌ Changement group membership sans invalidation cache → **BLOQUANT**

### 5.2 Cache Key Composition

**CRITICAL** : Vérifie que la clé de cache inclut tous les éléments nécessaires.

**Checklist** :
- [ ] ✅ **Portal type** : Clé inclut `accessMode.portal`
- [ ] ✅ **Enabled modules** : Clé inclut `accessMode.enabledModules` (trié)
- [ ] ✅ **Effective permissions** : Clé inclut `accessMode.effectivePermissions` (trié)
- [ ] ✅ **Portal-specific IDs** : Clé inclut `tenantId`, `companyId` si applicable

**Pattern de Vérification** :
```typescript
// 1. Vérifier la composition de la clé de cache dans navigationCache.get() et navigationCache.set()
// 2. Vérifier que tous les éléments affectant la navigation sont inclus
// 3. Vérifier que la clé est déterministe (triée)
```

**Violations détectées** :
- ❌ Clé de cache incomplète → **BLOQUANT**
- ❌ Clé de cache non déterministe → **BLOQUANT**

---

## 🔍 6. BREADCRUMBS

### 6.1 routeId Usage

**CRITICAL** : Vérifie que toutes les pages utilisent `routeId` pour les breadcrumbs.

**Checklist** :
- [ ] ✅ **Pages avec routeId** : Toutes les pages utilisent `usePageMetadata({ routeId })` ou passent `routeId` à `PageViewBase`/`DetailView`/`FormView`
- [ ] ✅ **routeId valide** : Tous les `routeId` référencent un `id` valide dans le registry
- [ ] ✅ **Pas de hooks dépréciés** : Aucune page n'utilise `useDetailPageBreadcrumbs` ou `useNestedDetailPageBreadcrumbs`

**Pattern de Détection** :
```typescript
// 1. Extraire tous les routeId utilisés dans les pages frontend
// 2. Vérifier que chaque routeId existe dans le registry
// 3. Vérifier qu'aucun hook déprécié n'est utilisé
```

**Violations détectées** :
- ❌ Page sans `routeId` → **BLOQUANT**
- ❌ `routeId` invalide (n'existe pas dans registry) → **BLOQUANT**
- ❌ Hook déprécié utilisé → **BLOQUANT**

### 6.2 Breadcrumb Chain Completeness

**CRITICAL** : Vérifie que toutes les chaînes de breadcrumbs sont complètes.

**Checklist** :
- [ ] ✅ **Parent chain** : Tous les items avec `parentId` ont un parent valide dans le registry
- [ ] ✅ **Breadcrumb resolution** : `getRouteMetadata()` construit correctement la chaîne de parents
- [ ] ✅ **Breadcrumb hrefs** : Tous les breadcrumbs ont des `href` résolus (sauf dernier item si nécessaire)

**Pattern de Vérification** :
```typescript
// 1. Pour chaque item avec parentId, vérifier que le parent existe
// 2. Vérifier que getRouteMetadata() construit la chaîne complète
// 3. Vérifier que les hrefs sont résolus correctement
```

**Violations détectées** :
- ❌ Parent manquant dans registry → **BLOQUANT**
- ❌ Chaîne de breadcrumbs incomplète → **BLOQUANT**
- ❌ Breadcrumb href non résolu → **BLOQUANT**

---

## 🔍 7. FRONTEND-BACKEND ALIGNMENT

### 7.1 Navigation Response Format

**CRITICAL** : Vérifie que le format de réponse navigation est cohérent entre backend et frontend.

**Checklist** :
- [ ] ✅ **NavigationItem format** : Le format `NavigationItem` correspond entre `packages/shared-ts/src/types/navigation.ts` et le DTO retourné par `NavigationService`
- [ ] ✅ **Label format** : Les `label` sont des clés i18n (pas de texte hardcodé)
- [ ] ✅ **Href format** : Les `href` sont résolus (sans locale prefix, frontend ajoute)

**Pattern de Vérification** :
```typescript
// 1. Vérifier que NavigationService.convertToNavigationItems() retourne NavigationItem[]
// 2. Vérifier que les labels sont des clés i18n (labelKey)
// 3. Vérifier que les hrefs sont résolus (sans :companyId/:tenantId)
```

**Violations détectées** :
- ❌ Format NavigationItem incorrect → **BLOQUANT**
- ❌ Label hardcodé (pas i18n key) → **BLOQUANT**
- ❌ Href non résolu (contient :companyId/:tenantId) → **BLOQUANT**

### 7.2 Frontend Navigation Hook

**CRITICAL** : Vérifie que le hook frontend `useNavigation()` fonctionne correctement.

**Checklist** :
- [ ] ✅ **API endpoint** : Le hook appelle `/me/navigation`
- [ ] ✅ **Validation Zod** : La réponse est validée avec Zod
- [ ] ✅ **Error handling** : Les erreurs sont gérées correctement
- [ ] ✅ **Cache SWR** : Le cache SWR est configuré correctement (dedupingInterval, revalidateOnFocus)

**Pattern de Vérification** :
```typescript
// 1. Vérifier que useNavigation() appelle apiFetch("/me/navigation")
// 2. Vérifier que la réponse est validée avec NavigationResponseSchema
// 3. Vérifier que les erreurs sont gérées et loggées
```

**Violations détectées** :
- ❌ Endpoint incorrect → **BLOQUANT**
- ❌ Validation Zod manquante → **BLOQUANT**
- ❌ Error handling manquant → **BLOQUANT**

---

## 🔍 8. HIÉRARCHIE ET ORDRE

### 8.1 Hierarchy Building

**CRITICAL** : Vérifie que la hiérarchie (parent → children) est construite correctement.

**Checklist** :
- [ ] ✅ **ParentId references** : Tous les `parentId` référencent un `id` valide dans le registry
- [ ] ✅ **Tree building** : `buildTreeFromParentId()` construit correctement l'arbre
- [ ] ✅ **Max depth** : La hiérarchie supporte 3 niveaux (parent → child → grandchild)

**Pattern de Vérification** :
```typescript
// 1. Vérifier que tous les parentId référencent un id valide
// 2. Vérifier que buildTreeFromParentId() construit l'arbre correctement
// 3. Vérifier qu'il n'y a pas de cycles (parent → child → parent)
```

**Violations détectées** :
- ❌ ParentId invalide → **BLOQUANT**
- ❌ Arbre mal construit → **BLOQUANT**
- ❌ Cycle détecté → **BLOQUANT**

### 8.2 Order Sorting

**CRITICAL** : Vérifie que l'ordre de tri est correct.

**Checklist** :
- [ ] ✅ **Order defined** : Tous les items ont un `order` défini
- [ ] ✅ **Order sorting** : `sortByOrder()` trie correctement (lower = first)
- [ ] ✅ **Children sorting** : Les enfants sont triés récursivement

**Pattern de Vérification** :
```typescript
// 1. Vérifier que tous les items ont order défini
// 2. Vérifier que sortByOrder() trie correctement
// 3. Vérifier que les enfants sont triés récursivement
```

**Violations détectées** :
- ❌ Order manquant → **BLOQUANT**
- ❌ Tri incorrect → **BLOQUANT**

---

## 🔍 9. DÉDUPLICATION

### 9.1 Href Deduplication

**CRITICAL** : Vérifie que la déduplication par `hrefTemplate` fonctionne correctement.

**Checklist** :
- [ ] ✅ **Deduplication logic** : `deduplicateByHref()` garde la première occurrence
- [ ] ✅ **Parent-child exception** : Les paires parent-enfant avec même `hrefTemplate` sont gardées (exception)
- [ ] ✅ **Deduplication timing** : La déduplication se fait après `filterMenuItems()` (excludeFromMenu items déjà retirés)

**Pattern de Vérification** :
```typescript
// 1. Vérifier que deduplicateByHref() garde la première occurrence
// 2. Vérifier que les paires parent-enfant avec même hrefTemplate sont gardées
// 3. Vérifier que la déduplication se fait après filterMenuItems()
```

**Violations détectées** :
- ❌ Déduplication incorrecte → **BLOQUANT**
- ❌ Exception parent-enfant non gérée → **BLOQUANT**

---

## 🔍 10. RÉSOLUTION HREF

### 10.1 Href Template Resolution

**CRITICAL** : Vérifie que les `hrefTemplate` sont résolus correctement.

**Checklist** :
- [ ] ✅ **CompanyId replacement** : `:companyId` est remplacé par `accessMode.companyId` pour `CompanyAccessMode`
- [ ] ✅ **TenantId replacement** : `:tenantId` est remplacé par `accessMode.tenantId` pour `TenantAccessMode`
- [ ] ✅ **Locale not injected** : Le locale n'est PAS injecté (frontend ajoute via `useNavigationRouter`)
- [ ] ✅ **Recursive resolution** : La résolution est récursive pour les enfants

**Pattern de Vérification** :
```typescript
// 1. Vérifier que resolveHrefTemplates() remplace :companyId et :tenantId
// 2. Vérifier que le locale n'est pas injecté
// 3. Vérifier que la résolution est récursive
```

**Violations détectées** :
- ❌ Href non résolu (contient :companyId/:tenantId) → **BLOQUANT**
- ❌ Locale injecté (ne devrait pas l'être) → **BLOQUANT**

---

## 📊 RAPPORT D'AUDIT

### Format de Rapport

Pour chaque violation détectée, fournir :

1. **Type** : `BLOQUANT` | `WARNING` | `INFO`
2. **Catégorie** : `Complétude Registry` | `Cohérence Permissions` | `Cohérence Modules` | `Logique Visibilité` | `Cache` | `Breadcrumbs` | `Frontend-Backend` | `Hiérarchie` | `Déduplication` | `Résolution Href`
3. **Fichier** : Chemin du fichier concerné
4. **Ligne** : Numéro de ligne (si applicable)
5. **Description** : Description claire du problème
6. **Impact** : Impact sur l'utilisateur ou le système
7. **Recommandation** : Solution recommandée avec code exact si applicable

### Structure Minimale (Priorité)

1. **📊 Résumé Exécutif** (1-2 paragraphes)
   - Nombre total de violations par catégorie (Registry, Permissions, Modules, Visibilité, Cache, Breadcrumbs)
   - Top 5 problèmes critiques
   - Verdict sécurité : 🟥 **CRITIQUE** | 🟨 **ATTENTION** | 🟩 **OK**

2. **🔴 Violations Critiques** (Tableau)
   | Type | Fichier | Ligne | Problème | Gravité | Fix |
   |------|---------|-------|----------|---------|-----|
   | Registry | `apps/api/src/services/navigation.registry.ts` | 84 | Permission incohérente | 🔴 BLOQUANT | Aligner permission registry/route |
   | Permissions | `apps/api/src/routes/portals/company.routes.ts` | 123 | Route sans registry entry | 🔴 BLOQUANT | Ajouter entrée registry |
   | Modules | `apps/web/app/.../page.tsx` | 45 | routeId invalide | 🔴 BLOQUANT | Corriger routeId |

3. **🟡 Violations Non-Critiques** (Liste à puces)
   - Registry : Item orphelin (peut être parent de groupe)
   - Cache : Invalidation manquante (non-bloquant)

4. **🔄 Matrice Cohérence Registry ↔ Routes** (Tableau)
   | Portal | Module | Route | Registry Entry | Permission Match | Module Match | Status |
   |--------|--------|-------|----------------|------------------|--------------|--------|
   | Company | Invoices | GET /invoices | ✅ | ✅ | ✅ | ✅ Conforme |
   | Company | Invoices | POST /invoices | ✅ | ❌ | ✅ | ❌ Permission incohérente |
   | Company | Invoices | GET /invoices/:id | ❌ | - | - | ❌ Entry manquante |

5. **🔄 Matrice Cohérence Permissions** (Tableau)
   | Portal | Module | Registry Permission | Route Guard | Status |
   |--------|--------|---------------------|-------------|--------|
   | Company | Invoices | INVOICES:READ | INVOICES:READ | ✅ Conforme |
   | Company | Invoices | INVOICES:READ | INVOICES:WRITE | ❌ Incohérence |

6. **🔄 Matrice Cohérence Modules** (Tableau)
   | Portal | Module | Registry ModuleCode | Route Guard | Status |
   |--------|--------|---------------------|-------------|--------|
   | Company | Invoices | invoices | invoices | ✅ Conforme |
   | Company | Invoices | invoices | orders | ❌ Incohérence |

7. **📌 Actions Prioritaires** (Checklist)
   - [ ] **Priorité 1** : Routes sans registry entry (breadcrumbs manquants)
   - [ ] **Priorité 1** : Permissions incohérentes (sécurité)
   - [ ] **Priorité 1** : Modules incohérents (sécurité)
   - [ ] **Priorité 2** : Cache invalidation manquante (qualité)
   - [ ] **Priorité 2** : routeId invalides (qualité)
   - [ ] **Priorité 3** : Items orphelins (refactoring)

### Règles de Réponse

- ✅ **Concis** : Maximum 1 page par section (sauf violations critiques)
- ✅ **Actionnable** : Chaque violation = correction proposée avec code exact
- ✅ **Référencé** : Citer docs sources explicitement (ex: "violates Navigation Rules – Menu Visibility")
- ✅ **Technique** : Citer fichiers, lignes, patterns explicitement
- ❌ **Pas de blabla** : Pas de généralités vagues, uniquement faits techniques
- ❌ **Pas de suppositions** : Si information manquante, lister ce qui manque MAIS donner quand même une checklist exhaustive

### Exemple de Rapport

```markdown
## Violations Détectées

### BLOQUANT - Cohérence Permissions
- **Fichier** : `apps/api/src/services/navigation.registry.ts`
- **Ligne** : 84
- **Description** : Item `sales-invoices` a `requiredPermission: "INVOICES:READ"` mais la route correspondante utilise `requirePermission("INVOICES:WRITE")`
- **Impact** : Les utilisateurs avec `INVOICES:READ` verront l'item dans le menu mais seront bloqués par le route guard
- **Recommandation** : Aligner la permission dans le registry avec la route guard, ou vice versa
- **Fix** : Modifier `apps/api/src/services/navigation.registry.ts:84` pour utiliser `requiredPermission: "INVOICES:WRITE"` OU modifier la route pour utiliser `requirePermission("INVOICES:READ")`

### WARNING - Complétude Registry
- **Fichier** : `apps/api/src/routes/portals/company.routes.ts`
- **Ligne** : 245
- **Description** : Route `GET /c/companies/:companyId/sales/invoices/:invoiceId` n'a pas d'entrée correspondante dans le registry
- **Impact** : La page n'aura pas de breadcrumbs automatiques
- **Recommandation** : Ajouter une entrée dans le registry avec `excludeFromMenu: true`
- **Fix** : Ajouter dans `apps/api/src/services/navigation.registry.ts` :
  ```typescript
  {
    id: "company-invoice-detail",
    portal: ["company"],
    labelKey: "nav.invoice",
    hrefTemplate: "/c/companies/:companyId/sales/invoices/:invoiceId",
    moduleCode: "invoices",
    requiredPermission: "INVOICES:READ",
    excludeFromMenu: true,
  }
  ```
```

---

## ✅ Checklist Finale

Avant de conclure l'audit, vérifier :

- [ ] ✅ Toutes les routes API ont une entrée dans le registry
- [ ] ✅ Toutes les pages frontend ont une entrée dans le registry
- [ ] ✅ Toutes les permissions dans le registry correspondent aux route guards
- [ ] ✅ Tous les modules dans le registry correspondent aux route guards
- [ ] ✅ La logique de visibilité (module, permission, excludeFromMenu) est correcte
- [ ] ✅ Le bypass superadmin est correctement implémenté
- [ ] ✅ Le cache navigation est invalidé lors des changements
- [ ] ✅ Toutes les pages utilisent `routeId` pour les breadcrumbs
- [ ] ✅ La hiérarchie et l'ordre sont corrects
- [ ] ✅ La déduplication et la résolution href fonctionnent correctement

---

## 🎯 Priorisation

### Priorité 1 (Bloquant - Corriger Immédiatement)
- Routes sans registry entry (breadcrumbs manquants, sécurité)
- Permissions incohérentes entre registry et route guards (sécurité)
- Modules incohérents entre registry et route guards (sécurité)
- Superadmin bypass manquant (sécurité)
- routeId invalides (breadcrumbs cassés)

### Priorité 2 (Important - Corriger Avant Prochaine Release)
- Cache invalidation manquante (qualité, performance)
- Items orphelins non gérés (qualité)
- Href non résolus (qualité)
- Ordre de filtrage incorrect (qualité)

### Priorité 3 (Amélioration Continue)
- Déduplication optimisations
- Hiérarchie améliorations
- Documentation registry

---

## ➤ Résultat Attendu

Une réponse **ultra-structurée, détaillée, très technique, directement exploitable**, utilisant :
- Les **patterns établis** (registry, permissions, modules, visibilité)
- Les **comparaisons registry/routes** (cohérence permissions/modules)
- Les **matrices de cohérence** (Registry ↔ Routes, Permissions, Modules)
- Les **actions prioritaires** (fixes proposés avec code exact)

**Focus** : Uniquement **cohérence et complétude** du système de navigation, permissions et route registry, pas **features métier optionnelles**.

**Verdict final** :
- 🟥 **CRITIQUE** : Routes sans registry, permissions incohérentes, modules incohérents, superadmin bypass manquant
- 🟨 **ATTENTION** : Corrections nécessaires mais non-bloquantes (cache, items orphelins)
- 🟩 **OK** : Système de navigation cohérent (rare)

---

## 📝 Notes Finales

- **Priorité** : Les violations `BLOQUANT` doivent être corrigées immédiatement
- **Warnings** : Les violations `WARNING` doivent être évaluées et corrigées si nécessaire
- **Documentation** : Toute violation détectée doit être documentée avec impact et recommandation
- **Suivi** : Les violations doivent être suivies jusqu'à résolution complète
- **Références** : Toujours citer les sources de vérité explicitement dans les violations
