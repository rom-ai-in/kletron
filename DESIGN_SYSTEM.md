# Numezis Design System Architecture

> How the design system and frontend UI are managed across the monorepo.

---

## Overview

The Numezis design system follows a **single source of truth** architecture where all UI primitives, tokens, and components live in `@numezis/ui` and are consumed by two frontend applications:

```
packages/ui/          ← Design system (source of truth)
├── tokens/           ← TypeScript token definitions
├── styles/           ← Generated CSS variables
├── components/       ← All shared React components
├── hooks/            ← Theme provider, shared hooks
├── context/          ← Auth context, etc.
└── tailwind-preset   ← Shared Tailwind config

apps/web/             ← Next.js web application
apps/desktop/         ← Electron desktop application
```

Both apps import components, tokens, and styles from `@numezis/ui`. Neither app should define its own UI primitives.

---

## Token Pipeline

Tokens flow from TypeScript definitions → CSS variables → Tailwind classes:

```
┌─────────────────────┐     generate:tokens     ┌──────────────────────┐
│ tokens/*.ts          │ ────────────────────►   │ styles/tokens.css    │
│ (TypeScript source)  │                         │ (CSS custom props)   │
└─────────────────────┘                          └──────────────────────┘
         │                                                │
         ▼                                                ▼
┌─────────────────────┐                          ┌──────────────────────┐
│ tailwind-preset.ts   │                          │ apps import CSS      │
│ (maps vars to TW)   │                          │ @import tokens.css   │
└─────────────────────┘                          └──────────────────────┘
         │
         ▼
┌─────────────────────┐
│ apps/*/tailwind.config│
│ presets: [preset]    │
└─────────────────────┘
```

### Step 1: Define tokens in TypeScript

All design tokens are defined as TypeScript constants in `packages/ui/src/tokens/`:

| File | Contents |
|------|----------|
| `colors.ts` | Surfaces (`bg-app`, `bg-surface`, `bg-elevated`), borders, text, states, status, chain, IDE, brand, agent |
| `spacing.ts` | 4px base scale, component spacing |
| `typography.ts` | Font families, sizes, weights, line heights |
| `motion.ts` | Durations, easing curves, transition presets, keyframes |
| `radius.ts` | Border radius tokens |
| `shadows.ts` | Elevation shadows |
| `z-index.ts` | Layering values |

Tokens reference CSS custom properties (`var(--bg-app)`), meaning they resolve at runtime and support theming.

### Step 2: Generate CSS variables

Running `npm run generate:tokens` in `packages/ui` executes `scripts/generate-css.ts`, which produces `src/styles/tokens.css` — a single CSS file defining every custom property:

```css
:root {
  --bg-app: #09090b;
  --bg-surface: #18181b;
  --bg-elevated: #27272a;
  --border-subtle: rgba(255, 255, 255, 0.08);
  --text-primary: #e4e4e7;
  --status-success: #22c55e;
  /* ... 100+ variables */
}
```

### Step 3: Tailwind preset maps CSS vars to utility classes

`packages/ui/src/tailwind-preset.ts` is a shared Tailwind preset that maps every CSS variable to a Tailwind utility:

```ts
colors: {
  bg: {
    app: 'var(--bg-app)',       // → class: bg-bg-app
    surface: 'var(--bg-surface)',
    elevated: 'var(--bg-elevated)',
  },
  text: {
    primary: 'var(--text-primary)',  // → class: text-text-primary
    secondary: 'var(--text-secondary)',
    muted: 'var(--text-muted)',
  },
  status: {
    success: { DEFAULT, bg, border, text },
    error:   { DEFAULT, bg, border, text },
    warning: { DEFAULT, bg, border, text },
    info:    { DEFAULT, bg, border, text },
  },
  // + diff colors, chain colors, brand colors, agent colors
}
```

### Step 4: Apps extend the preset

Both apps have a minimal `tailwind.config.js` that extends the shared preset:

```js
// apps/web/tailwind.config.js  (identical pattern in apps/desktop/)
import preset from '../../packages/ui/src/tailwind-preset.ts';
export default {
  presets: [preset],
  content: [
    './app/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};
```

### Step 5: Apps import the CSS

Each app's root stylesheet imports the generated tokens:

