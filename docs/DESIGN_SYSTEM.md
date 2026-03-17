# Kletron Design System

## Overview

Kletron follows a **subdued, Cursor-like aesthetic** with muted colors, minimal visual noise, and a focus on content over decoration. The design prioritizes:

- **Clarity over flash** — No vibrant gradients or attention-grabbing effects
- **Consistency** — Same visual language across all pages and components
- **Professional restraint** — Subtle borders, muted colors, minimal shadows

---

## Color Palette

### Semantic Color Variables

All colors use CSS custom properties defined in `globals.css`:

```css
/* Backgrounds */
--bg-app: #0a0a0a;        /* Main app background */
--bg-surface: #111111;    /* Card/surface backgrounds */
--bg-elevated: #1a1a1a;   /* Elevated elements, icons */

/* Text */
--text-primary: #fafafa;   /* Main headings, primary text */
--text-secondary: #d4d4d4; /* Secondary text, labels */
--text-muted: #737373;     /* Muted text, descriptions */

/* Borders */
--border-subtle: #262626;  /* Standard borders */

/* States */
--state-hover: #1f1f1f;    /* Hover state background */
```

### Accent Colors (Use Sparingly!)

- **Emerald (green)** — Only for positive states: checkmarks, success, "current" indicators
- **Red** — Only for errors, warnings, compliance risks
- **Amber** — Only for partial/warning states

**Rule**: Avoid sky-blue, violet, or other accent colors. Keep the palette monochromatic with emerald as the only accent.

---

## Typography

### Font Sizes

| Usage | Size | Class |
|-------|------|-------|
| Hero headline | 24-30px | `text-2xl sm:text-3xl` |
| Section headline | 18-24px | `text-lg sm:text-2xl` |
| Card title | 14px | `text-sm font-semibold` |
| Body text | 14px | `text-sm` |
| Description | 12px | `text-xs` |
| Badge/Label | 10-11px | `text-[10px]` or `text-[11px]` |

### Font Weights

- **Headings**: `font-semibold` (600)
- **Labels/Badges**: `font-medium` (500)
- **Body**: Default (400)

### Text Colors

```jsx
// Primary text - headings, important content
<h1 className="text-text-primary">...</h1>

// Secondary text - labels, supporting content
<span className="text-text-secondary">...</span>

// Muted text - descriptions, timestamps
<p className="text-text-muted">...</p>
```

---

## Component Patterns

### Cards

```jsx
<div className="p-5 rounded-lg border border-border-subtle bg-bg-surface">
  {/* Card content */}
</div>
```

- **Padding**: `p-4` to `p-6`
- **Border radius**: `rounded-lg` (8px)
- **Border**: `border border-border-subtle`
- **Background**: `bg-bg-surface`

### Icon Boxes

```jsx
<div className="w-8 h-8 rounded-md bg-bg-elevated border border-border-subtle flex items-center justify-center text-text-muted">
  🛡️
</div>
```

- **Size**: `w-8 h-8` (32px)
- **Border radius**: `rounded-md` (6px)
- **Background**: `bg-bg-elevated`
- **Text/icon color**: `text-text-muted`

### Badges/Labels

```jsx
<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-subtle bg-bg-surface text-xs text-text-muted">
  Label Text
</div>
```

### Buttons

**Primary Button:**
```jsx
<button className="rounded-md bg-text-primary text-bg-app px-4 py-2 text-sm font-medium hover:bg-text-secondary transition-colors">
  Primary Action
</button>
```

**Secondary Button:**
```jsx
<button className="rounded-md bg-bg-elevated hover:bg-state-hover border border-border-subtle px-4 py-2 text-sm font-medium text-text-primary transition-colors">
  Secondary Action
</button>
```

---

## Layout Principles

### Spacing

- **Section padding**: `py-20` to `py-24`
- **Container max-width**: `max-w-4xl` to `max-w-5xl`
- **Grid gaps**: `gap-3` to `gap-4`
- **Card padding**: `p-4` to `p-6`

### Responsive Breakpoints

```jsx
<div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* Responsive grid */}
</div>
```

### Section Separators

Use subtle borders between sections:

```jsx
<section className="py-20 px-6 border-y border-border-subtle">
```

---

## Do's and Don'ts

### ✅ DO

- Use muted, monochromatic colors
- Keep text small (`text-xs` to `text-sm`)
- Use subtle borders for visual separation
- Keep spacing tight and consistent
- Use emerald sparingly for positive states

### ❌ DON'T

- Use vibrant gradients or glowing effects
- Use multiple accent colors (sky, violet, etc.)
- Make elements "pop" with bright backgrounds
- Use large text sizes (larger than 30px)
- Add shadows or 3D effects
- Use glassmorphism or blur effects

---

## Page-Specific Guidelines

### Landing Page

- Hero: Large headline, muted description, two CTA buttons
- Features: 2-column grid with icon boxes
- Sections: Separated by subtle borders
- CTAs: Primary button style, not colorful

### Authenticated App

- Sidebar: Fixed left, dark background
- Content area: Full height, padded
- Cards: Use `bg-bg-surface` consistently

---

## CSS Variables Reference

Add these to your `globals.css`:

```css
:root {
  /* Backgrounds */
  --bg-app: #0a0a0a;
  --bg-surface: #111111;
  --bg-elevated: #1a1a1a;

  /* Text */
  --text-primary: #fafafa;
  --text-secondary: #d4d4d4;
  --text-muted: #737373;

  /* Borders */
  --border-subtle: #262626;

  /* States */
  --state-hover: #1f1f1f;
}
```

---

## Quick Reference Cheat Sheet

| Element | Classes |
|---------|---------|
| Card | `p-5 rounded-lg border border-border-subtle bg-bg-surface` |
| Icon box | `w-8 h-8 rounded-md bg-bg-elevated border border-border-subtle` |
| Badge | `px-3 py-1.5 rounded-md border border-border-subtle bg-bg-surface text-xs text-text-muted` |
| Primary btn | `rounded-md bg-text-primary text-bg-app px-4 py-2 text-sm font-medium` |
| Section | `py-20 px-6 border-y border-border-subtle` |
| Heading | `text-2xl font-semibold text-text-primary` |
| Subheading | `text-sm font-semibold text-text-primary` |
| Body | `text-xs text-text-muted` |
