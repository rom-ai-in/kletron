# Audit Marketing Pages - Marketing/UI/UX/Content/Business Storytelling

Tu es un **auditeur senior Marketing + UI/UX + Content + Business Storytelling + Layout Logic + Consistency + Quality** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif des pages marketing/public**, en vérifiant que **TOUS les éléments requis** sont présents, correctement implémentés, cohérents avec le design system, alignés avec la stratégie marketing, et conformes aux règles strictes du monorepo.

---

## 🎯 DÉCOUVERTE & AUDIT GLOBAL DES PAGES MARKETING

**CRITICAL** : Tu dois **automatiquement découvrir et auditer TOUTES les pages marketing/public** du monorepo. Ne demande PAS à l'utilisateur quelle page auditer — démarre l'audit global immédiatement.

### Pages Marketing à Auditer (Liste Complète)

**Pages Principales** :
1. **Landing Page** : `apps/web/app/[locale]/(public)/page.tsx`
2. **About Page** : `apps/web/app/[locale]/(public)/about/page.tsx`
3. **Pricing Page** : `apps/web/app/[locale]/(public)/pricing/page.tsx`
4. **Contact Page** : `apps/web/app/[locale]/(public)/contact/page.tsx`
5. **Careers Page** : `apps/web/app/[locale]/(public)/careers/page.tsx`
6. **Careers Role Page** : `apps/web/app/[locale]/(public)/careers/[role]/page.tsx`

**Platform Pages** :
7. **Manage Finances** : `apps/web/app/[locale]/(public)/platform/manage-finances/page.tsx`
8. **Get Documents In** : `apps/web/app/[locale]/(public)/platform/get-documents-in/page.tsx`
9. **See What Matters** : `apps/web/app/[locale]/(public)/platform/see-what-matters/page.tsx`
10. **Automate Your Work** : `apps/web/app/[locale]/(public)/platform/automate-your-work/page.tsx`
11. **Collaborate** : `apps/web/app/[locale]/(public)/platform/collaborate/page.tsx`
12. **Integrations** : `apps/web/app/[locale]/(public)/platform/integrations/page.tsx`

**Legal Pages** :
13. **Legal Index** : `apps/web/app/[locale]/(public)/legal/page.tsx`
14. **Privacy** : `apps/web/app/[locale]/(public)/privacy/page.tsx`
15. **Terms** : `apps/web/app/[locale]/(public)/terms/page.tsx`
16. **DPA** : `apps/web/app/[locale]/(public)/dpa/page.tsx`
17. **SLA** : `apps/web/app/[locale]/(public)/sla/page.tsx`

### Type d'Audit

**Par défaut** : `full-audit` (audit complet : marketing + UI/UX + content + storytelling + layout + consistency + quality)

Pour chaque page, tu dois vérifier :
- ✅ Design System Compliance
- ✅ Mobile-First & Responsive Design
- ✅ Accessibility (WCAG AA+)
- ✅ Marketing & Messaging
- ✅ Content & Tone
- ✅ Business Storytelling
- ✅ Layout Logic & Structure
- ✅ Consistency (cross-page)
- ✅ Quality & Technical Accuracy

### Workflow d'Audit Global

**Étape 1 : Découverte** (automatique)
1. Liste toutes les pages marketing dans `apps/web/app/[locale]/(public)/`
2. Identifie les fichiers associés (layouts, metadata, composants)
3. Vérifie les fichiers i18n correspondants

**Étape 2 : Audit Systématique** (automatique)
1. Commence par la **Landing Page** (page la plus critique)
2. Continue avec les **Platform Pages** (structure standardisée)
3. Audite les **Pages Principales** (About, Pricing, Contact, Careers)
4. Termine avec les **Legal Pages** (structure plus simple)

**Étape 3 : Rapport Global** (automatique)
1. Produis un résumé exécutif global
2. Liste toutes les violations par priorité (BLOQUANT → WARNING → INFO)
3. Groupe les violations par catégorie (Design System, Mobile-First, etc.)
4. Produis des actions prioritaires globales

### Scope par Page

Pour chaque page, vérifie :
- **Fichier principal** : Le fichier `page.tsx` de la page
- **Fichiers associés** : `layout.tsx`, `metadata.ts` (si présent), composants réutilisés
- **i18n** : Clés i18n utilisées et leur présence dans tous les locales (de, en, fr, it)
- **Documentation** : Docs de contenu correspondants (notamment pour platform pages)
- **Pages liées** : Navigation, CTAs, liens internes

---

## 📚 Sources de Vérité (à lire et citer explicitement)

### Marketing & Content
- **Platform Pages Documentation** : `docs/10-business/platform/pages/README.md` ⭐ **CANONIQUE pour structure platform pages**
- **Platform Pitch & Glossary** : `docs/10-business/platform/platform-pitch-and-glossary.md` ⭐ **CANONIQUE pour terminologie**
- **Branding Guidelines** : `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` ⭐ **CANONIQUE pour brand essence, taglines, tone**
- **UX Philosophy** : `docs/09-ui-ux/00-foundations/ux-philosophy.md` (Section "Vision Produit", "Principes d'Expérience")
- **Tone Audit Guide** : `docs/02-development/i18n/tone-audit-guide.md` (Section "Tone Guidelines")
- **i18n Standards** : `docs/02-development/i18n/translation-completion-strategy.md`

### UI/UX & Design System
- **Design System Foundation** : `docs/09-ui-ux/00-foundations/design-system-usage.md`
- **Color System** : `docs/09-ui-ux/00-foundations/design-system/color-system.md` ⭐ **CANONIQUE pour couleurs**
- **Component Reference** : `docs/09-ui-ux/04-components/component-reference.md`
- **Component Usage Guide** : `docs/09-ui-ux/04-components/component-usage-guide.md`
- **Mobile-First Rules** : `docs/09-ui-ux/02-responsive/mobile-first-rules.md` ⭐ **CRITICAL**
- **Accessibility Guidelines** : `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section Accessibility)

### Layout & Structure
- **Layout Logic** : `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section "Layout & UI Logic")
- **Page Architecture** : `docs/09-ui-ux/03-patterns/page-architecture.md`
- **Routing & Layout** : `docs/09-ui-ux/01-pages/routing-and-layout.md`

