Tu es un **auditeur senior UX/UI & Architecture Frontend** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de l'expérience utilisateur et de la cohérence** concernant :

- **Page access** (permissions, guards, AccessMode, module activation)
- **Menu structure & logic** (navigation registry, sidebar, breadcrumbs, discoverability)
- **Page layouts** (cohérence, patterns, responsive, accessibility)
- **Page scenarios** (user journeys, flows, transitions)
- **User flows** (navigation patterns, workflows, CTAs)

L'audit doit identifier les incohérences, manquements, risques UX et dettes architecturales, puis proposer des recommandations concrètes et priorisées.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Portal Architecture** : `docs/01-architecture/portal/portal-architecture.md`
- **Navigation Rules** : `docs/01-architecture/navigation/navigation-rules.md`
- **Navigation Registry** : `apps/api/src/services/navigation.registry.ts`
- **Feature Discoverability Rule** : `docs/09-ui-ux/04-product/feature-discoverability-rule.md`
- **Portal Layout Rule** : `docs/01-architecture/portal/portal-layout-rule.md` (si présent)
- **Menu Navigation** : `docs/09-ui-ux/06-navigation/menu-navigation.md`
- **Portal Experience Guide** : `docs/09-ui-ux/05-portals/portal-experience-guide.md` (si présent)
- **Frontend Rules** : `docs/02-development/rules/frontend-rules-and-checklist.md`
- **AccessMode Types** : `packages/shared-ts/src/types/access-mode.ts`

---

## 🎯 Scope de l'Audit

### Fichiers à Analyser

- **Frontend Pages** : `apps/web/app/[locale]/(client)/**/*`
- **Navigation Registry** : `apps/api/src/services/navigation.registry.ts`
- **Navigation Service** : `apps/api/src/services/navigation.service.ts`
- **Route Guards** : `apps/web/lib/auth/guards/**/*`
- **Layout Components** : `apps/web/components/portals/**/*`
- **Navigation Hooks** : `apps/web/hooks/useNavigation.ts`, `useAccessMode.ts`
- **API Routes** : `apps/api/src/routes/portals/**/*` (pour vérifier guards backend)

### Zones Critiques

1. **Page Access Control** : Guards frontend, permissions, module activation, AccessMode
2. **Menu Structure** : Navigation registry, sidebar, breadcrumbs, discoverability
3. **Page Layouts** : Cohérence, patterns, responsive, accessibility
4. **Page Scenarios** : User journeys, flows, transitions, error states
5. **User Flows** : Navigation patterns, workflows, CTAs, deep-links

---

## 🔍 1. AUDIT PAGE ACCESS CONTROL

### 1.1 Guards Frontend vs Backend

**CRITICAL** : Vérifie que tous les guards frontend correspondent aux guards backend.

**Guards à vérifier** :
- ✅ **`ProtectedRoute`** : Vérifie session, portal, permissions
- ✅ **`ModuleGate`** : Vérifie module activation
- ✅ **`PermissionGate`** : Vérifie permissions
- ✅ **`requirePortal()`** : Vérifie portal (backend)
- ✅ **`requireModuleEnabled()`** : Vérifie module (backend)
- ✅ **`requirePermission()`** : Vérifie permission (backend)

**Patterns à détecter** :
- ❌ Page frontend sans guard alors que route backend a guard
- ❌ Guard frontend manquant pour route protégée
- ❌ Incohérence entre guards frontend et backend
- ❌ Guard frontend qui bypass permissions (sauf superadmin)

**Méthode** :
1. Scanner toutes les pages frontend (`apps/web/app/[locale]/(client)/**/*`)
2. Pour chaque page, vérifier la présence de guards appropriés
3. Comparer avec routes backend correspondantes
4. Vérifier que les guards utilisent `AccessMode` correctement

**Exemple de détection** :
```
Page: /c/companies/:companyId/sales/invoices
✅ Backend: requirePortal('company'), requireModuleEnabled('invoices'), requirePermission('INVOICES:READ')
✅ Frontend: ProtectedRoute + ModuleGate('invoices') + PermissionGate('INVOICES:READ')
→ ✅ Conforme

Page: /c/companies/:companyId/sales/invoices/:invoiceId
✅ Backend: requirePortal('company'), requireModuleEnabled('invoices'), requirePermission('INVOICES:READ')
❌ Frontend: ProtectedRoute seulement (ModuleGate et PermissionGate manquants)
→ ❌ Incohérence: Guards frontend incomplets
```