```css
/* apps/desktop/src/app/styles.css */
@import '@numezis/ui/styles/tokens.css';
@import '@numezis/ui/styles/scrollbar.css';
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

## Theming

The `ThemeProvider` in `packages/ui/src/hooks/useTheme.tsx` manages dark/light/system modes:

- Applies `dark` or `light` class on `<html>` (Tailwind's `darkMode: 'class'` strategy)
- Persists user choice in `localStorage` (`numezis-theme`)
- Includes `themeScript` — an inline script injected in `<head>` to prevent flash of wrong theme on SSR

```tsx
// apps/web/app/layout.tsx
<html>
  <head>
    <script dangerouslySetInnerHTML={{ __html: themeScript }} />
  </head>
  <body className="bg-bg-app">
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </ThemeProvider>
  </body>
</html>
```

---

## Component Architecture

### Directory structure

```
packages/ui/src/components/
├── ui/                   (43 files) — Core primitives & workspace
│   ├── Button.tsx              CVA-based button with variants
│   ├── Input.tsx               Input, SearchInput, PasswordInput
│   ├── Badge.tsx               Badge, StatusBadge, LoadingBadge
│   ├── Card.tsx                Card, CardHeader, CardContent, CardFooter
│   ├── ChatInput.tsx           Chat input with send/stop/footer slots
│   ├── WorkspaceLayout.tsx     4-region layout (header/sidebar/content/aside)
│   ├── ThreadFeed.tsx          Conversation thread list
│   ├── MarketingLayout.tsx     MarketingHeader + MarketingFooter
│   ├── TrafficLights.tsx       macOS window controls
│   ├── CodeEditor.tsx          Monaco-based editor
│   ├── DiffEditor.tsx          Side-by-side diff
│   ├── GitPanel.tsx            Git status/branch/commit
│   ├── LLMSelector.tsx         Model/provider picker
│   └── ...                     (EmptyState, Toast, Tooltip, Modal, etc.)
│
├── Agent/                (18 files) — AI chat & agent interactions
│   ├── ChatMessage.tsx         MessageBubble, SystemMessage, CopyButton
│   ├── MarkdownRenderer.tsx    Shared react-markdown with DS overrides
│   ├── ToolInvocation.tsx      Collapsible tool call with rich rendering
│   ├── MessageList.tsx         Auto-scroll container + tool pairing
│   ├── ActiveSession.tsx       Full chat session (web production)
│   ├── CodeBlock.tsx           Syntax-highlighted code with copy
│   ├── ToolOutput.tsx          Raw tool output display
│   ├── ThoughtsPanel.tsx       Reasoning/thinking display
│   ├── DiffApproval.tsx        File diff with approve/reject
│   ├── ContextChips.tsx        File/folder/model context tags
│   └── ...                     (ThinkingBubble, ToolLog, metrics, etc.)
│
└── context/              (2 files) — Trace/context visualization
    ├── ContextTracePanel.tsx
    └── ContextVisualizer.tsx