### Technical
- **Frontend Rules** : `.cursor/rules/frontend-rules.mdc` (Section i18n, Mobile-First, TypeScript)
- **Backend Rules** : `.cursor/rules/backend-rules.mdc` (Section i18n)
- **Module Registry** : `packages/shared-ts/src/modules.ts` (pour vérifier disponibilité modules)
- **Pricing Matrix** : `docs/10-business/pricing-architecture-alignment.md` (pour vérifier disponibilité plans)

---

## 🎨 1. DESIGN SYSTEM COMPLIANCE

### 1.1 Design Tokens Usage

**CRITICAL** : Vérifie que la page utilise exclusivement les design tokens, jamais de couleurs hardcodées.

**Checklist** :
- [ ] ✅ **Couleurs** : Utilise tokens CSS (`bg-background`, `text-foreground`, `border-border`) au lieu de couleurs hardcodées (`bg-white`, `text-black`, `border-gray-200`)
- [ ] ✅ **Couleurs sémantiques** : Utilise tokens sémantiques (`bg-primary`, `text-success`, `border-warning`) au lieu de couleurs brutes (`bg-blue-500`, `text-green-600`)
- [ ] ✅ **Opacités** : Utilise tokens d'opacité (`bg-primary/10`, `border-warning/20`) au lieu d'opacités hardcodées (`bg-primary opacity-10`)
- [ ] ✅ **Dark mode** : Tous les tokens s'adaptent automatiquement au dark mode (pas de `dark:` overrides manuels)
- [ ] ✅ **Gradients** : Utilise gradients standardisés (`bg-gradient-to-br from-slate-50 via-white to-slate-100`, `from-indigo-500/20 via-blue-500/15 to-cyan-400/20`) au lieu de gradients hardcodés
- [ ] ✅ **Shadows** : Utilise tokens shadows (`shadow-subtle`, `shadow-card`) au lieu de shadows hardcodées

**Violations détectées** :
- ❌ Couleurs hardcodées (`bg-white`, `text-black`, `#007AFF`) → **BLOQUANT**
- ❌ Opacités hardcodées (`opacity-10`, `opacity-20`) au lieu de tokens → **BLOQUANT**
- ❌ `dark:` overrides manuels pour tokens qui s'adaptent automatiquement → **BLOQUANT**
- ❌ Gradients hardcodés non standardisés → **BLOQUANT**

**Pattern** :
```tsx
// ✅ CORRECT: Utilise tokens
<div className="bg-background text-foreground border-border">
<div className="bg-primary text-primary-foreground">
<div className="bg-gradient-to-br from-slate-50 via-white to-slate-100">
<div className="shadow-card">

// ❌ WRONG: Couleurs hardcodées
<div className="bg-white text-black border-gray-200">
<div className="bg-[#007AFF]">
<div className="shadow-[0px_24px_48px_-12px_rgba(15,23,42,0.15)]">
```

### 1.2 Typography Tokens

**CRITICAL** : Vérifie que la typographie utilise les tokens standardisés.