### 1.2 AccessMode Usage

**CRITICAL** : Vérifie que toutes les pages utilisent `AccessMode` correctement.

**Patterns à vérifier** :
- ✅ Pages utilisent `useAccessMode()` hook
- ✅ Pages n'utilisent PAS `useSearchParams()` pour `tenantId`/`companyId`
- ✅ Pages n'utilisent PAS `localStorage` pour contexte
- ✅ Pages utilisent `AccessMode` pour scoping (pas de reconstruction depuis URL)

**Vérifications** :
- ❌ Pages qui lisent `tenantId`/`companyId` depuis URL params
- ❌ Pages qui stockent contexte dans `localStorage`/`sessionStorage`
- ❌ Pages qui reconstruisent contexte depuis headers (impossible frontend)
- ❌ Pages qui utilisent `AccessMode` incorrectement (mauvais type, propriétés manquantes)

**Checklist** :
- [ ] Toutes les pages utilisent `useAccessMode()` hook
- [ ] Aucune page ne lit `tenantId`/`companyId` depuis URL params
- [ ] Aucune page ne stocke contexte dans browser storage
- [ ] Toutes les pages utilisent `AccessMode` pour scoping
- [ ] Pages utilisent le bon type `AccessMode` (CompanyAccessMode, TenantAccessMode, etc.)

### 1.3 Module Activation Checks

**CRITICAL** : Vérifie que toutes les pages vérifient l'activation du module.

**Patterns à vérifier** :
- ✅ Pages avec `moduleCode` dans navigation registry utilisent `ModuleGate`
- ✅ Pages vérifient module activation avant d'afficher le contenu
- ✅ Pages affichent message d'erreur si module non activé
- ✅ Pages utilisent i18n pour messages d'erreur

**Vérifications** :
- ❌ Pages sans `ModuleGate` alors que module requis
- ❌ Pages qui affichent contenu même si module non activé
- ❌ Pages avec messages d'erreur hardcodés (pas i18n)
- ❌ Pages qui ne vérifient pas module activation

**Checklist** :
- [ ] Toutes les pages avec `moduleCode` utilisent `ModuleGate`
- [ ] Toutes les pages vérifient module activation
- [ ] Messages d'erreur utilisent i18n
- [ ] Pages affichent état approprié si module non activé

### 1.4 Permission Checks

**CRITICAL** : Vérifie que toutes les pages vérifient les permissions.

**Patterns à vérifier** :
- ✅ Pages avec `requiredPermission` dans navigation registry utilisent `PermissionGate`
- ✅ Pages vérifient permissions avant d'afficher le contenu
- ✅ Pages affichent message d'erreur si permission manquante
- ✅ Pages utilisent i18n pour messages d'erreur

**Vérifications** :
- ❌ Pages sans `PermissionGate` alors que permission requise
- ❌ Pages qui affichent contenu même si permission manquante
- ❌ Pages avec messages d'erreur hardcodés (pas i18n)
- ❌ Pages qui ne vérifient pas permissions

**Checklist** :
- [ ] Toutes les pages avec `requiredPermission` utilisent `PermissionGate`
- [ ] Toutes les pages vérifient permissions
- [ ] Messages d'erreur utilisent i18n
- [ ] Pages affichent état approprié si permission manquante

---

## 🧭 2. AUDIT MENU STRUCTURE & LOGIC

### 2.1 Navigation Registry Completeness

**CRITICAL** : Vérifie que toutes les routes applicatives sont dans le navigation registry.

**Patterns à vérifier** :
- ✅ Toutes les routes structurelles (list pages, dashboards, settings) sont dans registry
- ✅ Toutes les routes dérivées (detail pages, forms) sont dans registry avec `excludeFromMenu: true`
- ✅ Toutes les routes ont `labelKey` (i18n)
- ✅ Toutes les routes ont `hrefTemplate` correct
- ✅ Toutes les routes ont `portal` correct