```

### Barrel file

All public exports go through a single barrel: `packages/ui/src/components/design-system.ts`

It is organized into clearly labeled sections:

```
// ── Design Tokens ──
// ── Core UI Components ── (Button, Badge, Input, Card, Toast, ...)
// ── Workspace Components ── (ChatInput, ThreadFeed, WorkspaceLayout, ...)
// ── Tooling Components ── (CommandPalette, FileTree, EditorTabs, ...)
// ── Agent Components ── (ThinkingBubble, ToolLog, DiffApproval, ...)
// ── Chat Agent Primitives ── (CodeBlock, ToolOutput, ThoughtsPanel, ...)
// ── Chat Message Components ── (MessageBubble, SystemMessage, CopyButton)
// ── Markdown Renderer ──
// ── Tool Invocation ──
// ── Message List ──
// ── Editor Components ── (CodeEditor, DiffEditor)
// ── File Browser ──
// ── Git Components ──
// ── Settings Components ── (LLMSelector, MCPServerConfig, ...)
// ── Layout Components ── (Breadcrumbs, MarketingHeader/Footer, TrafficLights)
```

### How to import

Always import from the barrel for application code:

```tsx
import {
  Button,
  Input,
  ToolInvocation,
  MarkdownRenderer,
  MessageBubble,
} from '@numezis/ui/components/design-system';
```

Deep imports are available for performance-sensitive contexts:

```tsx
import { Button } from '@numezis/ui/components/ui/Button';
```

---

## Build System

`packages/ui` uses **tsup** for library builds:

| Setting | Value |
|---------|-------|
| Format | ESM only |
| Declarations | `.d.ts` generated |
| Code splitting | Enabled |
| Tree-shaking | Enabled |
| Externals | react, react-dom, lucide-react, monaco-editor |

Entry points:

```
src/index.ts                    → dist/index.js
src/tokens/index.ts             → dist/tokens/index.js
src/types.ts                    → dist/types.js
src/components/design-system.ts → dist/components/design-system.js
src/tailwind-preset.ts          → dist/tailwind-preset.js
```

Package exports in `package.json`:

```json
{
  ".": "./src/index.ts",
  "./tokens": "./src/tokens/index.ts",
  "./components/*": "./src/components/*",
  "./hooks/*": "./src/hooks/*",
  "./context/*": "./src/context/*",
  "./styles/*": "./src/styles/*",
  "./tailwind-preset": "./src/tailwind-preset.ts"
}
```

---

## How Frontend Apps Consume the Design System

### Desktop App (`apps/desktop`)

- **Framework:** React + Vite + Electron
- **CSS:** `styles.css` imports `@numezis/ui/styles/tokens.css` + scrollbar styles
- **Tailwind:** Extends shared preset
- **Components:** Imported from `@numezis/ui/components/design-system`
- **All tool rendering** uses shared `ToolInvocation`
- **All markdown** uses shared `MarkdownRenderer`
- **macOS chrome** uses shared `TrafficLights`

### Web App (`apps/web`)

- **Framework:** Next.js (App Router)
- **CSS:** `globals.css` imports tokens
- **Tailwind:** Extends shared preset
- **Components:** Imported from `@numezis/ui/components/design-system`
- **Auth pages** use `Input`, `PasswordInput`, `Button`, `Checkbox`
- **Account pages** use `Button`, `Switch`, `Badge`, `PasswordInput`
- **Marketing pages** use `MarketingHeader`, `MarketingFooter`
- **Legal pages** use `MarketingHeader`, `MarketingFooter`
- **Production chat** (`ActiveSession.tsx`) uses shared `ToolInvocation`, `MarkdownRenderer`, `CopyButton`

---

## Design System Portal

A live showcase of all design system components is available at `/design-system` in the web app:

| Tab | Contents |
|-----|----------|
| **Foundation** | Color tokens, spacing, typography, motion |
| **Components** | Core UI primitives (Button, Input, Badge, Card, ...) |
| **Agent** | AI agent components (ToolLog, DiffApproval, CodeBlock, ...) |
| **Mac App** | Desktop app layout demo with real shared components |
| **Portal** | Explore chat + deep agent UI patterns |
| **Patterns** | Composite patterns and best practices |
| **IDE** | Editor components (CodeEditor, DiffEditor, FileTree) |

The demo pages use the **real shared components** from `@numezis/ui`, not mocks.

---

## Rules for Contributors

1. **Never create inline UI.** All buttons, inputs, cards, badges, toggles, and status indicators must come from `@numezis/ui`.

2. **Never use hardcoded colors.** Use semantic token classes:
   - `bg-bg-app`, `bg-bg-surface`, `bg-bg-elevated` (surfaces)
   - `text-text-primary`, `text-text-secondary`, `text-text-muted` (text)
   - `border-border-subtle`, `border-border-strong` (borders)
   - `bg-status-success-bg`, `text-status-error-text` (status)
   - Avoid raw Tailwind colors (`red-500`, `green-500`, etc.)

3. **Import from the barrel.** Use `@numezis/ui/components/design-system` for application code.

4. **New components go in `packages/ui/src/components/`.** Add them to the barrel file with the appropriate section. Core primitives go in `ui/`, agent/chat components go in `Agent/`.

5. **Token changes flow through the pipeline.** Edit `tokens/*.ts` → run `generate:tokens` → the CSS and Tailwind classes update automatically.

6. **Test in the portal.** Add a demo to the relevant design system tab when creating new components.