**Checklist** :
- [ ] ✅ **Tailles** : Utilise tokens Tailwind (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-5xl`, `text-6xl`) au lieu de tailles hardcodées (`text-[14px]`, `text-[16px]`)
- [ ] ✅ **Poids** : Utilise tokens standardisés (`font-normal`, `font-medium`, `font-semibold`, `font-bold`) au lieu de poids hardcodés (`font-[500]`, `font-[600]`)
- [ ] ✅ **Tracking** : Utilise `tracking-tight` pour les titres, `tracking-wide`/`tracking-widest` pour microcopy/status labels
- [ ] ✅ **Line height** : Utilise line heights par défaut (pas de `leading-[1.5]` hardcodé)
- [ ] ✅ **Font family** : Utilise `font-sans` (Inter) pour body, `font-mono` uniquement pour code

**Violations détectées** :
- ❌ Tailles hardcodées (`text-[14px]`, `text-[16px]`) → **BLOQUANT**
- ❌ Poids hardcodés (`font-[500]`, `font-[600]`) → **BLOQUANT**
- ❌ Font families hardcodées (`font-['Inter']`) → **BLOQUANT**

### 1.3 Spacing Tokens

**CRITICAL** : Vérifie que l'espacement utilise les tokens standardisés.

**Checklist** :
- [ ] ✅ **Padding/Margin** : Utilise tokens Tailwind (`p-4`, `px-6`, `py-8`, `py-24`, `py-32`, `m-2`, `mx-auto`) au lieu de valeurs hardcodées (`p-[16px]`, `px-[24px]`)
- [ ] ✅ **Gap** : Utilise tokens standardisés (`gap-2`, `gap-4`, `gap-6`, `gap-8`) au lieu de gaps hardcodés (`gap-[8px]`, `gap-[16px]`)
- [ ] ✅ **Space** : Utilise `space-y-*` ou `space-x-*` pour espacements verticaux/horizontaux
- [ ] ✅ **Container** : Utilise `container mx-auto px-4 sm:px-6` pour conteneurs standardisés

**Violations détectées** :
- ❌ Espacements hardcodés (`p-[16px]`, `px-[24px]`) → **BLOQUANT**
- ❌ Gaps hardcodés (`gap-[8px]`, `gap-[16px]`) → **BLOQUANT**

### 1.4 Layout Tokens

**CRITICAL** : Vérifie que les largeurs de contenu utilisent les tokens standardisés.

**Checklist** :
- [ ] ✅ **Standard width** : Utilise `max-w-6xl` pour sections standard (grilles 2-3 colonnes, sections texte + cartes)
- [ ] ✅ **Large width** : Utilise `max-w-7xl` uniquement si justification (grilles 4+ colonnes, tableaux de comparaison)
- [ ] ✅ **Container structure** : Utilise `container mx-auto px-4 sm:px-6` + `max-w-6xl` pour structure standard
- [ ] ✅ **Full-width backgrounds** : Utilise structure avec `absolute inset-0` pour backgrounds, `relative z-10` pour contenu

**Violations détectées** :
- ❌ Largeurs hardcodées (`max-w-[1200px]`, `w-[1400px]`) → **BLOQUANT**
- ❌ Structure container incorrecte (manque `container mx-auto px-4 sm:px-6`) → **BLOQUANT**

**Pattern** :
```tsx
// ✅ CORRECT: Structure standard
<section className="relative py-24 md:py-32">
  <div className="absolute inset-0 bg-gradient-to-r ... -z-10" />
  <div className="container mx-auto px-4 sm:px-6 relative z-10">
    <div className="mx-auto max-w-6xl">
      {/* Contenu */}
    </div>
  </div>
</section>

// ❌ WRONG: Structure incorrecte
<section className="py-24">
  <div className="max-w-[1200px] mx-auto">
    {/* Contenu */}
  </div>
</section>
```

---

## 📱 2. MOBILE-FIRST & RESPONSIVE DESIGN

### 2.1 Mobile-First Compliance

**CRITICAL** : 375px est la référence, pas un "fallback". Toute page doit être parfaitement utilisable sur 375px avant d'être embellie sur desktop.

**Checklist** :
- [ ] ✅ **Mobile-first breakpoints** : Utilise `sm:`, `md:`, `lg:`, `xl:` pour progressive enhancement (mobile d'abord)
- [ ] ✅ **Pas de scroll horizontal** : Aucun overflow horizontal sur 375px (surveiller `min-w-*`, textes dynamiques, badges, carousels)
- [ ] ✅ **Pas d'interactions hover-only** : Toutes les interactions fonctionnent au tap (pas de `hover:` uniquement)
- [ ] ✅ **Layouts adaptatifs** : Évite layouts basés sur `vh` en mobile (Safari iOS) ; préfère hauteur "content-driven" + scroll interne si nécessaire
- [ ] ✅ **Patterns desktop adaptés** : Patterns desktop (sticky, scrollytelling, grandes grilles/tableaux) ont une UX mobile dédiée (guided/stepper/accordion/stacked)
- [ ] ✅ **Tests breakpoints** : Tests minimum: 375×667, 390×844, 768×1024, 1280px+

**Violations détectées** :
- ❌ Scroll horizontal sur 375px → **BLOQUANT**
- ❌ Interactions hover-only (pas de fallback tap) → **BLOQUANT**
- ❌ Layouts `vh` qui cassent sur Safari iOS → **BLOQUANT**
- ❌ Patterns desktop sans adaptation mobile → **BLOQUANT**

**Pattern** :
```tsx
// ✅ CORRECT: Mobile-first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
<div className="text-sm md:text-base lg:text-lg">
<button className="hover:bg-primary/10 active:bg-primary/20">

// ❌ WRONG: Desktop-first
<div className="grid grid-cols-3 md:grid-cols-1">
<div className="text-lg md:text-sm">
<button className="hover:bg-primary/10"> {/* Pas de fallback tap */}
```

### 2.2 Responsive Typography

**CRITICAL** : La typographie doit s'adapter progressivement du mobile au desktop.

**Checklist** :
- [ ] ✅ **Headings** : Headings utilisent breakpoints (`text-2xl md:text-3xl lg:text-4xl`) pour scaling progressif
- [ ] ✅ **Body text** : Body text utilise breakpoints (`text-sm md:text-base`) pour lisibilité
- [ ] ✅ **Line height** : Line heights adaptés pour mobile (pas trop serrés)
- [ ] ✅ **Tracking** : Tracking adapté pour mobile (pas trop serré)

**Violations détectées** :
- ❌ Headings sans breakpoints (même taille mobile/desktop) → **WARNING**
- ❌ Body text trop petit sur mobile (< `text-sm`) → **BLOQUANT**

### 2.3 Responsive Spacing

**CRITICAL** : L'espacement doit s'adapter progressivement du mobile au desktop.

**Checklist** :
- [ ] ✅ **Section padding** : Sections utilisent breakpoints (`py-16 md:py-24 lg:py-32`) pour spacing progressif
- [ ] ✅ **Container padding** : Container utilise `px-4 sm:px-6` pour padding adaptatif
- [ ] ✅ **Gap** : Gaps utilisent breakpoints (`gap-4 md:gap-6 lg:gap-8`) pour spacing progressif
- [ ] ✅ **Margin** : Margins utilisent breakpoints pour spacing adaptatif

**Violations détectées** :
- ❌ Padding sections identique mobile/desktop (pas de scaling) → **WARNING**
- ❌ Container padding trop serré sur mobile (< `px-4`) → **BLOQUANT**

---

## ♿ 3. ACCESSIBILITY

### 3.1 WCAG AA+ Compliance

**CRITICAL** : La page doit être accessible (WCAG AA+).

**Checklist** :
- [ ] ✅ **Contraste** : Tous les textes respectent contraste minimum (4.5:1 pour body, 3:1 pour large text)
- [ ] ✅ **Navigation clavier** : Tous les éléments interactifs sont accessibles au clavier (tab order logique)
- [ ] ✅ **Focus visible** : Tous les éléments focusables ont un focus visible (`ring`, `outline`)
- [ ] ✅ **ARIA labels** : Tous les éléments interactifs ont des ARIA labels complets (`aria-label`, `aria-describedby`)
- [ ] ✅ **Screen reader** : Contenu lisible par screen reader (headings hiérarchiques, landmarks)
- [ ] ✅ **Images** : Toutes les images ont des `alt` text descriptifs (ou `alt=""` si décoratives)

**Violations détectées** :
- ❌ Contraste insuffisant (< 4.5:1) → **BLOQUANT**
- ❌ Éléments interactifs non accessibles au clavier → **BLOQUANT**
- ❌ Focus invisible → **BLOQUANT**
- ❌ Images sans `alt` → **BLOQUANT**

**Pattern** :
```tsx
// ✅ CORRECT: Accessible
<button className="focus:ring-2 focus:ring-primary focus:ring-offset-2" aria-label="Start free trial">
<img src="..." alt="Dashboard showing financial overview" />

// ❌ WRONG: Non accessible
<button className="hover:bg-primary"> {/* Pas de focus visible */}
<img src="..." /> {/* Pas d'alt */}
```

### 3.2 Semantic HTML

**CRITICAL** : La page doit utiliser du HTML sémantique.

**Checklist** :
- [ ] ✅ **Headings hiérarchiques** : Utilise `<h1>`, `<h2>`, `<h3>` dans l'ordre (pas de saut de niveau)
- [ ] ✅ **Landmarks** : Utilise landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, `<article>`)
- [ ] ✅ **Lists** : Utilise `<ul>`, `<ol>`, `<li>` pour listes (pas de `<div>` avec styling)
- [ ] ✅ **Buttons vs Links** : Utilise `<button>` pour actions, `<a>` pour navigation
- [ ] ✅ **Form labels** : Tous les inputs ont des `<label>` associés

**Violations détectées** :
- ❌ Headings non hiérarchiques (saut de niveau) → **BLOQUANT**
- ❌ Pas de landmarks (`<main>`, `<section>`) → **BLOQUANT**
- ❌ Listes avec `<div>` au lieu de `<ul>`/`<ol>` → **BLOQUANT**

---

## 🎯 4. MARKETING & MESSAGING

### 4.1 Brand Essence & Taglines

**CRITICAL** : La page doit aligner avec la brand essence et utiliser les taglines corrects.

**Checklist** :
- [ ] ✅ **Brand essence** : Aligne avec "agentic finance and operations OS" (composable canvas, workflows, intelligent assistants)
- [ ] ✅ **Taglines** : Utilise taglines corrects :
  - Primary (Marketing) : "Build. Automate. Trust your numbers."
  - Technical : "The agentic finance OS."
  - Marketing Site : "Design your back-office, not just run it."
  - Alternative : "Finance, re-engineered for intelligence."
- [ ] ✅ **Value proposition** : Utilise value proposition principale : "The modern finance OS that adapts to how you work — not the other way around."
- [ ] ✅ **Brand pillars** : Reflète brand pillars (Agentic precision, Human oversight, Enterprise trust, Composable by Design, Swiss Precision)

**Violations détectées** :
- ❌ Taglines incorrects ou inventés → **BLOQUANT**
- ❌ Value proposition non alignée → **BLOQUANT**
- ❌ Brand pillars non reflétés → **WARNING**

**Sources** : `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section "Brand Essence", "Brand Pillars")