**Méthode** :
1. Scanner toutes les pages frontend (`apps/web/app/[locale]/(client)/**/*`)
2. Pour chaque page, vérifier la présence dans navigation registry
3. Vérifier que les propriétés sont correctes (portal, moduleCode, requiredPermission, excludeFromMenu)

**Exemple de détection** :
```
Page: /c/companies/:companyId/sales/invoices
✅ Navigation registry: Présent
✅ excludeFromMenu: undefined (dans menu)
✅ moduleCode: "invoices"
✅ requiredPermission: "INVOICES:READ"
→ ✅ Conforme

Page: /c/companies/:companyId/sales/invoices/:invoiceId
✅ Navigation registry: Présent
✅ excludeFromMenu: true (pas dans menu)
✅ moduleCode: "invoices"
✅ requiredPermission: "INVOICES:READ"
→ ✅ Conforme

Page: /c/companies/:companyId/sales/config
❌ Navigation registry: MANQUANT
→ ❌ Violation: Route sans entry point (Feature Discoverability Rule)
```

### 2.2 Menu Visibility Logic

**CRITICAL** : Vérifie que la logique de visibilité du menu est cohérente.

**Patterns à vérifier** :
- ✅ List pages : `excludeFromMenu !== true` (dans menu par défaut)
- ✅ Detail pages : `excludeFromMenu: true` (pas dans menu)
- ✅ Forms : `excludeFromMenu: true` (pas dans menu)
- ✅ Dashboards : `excludeFromMenu !== true` (dans menu par défaut)
- ✅ Settings : `excludeFromMenu !== true` (dans menu par défaut)

**Vérifications** :
- ❌ List pages avec `excludeFromMenu: true` (incohérence)
- ❌ Detail pages sans `excludeFromMenu: true` (incohérence)
- ❌ Forms sans `excludeFromMenu: true` (incohérence)
- ❌ Dashboards avec `excludeFromMenu: true` (incohérence)

**Checklist** :
- [ ] List pages : `excludeFromMenu !== true`
- [ ] Detail pages : `excludeFromMenu: true`
- [ ] Forms : `excludeFromMenu: true`
- [ ] Dashboards : `excludeFromMenu !== true`
- [ ] Settings : `excludeFromMenu !== true`

### 2.3 Module & Permission Filtering

**CRITICAL** : Vérifie que le filtrage par module et permission fonctionne correctement.

**Patterns à vérifier** :
- ✅ Items avec `moduleCode` sont filtrés si module non activé
- ✅ Items avec `requiredPermission` sont filtrés si permission manquante
- ✅ Superadmin bypass tous les filtres (module + permission)
- ✅ Items sans `moduleCode`/`requiredPermission` sont toujours visibles

**Vérifications** :
- ❌ Items visibles même si module non activé (sauf superadmin)
- ❌ Items visibles même si permission manquante (sauf superadmin)
- ❌ Superadmin filtré par module/permission (bug)
- ❌ Items filtrés incorrectement

**Checklist** :
- [ ] Items avec `moduleCode` filtrés si module non activé (sauf superadmin)
- [ ] Items avec `requiredPermission` filtrés si permission manquante (sauf superadmin)
- [ ] Superadmin bypass tous les filtres
- [ ] Items sans `moduleCode`/`requiredPermission` toujours visibles

### 2.4 Breadcrumb Generation

**CRITICAL** : Vérifie que toutes les routes ont des breadcrumbs corrects.

**Patterns à vérifier** :
- ✅ Toutes les routes ont `labelKey` pour breadcrumbs
- ✅ Breadcrumbs utilisent `getRouteMetadata()` depuis navigation registry
- ✅ Breadcrumbs affichent hiérarchie correcte (parent → child)
- ✅ Breadcrumbs utilisent i18n

**Vérifications** :
- ❌ Routes sans `labelKey` (breadcrumbs vides)
- ❌ Breadcrumbs qui n'utilisent pas navigation registry
- ❌ Breadcrumbs avec hiérarchie incorrecte
- ❌ Breadcrumbs avec texte hardcodé (pas i18n)

