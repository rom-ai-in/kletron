Tu es un **auditeur senior Design System + Architecture Frontend** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de l'utilisation obligatoire et consistente du design system** dans tous les composants et toutes les pages, en vérifiant qu'**AUCUN code custom ne contourne le design system**.

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

**Scope d'audit** : **TOUS les composants et pages** du monorepo frontend

**Principe Fondamental** : **ZÉRO TOLÉRANCE** pour le code custom qui contourne le design system. Tous les composants et pages DOIVENT utiliser exclusivement le design system.

**Statut Design System** : ✅ **100% TERMINÉ** (infrastructure complète)
- **Gallery**: 61/61 composants documentés avec pages showcase interactives
- **Tests**: 61/61 composants testés (visual regression Playwright)
- **Token System**: Génération automatique opérationnelle
- **Documentation**: Component Reference complète, Usage Guide, Testing Guide

**Adoption en Cours** :
- **Component Usage**: ✅ Haute adoption (1,126 imports, 476 fichiers)
- **Token Adoption**: ⚠️ 95% conforme (119 fichiers, ~5-10 fichiers avec couleurs hardcodées)
- **Page Standardization**: ⚠️ 24% migré (74/308 pages, 234 restantes)

**Référence**: `docs/09-ui-ux/00-foundations/design-system/ADOPTION-STATUS.md` ⭐ **CANONIQUE pour métriques d'adoption**

**Objectifs** :
1. **Utilisation obligatoire du design system** : Tous les composants utilisent exclusivement les primitives du design system
2. **Cohérence absolue** : Tous les composants suivent les mêmes patterns (design tokens, variants, props, styling) - **AUCUNE exception**
3. **Pages standardisées** : Toutes les pages utilisent les composants prescrits selon leur scénario - **AUCUN code custom non autorisé**
4. **Zéro duplication de primitives** : Une seule primitive par type (Badge, Button, Card, etc.) - **AUCUNE duplication tolérée**

**Type d'audit** :
- `full-compliance-audit` : Audit complet de conformité design system (recommandé)
- `component-compliance-audit` : Audit des composants uniquement
- `page-compliance-audit` : Audit des pages uniquement
- `token-compliance-audit` : Audit des design tokens uniquement