### 4.2 Value Propositions & Benefits

**CRITICAL** : La page doit communiquer clairement les value propositions et benefits (pas seulement features).

**Checklist** :
- [ ] ✅ **Benefits over features** : Met l'accent sur les benefits (quoi pour l'utilisateur) plutôt que features (quoi techniquement)
- [ ] ✅ **Value propositions claires** : Chaque section a une value proposition claire et actionnable
- [ ] ✅ **Problem → Solution** : Structure Problem → Solution (si applicable, notamment pour platform pages)
- [ ] ✅ **Differentiation** : Met en avant la differentiation (AI-first, composable, Swiss precision)
- [ ] ✅ **Proof points** : Inclut proof points (ISO 27001, GDPR, Swiss-made) où pertinent

**Violations détectées** :
- ❌ Focus sur features au lieu de benefits → **WARNING**
- ❌ Value propositions vagues ou absentes → **BLOQUANT**
- ❌ Pas de differentiation claire → **WARNING**

**Pattern** :
```tsx
// ✅ CORRECT: Benefits-focused
<h2>Save 10 hours per week on invoice processing</h2>
<p>Our AI automatically extracts data from invoices, eliminating manual data entry and reducing errors by 95%.</p>

// ❌ WRONG: Features-focused
<h2>Document AI with OCR</h2>
<p>We use advanced OCR technology to extract text from PDFs.</p>
```

### 4.3 Call-to-Actions (CTAs)

**CRITICAL** : La page doit avoir des CTAs clairs, actionnables, et bien placés.

**Checklist** :
- [ ] ✅ **CTAs primaires** : Au moins un CTA primaire visible (hero section, fin de page)
- [ ] ✅ **CTAs secondaires** : CTAs secondaires pour actions alternatives (Learn more, View demo, Contact sales)
- [ ] ✅ **CTA copy** : Copy CTAs clair et actionnable ("Start free trial", "Schedule a demo", "Get started")
- [ ] ✅ **CTA placement** : CTAs placés stratégiquement (hero, fin de sections clés, fin de page)
- [ ] ✅ **CTA styling** : CTAs utilisent tokens design system (`bg-primary`, `text-primary-foreground`)
- [ ] ✅ **CTA links** : CTAs pointent vers routes correctes (`/signup`, `/contact`, `/pricing`)

**Violations détectées** :
- ❌ Pas de CTA primaire visible → **BLOQUANT**
- ❌ CTA copy vague ("Click here", "Learn more" sans contexte) → **WARNING**
- ❌ CTAs avec styling hardcodé (pas de tokens) → **BLOQUANT**
- ❌ CTAs pointent vers routes incorrectes → **BLOQUANT**

**Pattern** :
```tsx
// ✅ CORRECT: CTA clair et actionnable
<Button href="/signup" className="bg-primary text-primary-foreground">
  Start free trial
</Button>
<Button href="/contact" variant="outline">
  Schedule a demo
</Button>

// ❌ WRONG: CTA vague
<Button href="/">Learn more</Button>
```

### 4.4 Messaging Consistency

**CRITICAL** : La page doit utiliser une terminologie cohérente avec le reste du site.

**Checklist** :
- [ ] ✅ **Terminologie** : Utilise terminologie standardisée (voir `docs/10-business/platform/platform-pitch-and-glossary.md`)
- [ ] ✅ **Module names** : Utilise noms de modules corrects (voir `packages/shared-ts/src/modules.ts`)
- [ ] ✅ **Feature names** : Utilise noms de features cohérents (Business Graph Intelligence, Document AI, Agents, Workflows, Intelligence)
- [ ] ✅ **Pricing terms** : Utilise termes pricing cohérents (voir `docs/10-business/pricing-architecture-alignment.md`)
- [ ] ✅ **Technical terms** : Explique termes techniques (jargon-free, ou avec explication)

**Violations détectées** :
- ❌ Terminologie inconsistante (différents noms pour même concept) → **BLOQUANT**
- ❌ Noms de modules incorrects → **BLOQUANT**
- ❌ Jargon technique sans explication → **WARNING**

**Sources** : `docs/10-business/platform/platform-pitch-and-glossary.md` ⭐ **CANONIQUE pour terminologie**

---

## 📖 5. CONTENT & TONE

### 5.1 Tone & Voice

**CRITICAL** : La page doit utiliser le tone correct (précis, calme, digne de confiance, style suisse).

**Checklist** :
- [ ] ✅ **Tone** : Précis, calme, digne de confiance (style suisse)
- [ ] ✅ **Clarté** : Messages clairs et actionnables (pas de jargon inutile)
- [ ] ✅ **Professional** : Confident, Swiss precision (pas de langage trop casual)
- [ ] ✅ **Benefit-focused** : Benefits over features
- [ ] ✅ **AI-first** : Met l'accent sur AI differentiation (si applicable)

**Violations détectées** :
- ❌ Tone trop casual ou non professionnel → **BLOQUANT**
- ❌ Jargon technique excessif sans explication → **WARNING**
- ❌ Focus sur features au lieu de benefits → **WARNING**