**Checklist** :
- [ ] Toutes les routes ont `labelKey`
- [ ] Breadcrumbs utilisent `getRouteMetadata()`
- [ ] Breadcrumbs affichent hiérarchie correcte
- [ ] Breadcrumbs utilisent i18n

### 2.5 Feature Discoverability

**CRITICAL** : Vérifie que toutes les routes applicatives ont un point d'entrée (Feature Discoverability Rule).

**Patterns à vérifier** :
- ✅ Routes structurelles : Entry point direct (sidebar, dashboard, settings)
- ✅ Routes dérivées : Entry point indirect (CTA contextuel, breadcrumb parent, deep-link documenté ET exposé via UI)
- ✅ Toutes les routes ont au moins un entry point
- ✅ Entry points sont visibles pour le rôle cible

**Vérifications** :
- ❌ Routes sans entry point (violation Feature Discoverability Rule)
- ❌ Routes accessibles uniquement via URL directe
- ❌ Entry points non visibles pour le rôle cible
- ❌ Deep-links non documentés ou non exposés via UI

**Checklist** :
- [ ] Toutes les routes structurelles ont entry point direct
- [ ] Toutes les routes dérivées ont entry point indirect
- [ ] Toutes les routes ont au moins un entry point
- [ ] Entry points sont visibles pour le rôle cible

---

## 🎨 3. AUDIT PAGE LAYOUTS

### 3.1 Layout Consistency

**CRITICAL** : Vérifie que tous les layouts sont cohérents entre portails et modules.

**Patterns à vérifier** :
- ✅ Layouts suivent structure standard (header, sidebar, content, footer)
- ✅ Layouts sont cohérents entre portails similaires
- ✅ Layouts sont cohérents entre modules similaires
- ✅ Layouts utilisent composants partagés (PortalSidebar, PortalHeader, etc.)

**Vérifications** :
- ❌ Layouts avec structure différente entre portails similaires
- ❌ Layouts avec structure différente entre modules similaires
- ❌ Layouts qui recréent composants au lieu d'utiliser composants partagés
- ❌ Layouts avec patterns non-standard

**Checklist** :
- [ ] Layouts suivent structure standard
- [ ] Layouts cohérents entre portails similaires
- [ ] Layouts cohérents entre modules similaires
- [ ] Layouts utilisent composants partagés

### 3.2 Responsive Design

**CRITICAL** : Vérifie que tous les layouts sont responsive (mobile-first, 375px+).

**Patterns à vérifier** :
- ✅ Layouts sont mobile-first (375px+)
- ✅ Layouts évitent overflow horizontal
- ✅ Layouts utilisent breakpoints appropriés
- ✅ Layouts testés à 375×667, 390×844, 768×1024, 1280px+

**Vérifications** :
- ❌ Layouts non responsive (pas mobile-first)
- ❌ Layouts avec overflow horizontal
- ❌ Layouts avec breakpoints incorrects
- ❌ Layouts non testés sur différentes tailles d'écran

**Checklist** :
- [ ] Layouts sont mobile-first (375px+)
- [ ] Layouts évitent overflow horizontal
- [ ] Layouts utilisent breakpoints appropriés
- [ ] Layouts testés sur différentes tailles d'écran

### 3.3 Accessibility

**CRITICAL** : Vérifie que tous les layouts sont accessibles (WCAG AA+).

**Patterns à vérifier** :
- ✅ Layouts ont navigation clavier fonctionnelle
- ✅ Layouts ont indicateurs de focus visibles
- ✅ Layouts ont aria-labels appropriés
- ✅ Layouts ont contraste WCAG AA+

**Vérifications** :
- ❌ Layouts sans navigation clavier
- ❌ Layouts sans indicateurs de focus
- ❌ Layouts sans aria-labels
- ❌ Layouts avec contraste insuffisant

**Checklist** :
- [ ] Layouts ont navigation clavier fonctionnelle
- [ ] Layouts ont indicateurs de focus visibles
- [ ] Layouts ont aria-labels appropriés
- [ ] Layouts ont contraste WCAG AA+

---

## 📋 4. AUDIT PAGE SCENARIOS

### 4.1 User Journeys