**Zones à auditer** :
- **Composants UI** : `apps/web/components/ui/*` (primitives du design system)
- **Composants partagés** : `apps/web/components/shared/*` (composants cross-app)
- **Vues standardisées** : `apps/web/components/views/*` (UnifiedListView, DetailView, FormView, etc.)
- **Patterns** : `apps/web/components/patterns/*` (ActionBar, EmptyState, etc.)
- **Composants métier** : `apps/web/components/*/` (invoices, documents, etc.)
- **Pages** : `apps/web/app/**/page.tsx` (détection de code custom)

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **13 Scénarios Fondamentaux** : `docs/09-ui-ux/01-pages/page-scenarios-simplified.md` ⭐ **CANONIQUE** (source de vérité pour pages)
- **Component Reference** : `docs/09-ui-ux/04-components/component-reference.md` ⭐ **CANONIQUE** (source de vérité pour composants)
- **Design System Adoption Status** : `docs/09-ui-ux/00-foundations/design-system/ADOPTION-STATUS.md` ⭐ **CANONIQUE** (métriques d'adoption)
- **Design System Foundation** : `docs/09-ui-ux/00-foundations/design-system-usage.md` ⭐ **CANONIQUE** (règles d'utilisation)
- **Color System** : `docs/09-ui-ux/00-foundations/design-system/color-system.md` ⭐ **CANONIQUE** (système de couleurs)
- **Badge System** : `docs/09-ui-ux/00-foundations/design-system/badge-system.md` ⭐ **CANONIQUE** (système de badges)
- **Component Usage Guide** : `docs/09-ui-ux/04-components/component-usage-guide.md`
- **Accepted Patterns** : `docs/09-ui-ux/01-pages/accepted-patterns.md` (patterns acceptés)
- **UX Philosophy** : `docs/09-ui-ux/00-foundations/ux-philosophy.md` (Section "Mobile-First (CRITICAL)")
- **Portal Patterns** : `docs/09-ui-ux/05-portals/client-portal-patterns.md` (SWR, Error Handling, Hooks)
- **i18n Standards** : `docs/02-development/i18n/translation-completion-strategy.md`
- **Frontend Rules** : `.cursor/rules/frontend-rules.mdc` (Section i18n, Mobile-First, TypeScript, Zero `any`)

**Règles de custom code** :
- ✅ **Custom autorisé** : Scénarios B3, E3, G1-G5 (PageViewBase/PortalPage + composants du design system)
- ❌ **Custom interdit** : Scénarios B1, C1, D1, A1 (doivent utiliser Views standardisées)
- ✅ **Composants métier** : Autorisés UNIQUEMENT s'ils utilisent primitives (StatusBadge utilise Badge)
- ❌ **Duplications primitives** : **STRICTEMENT INTERDITES** (plusieurs Badge, plusieurs Button)
- ❌ **Code custom dans pages** : **STRICTEMENT INTERDIT** (sauf scénarios autorisés)

---

## 🔍 1. UTILISATION OBLIGATOIRE DU DESIGN SYSTEM DANS LES COMPOSANTS

### 1.1 Design Tokens Usage (ZÉRO TOLÉRANCE)

**CRITICAL** : Vérifie que **TOUS** les composants utilisent exclusivement les design tokens, **AUCUNE exception tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **Couleurs** : Tous les composants utilisent tokens CSS (`bg-background`, `text-foreground`, `border-border`) - **JAMAIS** de couleurs hardcodées (`bg-white`, `text-black`, `#007AFF`)
- [ ] ✅ **Couleurs sémantiques** : Tous les composants utilisent tokens sémantiques (`bg-primary`, `text-success`, `border-warning`) - **JAMAIS** de couleurs brutes (`bg-blue-500`, `text-green-600`)
- [ ] ✅ **Typography** : Tous les composants utilisent tokens Tailwind (`text-xs`, `text-sm`, `text-base`, etc.) - **JAMAIS** de tailles hardcodées (`text-[14px]`, `text-[16px]`)
- [ ] ✅ **Spacing** : Tous les composants utilisent tokens Tailwind (`p-4`, `px-6`, `gap-4`, etc.) - **JAMAIS** de valeurs hardcodées (`p-[16px]`, `px-[24px]`)
- [ ] ✅ **Border radius** : Tous les composants utilisent tokens standardisés (`rounded-md`, `rounded-lg`, etc.) - **JAMAIS** de valeurs hardcodées (`rounded-[8px]`)
- [ ] ✅ **Shadows** : Tous les composants utilisent tokens sémantiques (`shadow-subtle`, `shadow-card`, etc.) - **JAMAIS** de shadows hardcodées
- [ ] ✅ **Opacités** : Tous les composants utilisent tokens d'opacité (`bg-primary/10`, `border-warning/20`) - **JAMAIS** d'opacités hardcodées (`opacity-10`, `opacity-20`)

**Statut Actuel** :
- ✅ **95% conforme** : 119 fichiers utilisent design tokens
- ⚠️ **5% restant** : ~5-10 fichiers avec couleurs hardcodées (migration en cours)
- ✅ **Quality Check** : `npm run check:color-tokens` détecte automatiquement les violations

**Violations détectées** :
- ❌ Couleurs hardcodées dans n'importe quel composant → **BLOQUANT** (remplacer immédiatement)
- ❌ Typography hardcodée dans n'importe quel composant → **BLOQUANT** (remplacer immédiatement)
- ❌ Spacing hardcodé dans n'importe quel composant → **BLOQUANT** (remplacer immédiatement)
- ❌ Opacités hardcodées dans n'importe quel composant → **BLOQUANT** (remplacer immédiatement)

**Méthode** :
1. Scanner tous les fichiers `*.tsx` dans `apps/web/components/**/*`
2. Rechercher patterns hardcodés : `bg-white`, `text-black`, `p-[16px]`, `text-[14px]`, `#007AFF`, `rgb(255, 255, 255)`, `opacity-10`, etc.
3. Lister tous les composants avec violations
4. **Vérifier avec quality check** : `npm run check:color-tokens` pour détection automatique

**Référence**: `docs/09-ui-ux/00-foundations/design-system/ADOPTION-STATUS.md` section "Token Adoption"

### 1.2 Primitives Uniques (ZÉRO DUPLICATION)

**CRITICAL** : Vérifie qu'il n'existe **QU'UNE SEULE** primitive par type, **AUCUNE duplication tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **Badge unique** : Une seule primitive `Badge` dans `apps/web/components/ui/badge.tsx` - **JAMAIS** de `CustomBadge`, `MyBadge`, etc.
- [ ] ✅ **Button unique** : Une seule primitive `Button` dans `apps/web/components/ui/button.tsx` - **JAMAIS** de `CustomButton`, `MyButton`, etc.
- [ ] ✅ **Card unique** : Une seule primitive `Card` dans `apps/web/components/ui/card.tsx` - **JAMAIS** de `CustomCard`, `MyCard`, etc.
- [ ] ✅ **Input unique** : Une seule primitive `Input` dans `apps/web/components/ui/input.tsx` - **JAMAIS** de `CustomInput`, `MyInput`, etc.
- [ ] ✅ **Tous les primitives** : Vérifier contre Component Reference (61 composants dans gallery)

**Violations détectées** :
- ❌ Duplication de primitive Badge (Badge, CustomBadge, etc.) → **BLOQUANT** (consolidation immédiate requise)
- ❌ Duplication de primitive Button (Button, CustomButton, etc.) → **BLOQUANT** (consolidation immédiate requise)
- ❌ Duplication de primitive Card (Card, CustomCard, etc.) → **BLOQUANT** (consolidation immédiate requise)
- ❌ Composant métier qui recrée une primitive au lieu de l'utiliser → **BLOQUANT** (migration requise)

**Méthode** :
1. Scanner tous les fichiers dans `apps/web/components/**/*.tsx`
2. Grouper par fonctionnalité (badges, buttons, cards, inputs, modals, forms, etc.)
3. Identifier les duplications de primitives
4. **Vérifier contre Component Reference** : Tous les composants UI primitifs doivent être uniques (61 composants dans gallery, voir `docs/09-ui-ux/04-components/component-reference.md`)

**Exemples de violations** :
- ❌ **Duplications primitives** : Plusieurs composants Badge (Badge, CustomBadge, etc.) → **BLOQUANT**
- ❌ **Duplications primitives** : Plusieurs composants Button (Button, CustomButton, etc.) → **BLOQUANT**
- ❌ **Duplications primitives** : Plusieurs composants Card (Card, CustomCard, etc.) → **BLOQUANT**
- ✅ **Composants métier légitimes** : StatusBadge utilisant Badge → **NORMAL** (pas de violation)
- ✅ **Composants métier légitimes** : InvoiceStatusBadge utilisant StatusBadge → **NORMAL** (si réutilisable)

### 1.3 Composants Métier Utilisent Primitives (OBLIGATOIRE)

**CRITICAL** : Vérifie que **TOUS** les composants métier utilisent les primitives du design system, **AUCUN composant métier ne doit recréer une primitive**.

**Checklist exhaustive** :
- [ ] ✅ **Composants métier utilisent primitives** : Tous les composants métier utilisent des primitives (StatusBadge utilise Badge, InvoiceButton utilise Button)
- [ ] ✅ **Pas de recréation de primitives** : Aucun composant métier ne recrée une primitive (pas de `<div className="bg-primary">` au lieu de `<Button>`)
- [ ] ✅ **Composants métier réutilisables** : Composants métier doivent être réutilisables (pas de logique hardcodée)

**Violations détectées** :
- ❌ Composant métier qui recrée une primitive au lieu de l'utiliser → **BLOQUANT** (migration requise)
- ❌ Composant métier avec logique hardcodée (non réutilisable) → **BLOQUANT** (abstraction requise)

**Méthode** :
1. Scanner `apps/web/components/shared/*` (métier réutilisable)
2. Scanner `apps/web/components/*/` (métier spécifique)
3. Vérifier que tous utilisent des primitives du design system
4. Identifier les composants qui recréent des primitives

**Exemples légitimes** :
- ✅ `StatusBadge` (métier) utilisant `Badge` (primitive) : **NORMAL**
- ✅ `InvoiceButton` (métier) utilisant `Button` (primitive) : **NORMAL**
- ❌ `CustomBadge` (métier) recréant Badge : **VIOLATION**

### 1.4 Variants Cohérence (UNIFORMITÉ ABSOLUE)

**CRITICAL** : Vérifie que **TOUS** les composants avec variants utilisent les mêmes patterns, **AUCUNE exception tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **Variants standardisés** : Tous les composants utilisent les mêmes variants (`default`, `secondary`, `success`, `warning`, `destructive`, `outline`) - **JAMAIS** de variants custom
- [ ] ✅ **CVA usage** : Tous les composants avec variants utilisent `class-variance-authority` (CVA) - **JAMAIS** de variants manuels
- [ ] ✅ **Props cohérentes** : Tous les composants avec variants ont la même prop `variant` (string, pas enum) - **JAMAIS** de props différentes
- [ ] ✅ **Naming cohérent** : Tous les variants suivent les mêmes conventions de nommage - **JAMAIS** de naming différent

**Statut Actuel** :
- ✅ **100% conforme** : Tous les composants UI utilisent CVA (vérifié dans gallery)
- ✅ **Documentation** : Tous les variants documentés dans Component Reference
- ✅ **Tests** : Tous les variants testés dans Playwright tests

**Violations détectées** :
- ❌ Composants avec variants non standardisés → **BLOQUANT** (unification requise)
- ❌ Composants avec variants sans CVA → **BLOQUANT** (migration requise)
- ❌ Props de variants incohérentes → **BLOQUANT** (unification requise)

**Méthode** :
1. Identifier tous les composants avec variants
2. Comparer les variants entre composants similaires
3. Vérifier l'utilisation de CVA
4. Vérifier la cohérence des props
5. **Vérifier contre Component Reference** : Consulter `docs/09-ui-ux/04-components/component-reference.md` pour variants documentés
6. **Vérifier contre Gallery** : Consulter `/en/design-system` pour exemples interactifs

**Référence**: `docs/09-ui-ux/04-components/component-reference.md` (tous les variants documentés)

### 1.5 Props Cohérence (UNIFORMITÉ ABSOLUE)

**CRITICAL** : Vérifie que **TOUS** les composants similaires ont des props cohérentes, **AUCUNE exception tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **Props standardisées** : Tous les composants similaires ont les mêmes props de base (`className`, `children`, etc.) - **JAMAIS** de props différentes
- [ ] ✅ **Naming cohérent** : Tous les composants similaires utilisent les mêmes noms de props - **JAMAIS** de naming différent
- [ ] ✅ **Types cohérents** : Tous les composants similaires utilisent les mêmes types pour props similaires - **JAMAIS** de types différents
- [ ] ✅ **Defaults cohérents** : Tous les composants similaires ont les mêmes valeurs par défaut - **JAMAIS** de defaults différents

**Violations détectées** :
- ❌ Props incohérentes entre composants similaires → **BLOQUANT** (unification requise)
- ❌ Naming incohérent entre composants similaires → **BLOQUANT** (unification requise)
- ❌ Types incohérents entre composants similaires → **BLOQUANT** (unification requise)

**Méthode** :
1. Grouper les composants similaires
2. Comparer les interfaces de props
3. Identifier les incohérences

---

## 📄 2. UTILISATION OBLIGATOIRE DU DESIGN SYSTEM DANS LES PAGES

### 2.1 Respect des Scénarios (OBLIGATOIRE)

**CRITICAL** : Vérifie que **TOUTES** les pages correspondent à un des 13 scénarios fondamentaux et utilisent les composants prescrits, **AUCUNE exception tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **Scénario identifié** : Chaque page correspond à un scénario défini dans `page-scenarios-simplified.md` - **JAMAIS** de page sans scénario
- [ ] ✅ **Composant prescrit** : Chaque page utilise le composant prescrit pour son scénario - **JAMAIS** de composant différent
- [ ] ✅ **Custom autorisé** : Pages avec custom (B3, E3, G1-G5) utilisent `PageViewBase` ou `PortalPage` - **JAMAIS** de custom sans wrapper
- [ ] ✅ **Custom interdit** : Pages standard (B1, C1, D1, A1) n'ont **JAMAIS** de custom - **JAMAIS** de JSX custom

**Statut Actuel** :
- ⚠️ **24% migré** : 74/308 pages utilisent Views standardisées
- ⚠️ **76% restant** : 234 pages à migrer (migration incrémentale 10-20 pages/mois)
- ✅ **Infrastructure** : Toutes les Views standardisées sont disponibles (ListView, DetailView, FormView, etc.)

**Violations détectées** :
- ❌ Page sans scénario identifié → **BLOQUANT** (identifier scénario ou créer nouveau)
- ❌ Page standard avec custom (devrait utiliser View) → **BLOQUANT** (migration requise)
- ❌ Page custom sans PageViewBase/PortalPage → **BLOQUANT** (migration requise)

**Référence**: `docs/09-ui-ux/00-foundations/design-system/ADOPTION-STATUS.md` section "Page Standardization"

**Scénarios autorisant custom** :
- **B3** (Liste custom) : `PageViewBase + composants du design system` ✅
- **E3** (Settings complexe) : `PageViewBase + composants du design system` ✅
- **G1-G5** (Pages système) : `PortalPage + composants du design system` ✅

**Scénarios interdisant custom** :
- **B1** (Liste standard) : DOIT utiliser `ListView` ❌
- **C1** (Détail read-only) : DOIT utiliser `DetailView` ❌
- **D1** (Formulaire) : DOIT utiliser `FormView` ❌
- **A1** (Dashboard) : DOIT utiliser `DashboardView` ❌

### 2.2 Détection de Code Custom Non Autorisé (ZÉRO TOLÉRANCE)

**CRITICAL** : Détecte le code custom non autorisé dans les pages, **AUCUNE exception tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **Scénario standard** : Pages standard (B1, C1, D1, A1) n'ont **JAMAIS** de JSX custom - **JAMAIS** de `<div>` custom au lieu de composants
- [ ] ✅ **Scénario custom** : Pages custom (B3, E3, G1-G5) utilisent `PageViewBase`/`PortalPage` - **JAMAIS** de custom sans wrapper
- [ ] ✅ **Styling standardisé** : Tous les composants utilisent design tokens (même dans custom) - **JAMAIS** de tokens hardcodés
- [ ] ✅ **Composants réutilisables** : Custom utilise des composants réutilisables (pas de JSX inline) - **JAMAIS** de JSX inline

**Violations détectées** :
- ❌ Page standard (B1, C1, D1, A1) avec JSX custom → **BLOQUANT** (migration vers View)
- ❌ Page custom sans PageViewBase/PortalPage → **BLOQUANT** (migration requise)
- ❌ Styling custom avec tokens hardcodés → **BLOQUANT** (utiliser design tokens)

**Patterns à détecter** :
```tsx
// ❌ WRONG: JSX custom dans page standard
export default function MyPage() {
  return (
    <div className="custom-layout">
      <div className="custom-header">...</div>
      <div className="custom-content">...</div>
    </div>
  );
}

// ✅ CORRECT: Utilise composants du design system
export default function MyPage() {
  return (
    <PageViewBase>
      <UnifiedListView {...props} />
    </PageViewBase>
  );
}
```

**Méthode** :
1. Scanner tous les fichiers `page.tsx` dans `apps/web/app/**/page.tsx`
2. Analyser chaque page pour détecter :
   - JSX custom (divs, sections, etc. au lieu de composants)
   - Styling custom (className avec tokens hardcodés)
   - Logique custom (useState, useEffect, etc. au lieu de hooks)
   - Layouts custom (divs avec flex/grid au lieu de PortalPage/PageViewBase)
3. Lister toutes les pages avec violations

### 2.3 Layouts Standardisés (OBLIGATOIRE)

**CRITICAL** : Vérifie que **TOUTES** les pages utilisent les layouts standardisés, **AUCUNE exception tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **PortalPage** : Toutes les pages de portail utilisent `PortalPage` ou `PageViewBase` (pas de layout custom) - **JAMAIS** de `<div>` direct
- [ ] ✅ **PortalPageHeader** : Tous les headers utilisent `PortalPageHeader` (pas de header custom) - **JAMAIS** de header custom
- [ ] ✅ **PortalBreadcrumbs** : Tous les breadcrumbs utilisent `PortalBreadcrumbs` (pas de breadcrumbs custom) - **JAMAIS** de breadcrumbs custom
- [ ] ✅ **PortalSidebar** : Toutes les sidebars utilisent `PortalSidebar` (pas de sidebar custom) - **JAMAIS** de sidebar custom
- [ ] ✅ **Pas de padding manuel** : Padding géré automatiquement par `PortalPage` (pas de `p-*` manuel sur page root) - **JAMAIS** de padding manuel
- [ ] ✅ **Pas de max-width manuel** : Max-width géré automatiquement par `PortalPage` (pas de `max-w-*` manuel sur page root) - **JAMAIS** de max-width manuel
- [ ] ✅ **Pas de background manuel** : Background géré par `PortalLayout` (pas de `bg-*` manuel sur page root) - **JAMAIS** de background manuel

**Violations détectées** :
- ❌ Layout custom dans une page (devrait utiliser PortalPage/PageViewBase) → **BLOQUANT** (migration requise)
- ❌ Header custom dans une page (devrait utiliser PortalPageHeader) → **BLOQUANT** (migration requise)
- ❌ Breadcrumbs custom dans une page (devrait utiliser PortalBreadcrumbs) → **BLOQUANT** (migration requise)
- ❌ Padding/max-width/background manuel sur page root → **BLOQUANT** (supprimer manuel styling)

**Méthode** :
1. Scanner toutes les pages
2. Détecter les layouts custom (divs avec flex/grid au lieu de PortalPage/PageViewBase)
3. Détecter les headers custom (divs avec title au lieu de PortalPageHeader)
4. Détecter les breadcrumbs custom (nav/ol au lieu de PortalBreadcrumbs)
5. Détecter le styling manuel (padding, max-width, background sur page root)
6. Lister toutes les violations

### 2.4 Vues Standardisées (OBLIGATOIRE)

**CRITICAL** : Vérifie que **TOUTES** les pages standard utilisent les vues standardisées, **AUCUNE exception tolérée**.

**Checklist exhaustive** :
- [ ] ✅ **Scénario B1** : Pages de liste standard utilisent `ListView` (pas de table custom) - **JAMAIS** de table custom
- [ ] ✅ **Scénario C1** : Pages de détail standard utilisent `DetailView` (pas de layout custom) - **JAMAIS** de layout custom
- [ ] ✅ **Scénario D1** : Pages de formulaire standard utilisent `FormView` (pas de form custom) - **JAMAIS** de form custom
- [ ] ✅ **Scénario A1** : Pages de dashboard standard utilisent `DashboardView` (pas de layout custom) - **JAMAIS** de layout custom
- [ ] ✅ **Scénario E2** : Pages de settings simple utilisent `SettingsView` (pas de layout custom) - **JAMAIS** de layout custom
- [ ] ✅ **Scénarios custom** : Pages custom (B3, E3, G1-G5) utilisent `PageViewBase`/`PortalPage` avec composants du design system - **JAMAIS** de composants custom

**Violations détectées** :
- ❌ Page B1 sans `ListView` → **BLOQUANT** (migration requise)
- ❌ Page C1 sans `DetailView` → **BLOQUANT** (migration requise)
- ❌ Page D1 sans `FormView` → **BLOQUANT** (migration requise)
- ❌ Page A1 sans `DashboardView` → **BLOQUANT** (migration requise)
- ❌ Page custom sans `PageViewBase`/`PortalPage` → **BLOQUANT** (migration requise)

**Méthode** :
1. Scanner toutes les pages dans `apps/web/app/**/page.tsx`
2. Identifier le scénario de chaque page (selon `page-scenarios-simplified.md`)
3. Vérifier l'utilisation du composant prescrit pour le scénario
4. Lister toutes les pages avec violations

---

## 🔍 3. DÉTECTION DE COMPOSANTS CASSÉS ET NON ADÉQUATS

### 3.1 Composants Cassés (Bugs Fonctionnels)

**CRITICAL** : Détecte les composants qui ne fonctionnent pas correctement (bugs, erreurs de rendu, problèmes de logique).

**Checklist exhaustive** :
- [ ] ✅ **Variables non définies** : Toutes les variables utilisées sont définies - **JAMAIS** de variables manquantes
- [ ] ✅ **Hooks correctement utilisés** : Tous les hooks sont utilisés selon les règles React - **JAMAIS** de violations des règles des hooks
- [ ] ✅ **Positionnement correct** : Tous les éléments positionnés (`absolute`, `fixed`) ont un parent avec `position: relative` - **JAMAIS** de positionnement cassé
- [ ] ✅ **Calculs corrects** : Tous les calculs (circumference, offsets, etc.) sont corrects - **JAMAIS** de calculs incorrects
- [ ] ✅ **Props requises** : Toutes les props requises sont fournies - **JAMAIS** de props manquantes
- [ ] ✅ **Types corrects** : Tous les types sont corrects (pas de `any`, pas de types incorrects) - **JAMAIS** de types incorrects
- [ ] ✅ **Imports corrects** : Tous les imports sont corrects et résolus - **JAMAIS** d'imports manquants ou incorrects

**Violations détectées** :
- ❌ Variable utilisée mais non définie → **BLOQUANT** (corriger immédiatement)
- ❌ Positionnement `absolute` sans parent `relative` → **BLOQUANT** (corriger immédiatement)
- ❌ Calcul incorrect (circumference, offset, etc.) → **BLOQUANT** (corriger immédiatement)
- ❌ Hook utilisé incorrectement (violation des règles React) → **BLOQUANT** (corriger immédiatement)
- ❌ Props requises manquantes → **BLOQUANT** (corriger immédiatement)
- ❌ Type incorrect ou `any` → **BLOQUANT** (corriger immédiatement)

**Méthode** :
1. Scanner tous les fichiers `*.tsx` dans `apps/web/components/**/*`
2. Vérifier que toutes les variables utilisées sont définies
3. Vérifier que tous les positionnements `absolute`/`fixed` ont un parent `relative`
4. Vérifier que tous les calculs sont corrects
5. Vérifier que tous les hooks sont utilisés correctement
6. Vérifier que toutes les props requises sont fournies
7. Vérifier que tous les types sont corrects
8. Vérifier que tous les imports sont corrects

**Exemples de violations** :
```tsx
// ❌ WRONG: Variable non définie
const offset = circumference - (animatedValue / 100) * circumference;
// circumference n'est pas défini

// ❌ WRONG: Positionnement absolute sans parent relative
<div className="absolute">...</div>
// Parent n'a pas position: relative

// ✅ CORRECT: Positionnement correct
<div className="relative">
  <div className="absolute">...</div>
</div>
```

### 3.2 Composants Non Adéquats (Problèmes de Qualité Visuelle)

**CRITICAL** : Détecte les composants qui ne sont pas adéquats pour leur usage (problèmes de rendu visuel, incohérence avec le design system, problèmes de responsive).

**Checklist exhaustive** :
- [ ] ✅ **Rendu visuel correct** : Tous les composants s'affichent correctement - **JAMAIS** de composants qui ne s'affichent pas
- [ ] ✅ **Cohérence visuelle** : Tous les composants sont cohérents avec le design system - **JAMAIS** de composants qui ne respectent pas le design system
- [ ] ✅ **Responsive design** : Tous les composants sont responsive (mobile-first) - **JAMAIS** de composants qui cassent sur mobile
- [ ] ✅ **Accessibilité visuelle** : Tous les composants sont accessibles (contraste, taille, etc.) - **JAMAIS** de problèmes d'accessibilité
- [ ] ✅ **Animations correctes** : Toutes les animations fonctionnent correctement - **JAMAIS** d'animations cassées
- [ ] ✅ **États corrects** : Tous les états (hover, focus, active, disabled) fonctionnent correctement - **JAMAIS** d'états cassés
- [ ] ✅ **Overflow correct** : Tous les composants gèrent correctement l'overflow - **JAMAIS** de débordement non géré

**Violations détectées** :
- ❌ Composant qui ne s'affiche pas correctement → **BLOQUANT** (corriger immédiatement)
- ❌ Composant qui ne respecte pas le design system visuellement → **BLOQUANT** (corriger immédiatement)
- ❌ Composant qui casse sur mobile (responsive) → **BLOQUANT** (corriger immédiatement)
- ❌ Problème d'accessibilité visuelle (contraste, taille) → **BLOQUANT** (corriger immédiatement)
- ❌ Animation cassée ou non fonctionnelle → **BLOQUANT** (corriger immédiatement)
- ❌ État (hover, focus, active, disabled) cassé → **BLOQUANT** (corriger immédiatement)
- ❌ Overflow non géré (débordement) → **BLOQUANT** (corriger immédiatement)

**Méthode** :
1. Scanner tous les fichiers `*.tsx` dans `apps/web/components/**/*`
2. Vérifier le rendu visuel (positionnement, taille, couleurs, etc.)
3. Vérifier la cohérence avec le design system (tokens, variants, spacing, etc.)
4. Vérifier le responsive design (breakpoints, mobile-first, etc.)
5. Vérifier l'accessibilité visuelle (contraste, taille, etc.)
6. Vérifier les animations (fonctionnement, performance, etc.)
7. Vérifier les états (hover, focus, active, disabled)
8. Vérifier l'overflow (débordement, scroll, etc.)

**Exemples de violations** :
```tsx
// ❌ WRONG: Texte centré avec absolute mais parent sans relative
<div className="inline-flex items-center justify-center">
  <div className="absolute flex flex-col items-center justify-center">
    <span>Text</span>
  </div>
</div>
// Le texte ne sera pas centré correctement

// ❌ WRONG: Composant non responsive
<div className="w-[800px]">...</div>
// Casse sur mobile

// ✅ CORRECT: Responsive design
<div className="w-full md:w-[800px]">...</div>
```

### 3.3 Composants Inappropriés (Mauvais Usage)

**CRITICAL** : Détecte les composants utilisés de manière inappropriée (mauvais composant pour le cas d'usage, composant custom au lieu de primitive, etc.).

**Checklist exhaustive** :
- [ ] ✅ **Bon composant pour le cas d'usage** : Le bon composant est utilisé pour chaque cas d'usage - **JAMAIS** de mauvais composant
- [ ] ✅ **Primitive utilisée quand disponible** : Les primitives du design system sont utilisées quand disponibles - **JAMAIS** de composant custom si primitive existe
- [ ] ✅ **Composant adapté au contexte** : Le composant est adapté au contexte (portal vs public, etc.) - **JAMAIS** de composant inadapté
- [ ] ✅ **Pattern correct** : Le pattern utilisé est correct selon les scénarios - **JAMAIS** de pattern incorrect

**Violations détectées** :
- ❌ Mauvais composant utilisé pour le cas d'usage → **BLOQUANT** (utiliser le bon composant)
- ❌ Composant custom utilisé alors qu'une primitive existe → **BLOQUANT** (utiliser la primitive)
- ❌ Composant inadapté au contexte → **BLOQUANT** (utiliser le bon composant)
- ❌ Pattern incorrect selon les scénarios → **BLOQUANT** (utiliser le bon pattern)

**Méthode** :
1. Scanner tous les fichiers `*.tsx` dans `apps/web/app/**/page.tsx`
2. Vérifier que le bon composant est utilisé pour chaque cas d'usage
3. Vérifier que les primitives sont utilisées quand disponibles
4. Vérifier que les composants sont adaptés au contexte
5. Vérifier que les patterns sont corrects selon les scénarios

**Exemples de violations** :
```tsx
// ❌ WRONG: Composant custom au lieu de primitive
<div className="bg-primary text-primary-foreground px-4 py-2 rounded">
  Button
</div>
// Devrait utiliser <Button> du design system

// ❌ WRONG: Mauvais composant pour le cas d'usage
<ProgressRing value={65} />
// ProgressRing est pour les indicateurs circulaires, pas pour les barres de progression
// Devrait utiliser <Progress> pour les barres de progression

// ✅ CORRECT: Bon composant utilisé
<Button variant="primary">Button</Button>
<Progress value={65} />
```

---

## 📊 4. FORMAT DE RÉPONSE ATTENDU

### Structure Minimale (Priorité)

1. **📊 Résumé Exécutif** (1-2 paragraphes)
   - Nombre total de composants analysés
   - Nombre de violations de design system détectées
   - Nombre de pages avec code custom non autorisé
   - Nombre de duplications de primitives
   - Verdict global : 🟥 **CRITIQUE** | 🟨 **ATTENTION** | 🟩 **OK**

2. **🔴 Violations Critiques - Design Tokens** (Tableau)
   | Composant/Page | Type | Gravité | Description | Action |
   |----------------|------|---------|-------------|--------|
   | `apps/web/components/.../MyComponent.tsx` | Couleur hardcodée | 🔴 Bloquant | `bg-white` au lieu de `bg-background` | Remplacer par token |
   | `apps/web/app/.../page.tsx` | Spacing hardcodé | 🔴 Bloquant | `p-[16px]` au lieu de `p-4` | Remplacer par token |

3. **🔴 Violations Critiques - Duplications Primitives** (Tableau)
   | Composant 1 | Composant 2 | Type | Gravité | Description | Action |
   |-------------|-------------|------|---------|-------------|--------|
   | `Badge` | `CustomBadge` | Duplication primitive | 🔴 Bloquant | Deux primitives Badge | Consolider en un seul |
   | `Button` | `CustomButton` | Duplication primitive | 🔴 Bloquant | Deux primitives Button | Consolider en un seul |

4. **🔴 Violations Critiques - Code Custom dans Pages** (Tableau)
   | Page | Scénario | Type | Gravité | Description | Action |
   |------|----------|------|---------|-------------|--------|
   | `apps/web/app/.../page.tsx` | B1 (Liste) | JSX custom | 🔴 Bloquant | JSX custom au lieu de ListView | Migrer vers ListView |
   | `apps/web/app/.../page.tsx` | C1 (Détail) | Layout custom | 🔴 Bloquant | Layout custom au lieu de DetailView | Migrer vers DetailView |
   | `apps/web/app/.../page.tsx` | B3 (Liste custom) | Sans PageViewBase | 🔴 Bloquant | Custom sans PageViewBase | Ajouter PageViewBase |

5. **🔴 Violations Critiques - Composants Métier** (Tableau)
   | Composant | Type | Gravité | Description | Action |
   |-----------|------|---------|-------------|--------|
   | `apps/web/components/.../MyComponent.tsx` | Recrée primitive | 🔴 Bloquant | Recrée Button au lieu d'utiliser Button | Utiliser primitive Button |
   | `apps/web/components/.../MyComponent.tsx` | Logique hardcodée | 🔴 Bloquant | Logique métier hardcodée | Extraire en props |

6. **🔴 Violations Critiques - Composants Cassés** (Tableau)
   | Composant | Type | Gravité | Description | Action |
   |-----------|------|---------|-------------|--------|
   | `apps/web/components/.../ProgressRing.tsx` | Variable non définie | 🔴 Bloquant | `circumference` utilisé mais non défini | Définir `circumference` |
   | `apps/web/components/.../MyComponent.tsx` | Positionnement cassé | 🔴 Bloquant | `absolute` sans parent `relative` | Ajouter `position: relative` au parent |
   | `apps/web/components/.../MyComponent.tsx` | Calcul incorrect | 🔴 Bloquant | Calcul de `offset` incorrect | Corriger le calcul |

7. **🔴 Violations Critiques - Composants Non Adéquats** (Tableau)
   | Composant | Type | Gravité | Description | Action |
   |-----------|------|---------|-------------|--------|
   | `apps/web/components/.../ProgressRing.tsx` | Rendu visuel cassé | 🔴 Bloquant | Texte centré avec `absolute` mais parent sans `relative` | Ajouter `position: relative` au parent |
   | `apps/web/components/.../MyComponent.tsx` | Non responsive | 🔴 Bloquant | Largeur fixe qui casse sur mobile | Utiliser classes responsive |
   | `apps/web/components/.../MyComponent.tsx` | Incohérence visuelle | 🔴 Bloquant | Ne respecte pas le design system | Utiliser design tokens |

8. **🔴 Violations Critiques - Composants Inappropriés** (Tableau)
   | Composant | Type | Gravité | Description | Action |
   |-----------|------|---------|-------------|--------|
   | `apps/web/app/.../page.tsx` | Mauvais composant | 🔴 Bloquant | `ProgressRing` utilisé au lieu de `Progress` | Utiliser `Progress` pour barres |
   | `apps/web/app/.../page.tsx` | Composant custom au lieu de primitive | 🔴 Bloquant | `<div>` custom au lieu de `<Button>` | Utiliser `<Button>` du design system |

9. **📁 Matrice de Conformité Design System** (Tableau)
   | Aspect | Composants/Pages Analysés | Conformité | Violations | Status |
   |--------|---------------------------|-----------|-----------|--------|
   | Design Tokens | 150/150 | 95% | 5 | ⚠️ 5 violations |
   | Primitives Uniques | 61/61 | 100% | 0 | ✅ Conforme |
   | Variants Cohérence | 35/35 | 100% | 0 | ✅ Conforme |
   | Props Cohérence | 45/45 | 89% | 5 | ⚠️ 5 incohérences |
   | Pages Standardisées | 74/308 | 24% | 234 | ⚠️ 234 pages à migrer |
   | Layouts Standardisés | 120/150 | 80% | 30 | ⚠️ 30 pages custom |
   | Composants Cassés | 0/150 | 100% | 0 | ✅ Conforme |
   | Composants Non Adéquats | 0/150 | 100% | 0 | ✅ Conforme |
   | Composants Inappropriés | 0/150 | 100% | 0 | ✅ Conforme |

10. **📌 Plan de Correction Prioritaire** (Checklist prioritaire)
   - [ ] **Priorité 1** : Corriger tous les composants cassés (variables non définies, positionnement, calculs, etc.)
   - [ ] **Priorité 1** : Corriger tous les composants non adéquats (rendu visuel, responsive, accessibilité, etc.)
   - [ ] **Priorité 1** : Corriger tous les composants inappropriés (mauvais composant, primitive non utilisée, etc.)
   - [ ] **Priorité 1** : Corriger toutes les violations de design tokens (couleurs, spacing, typography hardcodées)
   - [ ] **Priorité 1** : Consolider toutes les duplications de primitives (Badge, Button, Card, etc.)
   - [ ] **Priorité 1** : Migrer toutes les pages standard (B1, C1, D1, A1) vers Views standardisées
   - [ ] **Priorité 1** : Vérifier que toutes les pages custom (B3, E3, G1-G5) utilisent PageViewBase/PortalPage
   - [ ] **Priorité 1** : Corriger tous les composants métier qui recréent des primitives
   - [ ] **Priorité 2** : Unifier les variants entre composants similaires
   - [ ] **Priorité 2** : Unifier les props entre composants similaires
   - [ ] **Priorité 2** : Corriger les layouts custom (headers, breadcrumbs, sidebars)

### Règles de Réponse

- ✅ **Concis** : Maximum 2 pages par section (sauf violations critiques)
- ✅ **Actionnable** : Chaque violation = correction proposée avec code exact
- ✅ **Référencé** : Citer fichiers, lignes, patterns explicitement
- ✅ **Technique** : Citer fichiers, lignes, patterns explicitement
- ❌ **Pas de blabla** : Pas de généralités vagues, uniquement faits techniques
- ❌ **Pas de suppositions** : Si information manquante, lister ce qui manque MAIS donner quand même une checklist exhaustive

---

## 🎯 Priorisation

### Priorité 1 (Bloquant - Corriger Immédiatement)
- Composants cassés (variables non définies, positionnement, calculs, hooks, etc.) - correction requise
- Composants non adéquats (rendu visuel, responsive, accessibilité, animations, états, overflow) - correction requise
- Composants inappropriés (mauvais composant, primitive non utilisée, pattern incorrect) - correction requise
- Violations de design tokens (couleurs, spacing, typography hardcodées) - correction requise
- Duplications de primitives (Badge, Button, Card, etc.) - consolidation requise
- Pages standard (B1, C1, D1, A1) avec code custom - migration vers Views requise
- Pages custom (B3, E3, G1-G5) sans PageViewBase/PortalPage - migration requise
- Composants métier qui recréent des primitives - migration requise

### Priorité 2 (Important - Corriger Avant Prochaine Release)
- Incohérences de variants/props entre composants similaires - unification requise
- Layouts custom (migration vers PortalPage/PageViewBase)
- Composants non réutilisables (abstraction requise)

### Priorité 3 (Amélioration Continue)
- Optimisation de la réutilisabilité
- Améliorations UX (feedback, animations)
- Documentation des composants

---

## ➤ Résultat Attendu

Une réponse **ultra-structurée, détaillée, très technique, directement exploitable**, utilisant :
- Les **inventaires complets** (tous les composants, toutes les pages)
- Les **violations de design system** (tokens hardcodés, duplications, code custom)
- Les **matrices de conformité** (Design System, Pages, Composants)
- Les **plans de correction** (actions prioritaires avec code exact)

**Focus** : Uniquement **utilisation obligatoire et consistente du design system**, **zéro tolérance pour le code custom qui contourne le design system**.

**Verdict final** :
- 🟥 **CRITIQUE** : Composants cassés, composants non adéquats, composants inappropriés, violations de design tokens, duplications de primitives, pages standard avec custom, composants métier qui recréent des primitives
- 🟨 **ATTENTION** : Quelques incohérences mineures, quelques pages à migrer, quelques problèmes de qualité visuelle mineurs
- 🟩 **OK** : Tous les composants et pages utilisent exclusivement le design system, aucun composant cassé ou non adéquat, aucune violation (rare)