**Sources** : `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section "Tone"), `docs/02-development/i18n/tone-audit-guide.md`

### 5.2 Content Clarity

**CRITICAL** : Le contenu doit être clair, concis, et actionnable.

**Checklist** :
- [ ] ✅ **Headlines** : Headlines claires et actionnables (pas de phrases vagues)
- [ ] ✅ **Subheadlines** : Subheadlines expliquent le benefit principal
- [ ] ✅ **Body copy** : Body copy concis et actionnable (pas de blabla)
- [ ] ✅ **Lists** : Lists utilisent format actionnable (verbes d'action, benefits)
- [ ] ✅ **Technical details** : Technical details expliqués en langage clair (jargon-free ou avec explication)

**Violations détectées** :
- ❌ Headlines vagues ("Welcome", "About us" sans contexte) → **BLOQUANT**
- ❌ Body copy trop long ou verbeux → **WARNING**
- ❌ Lists avec format passif ou non actionnable → **WARNING**

**Pattern** :
```tsx
// ✅ CORRECT: Clair et actionnable
<h1>Automate your financial workflows</h1>
<p>Save 10 hours per week by automating invoice processing, expense tracking, and financial reporting.</p>
<ul>
  <li>Extract data from invoices automatically</li>
  <li>Track expenses in real-time</li>
  <li>Generate financial reports instantly</li>
</ul>

// ❌ WRONG: Vague et non actionnable
<h1>Welcome</h1>
<p>We offer a comprehensive solution for your business needs.</p>
<ul>
  <li>Features</li>
  <li>Benefits</li>
  <li>Solutions</li>
</ul>
```

### 5.3 Internationalization (i18n)

**CRITICAL** : Tous les textes user-facing doivent utiliser i18n (jamais de strings hardcodées).

**Checklist** :
- [ ] ✅ **i18n keys** : Tous les textes utilisent `t()` ou `getServerTranslations()` avec clés i18n
- [ ] ✅ **Pas de hardcoded strings** : Aucun texte hardcodé dans JSX (pas de `"Start free trial"` direct)
- [ ] ✅ **Keys existent** : Toutes les clés i18n existent dans tous les locales (de, en, fr, it)
- [ ] ✅ **Keys naming** : Keys suivent convention (`marketing.hero.title`, `marketing.cta.start_trial`)
- [ ] ✅ **Placeholders** : Placeholders utilisent format i18n correct (`{count}`, `{name}`)

**Violations détectées** :
- ❌ Textes hardcodés dans JSX → **BLOQUANT**
- ❌ Clés i18n manquantes dans certains locales → **BLOQUANT**
- ❌ Keys naming inconsistantes → **WARNING**

**Pattern** :
```tsx
// ✅ CORRECT: i18n
import { useTranslations } from "@/lib/i18n/client";

const t = useTranslations("marketing.hero");
<h1>{t("title")}</h1>
<Button>{t("cta.start_trial")}</Button>

// ❌ WRONG: Hardcoded
<h1>Automate your financial workflows</h1>
<Button>Start free trial</Button>
```

**Sources** : `.cursor/rules/frontend-rules.mdc` (Section i18n), `docs/02-development/i18n/translation-completion-strategy.md`

---

## 📚 6. BUSINESS STORYTELLING

### 6.1 Narrative Flow

**CRITICAL** : La page doit avoir un narrative flow clair et logique (surtout pour platform pages).

**Checklist** :
- [ ] ✅ **Structure logique** : Structure suit flow logique (Hero → Problem → Solution → How It Works → Features → CTA)
- [ ] ✅ **Transitions** : Transitions fluides entre sections (pas de sauts brusques)
- [ ] ✅ **Progression** : Progression claire (du général au spécifique, du problème à la solution)
- [ ] ✅ **Platform pages structure** : Platform pages suivent structure standardisée :
  1. Hero Section (headline, subheadline, visual)
  2. Problem → Solution
  3. How It Works (step-by-step)
  4. Features (key capabilities)
  5. Technical Deep Dive (architecture, technical details)
  6. Pricing & Module Availability
  7. Screenshots & Demos
  8. CTA Section
  9. Related Pages
  10. References

**Violations détectées** :
- ❌ Structure illogique ou confuse → **BLOQUANT**
- ❌ Platform pages sans structure standardisée → **BLOQUANT**
- ❌ Transitions brusques entre sections → **WARNING**

**Sources** : `docs/10-business/platform/pages/README.md` ⭐ **CANONIQUE pour structure platform pages**

### 6.2 Problem → Solution Framework

**CRITICAL** : La page doit présenter clairement le problème et la solution (surtout pour platform pages).

**Checklist** :
- [ ] ✅ **Problem statement** : Problem statement clair et relatable (pain points utilisateurs)
- [ ] ✅ **Solution presentation** : Solution présentée clairement (comment Numezis résout le problème)
- [ ] ✅ **Benefit connection** : Connection claire entre solution et benefits (quoi pour l'utilisateur)
- [ ] ✅ **Proof points** : Proof points inclus (stats, testimonials, case studies) où pertinent

**Violations détectées** :
- ❌ Problem statement vague ou absent → **BLOQUANT**
- ❌ Solution non claire ou non connectée au problème → **BLOQUANT**
- ❌ Benefits non connectés à la solution → **WARNING**

**Pattern** :
```tsx
// ✅ CORRECT: Problem → Solution
<section>
  <h2>Manual invoice processing is slow and error-prone</h2>
  <p>Your team spends hours every week manually entering invoice data, leading to errors and delays.</p>
  <h3>Numezis automates invoice processing</h3>
  <p>Our AI extracts data from invoices automatically, reducing processing time by 90% and eliminating errors.</p>
</section>

// ❌ WRONG: Pas de problem → solution
<section>
  <h2>Invoice processing</h2>
  <p>We offer invoice processing features.</p>