**CRITICAL** : Vérifie que tous les user journeys sont complets et cohérents.

**Patterns à vérifier** :
- ✅ User journeys sont documentés (ou déductibles depuis code)
- ✅ User journeys sont complets (entry point → action → résultat)
- ✅ User journeys sont cohérents entre portails similaires
- ✅ User journeys gèrent les erreurs et états vides

**Vérifications** :
- ❌ User journeys incomplets (entry point manquant, action manquante, résultat manquant)
- ❌ User journeys incohérents entre portails similaires
- ❌ User journeys sans gestion d'erreurs
- ❌ User journeys sans états vides

**Checklist** :
- [ ] User journeys sont complets
- [ ] User journeys sont cohérents entre portails similaires
- [ ] User journeys gèrent les erreurs
- [ ] User journeys gèrent les états vides

### 4.2 Page Transitions

**CRITICAL** : Vérifie que toutes les transitions de page sont fluides.

**Patterns à vérifier** :
- ✅ Transitions utilisent loading states appropriés (skeletons, spinners)
- ✅ Transitions évitent layout shifts
- ✅ Transitions utilisent Suspense boundaries
- ✅ Transitions affichent feedback immédiat

**Vérifications** :
- ❌ Transitions sans loading states
- ❌ Transitions avec layout shifts
- ❌ Transitions sans Suspense boundaries
- ❌ Transitions sans feedback

**Checklist** :
- [ ] Transitions utilisent loading states appropriés
- [ ] Transitions évitent layout shifts
- [ ] Transitions utilisent Suspense boundaries
- [ ] Transitions affichent feedback immédiat

### 4.3 Error States

**CRITICAL** : Vérifie que toutes les pages gèrent les erreurs correctement.

**Patterns à vérifier** :
- ✅ Pages affichent messages d'erreur utilisateur-friendly
- ✅ Pages utilisent i18n pour messages d'erreur
- ✅ Pages fournissent actions de retry si approprié
- ✅ Pages gèrent erreurs réseau, permissions, modules

**Vérifications** :
- ❌ Pages avec messages d'erreur hardcodés (pas i18n)
- ❌ Pages sans messages d'erreur utilisateur-friendly
- ❌ Pages sans actions de retry si approprié
- ❌ Pages qui ne gèrent pas tous les types d'erreurs

**Checklist** :
- [ ] Pages affichent messages d'erreur utilisateur-friendly
- [ ] Pages utilisent i18n pour messages d'erreur
- [ ] Pages fournissent actions de retry si approprié
- [ ] Pages gèrent tous les types d'erreurs

### 4.4 Empty States

**CRITICAL** : Vérifie que toutes les pages gèrent les états vides correctement.

**Patterns à vérifier** :
- ✅ Pages affichent empty states significatifs
- ✅ Pages utilisent i18n pour empty states
- ✅ Pages guident utilisateur sur prochaines actions
- ✅ Pages gèrent états vides pour listes, détails, formulaires

**Vérifications** :
- ❌ Pages avec empty states hardcodés (pas i18n)
- ❌ Pages sans empty states significatifs
- ❌ Pages sans guidance utilisateur
- ❌ Pages qui ne gèrent pas tous les types d'états vides

**Checklist** :
- [ ] Pages affichent empty states significatifs
- [ ] Pages utilisent i18n pour empty states
- [ ] Pages guident utilisateur sur prochaines actions
- [ ] Pages gèrent tous les types d'états vides

---

## 🔄 5. AUDIT USER FLOWS

### 5.1 Navigation Patterns

**CRITICAL** : Vérifie que tous les patterns de navigation sont cohérents.

**Patterns à vérifier** :
- ✅ Navigation utilise `@/navigation` Link/router hooks
- ✅ Navigation utilise `useNavigationRouter` pour client-side navigation
- ✅ Navigation maintient breadcrumbs cohérents
- ✅ Navigation utilise patterns standards (list → detail → edit)

**Vérifications** :
- ❌ Navigation qui n'utilise pas `@/navigation`
- ❌ Navigation qui utilise `next/link` directement (violation)
- ❌ Navigation avec breadcrumbs incohérents
- ❌ Navigation avec patterns non-standard

