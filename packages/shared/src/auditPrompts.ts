export type AuditPromptOption = {
  id: string;
  name: string;
  description: string;
  focus: string[];
  prompt: string;
};

export const auditPrompts: AuditPromptOption[] = [
  {
    id: "i18n",
    name: "Localization readiness audit",
    description:
      "Audit the i18n layer for data parity, placeholder safety, hardcoded strings, usage hygiene, resilience, and monitoring in the Numezis ERP.",
    focus: [
      "JSON parity + placeholder coverage",
      "Code + interpolation safety",
      "Architecture/resilience plan",
    ],
    prompt: [
      "Tu es Expert Linguistique & Architecte i18n pour un ERP critique (Numezis).",
      "Mission: auditer la solidité, la complétude et la résilience de la couche d'internationalisation afin de garantir que l'application est 100% Localization-Ready, sans dette technique linguistique, et capable de scaler à 10+ langues.",
      "Sources de vérité: docs/01-architecture/core/internationalization-standards.md, packages/i18n/README.md, docs/02-development/i18n/translation-completion-strategy.md, docs/02-development/quality/quality-architecture.md (section « i18n Placeholder Values »), docs/02-development/i18n/translator-guide.md (section « Placeholder Values »), docs/02-development/rules/backend-rules-and-checklist.md (section i18n), docs/02-development/rules/frontend-rules-and-checklist.md (section i18n).",
      "Périmètre: 1) intégrité des JSONs (parité en/fr/de/it, hiérarchie/domain.module.component, interpolations cohérentes); 2) placeholders, commandes npm run i18n:check-placeholder-values et npm run i18n:analyze-placeholders, priorisation (CRITICAL/HIGH/MEDIUM/LOW) et valeurs vides/manquantes; 3) strings hardcodées et interpolations manuelles côté front/back; 4) architecture & usages (helpers, fallback, changement de langue, typage, chunking, crash prevention); 5) résilience/perf (monitoring des placeholders, plan de correction).",
      "Livrables: 1️⃣ Santé Globale i18n (scores, placeholders par priorité, stats untranslated) + risque architectural. 2️⃣ Violations critiques (placeholders CRITICAL, messages d'erreur hardcodés, placeholders visibles, interpolations manquantes, mauvais formatage). 3️⃣ Violations modérées (placeholders HIGH/MEDIUM, doublons, ton incohérent, clés sans traduction anglaise). 4️⃣ Plan de remédiation priorisé (tableau Problème | Fichiers | Fix | Effort | Priorité) avec workflow npm run i18n:fix-placeholders. 5️⃣ Recommandations ERP-Grade (pluriels, workflow, enums dynamiques, prévention placeholders, monitoring via npm run i18n:check-placeholder-values et npm run i18n:untranslated).",
    ].join("\n"),
  },
  {
    id: "architecture",
    name: "Architecture & patterns audit",
    description:
      "Verify structural consistency, module patterns, services/repos/routes, and discoverability across the API and portal modules.",
    focus: [
      "Domain patterns + missing modules",
      "Services/Repos/Routes coverage",
      "Discoverability/navigation matrix",
    ],
    prompt: [
      "Tu es un auditeur senior Architecture & Patterns pour le monorepo Numezis.",
      "Mission: auditer exhaustivement la cohérence architecturale entre les modules (structure, organisation, nommage, services, repositories, routes, découvrabilité) et dénoncer uniquement les incohérences architecturales (pas les features métières optionnelles).",
      "Sources de vérité: docs/01-architecture/development/domain-structure-template.md, docs/02-development/module-creation-guide.md, docs/01-architecture/core/domain-model.md, docs/01-architecture/portal/portal-architecture.md, packages/shared-ts/src/modules.ts, docs/04-features/14-reporting/ARCHITECTURE.md, docs/09-ui-ux/04-product/feature-discoverability-rule.md, docs/01-architecture/navigation/navigation-rules.md, apps/api/src/services/navigation.registry.ts.",
      "Scope: apps/api/src/domain/**/*, apps/api/src/repositories/**/*, apps/api/src/routes/portals/**/*, apps/web/app/[locale]/(client)/**/*, registry navigation et comparaisons Purchase vs Sales, Accounting vs HR, Projects vs Inventory.",
      "Points critiques: patterns standards (config/workflows/ocr/events/documents/reporting/lifecycle/integration), sous-modules (service/router/repository/schema), services/repos/routes manquants ou nommage incohérent, routes sans integration portal, découvertabilité (API ⇄ frontend ⇄ navigation), duplications, patterns interdits (handlers/db utils massifs), incohérences de navigation (excludeFromMenu), incohérences de structure (hr/config vs purchase-config).",
      "Livrables: 1️⃣ Résumé exécutif (violations par catégorie, top 5 critiques, verdict global). 2️⃣ Tableau des violations critiques (Module | Problème | Gravité | Description | Fix | Source). 3️⃣ Violations non critiques (liste). 4️⃣ Matrice patterns (module vs config/workflows/ocr/events/documents/reporting/lifecycle/integration). 5️⃣ Comparaisons inter-modules détaillées. 6️⃣ Découvrabilité & navigation (API → frontend → navigation). 7️⃣ Structure des modules (complets/incomplets/non-standard). 8️⃣ Services/Repositories/Routes manquants. 9️⃣ Actions prioritaires (checklist).",
    ].join("\n"),
  },
  {
    id: "design-system",
    name: "Design system compliance audit",
    description:
      "Ensure every component and page respects the design system tokens, primitives, variants, props, and layouts with zero tolerance for custom code.",
    focus: [
      "Design tokens & primitives",
      "Component/page patterns",
      "Zero custom code + layouts",
    ],
    prompt: [
      "Tu es un auditeur senior Design System + Architecture Frontend pour le monorepo Numezis.",
      "Mission: exécuter un full-compliance-audit de l'utilisation du design system dans tous les composants et pages, en garantissant qu'aucun code custom ne contourne les primitives, tokens ou layouts standards.",
      "Sources de vérité: docs/09-ui-ux/01-pages/page-scenarios-simplified.md, docs/09-ui-ux/04-components/component-reference.md, docs/09-ui-ux/00-foundations/design-system/ADOPTION-STATUS.md, docs/09-ui-ux/00-foundations/design-system-usage.md, docs/09-ui-ux/00-foundations/design-system/color-system.md, docs/09-ui-ux/00-foundations/design-system/badge-system.md, docs/09-ui-ux/04-components/component-usage-guide.md, docs/09-ui-ux/01-pages/accepted-patterns.md, docs/09-ui-ux/00-foundations/ux-philosophy.md (section Mobile-First), docs/09-ui-ux/05-portals/client-portal-patterns.md, docs/02-development/i18n/translation-completion-strategy.md, .cursor/rules/frontend-rules.mdc (section i18n, Mobile-First, TypeScript, zero any).",
      "Scope: apps/web/components/ui/*, components/shared/*, components/views/*, components/patterns/*, composants métiers, et pages apps/web/app/**/page.tsx.",
      "Vérifications: tokens (couleurs, typographie, spacing, border-radius, shadows, opacités), unicité des primitives (Badge, Button, Card, Input), utilisation des primitives dans les composants métiers, cohérence des variants (CVA), cohérence des props, respect des scénarios pages (B1/B3/C1/D1/A1/E3/G1-G5), détection de code custom non autorisé dans les pages (multi layout, PortalPage/PageViewBase, PortalPageHeader, PortalBreadcrumbs), layouts standardisés, composants cassés / non adéquats / inappropriés, responsive, accessibilité, overflow, bons composants pour le cas d'usage.",
      "Livrables: 1️⃣ Résumé exécutif (composants analysés, violations tokens/duplications/taux de pages custom, verdict). 2️⃣ Tableaux des violations critiques (tokens hardcodés, duplications primitives, custom code, composants cassés, composants non adéquats, composants inappropriés). 3️⃣ Matrice de conformité design system. 4️⃣ Plan de correction prioritaire (checklist).",
    ].join("\n"),
  },
];