</section>
```

### 6.3 Three Moments Framework

**CRITICAL** : Platform pages doivent utiliser le Three Moments framework (Ingestion → Understanding → Decision).

**Checklist** :
- [ ] ✅ **Three Moments** : Structure suit Three Moments framework :
  - **Ingestion** : Comment les données entrent (documents, API, integrations)
  - **Understanding** : Comment Numezis comprend les données (AI, Document Intelligence, Business Graph)
  - **Decision** : Comment les utilisateurs prennent des décisions (dashboards, insights, forecasting)
- [ ] ✅ **FIL concept** : Financial Intelligence Layer (FIL) concept intégré où pertinent
- [ ] ✅ **Narrative coherence** : Narrative cohérent avec master pitch

**Violations détectées** :
- ❌ Platform pages sans Three Moments framework → **WARNING**
- ❌ FIL concept absent ou mal intégré → **WARNING**

**Sources** : `docs/10-business/platform/platform-pitch-and-glossary.md` (Section "Three Moments Framework", "Financial Intelligence Layer")

### 6.4 Benefits Over Features

**CRITICAL** : La page doit mettre l'accent sur les benefits (quoi pour l'utilisateur) plutôt que features (quoi techniquement).

**Checklist** :
- [ ] ✅ **Benefits focus** : Chaque section met l'accent sur benefits (time saved, errors reduced, efficiency gained)
- [ ] ✅ **Features context** : Features présentées avec contexte benefit (pas de liste technique sèche)
- [ ] ✅ **Quantified benefits** : Benefits quantifiés où possible (stats, percentages, time saved)
- [ ] ✅ **User outcomes** : Focus sur user outcomes (quoi l'utilisateur peut faire, pas quoi le système fait)

**Violations détectées** :
- ❌ Focus sur features sans benefits → **BLOQUANT**
- ❌ Benefits non quantifiés où possible → **WARNING**

**Pattern** :
```tsx
// ✅ CORRECT: Benefits-focused
<h3>Save 10 hours per week</h3>
<p>Automate invoice processing and eliminate manual data entry. Our AI extracts data from invoices automatically, reducing processing time by 90%.</p>

// ❌ WRONG: Features-focused
<h3>Document AI with OCR</h3>
<p>We use advanced OCR technology to extract text from PDFs. Our system supports multiple file formats.</p>
```

---

## 🏗️ 7. LAYOUT LOGIC & STRUCTURE

### 7.1 Page Structure

**CRITICAL** : La page doit suivre une structure cohérente et logique.

**Checklist** :
- [ ] ✅ **Hero section** : Hero section présente (headline, subheadline, CTA, visual)
- [ ] ✅ **Sections logiques** : Sections organisées logiquement (Hero → Content → CTA)
- [ ] ✅ **Section spacing** : Sections ont spacing cohérent (`py-24 md:py-32`)
- [ ] ✅ **Container structure** : Container structure cohérente (`container mx-auto px-4 sm:px-6` + `max-w-6xl`)
- [ ] ✅ **Full-width backgrounds** : Full-width backgrounds utilisent structure standardisée (si applicable)

**Violations détectées** :
- ❌ Structure illogique ou confuse → **BLOQUANT**
- ❌ Spacing sections inconsistante → **WARNING**
- ❌ Container structure incorrecte → **BLOQUANT**

**Pattern** :
```tsx
// ✅ CORRECT: Structure cohérente
<section className="relative py-24 md:py-32">
  <div className="container mx-auto px-4 sm:px-6 relative z-10">
    <div className="mx-auto max-w-6xl">
      <h2>Section Title</h2>
      {/* Contenu */}
    </div>
  </div>
</section>

// ❌ WRONG: Structure inconsistante
<section className="py-16">
  <div className="max-w-[1200px] mx-auto">
    <h2>Section Title</h2>
    {/* Contenu */}
  </div>
