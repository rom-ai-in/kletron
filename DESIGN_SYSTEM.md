# Numezis Design System - Documentation Complète

> Guide complet de la stratégie de design, UI/UX, construction des pages, formulaires, composants, typographie, et conventions de style du projet Numezis.

---

## Table des matières

1. [Architecture & Structure du Projet](#1-architecture--structure-du-projet)
2. [Philosophie de Design](#2-philosophie-de-design)
3. [Design Tokens - Source Unique de Vérité](#3-design-tokens---source-unique-de-vérité)
4. [Palette de Couleurs](#4-palette-de-couleurs)
5. [Typographie](#5-typographie)
6. [Espacement (Spacing)](#6-espacement-spacing)
7. [Coins Arrondis (Border Radius)](#7-coins-arrondis-border-radius)
8. [Ombres & Effets Glow](#8-ombres--effets-glow)
9. [Surfaces Glass / Frosted](#9-surfaces-glass--frosted)
10. [Animations & Transitions](#10-animations--transitions)
11. [Z-Index & Hiérarchie de Couches](#11-z-index--hiérarchie-de-couches)
12. [Système d'Icônes](#12-système-dicônes)
13. [Layouts & Structure des Pages](#13-layouts--structure-des-pages)
14. [Composants UI de Base](#14-composants-ui-de-base)
15. [Composants de Formulaire](#15-composants-de-formulaire)
16. [Composants Agent / IA](#16-composants-agent--ia)
17. [Composants Command Center](#17-composants-command-center)
18. [Composants IDE-Style](#18-composants-ide-style)
19. [Système de Variantes (CVA)](#19-système-de-variantes-cva)
20. [Types Partagés](#20-types-partagés)
21. [CSS Utilitaires Personnalisés](#21-css-utilitaires-personnalisés)
22. [Patterns & Conventions](#22-patterns--conventions)
23. [Imports & Utilisation](#23-imports--utilisation)

---

## 1. Architecture & Structure du Projet

### Monorepo Structure

```
numezis-coder-mcp/
├── apps/
│   ├── web/            → Application Next.js (web)
│   └── desktop/        → Application Electron (desktop)
├── packages/
│   ├── ui/             → Design system partagé (composants, tokens, styles)
│   ├── shared/         → Types et utilitaires partagés
│   ├── server/         → Services backend
│   └── agent-core/     → Logique agent IA
```

### Package UI (`@numezis/ui`)

Le package `packages/ui/` est le **coeur du design system**. Il est consommé par les deux apps (web et desktop).

```
packages/ui/src/
├── components/
│   ├── ui/              → Composants primitifs (Button, Input, Card, etc.)
│   ├── Agent/           → Composants IA (ThinkingBubble, ToolLog, etc.)
│   ├── CommandCenter/   → Shell de l'application principale
│   ├── config/          → Vues de configuration
│   ├── context/         → Composants de contexte
│   ├── Editor/          → Document viewer
│   └── design-system.ts → Barrel export de tous les composants
├── tokens/              → Design tokens (colors, spacing, typography, etc.)
├── styles/              → CSS global (tokens.css, scrollbar.css)
├── hooks/               → React hooks partagés
├── context/             → React contexts (Workspace, Auth)
├── lib/                 → Utilitaires (cn pour className merging)
├── types.ts             → Types partagés (Size, Variant, etc.)
├── tailwind-preset.ts   → Preset Tailwind partagé
└── index.ts             → Point d'entrée principal
```

### Stratégie de Styling

| Technologie | Rôle |
|---|---|
| **Tailwind CSS** | Framework CSS utility-first |
| **CSS Variables** | Theming via `tokens.css` (généré automatiquement) |
| **CVA (Class Variance Authority)** | Variantes de composants type-safe |
| **clsx** | Merge de class names conditionnels (`cn()`) |
| **Preset Tailwind Partagé** | `tailwind-preset.ts` étendu par les deux apps |

---

## 2. Philosophie de Design

### Principes Fondamentaux

| Principe | Description |
|---|---|
| **Dark-first** | Thème sombre exclusif, optimisé pour les environnements faible luminosité |
| **Glass Morphism** | Surfaces semi-transparentes avec backdrop-blur (vibrancy macOS) |
| **IDE-Inspired** | Interface inspirée de VS Code / Cursor pour la familiarité développeur |
| **Token-Driven** | Tous les styles définis comme tokens, jamais de valeurs magiques |
| **Component Composition** | Composants modulaires assemblables (compound components) |
| **Type-Safe** | Variantes et props typés via TypeScript + CVA |
| **Density Aware** | Mode compact disponible pour maximiser l'espace utile |

### Esthétique Visuelle

- **Zinc Scale** comme base de gris (du `#09090b` au `#e4e4e7`)
- **Teal Accent** (`#3994BC`) comme couleur brand Numezis
- **Violet/Sky/Emerald** pour les états sémantiques de l'agent IA
- **Très faible contraste** pour les bordures (5-12% blanc)
- **Backdrop blur** intensif avec saturation et brightness
- **Ombres profondes** calibrées pour le dark mode
- **Anti-aliasing** activé (`-webkit-font-smoothing: antialiased`)

---

## 3. Design Tokens - Source Unique de Vérité

### Architecture des Tokens

Les tokens sont définis en **TypeScript** puis **générés en CSS** automatiquement :

```
tokens/*.ts (source)  →  scripts/generate-css.ts  →  styles/tokens.css (output)
                                                         ↓
                                             Importé dans globals.css
                                                         ↓
                                             Variables CSS :root disponibles
                                                         ↓
                                             Tailwind les consomme via preset
```

### Fichiers de Tokens

| Fichier | Contenu |
|---|---|
| `tokens/colors.ts` | Surfaces, bordures, texte, états, agent, brand, IDE, diff |
| `tokens/spacing.ts` | Échelle de spacing 4px, spacing sémantique par composant |
| `tokens/radius.ts` | Border radius (sm→full), radius sémantique par composant |
| `tokens/typography.ts` | Familles, tailles, poids, line-height, presets sémantiques |
| `tokens/motion.ts` | Durées, easing, transitions, keyframes |
| `tokens/shadows.ts` | Box shadows, glows, shadows sémantiques |
| `tokens/z-index.ts` | Échelle de z-index, layers sémantiques |
| `tokens/glass.ts` | Surfaces glass, bordures glass, blur radii |
| `tokens/index.ts` | Barrel export + objet `tokens` unifié |

### Accès aux Tokens

```tsx
// 1. Via Tailwind classes (PRÉFÉRÉ)
<div className="bg-bg-surface text-text-primary border-border-subtle" />

// 2. Via CSS Variables
<div style={{ background: 'var(--bg-surface)' }} />

// 3. Via TypeScript import (pour styles inline / runtime)
import { colors, spacing } from '@numezis/ui/tokens';
<div style={{ background: colors.bgSurface, padding: spacing.base }} />

// 4. Via l'objet unifié
import { tokens } from '@numezis/ui/tokens';
const bg = tokens.colors.bgSurface;
```

---

## 4. Palette de Couleurs

### Surfaces (Zinc Scale)

| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| `--bg-app` | `#09090b` | `bg-bg-app` | Fond de l'application (le plus sombre) |
| `--bg-surface` | `#18181b` | `bg-bg-surface` | Fond des panneaux, cartes |
| `--bg-elevated` | `#27272a` | `bg-bg-elevated` | Modales, popovers (élévation) |

### Bordures

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `--border-subtle` | `rgba(255,255,255, 0.05)` | `border-border-subtle` | Séparateurs discrets |
| `--border-strong` | `rgba(255,255,255, 0.10)` | `border-border-strong` | Bordures accentuées, hover |

### Texte

| Token | Hex | Tailwind | Usage |
|---|---|---|---|
| `--text-primary` | `#e4e4e7` | `text-text-primary` | Texte principal lisible |
| `--text-secondary` | `#a1a1aa` | `text-text-secondary` | Texte secondaire / support |
| `--text-muted` | `#71717a` | `text-text-muted` | Texte désactivé / placeholder |

### États Interactifs

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `--state-hover` | `rgba(255,255,255, 0.03)` | `bg-state-hover` | Survol |
| `--state-active` | `rgba(255,255,255, 0.06)` | `bg-state-active` | Actif / pressé |
| `--state-selected` | `#1e1e21` | `bg-state-selected` | Élément sélectionné |
| `--focus-ring` | `rgba(161,161,170, 0.25)` | `ring-focusRing` | Anneau de focus |

### Couleurs Sémantiques (Status)

| État | Couleur principale | Background | Bordure | Texte |
|---|---|---|---|---|
| **Success** | `#22c55e` (Emerald) | `rgba(34,197,94, 0.1)` | `rgba(34,197,94, 0.4)` | `#6ee7b7` |
| **Error** | `#f43f5e` (Rose) | `rgba(244,63,94, 0.1)` | `rgba(244,63,94, 0.4)` | `#fda4af` |
| **Warning** | `#f59e0b` (Amber) | `rgba(245,158,11, 0.1)` | `rgba(251,191,36, 0.4)` | `#fcd34d` |
| **Info** | `#0ea5e9` (Sky) | `rgba(14,165,233, 0.1)` | `rgba(56,189,248, 0.4)` | `#7dd3fc` |

> **Pattern** : Chaque couleur sémantique a 4 déclinaisons — `DEFAULT`, `bg` (10% opacité), `border` (40% opacité), `text` (pastel clair).

### Couleurs Agent IA

| État | Couleur | Hex | Usage |
|---|---|---|---|
| **Thinking** | Violet | `#8b5cf6` | L'agent réfléchit |
| **Tool** | Amber | `#f59e0b` | Exécution d'outil |
| **Success** | Emerald | `#22c55e` | Tâche réussie |
| **Error** | Rose | `#f43f5e` | Erreur |
| **Running** | Sky | `#0ea5e9` | En cours d'exécution |
| **Pending** | Zinc | `#71717a` | En attente |

### Couleurs Brand

| Token | Hex | Usage |
|---|---|---|
| `--numezis-accent` | `#3994BC` | Accent principal Numezis (teal) |
| `--numezis-accent-hover` | `#3E9BC4` | État hover de l'accent |
| `--numezis-accent-muted` | `#3994BC26` | Background subtle accent |

### Couleurs Diff (Code)

| Token | Hex | Usage |
|---|---|---|
| `--diff-add` | `#73c991` | Texte ajouté (vert) |
| `--diff-remove` | `#f48771` | Texte supprimé (rouge) |
| `--diff-add-bg` | `rgba(114,200,146, 0.12)` | Background lignes ajoutées |
| `--diff-remove-bg` | `rgba(242,135,114, 0.12)` | Background lignes supprimées |

### Couleurs IDE (VS Code Theme)

L'application intègre un thème VS Code complet avec des variables `--vscode-*` pour :
- Editor (background, foreground, selection, line highlight)
- Sidebar, Activity Bar, Title Bar
- Tabs (active, inactive, borders)
- Status Bar, Panel
- Input, Quick Input (Command Palette)
- Buttons, Badges, Lists
- Git Decorations (added, modified, deleted)
- Diff Editor (inserted, removed)
- Notifications

Ces variables sont **aliasées** vers des noms courts pour les composants internes :
```css
--sidebar-bg: var(--vscode-sideBar-background);
--tab-active-bg: var(--vscode-tab-activeBackground);
--statusbar-bg: var(--vscode-statusBar-background);
/* etc. */
```

---

## 5. Typographie

### Familles de Police

| Token | Fonts | Tailwind | Usage |
|---|---|---|---|
| `display` | SF Pro Display, -apple-system, BlinkMacSystemFont, system-ui, sans-serif | `font-display` | Titres, display text |
| `body` | SF Pro Text, -apple-system, BlinkMacSystemFont, system-ui, sans-serif | `font-body` | Texte courant |
| `mono` | SF Mono, JetBrains Mono, Menlo, Monaco, monospace | `font-mono` | Code, terminal, diffs |

> Les polices utilisent le **system font stack Apple** en priorité, avec fallback système universel.

### Échelle de Tailles

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `2xs` | 10px / 0.625rem | `text-2xs` | Micro texte (badges, labels) |
| `xs` | 12px / 0.75rem | `text-xs` | Texte small (captions, métadonnées) |
| `sm` | **14px / 0.875rem** | `text-sm` | **Texte body par défaut** |
| `base` | 16px / 1rem | `text-base` | Grand body text |
| `lg` | 18px / 1.125rem | `text-lg` | Heading medium |
| `xl` | 20px / 1.25rem | `text-xl` | Heading large |
| `2xl` | 24px / 1.5rem | `text-2xl` | Heading XL |
| `3xl` | 30px / 1.875rem | `text-3xl` | Display small |
| `4xl` | 36px / 2.25rem | `text-4xl` | Display medium |
| `5xl` | 48px / 3rem | `text-5xl` | Display large |
| `6xl` | 60px / 3.75rem | `text-6xl` | Hero display |

> **Important** : La taille par défaut du `body` est **14px** (non 16px), avec un `line-height: 1.5`.

### Tailles Nommées Spéciales

```tsx
FONT_SIZES.micro    // text-[9px]   → Micro labels
FONT_SIZES.badge    // text-[10px]  → Badge text, small labels
FONT_SIZES.compact  // text-[11px]  → Compact UI text, selectors
FONT_SIZES.selector // text-[13px]  → Standard selector text
```

### Poids de Police

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `normal` | 400 | `font-normal` | Texte body courant |
| `medium` | 500 | `font-medium` | Emphase moyenne (h3, h4, labels) |
| `semibold` | 600 | `font-semibold` | Boutons, headings (h2) |
| `bold` | 700 | `font-bold` | Emphase forte (h1, badges uppercase) |

### Line Heights

| Token | Valeur | Usage |
|---|---|---|
| `none` | 1 | Display text serré |
| `tight` | 1.25 | Headings serrés |
| `snug` | 1.375 | Légèrement relâché |
| `normal` | 1.5 | Body text standard |
| `relaxed` | 1.625 | Lecture confortable |
| `loose` | 2 | Espacement très large |

### Letter Spacing

| Token | Valeur | Usage |
|---|---|---|
| `tighter` | -0.025em | Headings |
| `tight` | -0.015em | Slightly tight |
| `normal` | 0 | Default |
| `wide` | 0.025em | Labels |
| `wider` | 0.05em | ALL-CAPS labels |
| `widest` | 0.1em | Maximum spread |

### Presets Typographiques Sémantiques

```tsx
textStyles.h1       // 24px, bold, tight line-height, tight letter-spacing
textStyles.h2       // 20px, semibold, tight line-height
textStyles.h3       // 18px, medium, snug line-height
textStyles.h4       // 16px, medium, snug line-height
textStyles.body     // 14px, normal, normal line-height
textStyles.bodySmall // 12px, normal, normal line-height
textStyles.label    // 12px, medium, wide letter-spacing
textStyles.labelUppercase // 10px, bold, wider, UPPERCASE
textStyles.code     // mono font, 12px, relaxed line-height
textStyles.caption  // 10px, normal, text-muted color
```

---

## 6. Espacement (Spacing)

### Échelle de Base (4px)

| Token | Valeur | Pixels | Tailwind | Usage |
|---|---|---|---|---|
| `none` | 0 | 0px | `p-0`, `m-0` | Aucun espacement |
| `2xs` | 0.125rem | 2px | `p-2xs`, `gap-2xs` | Micro (icon padding) |
| `xs` | 0.25rem | 4px | `p-xs`, `gap-xs` | Extra small (badges) |
| `sm` | 0.5rem | 8px | `p-sm`, `gap-sm` | Small (buttons, list gaps) |
| `md` | 0.75rem | 12px | `p-md`, `gap-md` | Medium (card internal) |
| `base` | 1rem | 16px | `p-base`, `gap-base` | **Base unit** (sections) |
| `lg` | 1.25rem | 20px | `p-lg` | Medium-large |
| `xl` | 1.5rem | 24px | `p-xl` | Large (containers) |
| `2xl` | 2rem | 32px | `p-2xl` | Extra large (sections) |
| `3xl` | 2.5rem | 40px | `p-3xl` | 2x large |
| `4xl` | 3rem | 48px | `p-4xl` | Hero padding |
| `5xl` | 4rem | 64px | `p-5xl` | Page margins |
| `6xl` | 5rem | 80px | — | — |
| `7xl` | 6rem | 96px | — | — |

### Spacing Sémantique par Composant

```tsx
// Buttons
buttonPaddingXs:  "4px 8px"
buttonPaddingSm:  "8px 12px"
buttonPaddingMd:  "8px 16px"
buttonPaddingLg:  "12px 24px"

// Cards/Panels
cardPadding:        16px
cardPaddingCompact: 12px

// Sidebar
sidebarItemPadding: "6px 8px"
sidebarItemGap:     4px

// Modal
modalPadding:    24px
modalHeaderGap:  8px

// List items
listItemPadding: "8px 12px"
listItemGap:     4px

// Form fields
inputPadding:    "8px 12px"
labelGap:        4px
fieldGap:        16px

// Page layout
pageMargin:       32px
sectionGap:       40px
containerMaxWidth: 1280px
```

---

## 7. Coins Arrondis (Border Radius)

### Échelle

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `none` | 0 | `rounded-none` | Coins droits |
| `sm` | 2px | `rounded-sm` | Badges, petits boutons |
| `md` | 6px | `rounded-md` | **Boutons, inputs** (défaut) |
| `lg` | 8px | `rounded-lg` | Cards, panels |
| `xl` | 12px | `rounded-xl` | Modales, grands containers |
| `full` | 9999px | `rounded-full` | Pills, avatars |

### Radius Sémantique

```tsx
componentRadius.button   // 6px (md) — Coins de boutons
componentRadius.input    // 6px (md) — Inputs de formulaire
componentRadius.badge    // 6px (md) — Badges standard
componentRadius.badgePill // 9999px   — Badges pill
componentRadius.card     // 8px (lg) — Cartes
componentRadius.panel    // 8px (lg) — Panneaux
componentRadius.modal    // 12px (xl) — Modales
componentRadius.avatar   // 9999px   — Avatars (cercle)
componentRadius.tooltip  // 6px (md) — Tooltips
componentRadius.dropdown // 8px (lg) — Menus dropdown
```

---

## 8. Ombres & Effets Glow

### Échelle d'Ombres

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `none` | none | `shadow-none` | Pas d'ombre |
| `sm` | `0 1px 2px rgba(0,0,0,0.25)` | `shadow-sm` | Éléments inline, cartes |
| `md` | `0 4px 6px rgba(0,0,0,0.3), ...` | `shadow-md` | Boutons, tooltips |
| `lg` | `0 10px 15px rgba(0,0,0,0.4), ...` | `shadow-lg` | Dropdowns, popovers |
| `xl` | `0 20px 25px rgba(0,0,0,0.4), ...` | `shadow-xl` | Modales |
| `2xl` | `0 25px 50px rgba(0,0,0,0.5)` | — | Éléments flottants |
| `inner` | `inset 0 2px 4px rgba(0,0,0,0.2)` | — | États pressés |

> **Note** : Les ombres sont calibrées pour le dark mode avec une opacité plus élevée que les défauts Tailwind.

### Effets Glow

```css
glow-primary:  /* Sky + Indigo mix */
glow-eu:       /* EU blue */
glow-brand:    /* Numezis teal #3994BC */
glow-success:  /* Emerald */
glow-error:    /* Rose */
glow-thinking: /* Violet */
```

### Ombres Sémantiques

```tsx
componentShadows.card        // shadow-sm
componentShadows.dropdown    // shadow-lg
componentShadows.modal       // shadow-xl
componentShadows.tooltip     // shadow-md
componentShadows.buttonHover // "0 4px 12px rgba(0,0,0,0.3)"
componentShadows.focus       // "0 0 0 3px var(--focus-ring)"
componentShadows.glass       // "0 12px 48px rgba(0,0,0,0.5), ..."
```

---

## 9. Surfaces Glass / Frosted

### Concept

Le design system utilise un **glassmorphism** inspiré de macOS avec des surfaces semi-transparentes et du backdrop-filter. Sur Electron (desktop), cela exploite la vibrancy native. Sur le web, un dégradé de fond (`app-shell`) simule l'effet.

### Surfaces Glass

| Surface | Background | Blur | Usage |
|---|---|---|---|
| `glass-sidebar` | `rgba(24,24,27, 0.52)` | 56px (xl) | Sidebars |
| `glass-titlebar` | `rgba(24,24,27, 0.42)` | 56px (xl) | Title bar |
| `glass-panel` | `rgba(24,24,27, 0.55)` | 36px (lg) | Panneaux généraux |
| `glass-card` | `rgba(255,255,255, 0.045)` | 24px (md) | Cartes |
| `glass-card-hover` | `rgba(255,255,255, 0.08)` | — | Cartes au survol |
| `glass-input` | `rgba(255,255,255, 0.05)` | 12px (sm) | Champs de formulaire |
| `glass-elevated` | `rgba(39,39,42, 0.60)` | 56px (xl) | Modales, popovers |

### Bordures Glass

| Token | Valeur |
|---|---|
| `--glass-border` | `rgba(255,255,255, 0.12)` |
| `--glass-border-strong` | `rgba(255,255,255, 0.20)` |

### Classes CSS Utilitaires

```css
/* Utilisation directe */
.glass           /* Panel standard */
.glass-sidebar   /* Sidebar avec vibrancy */
.glass-titlebar  /* Title bar */
.glass-elevated  /* Modal, popover, dropdown */
.glass-card      /* Card interactive avec hover */
.glass-input     /* Input avec focus state */
.glass-selected  /* Élément sélectionné (accent teal) */
.glass-noise     /* Pseudo-element de texture noise */
```

### Fond d'Application (Web Fallback)

```css
.app-shell {
  /* Dégradé multi-couches qui simule la vibrancy */
  background:
    radial-gradient(... rgba(57,148,188, 0.14) ...),  /* Teal */
    radial-gradient(... rgba(139,92,246, 0.10) ...),   /* Violet */
    radial-gradient(... rgba(99,102,241, 0.07) ...),   /* Indigo */
    radial-gradient(... rgba(14,165,233, 0.06) ...),   /* Sky */
    var(--bg-app);
}
```

### Détails Techniques

Chaque surface glass combine :
1. **Background** semi-transparent
2. **Backdrop-filter** : `blur()` + `saturate()` + `brightness()`
3. **Bordure** : `1px solid var(--glass-border)`
4. **Inset shadows** : Subtiles reflets blancs internes pour simuler du verre
5. **Drop shadow** (pour les élevés) : Ombre portée profonde

---

## 10. Animations & Transitions

### Durées

| Token | Valeur | Usage |
|---|---|---|
| `instant` | 0ms | Instantané |
| `fastest` | 75ms | Micro-interactions |
| `fast` | 150ms | Hover states, petites animations |
| `normal` | 300ms | La plupart des transitions |
| `slow` | 500ms | Grandes animations, modales |
| `slowest` | 1000ms | Transitions de page |

### Fonctions d'Easing

| Token | Valeur | Tailwind | Usage |
|---|---|---|---|
| `default` | `cubic-bezier(0.4, 0, 0.2, 1)` | `ease-DEFAULT` | Standard |
| `easeOut` | `cubic-bezier(0, 0, 0.2, 1)` | `ease-ease-out` | Décélération douce |
| `easeIn` | `cubic-bezier(0.4, 0, 1, 1)` | `ease-ease-in` | Accélération |
| `easeInOut` | `cubic-bezier(0.4, 0, 0.2, 1)` | `ease-ease-in-out` | Smooth |
| `bounce` | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | `ease-bounce` | Playful |
| `spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | `ease-spring` | Feedback interactif |
| `linear` | `linear` | — | Spinners, loaders |

### Presets de Transition

```tsx
transitions.colors  // color + bg-color + border-color (fast)
transitions.opacity // opacity (normal)
transitions.transform // transform (normal + default easing)
transitions.all     // all (normal + default easing)
transitions.allFast // all (fast + default easing)
transitions.modal   // opacity (normal) + transform (slow + easeOut)
transitions.hover   // background-color (fast)
transitions.focus   // box-shadow (fast)
```

### Animations Keyframe (Tailwind)

| Animation | Classe | Durée | Description |
|---|---|---|---|
| Fade In | `animate-fade-in` | 300ms | Apparition en opacité |
| Fade In Up | `animate-fade-in-up` | 300ms | Apparition + glissement vers le haut |
| Fade In Down | `animate-fade-in-down` | 300ms | Apparition + glissement vers le bas |
| Scale In | `animate-scale-in` | 300ms | Apparition + zoom de 0.95 à 1 |
| Slide In Right | `animate-slide-in-right` | 300ms | Glissement depuis la droite |
| Slide In Left | `animate-slide-in-left` | 300ms | Glissement depuis la gauche |

### Animations Personnalisées (CSS)

| Animation | Classe | Durée | Description |
|---|---|---|---|
| Progress Bar | `animate-progress-loader` | 2.5s, infini | Barre de chargement |
| Light Pulse | `animate-light-pulse` | 2s, infini | Effet pulse lumineux |
| Aurora | `animate-aurora` | 15s, infini | Dégradé animé pour hero |
| Glow Pulse | `animate-glow-pulse` | 3s, infini | Pulsation d'un glow CTA |
| Fade In Up (custom) | `animate-fade-in-up` | 0.6s, forwards | Apparition stagger |
| Typing Cursor | `animate-cursor` | 1s, step-end | Curseur de frappe |
| Float | `animate-float` | 4s, infini | Flottement de badges |

### Délais Staggerés

```css
.delay-100  /* 100ms */
.delay-200  /* 200ms */
.delay-300  /* 300ms */
.delay-400  /* 400ms */
.delay-500  /* 500ms */
```

Utilisés avec `animate-fade-in-up` pour des apparitions séquentielles d'éléments.

---

## 11. Z-Index & Hiérarchie de Couches

### Échelle

| Token | Valeur | Éléments |
|---|---|---|
| `behind` | -1 | Éléments en dessous |
| `base` | 0 | Contenu standard |
| `sticky` | 10 | Headers sticky, status bar |
| `dropdown` | 20 | Dropdowns, popovers, menus contextuels |
| `fixed` | 30 | Sidebars, headers fixes, activity bar |
| `modalBackdrop` | 40 | Fond sombre de modale |
| `modal` | 50 | Contenu de modale |
| `tooltip` | 60 | Tooltips |
| `toast` | 70 | Notifications / toasts |
| `commandPalette` | 80 | Command palette / overlays globaux |
| `max` | 100 | Debug uniquement |

### Mapping Sémantique

```tsx
layerIndex.sidebar       // 30 (fixed)
layerIndex.header        // 30 (fixed)
layerIndex.activityBar   // 30 (fixed)
layerIndex.statusBar     // 10 (sticky)
layerIndex.popover       // 20 (dropdown)
layerIndex.contextMenu   // 20 (dropdown)
layerIndex.modal         // 50 (modal)
layerIndex.notification  // 70 (toast)
layerIndex.globalSearch  // 80 (commandPalette)
```

---

## 12. Système d'Icônes

### Librairie

Le projet utilise **lucide-react** comme librairie d'icônes principale.

### Tailles Standardisées

| Taille | Classes | Contexte |
|---|---|---|
| XS | `w-2.5 h-2.5` | Badges XS |
| Small | `w-3 h-3` | Badges SM, indicateurs inline |
| Default | `w-4 h-4` | Boutons, inputs, listes |
| Medium | `w-5 h-5` | Card headers, actions |
| Large | `w-6 h-6` | Display icons |

### Couleurs d'Icônes

```tsx
// Standard
className="text-text-muted"       // Icônes discrètes
className="text-text-secondary"   // Icônes secondaires
className="text-text-primary"     // Icônes proéminentes

// Sémantiques
className="text-status-success-text"
className="text-status-error-text"
className="text-status-warning-text"
className="text-status-info-text"
```

### Collections d'Icônes

- **CommandIcons** : Icônes par défaut pour la Command Palette
- **ActivityIcons** : Icônes de l'Activity Bar (Files, Search, Git, Extensions, etc.)
- **ToolInvocationIcon** : Icônes mappées par nom d'outil (Search, Pencil, FileText, FolderOpen, GitBranch, Globe, Terminal, etc.)

### Convention

- Les boutons icon-only **doivent** avoir un `aria-label`
- Taille `icon` du Button : `h-8 w-8`
- Attribut `aria-hidden="true"` sur les icônes décoratives

---

## 13. Layouts & Structure des Pages

### Architecture de l'App Shell

#### Desktop (Electron)

```
┌─────────────────────────────────────────────────┐
│                  TitleBar (glass)                │ ← Traffic lights macOS
├────┬────────────────────────────────┬───────────┤
│    │                                │           │
│ P  │                                │  Utility  │
│ r  │     ConversationCenter         │  Sidebar  │
│ o  │     (main content area)        │  (git,    │
│ j  │                                │   files)  │
│ e  │                                │           │
│ c  │                                │           │
│ t  │                                │           │
│    ├────────────────────────────────┤           │
│ S  │       InputBar                 │           │
│ i  │  (chat input + context chips)  │           │
│ d  │                                │           │
│ e  │                                │           │
│ b  │                                │           │
│ a  │                                │           │
│ r  │                                │           │
│    │                                │           │
├────┴────────────────────────────────┴───────────┤
│                 StatusBar                        │
└─────────────────────────────────────────────────┘
```

#### Web (Next.js)

```
┌─────────────────────────────────────────────────┐
│              Sidebar / AppHeader                 │
├─────────────────────────────────────────────────┤
│                                                  │
│                Main Content                      │
│                                                  │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Layout Components

| Composant | Rôle |
|---|---|
| `WorkspaceLayout` | Shell principal de l'espace de travail |
| `ProtectedLayout` | Wrapper avec auth guard |
| `MarketingLayout` | Layout pour les pages marketing (Header + Footer) |
| `TitleBar` | Barre de titre macOS-style avec traffic lights |
| `ProjectSidebar` | Sidebar gauche (projets, conversations) |
| `ProjectUtilitySidebar` | Sidebar droite (git, fichiers liés) |
| `StatusBar` | Barre de statut en bas |
| `ActivityBar` | Barre d'activité VS Code-style |

### Constantes de Layout

```tsx
LAYOUT.sidebar.collapsed   // w-10  (40px)
LAYOUT.sidebar.compact     // w-[200px]
LAYOUT.sidebar.default     // w-[260px]
LAYOUT.sidebar.wide        // w-[300px]
LAYOUT.sidebar.extraWide   // w-[320px]
LAYOUT.tab.min             // min-w-[120px]
LAYOUT.tab.max             // max-w-[200px]
LAYOUT.contextMenu.minWidth // min-w-[160px]
LAYOUT.dropdown.minWidth   // min-w-[180px]
LAYOUT.modal.maxHeight     // max-h-[calc(100vh-3rem)]
LAYOUT.statusBar.height    // h-[22px]
LAYOUT.selector.maxLabelWidth // max-w-[120px]
```

### Patterns de Layout

1. **Flexbox** pour les layouts principaux (3 colonnes)
2. **Grid** pour les diff views et le contenu structuré
3. **Sidebars collapsibles** (gauche et droite)
4. **Panneaux rétractables** (terminal, changes)
5. **Modal overlays** avec backdrop blur

### Région Draggable (Electron)

```css
.app-region-drag    /* Zones draggables pour déplacer la fenêtre */
.app-region-no-drag /* Zones non-draggables (boutons dans la title bar) */
```

---

## 14. Composants UI de Base

### Button

```tsx
import { Button } from '@numezis/ui';

// Variantes
<Button variant="primary">Primary</Button>    // bg-selected, border subtle
<Button variant="secondary">Secondary</Button> // bg-elevated, border subtle
<Button variant="ghost">Ghost</Button>          // Transparent, text only
<Button variant="danger">Danger</Button>        // Error colors

// Tailles
<Button size="xs">XS</Button>   // h-6, text-[10px]
<Button size="sm">SM</Button>   // h-7, text-[11px]
<Button size="md">MD</Button>   // h-9, text-xs (DEFAULT)
<Button size="lg">LG</Button>   // h-11, text-sm
<Button size="icon">           // h-8, w-8
  <Icon className="w-4 h-4" />
</Button>

// Props spéciales
<Button loading>Saving...</Button>    // Spinner + disabled
<Button fullWidth>Full Width</Button> // w-full
```

### Card

```tsx
import { Card, CardHeader, CardContent, CardFooter, StatCard, FeatureCard } from '@numezis/ui';

// Variantes
<Card variant="default">...</Card>    // bg-surface, border-subtle
<Card variant="elevated">...</Card>   // bg-elevated, shadow-md
<Card variant="outlined">...</Card>   // Transparent, border-strong
<Card variant="ghost">...</Card>      // Transparent, no border

// Padding
<Card padding="none">...</Card>
<Card padding="sm">...</Card>   // p-3
<Card padding="md">...</Card>   // p-4 (DEFAULT)
<Card padding="lg">...</Card>   // p-6

// Interactive
<Card interactive>...</Card>  // cursor-pointer, hover effects
<Card selected>...</Card>     // Success border + bg

// Compound
<Card>
  <CardHeader title="Title" subtitle="Description" icon={Settings} action={<Button />} />
  <CardContent>Content here</CardContent>
  <CardFooter><Button>Save</Button></CardFooter>
</Card>

// Presets
<StatCard title="Users" value={1234} change={{ value: "+12%", positive: true }} />
<FeatureCard title="Feature" description="Description" icon={Zap} />
```

### Badge

```tsx
import { Badge, StatusBadge, LoadingBadge } from '@numezis/ui';

// Variantes
<Badge variant="default">Default</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="error">Error</Badge>
<Badge variant="warning">Warning</Badge>
<Badge variant="info">Info</Badge>
<Badge variant="running" showIcon>Running</Badge>  // Avec icône + spin
<Badge variant="completed" showIcon>Done</Badge>
<Badge variant="failed" showIcon>Failed</Badge>

// Options
<Badge size="xs">XS</Badge>  // text-[9px]
<Badge size="sm">SM</Badge>  // text-[10px] (DEFAULT)
<Badge size="md">MD</Badge>  // text-xs
<Badge pill>Pill Badge</Badge>           // rounded-full
<Badge uppercase={false}>Lower</Badge>  // Pas d'uppercase

// Presets
<StatusBadge status="running" />    // Automatique : icône + label + spin
<StatusBadge status="completed" />
<LoadingBadge />                     // "Loading" avec spinner
```

### Modal

```tsx
import { Modal } from '@numezis/ui';

<Modal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="modal-path"           // Petit texte mono en haut
  subtitle="Modal Title"       // Grand titre
  footer={<Button>Save</Button>}
  fullHeight                    // Contenu prend toute la hauteur
>
  <p>Modal content</p>
</Modal>
```

**Caractéristiques** :
- Fermeture par Escape et clic sur backdrop
- Glass elevated background
- Scrollbar elegant dans le body
- Max width `4xl`, max height `calc(100vh - 3rem)`

### Tabs

```tsx
import { Tabs, TabsList, TabTrigger, TabContent } from '@numezis/ui';

<Tabs defaultValue="tab1" variant="default">
  <TabsList>
    <TabTrigger value="tab1">Tab 1</TabTrigger>
    <TabTrigger value="tab2">Tab 2</TabTrigger>
  </TabsList>
  <TabContent value="tab1">Content 1</TabContent>
  <TabContent value="tab2">Content 2</TabContent>
</Tabs>

// Variantes
variant="default"   // Border bottom, selected bg
variant="pills"     // Rounded bg pills
variant="underline" // Underline indicator
variant="segment"   // Segmented control
```

### Toast

```tsx
import { ToastProvider, useToast } from '@numezis/ui';

// Dans le layout
<ToastProvider>
  <App />
</ToastProvider>

// Dans un composant
const { addToast } = useToast();
addToast({ type: 'success', message: 'Saved!' });
```

### Autres Composants de Base

| Composant | Description |
|---|---|
| `Tooltip` | Tooltip au survol |
| `Panel` | Panneau rétractable |
| `Skeleton` | Placeholder de chargement |
| `EmptyState` | État vide avec icône et message |
| `LoadingState` | Spinner de chargement |
| `ErrorState` | Affichage d'erreur avec retry |
| `Avatar` / `AvatarGroup` | Avatar avec initiales ou image |
| `ProgressBar` / `CircularProgress` | Indicateurs de progression |
| `Selector` | Menu de sélection custom |
| `SelectableRow` | Ligne sélectionnable |
| `ContextMenu` | Menu contextuel clic-droit |

---

## 15. Composants de Formulaire

### Input

```tsx
import { Input, SearchInput, PasswordInput } from '@numezis/ui';

// Tailles
<Input size="sm" />   // h-8,  text-xs
<Input size="md" />   // h-10, text-sm (DEFAULT)
<Input size="lg" />   // h-12, text-base

// Variantes
<Input variant="default" />  // bg-surface, border subtle
<Input variant="filled" />   // bg-elevated, border transparent
<Input variant="ghost" />    // Transparent

// États
<Input error errorMessage="Ce champ est requis" />
<Input success />
<Input disabled />

// Icônes
<Input leftIcon={Mail} />
<Input rightIcon={ChevronDown} />

// Clearable
<Input clearable value={val} onClear={() => setVal('')} />

// Full width
<Input fullWidth />

// Presets
<SearchInput placeholder="Rechercher..." />  // leftIcon=Search, clearable
<PasswordInput />  // Toggle show/hide
```

### Patterns de Formulaire

```tsx
// Label + Input + Error
<div className="flex flex-col gap-xs">
  <label className="text-xs font-medium text-text-secondary">Email</label>
  <Input
    type="email"
    error={!!errors.email}
    errorMessage={errors.email}
    placeholder="you@example.com"
    fullWidth
  />
</div>

// Groupe de champs vertical
<div className="flex flex-col gap-base">  {/* 16px entre champs */}
  <Field label="Name" />
  <Field label="Email" />
  <Field label="Password" />
</div>

// Actions de formulaire
<div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-border-subtle">
  <Button variant="ghost">Cancel</Button>
  <Button variant="primary">Save</Button>
</div>
```

### Textarea

```tsx
import { Textarea } from '@numezis/ui';
<Textarea rows={4} placeholder="Describe..." />
```

### Toggle / Switch

```tsx
import { Toggle, Switch } from '@numezis/ui';
<Toggle checked={value} onChange={setValue} />
<Switch checked={value} onChange={setValue} />
```

### Checkbox

```tsx
import { Checkbox, CheckboxGroup, CheckboxGroupItem } from '@numezis/ui';

<Checkbox checked={val} onChange={setVal} label="Accept terms" />

<CheckboxGroup>
  <CheckboxGroupItem value="a" label="Option A" />
  <CheckboxGroupItem value="b" label="Option B" />
</CheckboxGroup>
```

### Radio

```tsx
import { Radio, RadioGroup } from '@numezis/ui';

<RadioGroup value={val} onChange={setVal}>
  <Radio value="option1" label="Option 1" />
  <Radio value="option2" label="Option 2" />
</RadioGroup>
```

### Sélecteurs Spécialisés

| Composant | Description |
|---|---|
| `Selector` | Select custom avec dropdown |
| `LLMSelector` | Sélecteur de modèle LLM (provider + model) |
| `FolderTreePicker` | Sélecteur de dossier en arborescence |

### Convention de Validation

1. **Label** au-dessus de l'input (`text-xs font-medium text-text-secondary`)
2. **Message d'erreur** en dessous (`text-xs text-status-error-text` avec icône AlertCircle)
3. **Bordure** rouge sur erreur (`border-status-error-border`)
4. **Bordure** verte sur succès (`border-status-success-border`)
5. **Icône de statut** automatique à droite (AlertCircle / Check)
6. **Focus ring** : `ring-2 ring-focus-ring/50`

---

## 16. Composants Agent / IA

### ThinkingBubble / ThinkingList

```tsx
import { ThinkingBubble, ThinkingList } from '@numezis/ui';
```

Affiche l'état de réflexion de l'agent IA avec animation violette.

### ToolLog / ToolOutput / ToolInvocation

Affichent les exécutions d'outils avec icônes spécifiques et couleurs amber.

### ChatMessage (MessageBubble / SystemMessage)

Bulles de conversation avec support Markdown, bouton Copy, et distinction user/assistant.

### MarkdownRenderer / CodeBlock

Rendu de Markdown complet avec GFM, blocs de code syntax-highlighted.

### DiffApproval

Interface d'approbation de diffs proposés par l'agent.

### ContextChips

Chips contextuels pour fichiers, dossiers, agents, modèles :

```tsx
import { createFileChip, createFolderChip, createAgentChip } from '@numezis/ui';
```

### InlineCompletion / MultiLineCompletion

Auto-complétion inline style Copilot.

### ThoughtsPanel / TimelinePanel

Panneaux de visualisation de la chaîne de pensée et de la timeline d'exécution.

### AgentTaskQueue

Sidebar de file d'attente des tâches agent.

### ConversationList

Liste des conversations avec un agent.

---

## 17. Composants Command Center

Le Command Center est le **shell principal** de l'application, organisant l'interface en zones fonctionnelles.

| Composant | Rôle |
|---|---|
| `TitleBar` | Barre de titre avec infos git, traffic lights |
| `ProjectSidebar` | Navigation projets + threads de conversation |
| `ConversationTabs` | Onglets de conversation multiples |
| `ConversationCenter` | Zone centrale de conversation |
| `InputBar` | Barre d'entrée avec chips contextuels |
| `ProjectUtilitySidebar` | Sidebar droit (git, fichiers, diffs pending) |
| `InlineDiffReview` | Review de diffs inline |
| `SlashCommandMenu` | Menu de commandes slash |
| `MultimodalMenu` | Menu d'attachements multimodaux |
| `ReviewQueue` | File de review des changements |
| `SkillsManager` | Gestionnaire de skills |
| `AutomationsDashboard` | Dashboard d'automations |
| `AgentGraphSelector` | Sélecteur de graph agent |
| `ReplayConfirmDialog` | Dialogue de confirmation de replay |
| `AddWorkspaceModal` | Modale d'ajout de workspace |
| `GitDiffViewer` | Visualiseur de diffs git |
| `GitChangeTree` | Arbre de fichiers modifiés |
| `UncommittedChangesPanel` | Panneau de changements non-commités |
| `MessageQueue` | File de messages |

---

## 18. Composants IDE-Style

Ces composants reproduisent une interface de type VS Code / Cursor.

| Composant | Description |
|---|---|
| `ActivityBar` + `ActivityIcons` | Barre d'activité latérale avec icônes |
| `CommandPalette` + `CommandIcons` | Palette de commandes (Cmd+K) |
| `FileTree` + `createFileTree` | Arborescence de fichiers |
| `EditorTabs` | Onglets d'éditeur |
| `StatusBar` | Barre de statut en bas |
| `CodeEditor` + `detectLanguage` | Éditeur Monaco |
| `DiffEditor` | Éditeur de diff Monaco |
| `FileBrowser` | Navigateur de fichiers |
| `GitPanel` | Panneau git complet |
| `GitStatusBar` | Barre de statut git |
| `GitBranchSelector` | Sélecteur de branche |
| `GitChangedFiles` | Liste des fichiers modifiés |
| `GitCommitForm` | Formulaire de commit |
| `Breadcrumbs` | Fil d'ariane |
| `WorktreeManager` | Gestionnaire de worktrees |

---

## 19. Système de Variantes (CVA)

### Concept

Le projet utilise **Class Variance Authority (CVA)** pour gérer les variantes de composants de manière type-safe.

### Pattern

```tsx
import { cva, type VariantProps } from 'class-variance-authority';

// 1. Définir les variantes
const buttonVariants = cva(
  // Classes de base
  "inline-flex items-center justify-center rounded-md font-medium transition-colors ...",
  {
    variants: {
      variant: {
        primary: "bg-state-selected text-text-primary ...",
        secondary: "bg-bg-elevated text-text-primary ...",
        ghost: "text-text-secondary hover:text-text-primary ...",
        danger: "bg-status-error-bg text-status-error-text ...",
      },
      size: {
        xs: "h-6 px-2 text-[10px]",
        sm: "h-7 px-3 text-[11px]",
        md: "h-9 px-4 text-xs",
        lg: "h-11 px-6 text-sm",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
);

// 2. Typer les props
interface ButtonProps extends VariantProps<typeof buttonVariants> {
  // ... props additionnelles
}

// 3. Appliquer dans le composant
<button className={buttonVariants({ variant, size, className })} />
```

### Variantes Exportées

Les définitions CVA sont exportées pour permettre la composition :

```tsx
import { buttonVariants, badgeVariants } from '@numezis/ui';

// Utiliser les classes dans un composant custom
<a className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Link</a>
```

---

## 20. Types Partagés

### Types de Taille

```tsx
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type CompactSize = 'xs' | 'sm' | 'md';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';
```

### Types de Variante

```tsx
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type StatusVariant = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'running';
type Emphasis = 'high' | 'medium' | 'low' | 'none';
```

### Props de Base

```tsx
// Tous les composants interactifs héritent de :
interface ComponentBaseProps {
  className?: string;
  disabled?: boolean;
  size?: Size;
}

// Les composants avec support ARIA ajoutent :
interface InteractiveComponentProps extends ComponentBaseProps {
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}
```

---

## 21. CSS Utilitaires Personnalisés

### Scrollbar

```css
/* Global - dark & subtle */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255, 0.06); border-radius: 4px; }

/* Classe utilitaire - plus fin */
.scrollbar-elegant {
  scrollbar-width: thin;
  /* Thumb: 6px, très discret */
}
```

### Gradients

```css
.text-gradient     /* Gradient text (Sky → Indigo → Violet) */
.bg-hero-gradient  /* Gradient de fond hero */
.bg-grid-pattern   /* Pattern de grille subtile */
.bg-eu-gradient    /* Gradient EU blue */
```

### Effets

```css
.glow-primary      /* Glow Sky + Indigo */
.glow-eu           /* Glow bleu EU */
.badge-glow:hover  /* Glow sur hover avec currentColor */
.feature-card      /* Scale 1.02 au hover */
```

### Autofill Fix (Dark Mode)

```css
input:-webkit-autofill {
  -webkit-box-shadow: 0 0 0 1000px var(--bg-elevated) inset !important;
  -webkit-text-fill-color: var(--text-primary) !important;
}
```

---

## 22. Patterns & Conventions

### Naming Convention des Classes Tailwind

```tsx
// Couleurs : {role}-{token}
"bg-bg-surface"          // Background → surface
"text-text-primary"      // Text → primary
"border-border-subtle"   // Border → subtle
"bg-state-hover"         // Background → state hover
"text-status-error-text" // Text → status error text

// Agent
"bg-agent-thinking-bg"
"border-agent-tool-border"

// Brand
"bg-brand-accent"
"text-brand-accent"
```

### Pattern de Composant

```tsx
// 1. Import des deps
import React from 'react';
import { cn } from '../../lib/utils';

// 2. Types
export interface MyComponentProps {
  variant?: 'default' | 'alt';
  className?: string;
  children: React.ReactNode;
}

// 3. Composant avec forwardRef si interactif
export const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ variant = 'default', className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base
          'rounded-lg transition-all',
          // Variant
          variant === 'default' && 'bg-bg-surface border border-border-subtle',
          variant === 'alt' && 'bg-bg-elevated',
          // Custom
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

MyComponent.displayName = 'MyComponent';
```

### Pattern Compound Component

```tsx
// Context
const TabsContext = createContext<TabsContextValue | null>(null);

// Parent
export function Tabs({ children, ...props }) {
  return (
    <TabsContext.Provider value={...}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

// Enfants
export function TabTrigger({ value, children }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabTrigger must be used within Tabs');
  // ...
}
```

### Pattern Factory

```tsx
// Pour créer des données complexes de composants
import { createFileChip, createFolderChip } from '@numezis/ui';

const chips = [
  createFileChip('src/App.tsx'),
  createFolderChip('src/components'),
];
```

### Accessibilité

- `aria-label` sur tous les boutons icon-only
- `role="tablist"` / `role="tab"` / `role="tabpanel"` sur les Tabs
- `aria-selected` sur les triggers de tabs
- `aria-hidden="true"` sur les icônes décoratives
- Focus visible via `focus-visible:ring-2 focus-visible:ring-focus-ring`
- Gestion du focus trap dans les modales (Escape pour fermer)

### Mode Compact / Densité

```css
--sidebar-density-padding: 6px 8px;
--sidebar-density-gap: 4px;
--sidebar-density-font: 12px;
--sidebar-density-icon: 16px;
```

Le mode compact est togglable dans les settings et ajuste les paddings/gaps de la sidebar.

---

## 23. Imports & Utilisation

### Depuis `@numezis/ui`

```tsx
// Composants
import { Button, Card, Input, Badge, Modal, Tabs } from '@numezis/ui';

// Types
import type { Size, Variant, StatusVariant } from '@numezis/ui';

// Constantes de layout
import { LAYOUT, FONT_SIZES } from '@numezis/ui';

// Variantes CVA (pour composition)
import { buttonVariants, badgeVariants } from '@numezis/ui';

// Tokens
import { tokens, colors, spacing, typography, motion, shadows, zIndex } from '@numezis/ui';

// Command Center
import { TitleBar, ProjectSidebar, InputBar } from '@numezis/ui';
```

### Depuis `@numezis/ui/tokens`

```tsx
import { colors, spacing, radius, typography, motion, shadows, zIndex, glass } from '@numezis/ui/tokens';
import { rawColors, rawRadius, rawDuration } from '@numezis/ui/tokens';
import { componentSpacing, componentRadius, componentShadows } from '@numezis/ui/tokens';
import { textStyles, fontFamily, fontSize, fontWeight } from '@numezis/ui/tokens';
```

### Utilitaire `cn()`

```tsx
import { cn } from '@numezis/ui/lib/utils';

// Merge conditionnel de classes
className={cn(
  'base-class',
  isActive && 'active-class',
  variant === 'primary' && 'primary-class',
  className  // permet override depuis les props
)}
```

---

## Résumé Visuel

```
Numezis Design System
│
├── 🎨 Couleurs     → Zinc dark + Teal accent + Agent semantic colors
├── 📐 Spacing      → 4px base, 14 niveaux (0→96px)
├── 🔤 Typographie  → SF Pro Display/Text + SF Mono, 14px base
├── ⬜ Radius       → 2px→12px + full, sémantique par composant
├── 🌑 Ombres       → Calibrées dark mode, + glows sémantiques
├── 🪟 Glass        → Backdrop-blur frosted surfaces
├── ✨ Animations   → 6 durées, 7 easings, 10+ keyframes
├── 📚 Z-Index      → 10 niveaux (-1 → 100)
├── 🧩 Composants   → 60+ composants (UI + Agent + IDE + CommandCenter)
├── 📋 Formulaires  → Input/Search/Password + Checkbox/Radio/Toggle/Selector
├── 🏗️ Layouts      → 3-pane workspace, glass sidebars, collapsible panels
└── 🔧 Outils       → Tailwind preset, CVA variants, cn() utility, tokens
```