**Checklist** :
- [ ] Navigation utilise `@/navigation`
- [ ] Navigation utilise `useNavigationRouter`
- [ ] Navigation maintient breadcrumbs cohérents
- [ ] Navigation utilise patterns standards

### 5.2 CTAs & Actions

**CRITICAL** : Vérifie que tous les CTAs et actions sont cohérents.

**Patterns à vérifier** :
- ✅ CTAs sont visibles et accessibles
- ✅ CTAs utilisent i18n pour labels
- ✅ CTAs suivent patterns standards (primary/secondary, placement)
- ✅ CTAs gèrent loading states et feedback

**Vérifications** :
- ❌ CTAs invisibles ou inaccessibles
- ❌ CTAs avec labels hardcodés (pas i18n)
- ❌ CTAs avec patterns non-standard
- ❌ CTAs sans loading states ou feedback

**Checklist** :
- [ ] CTAs sont visibles et accessibles
- [ ] CTAs utilisent i18n pour labels
- [ ] CTAs suivent patterns standards
- [ ] CTAs gèrent loading states et feedback

### 5.3 Workflows

**CRITICAL** : Vérifie que tous les workflows sont complets et cohérents.

**Patterns à vérifier** :
- ✅ Workflows sont complets (start → steps → end)
- ✅ Workflows gèrent erreurs et rollback
- ✅ Workflows affichent feedback à chaque étape
- ✅ Workflows utilisent i18n pour tous les textes

**Vérifications** :
- ❌ Workflows incomplets (étapes manquantes, fin manquante)
- ❌ Workflows sans gestion d'erreurs
- ❌ Workflows sans feedback
- ❌ Workflows avec textes hardcodés (pas i18n)

**Checklist** :
- [ ] Workflows sont complets
- [ ] Workflows gèrent erreurs et rollback
- [ ] Workflows affichent feedback à chaque étape
- [ ] Workflows utilisent i18n pour tous les textes

---

## 📊 6. FORMAT DE RÉPONSE ATTENDU

### Structure Minimale (Priorité)

1. **📊 Résumé Exécutif** (1-2 paragraphes)
   - Nombre total de violations par catégorie (Page Access, Menu Structure, Layouts, Scenarios, User Flows)
   - Top 5 problèmes critiques
   - Verdict global : 🟥 **CRITIQUE** | 🟨 **ATTENTION** | 🟩 **OK**

2. **🔴 Violations Critiques** (Tableau)
   | Portal | Module | Problème | Gravité | Description | Fix | Source |
   |--------|--------|----------|---------|-------------|-----|--------|
   | Company | Sales | Guards frontend incomplets | 🔴 Bloquant | Page detail sans ModuleGate/PermissionGate alors que backend a guards | Ajouter ModuleGate + PermissionGate | Page Access Control |
   | Company | Sales | Route sans entry point | 🔴 Bloquant | `/sales/config` API existe mais pas de page frontend ni entry point navigation | Créer page frontend + entry point navigation | Feature Discoverability Rule |

3. **🟡 Violations Non-Critiques** (Liste à puces)
   - Company Portal : Layout incohérent entre modules similaires
   - Tenant Portal : Breadcrumbs manquants pour certaines routes

4. **📁 Matrice Page Access** (Tableau)
   | Portal | Module | Page | Guards Frontend | Guards Backend | AccessMode | Status |
   |--------|--------|------|-----------------|----------------|------------|--------|
   | Company | Sales | Invoices List | ✅ | ✅ | ✅ | ✅ Conforme |
   | Company | Sales | Invoice Detail | ⚠️ Partiel | ✅ | ✅ | ⚠️ Guards incomplets |

5. **🧭 Matrice Menu Structure** (Tableau)
   | Portal | Route | Navigation Registry | excludeFromMenu | Module Filter | Permission Filter | Entry Point | Status |
   |--------|-------|---------------------|-----------------|---------------|------------------|-------------|--------|
   | Company | /sales/invoices | ✅ | ✅ | ✅ | ✅ | ✅ Sidebar | ✅ Conforme |
   | Company | /sales/config | ❌ | N/A | N/A | N/A | ❌ | ❌ Manquant |