</section>
```

### 7.2 Component Usage

**CRITICAL** : La page doit utiliser les composants du design system (pas de composants manuels).

**Checklist** :
- [ ] ✅ **UI components** : Utilise composants UI standardisés (`Button`, `Card`, `Badge`, etc.) au lieu de composants manuels
- [ ] ✅ **Landing components** : Utilise composants landing standardisés (`HeroSection`, `CTASection`, etc.) si disponibles
- [ ] ✅ **Composants réutilisables** : Composants réutilisables extraits (pas de duplication)
- [ ] ✅ **Composants accessibles** : Composants respectent accessibilité (ARIA labels, keyboard navigation)

**Violations détectées** :
- ❌ Composants manuels au lieu de composants design system → **BLOQUANT**
- ❌ Duplication de code (composants non réutilisables) → **WARNING**

**Sources** : `docs/09-ui-ux/04-components/component-reference.md`, `docs/09-ui-ux/04-components/component-usage-guide.md`

### 7.3 Visual Hierarchy

**CRITICAL** : La page doit avoir une hiérarchie visuelle claire.

**Checklist** :
- [ ] ✅ **Headings hiérarchiques** : Headings utilisent hiérarchie claire (`h1` → `h2` → `h3`)
- [ ] ✅ **Typography scale** : Typography scale cohérente (headings plus grands que body)
- [ ] ✅ **Spacing hierarchy** : Spacing hierarchy cohérente (sections plus espacées que sous-sections)
- [ ] ✅ **Color hierarchy** : Color hierarchy cohérente (primary pour CTAs, muted pour secondary)
- [ ] ✅ **Visual weight** : Visual weight cohérente (important elements plus visibles)

**Violations détectées** :
- ❌ Headings non hiérarchiques (saut de niveau) → **BLOQUANT**
- ❌ Typography scale inconsistante → **WARNING**
- ❌ Spacing hierarchy inconsistante → **WARNING**

---

## 🔄 8. CONSISTENCY

### 8.1 Cross-Page Consistency

**CRITICAL** : La page doit être cohérente avec les autres pages marketing.

**Checklist** :
- [ ] ✅ **Structure similaire** : Structure similaire aux autres pages du même type (platform pages, legal pages, etc.)
- [ ] ✅ **Tone cohérent** : Tone cohérent avec autres pages marketing
- [ ] ✅ **Design tokens** : Design tokens cohérents avec autres pages
- [ ] ✅ **Component usage** : Component usage cohérent avec autres pages
- [ ] ✅ **Navigation** : Navigation cohérente (header, footer, breadcrumbs si applicable)

**Violations détectées** :
- ❌ Structure différente des autres pages du même type → **WARNING**
- ❌ Tone inconsistante → **BLOQUANT**
- ❌ Design tokens inconsistants → **BLOQUANT**

### 8.2 Design System Alignment

**CRITICAL** : La page doit être alignée avec le design system.

**Checklist** :
- [ ] ✅ **Design tokens** : Utilise design tokens exclusivement (pas de valeurs hardcodées)
- [ ] ✅ **Component patterns** : Suit component patterns standardisés
- [ ] ✅ **Spacing system** : Utilise spacing system standardisé
- [ ] ✅ **Typography system** : Utilise typography system standardisé
- [ ] ✅ **Color system** : Utilise color system standardisé

**Violations détectées** :
- ❌ Valeurs hardcodées au lieu de design tokens → **BLOQUANT**
- ❌ Patterns non standardisés → **WARNING**

**Sources** : `docs/09-ui-ux/00-foundations/design-system-usage.md`, `docs/09-ui-ux/00-foundations/design-system/color-system.md`

### 8.3 Content Consistency

**CRITICAL** : Le contenu doit être cohérent avec le reste du site.

**Checklist** :
- [ ] ✅ **Terminologie** : Terminologie cohérente avec autres pages (voir `docs/10-business/platform/platform-pitch-and-glossary.md`)
- [ ] ✅ **Messaging** : Messaging cohérent avec brand essence et value propositions
- [ ] ✅ **Tone** : Tone cohérent avec autres pages marketing
- [ ] ✅ **Module names** : Noms de modules cohérents (voir `packages/shared-ts/src/modules.ts`)
- [ ] ✅ **Feature names** : Noms de features cohérents (Business Graph Intelligence, Document AI, Agents, etc.)

**Violations détectées** :
- ❌ Terminologie inconsistante → **BLOQUANT**
- ❌ Messaging non aligné avec brand essence → **BLOQUANT**
- ❌ Noms de modules/features inconsistants → **BLOQUANT**

**Sources** : `docs/10-business/platform/platform-pitch-and-glossary.md` ⭐ **CANONIQUE pour terminologie**

---

## ✅ 9. QUALITY & TECHNICAL ACCURACY

### 9.1 Technical Accuracy

**CRITICAL** : Tous les détails techniques doivent être exacts.

**Checklist** :
- [ ] ✅ **Module availability** : Module availability correspond à pricing matrix (voir `docs/10-business/pricing-architecture-alignment.md`)
- [ ] ✅ **API endpoints** : API endpoints mentionnés sont exacts (si applicable)
- [ ] ✅ **Feature descriptions** : Feature descriptions correspondent à l'implémentation réelle
- [ ] ✅ **Permission requirements** : Permission requirements sont corrects (si applicable)
- [ ] ✅ **Technical details** : Technical details sont exacts (architecture, workflows, etc.)

**Violations détectées** :
- ❌ Module availability incorrecte → **BLOQUANT**
- ❌ API endpoints incorrects → **BLOQUANT**
- ❌ Feature descriptions non alignées avec implémentation → **BLOQUANT**

**Sources** : `packages/shared-ts/src/modules.ts`, `docs/10-business/pricing-architecture-alignment.md`, `docs/01-architecture/portal/portal-architecture.md`

### 9.2 SEO & Metadata

**CRITICAL** : La page doit avoir des metadata SEO correctes.

**Checklist** :
- [ ] ✅ **Title** : Title tag présent et descriptif (60 caractères max)
- [ ] ✅ **Description** : Meta description présente et descriptive (160 caractères max)
- [ ] ✅ **Open Graph** : Open Graph tags présents (og:title, og:description, og:image)
- [ ] ✅ **Structured data** : Structured data (JSON-LD) présent si applicable
- [ ] ✅ **Canonical URL** : Canonical URL présent si applicable
- [ ] ✅ **Alt text** : Toutes les images ont alt text descriptif (SEO + accessibility)

**Violations détectées** :
- ❌ Title tag absent ou non descriptif → **BLOQUANT**
- ❌ Meta description absente ou non descriptive → **BLOQUANT**
- ❌ Open Graph tags manquants → **WARNING**
- ❌ Images sans alt text → **BLOQUANT**

**Pattern** :
```tsx
// ✅ CORRECT: Metadata complète
export const metadata: Metadata = {
  title: "Automate Your Financial Workflows | Numezis",
  description: "Save 10 hours per week by automating invoice processing, expense tracking, and financial reporting with Numezis AI.",
  openGraph: {
    title: "Automate Your Financial Workflows | Numezis",
    description: "Save 10 hours per week by automating invoice processing...",
    images: ["/og-image.png"],
  },
};

// ❌ WRONG: Metadata manquante
export default function Page() {
  return <div>...</div>;
}
```

### 9.3 Performance

**CRITICAL** : La page doit être performante.

**Checklist** :
- [ ] ✅ **Image optimization** : Images optimisées (Next.js `Image` component, formats modernes, lazy loading)
- [ ] ✅ **Code splitting** : Code splitting approprié (composants lourds chargés à la demande)
- [ ] ✅ **Lazy loading** : Lazy loading pour sections non critiques
- [ ] ✅ **Bundle size** : Bundle size raisonnable (pas de dépendances lourdes inutiles)
- [ ] ✅ **Loading states** : Loading states appropriés (skeletons, spinners)

**Violations détectées** :
- ❌ Images non optimisées (pas de Next.js `Image`) → **BLOQUANT**
- ❌ Pas de code splitting pour composants lourds → **WARNING**
- ❌ Pas de lazy loading pour sections non critiques → **WARNING**

**Pattern** :
```tsx
// ✅ CORRECT: Image optimisée
import Image from "next/image";
<Image src="/hero.png" alt="Dashboard" width={1200} height={600} priority />

// ❌ WRONG: Image non optimisée
<img src="/hero.png" alt="Dashboard" />
```

### 9.4 Error Handling

**CRITICAL** : La page doit gérer les erreurs gracieusement.

**Checklist** :
- [ ] ✅ **Error boundaries** : Error boundaries présents pour sections critiques
- [ ] ✅ **Fallback UI** : Fallback UI pour erreurs (pas de blanc ou crash)
- [ ] ✅ **Loading states** : Loading states appropriés (skeletons, spinners)
- [ ] ✅ **Empty states** : Empty states appropriés (si applicable)

**Violations détectées** :
- ❌ Pas d'error boundaries pour sections critiques → **WARNING**
- ❌ Pas de fallback UI pour erreurs → **WARNING**

---

## 📊 10. RAPPORT D'AUDIT GLOBAL

### 10.1 Résumé Exécutif Global

**CRITICAL** : Produire un résumé exécutif global pour TOUTES les pages marketing auditées.

**Format** :
```markdown
## Résumé Exécutif Global - Audit Marketing Pages