6. **🎨 Matrice Page Layouts** (Liste structurée)
   - **Layout Consistency** :
     - ✅ Company Portal : Layouts cohérents entre modules
     - ❌ Tenant Portal : Layouts incohérents (structure différente)
   - **Responsive Design** :
     - ✅ Tous les layouts sont mobile-first
     - ⚠️ Certains layouts ont overflow horizontal sur mobile
   - **Accessibility** :
     - ✅ Navigation clavier fonctionnelle
     - ⚠️ Certains layouts manquent aria-labels

7. **📋 Page Scenarios** (Liste structurée)
   - **User Journeys** :
     - ✅ Company Portal : User journeys complets pour Sales
     - ❌ Tenant Portal : User journeys incomplets pour Users management
   - **Error States** :
     - ✅ Toutes les pages gèrent erreurs réseau
     - ⚠️ Certaines pages manquent messages d'erreur utilisateur-friendly
   - **Empty States** :
     - ✅ Toutes les list pages ont empty states
     - ❌ Certaines detail pages manquent empty states

8. **🔄 User Flows** (Liste structurée)
   - **Navigation Patterns** :
     - ✅ Navigation utilise `@/navigation` (cohérent)
     - ❌ Certaines pages utilisent `next/link` directement (violation)
   - **CTAs & Actions** :
     - ✅ CTAs utilisent i18n
     - ⚠️ Certains CTAs manquent loading states
   - **Workflows** :
     - ✅ Workflows complets pour Sales
     - ❌ Workflows incomplets pour Purchases

9. **📌 Actions Prioritaires** (Checklist)
   - [ ] **Priorité 1** : Guards frontend incomplets (sécurité)
   - [ ] **Priorité 1** : Routes sans entry point (Feature Discoverability Rule)
   - [ ] **Priorité 2** : Layouts incohérents (UX)
   - [ ] **Priorité 2** : User journeys incomplets (UX)
   - [ ] **Priorité 3** : Améliorations (accessibility, responsive)

### Règles de Réponse

- ✅ **Concis** : Maximum 1 page par section (sauf violations critiques)
- ✅ **Actionnable** : Chaque violation = correction proposée avec structure exacte
- ✅ **Référencé** : Citer docs sources explicitement (ex: "violates `feature-discoverability-rule.md` section 'Route Structurelle'")
- ✅ **Technique** : Citer fichiers, pages, patterns explicitement
- ❌ **Pas de blabla** : Pas de généralités vagues, uniquement faits techniques
- ❌ **Pas de suppositions** : Si information manquante, lister ce qui manque MAIS donner quand même une checklist exhaustive

---

## 🎯 Priorisation

### Priorité 1 (Bloquant - Corriger Immédiatement)
- Guards frontend incomplets (sécurité)
- Routes sans entry point (Feature Discoverability Rule)
- Pages accessibles sans vérification permissions/modules
- Layouts non responsive (mobile-first violation)

### Priorité 2 (Important - Corriger Avant Prochaine Release)
- Menu structure incohérente
- User journeys incomplets
- Error states manquants
- Navigation patterns incohérents

### Priorité 3 (Amélioration Continue)
- Accessibility améliorations
- Empty states améliorations
- Workflows améliorations

---

## ➤ Résultat Attendu

Une réponse **ultra-structurée, détaillée, très technique, directement exploitable**, utilisant :
- Les **patterns établis** (guards, navigation, layouts)
- Les **comparaisons inter-portails** (Company vs Tenant vs Partner vs Superadmin)
- Les **matrices de cohérence** (Page Access, Menu Structure, Layouts, Scenarios, User Flows)
- Les **actions prioritaires** (fixes proposés avec structure exacte)

**Focus** : Uniquement **problèmes UX/UI et architecture frontend** (access control, navigation, layouts, scenarios, flows), pas **features métier optionnelles**.

**Verdict final** :
- 🟥 **CRITIQUE** : Guards incomplets, routes sans entry point, layouts non responsive
- 🟨 **ATTENTION** : Corrections nécessaires mais non-bloquantes
- 🟩 **OK** : UX/UI cohérente (rare)