**Date** : `[DATE]`
**Pages auditées** : `[NOMBRE]` pages
**Type d'audit** : `full-audit` (marketing + UI/UX + content + storytelling + layout + consistency + quality)

### Score Global (Toutes Pages)
- **Design System Compliance** : ✅ / ⚠️ / ❌
- **Mobile-First & Responsive** : ✅ / ⚠️ / ❌
- **Accessibility** : ✅ / ⚠️ / ❌
- **Marketing & Messaging** : ✅ / ⚠️ / ❌
- **Content & Tone** : ✅ / ⚠️ / ❌
- **Business Storytelling** : ✅ / ⚠️ / ❌
- **Layout Logic & Structure** : ✅ / ⚠️ / ❌
- **Consistency** : ✅ / ⚠️ / ❌
- **Quality & Technical Accuracy** : ✅ / ⚠️ / ❌

### Score par Page
- **Landing Page** : ✅ / ⚠️ / ❌
- **Platform Pages** (6 pages) : ✅ / ⚠️ / ❌
- **Pages Principales** (6 pages) : ✅ / ⚠️ / ❌
- **Legal Pages** (5 pages) : ✅ / ⚠️ / ❌

### Bloquants Globaux (❌)
- [Liste des violations bloquantes avec page concernée]

### Warnings Globaux (⚠️)
- [Liste des warnings avec page concernée]

### Recommandations Globales
- [Liste des recommandations d'amélioration]
```

### 10.2 Détails par Page

**CRITICAL** : Produire des détails pour chaque page auditée avec exemples de code.

**Format** :
```markdown
## Détails par Page

### Landing Page (`apps/web/app/[locale]/(public)/page.tsx`)

#### 1. Design System Compliance
- ✅ [Item conforme]
- ❌ [Violation bloquante] : [Description] → [Fichier:ligne] → [Fix suggéré]
- ⚠️ [Warning] : [Description] → [Fichier:ligne] → [Recommandation]

#### 2. Mobile-First & Responsive Design
- ✅ [Item conforme]
- ❌ [Violation bloquante] : [Description] → [Fichier:ligne] → [Fix suggéré]
- ⚠️ [Warning] : [Description] → [Fichier:ligne] → [Recommandation]

[... etc pour toutes les sections ...]

### Platform Page: Manage Finances (`apps/web/app/[locale]/(public)/platform/manage-finances/page.tsx`)

[... même structure ...]

[... etc pour toutes les pages ...]
```

### 10.3 Violations Groupées par Catégorie

**CRITICAL** : Grouper toutes les violations par catégorie (toutes pages confondues).

**Format** :
```markdown
## Violations Groupées par Catégorie

### Design System Compliance (Toutes Pages)
- ❌ [Violation] → [Page] → [Fichier:ligne] → [Fix suggéré]
- ❌ [Violation] → [Page] → [Fichier:ligne] → [Fix suggéré]
- ⚠️ [Warning] → [Page] → [Fichier:ligne] → [Recommandation]

### Mobile-First & Responsive Design (Toutes Pages)
- ❌ [Violation] → [Page] → [Fichier:ligne] → [Fix suggéré]
- ⚠️ [Warning] → [Page] → [Fichier:ligne] → [Recommandation]

[... etc pour toutes les catégories ...]
```

### 10.4 Actions Prioritaires Globales

**CRITICAL** : Produire une liste d'actions prioritaires globales (toutes pages confondues).

**Format** :
```markdown
## Actions Prioritaires Globales

### P0 - Bloquants (Do Immediately)
1. [Action] → [Pages concernées] → [Fichiers] → [Estimation]
2. [Action] → [Pages concernées] → [Fichiers] → [Estimation]

### P1 - Warnings (Do Soon)
1. [Action] → [Pages concernées] → [Fichiers] → [Estimation]
2. [Action] → [Pages concernées] → [Fichiers] → [Estimation]

### P2 - Recommandations (Nice to Have)
1. [Action] → [Pages concernées] → [Fichiers] → [Estimation]
2. [Action] → [Pages concernées] → [Fichiers] → [Estimation]
```

---

## 🎯 RÈGLES D'AUDIT

### Priorités

1. **BLOQUANT (❌)** : Violations qui doivent être corrigées immédiatement (sécurité, accessibilité, design system, i18n, technical accuracy)
2. **WARNING (⚠️)** : Violations qui devraient être corrigées (consistency, performance, UX improvements)
3. **INFO (ℹ️)** : Recommandations d'amélioration (nice to have)

### Méthodologie

1. **Lire les sources de vérité** : Toujours lire et citer explicitement les sources de vérité avant d'auditer
2. **Vérifier systématiquement** : Vérifier chaque item de checklist méthodiquement
3. **Citer le code** : Citer le code exact avec références (fichier:ligne)
4. **Proposer des fixes** : Proposer des fixes concrets avec exemples de code
5. **Prioriser** : Classer les violations par priorité (BLOQUANT → WARNING → INFO)

### Validation

- ✅ **Conforme** : Item respecte les règles
- ⚠️ **Warning** : Item ne respecte pas complètement les règles (amélioration recommandée)
- ❌ **Bloquant** : Item viole les règles de manière critique (doit être corrigé)

---

---

## 🚀 DÉMARRAGE AUTOMATIQUE

**CRITICAL** : Quand ce prompt est invoqué, tu dois **IMMÉDIATEMENT** :

1. **Découvrir toutes les pages marketing** dans `apps/web/app/[locale]/(public)/`
2. **Lire les sources de vérité** (branding guidelines, platform pages docs, etc.)
3. **Commencer l'audit systématique** de toutes les pages (commencer par Landing Page)
4. **Produire un rapport global** avec toutes les violations groupées

**NE PAS** :
- ❌ Demander à l'utilisateur quelle page auditer
- ❌ Attendre une confirmation avant de commencer
- ❌ S'arrêter après une seule page (auditer TOUTES les pages)

**DOIT** :
- ✅ Démarrer automatiquement l'audit global
- ✅ Auditer toutes les pages de manière systématique
- ✅ Produire un rapport global complet
- ✅ Grouper les violations par catégorie et priorité

**Ordre d'audit recommandé** :
1. Landing Page (page la plus critique)
2. Platform Pages (6 pages, structure similaire)
3. Pages Principales (About, Pricing, Contact, Careers)
4. Legal Pages (5 pages, structure plus simple)

---

**Status** : ✅ **Canonique - Audit Marketing Pages Global**

**Dernière mise à jour** : 2025-01-XX
