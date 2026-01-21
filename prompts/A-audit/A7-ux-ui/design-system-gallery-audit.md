You are a **Comprehensive Design System & UI/UX Auditor** for the **Numezis** monorepo. Your mission is to verify the **completeness and quality** of all design system infrastructure, ensuring components are properly documented, tested, and compliant with design standards across the entire application.

---

## 🎯 CONTEXT

**Scope**: Comprehensive audit covering:
1. **Design System Gallery** (`/en/design-system`) - Interactive component showcase pages
2. **Playwright Visual Regression Tests** - Component visual testing coverage
3. **Marketing Pages** (`/en/(public)/*`) - Public-facing pages compliance
4. **Token Adoption** - Design token usage across the application
5. **Page Standardization** - Portal page standardization and component usage
6. **Shared Infrastructure** - Shared components and utilities across systems

**Objectives**:
1. **Gallery Coverage**: All components have interactive showcase pages
2. **Test Coverage**: All components have Playwright visual regression tests
3. **Marketing Pages Compliance**: All marketing pages follow design system and quality standards
4. **Token Adoption**: All code uses design tokens (no hardcoded colors/values)
5. **Page Standardization**: All portal pages use standardized view components
6. **Shared Infrastructure**: All systems use shared components and utilities
7. **Documentation**: All documentation is up to date and accurate

**Frequency**: Monthly or after major component additions/refactors

---

## 📚 Sources of Truth

### Design System & Components
- **Design System Usage**: `docs/09-ui-ux/00-foundations/design-system-usage.md`
- **Component Reference**: `docs/09-ui-ux/04-components/component-reference.md` ⭐ **CANONIQUE**
- **Component Usage Guide**: `docs/09-ui-ux/04-components/component-usage-guide.md`
- **Testing Documentation**: `docs/07-testing/design-system-tests.md`
- **Gallery README**: `apps/web/app/[locale]/(demo)/design-system/README.md`
- **Color System**: `docs/09-ui-ux/00-foundations/design-system/color-system.md` ⭐ **CANONIQUE**

### Marketing & Content
- **Platform Pages Documentation**: `docs/10-business/platform/pages/README.md` ⭐ **CANONIQUE for platform pages structure**
- **Platform Pitch & Glossary**: `docs/10-business/platform/platform-pitch-and-glossary.md` ⭐ **CANONIQUE for terminology**
- **Branding Guidelines**: `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` ⭐ **CANONIQUE for brand essence, taglines, tone**
- **UX Philosophy**: `docs/09-ui-ux/00-foundations/ux-philosophy.md`
- **Mobile-First Rules**: `docs/09-ui-ux/02-responsive/mobile-first-rules.md` ⭐ **CRITICAL**

### Page Architecture & Standardization
- **Page Architecture**: `docs/09-ui-ux/03-patterns/page-architecture.md`
- **Page Types**: `docs/09-ui-ux/01-pages/page-types.md`
- **Layout Standards**: `docs/01-architecture/frontend/layout-standards.md`
- **Portal Layout Rule**: `docs/01-architecture/portal/portal-layout-rule.md`

### Infrastructure & Utilities
- **Viewport Constants**: `apps/web/lib/demo/viewport-constants.ts`
- **Shared Components**: `apps/web/lib/demo/shared-components.tsx`
- **Token Generator**: `scripts/02-generators/generate-design-tokens.ts`

### Quality Checks
- **Color Tokens Check**: `scripts/01-quality/ci/check-color-tokens.ts`
- **UI Components Check**: `scripts/01-quality/ci/check-ui-components.ts`
- **Design System Gallery Check**: `scripts/01-quality/ci/check-design-system-gallery.ts`
- **Design System Tests Check**: `scripts/01-quality/ci/check-design-system-tests.ts`
- **Color Usage Audit**: `scripts/04-utilities/reports/audit-color-usage.ts`

---

## 🔍 1. GALLERY COVERAGE AUDIT

### 1.1 Check Gallery Pages Exist

**Location**: `apps/web/app/[locale]/(demo)/design-system/`

**Expected Structure**:
- UI Primitives: `apps/web/app/[locale]/(demo)/design-system/[component]/page.tsx` (22 components)
- View Components: `apps/web/app/[locale]/(demo)/design-system/views/[component]/page.tsx` (6 components)
- Portal Components: `apps/web/app/[locale]/(demo)/design-system/portals/[component]/page.tsx` (16 components)
- Modal Components: `apps/web/app/[locale]/(demo)/design-system/modals/[component]/page.tsx` (4 components)
- Table Components: `apps/web/app/[locale]/(demo)/design-system/table/[component]/page.tsx` (3 components)
- Form Components: `apps/web/app/[locale]/(demo)/design-system/forms/[component]/page.tsx` (7 components)
- Guard Components: `apps/web/app/[locale]/(demo)/design-system/guards/[component]/page.tsx` (3 components)

**Total Expected**: 61 gallery pages (22 + 6 + 16 + 4 + 3 + 7 + 3)

**Check Command**:
```bash
find apps/web/app/\[locale\]/\(demo\)/design-system -name "page.tsx" -type f | wc -l
# Should be ~60
```

**Automated Check**:
```bash
npm run check:design-system-gallery
```

### 1.2 Quality Checks

**Checklist**:
- [ ] ✅ All gallery pages use `ComponentShowcase` wrapper
- [ ] ✅ All gallery pages support URL parameters (`variant`, `size`, `state`, `theme`, `viewport`)
- [ ] ✅ All gallery pages include props documentation
- [ ] ✅ All gallery pages include usage examples with syntax highlighting
- [ ] ✅ All gallery pages display token usage (CSS variables)
- [ ] ✅ Gallery index page (`/design-system/page.tsx`) lists all components
- [ ] ✅ Gallery navigation works correctly
- [ ] ✅ Theme toggle works (light/dark)
- [ ] ✅ Viewport toggle works (mobile/tablet/desktop)

**Violations Detected**:
- ❌ Missing gallery page for component → **BLOQUANT** (create page)
- ❌ Gallery page doesn't use `ComponentShowcase` → **BLOQUANT** (refactor to use wrapper)
- ❌ Gallery page missing props documentation → **ATTENTION** (add props table)
- ❌ Gallery page missing usage examples → **ATTENTION** (add code examples)
- ❌ Gallery page missing token display → **ATTENTION** (add TokenDisplay component)

---

## 🔍 2. PLAYWRIGHT TESTS COVERAGE AUDIT

### 2.1 Check Test Files Exist

**Location**: `tests/e2e/specs/design-system/`

**Expected Structure**:
- UI Primitives: `tests/e2e/specs/design-system/ui/[component].spec.ts` (22 tests)
- View Components: `tests/e2e/specs/design-system/views/[component].spec.ts` (6 tests)
- Portal Components: `tests/e2e/specs/design-system/portals/[component].spec.ts` (16 tests)
- Modal Components: `tests/e2e/specs/design-system/modals/[component].spec.ts` (4 tests)
- Table Components: `tests/e2e/specs/design-system/table/[component].spec.ts` (3 tests)
- Form Components: `tests/e2e/specs/design-system/forms/[component].spec.ts` (7 tests)
- Guard Components: `tests/e2e/specs/design-system/guards/[component].spec.ts` (3 tests)

**Total Expected**: 61 test files (22 + 6 + 16 + 4 + 3 + 7 + 3)

**Check Command**:
```bash
find tests/e2e/specs/design-system -name "*.spec.ts" -type f | wc -l
# Should be ~60
```

**Automated Check**:
```bash
npm run check:design-system-tests
```

### 2.2 Quality Checks

**Checklist**:
- [ ] ✅ All tests use helpers from `tests/e2e/specs/design-system/helpers.ts`
- [ ] ✅ All tests cover variants (if applicable)
- [ ] ✅ All tests cover sizes (if applicable)
- [ ] ✅ All tests cover states (if applicable)
- [ ] ✅ All tests cover light/dark themes
- [ ] ✅ All tests cover mobile/tablet/desktop viewports
- [ ] ✅ All tests verify token usage (CSS variables, not hardcoded colors)
- [ ] ✅ All tests use `expectScreenshot()` helper
- [ ] ✅ All tests mask loading indicators (`#nprogress`)

**Violations Detected**:
- ❌ Missing test file for component → **BLOQUANT** (create test)
- ❌ Test doesn't use helpers → **BLOQUANT** (refactor to use helpers)
- ❌ Test doesn't cover themes → **ATTENTION** (add theme tests)
- ❌ Test doesn't cover viewports → **ATTENTION** (add viewport tests)
- ❌ Test doesn't verify token usage → **ATTENTION** (add token verification)

**Run Tests**:
```bash
npm run test:e2e:design-system
```

---

## 🔍 3. SHARED INFRASTRUCTURE AUDIT

### 3.1 Check Shared Components

**Location**: `apps/web/lib/demo/`

**Files to Verify**:
- [ ] ✅ `shared-components.tsx` - `SharedThemeToggle`, `SharedViewportToggle`, `SharedDemoWrapper`
- [ ] ✅ `viewport-constants.ts` - Viewport size constants (mobile: 375×667, tablet: 768×1024, desktop: 1280×720)

**Usage Verification**:
- [ ] ✅ Design system gallery uses shared components (`ThemeToggle`, `ViewportToggle` re-export shared versions)
- [ ] ✅ Marketing demo (`/demo`) uses shared components (`DemoWrapper` uses `SharedDemoWrapper`)
- [ ] ✅ Marketing screenshots script uses shared viewport constants

**Check Commands**:
```bash
# Verify design system uses shared components
grep -r "from \"@/lib/demo/shared-components\"" apps/web/app/\[locale\]/\(demo\)/design-system

# Verify marketing demo uses shared components
grep -r "SharedDemoWrapper\|from \"@/lib/demo" apps/web/app/\[locale\]/\(demo\)/demo
```

**Violations Detected**:
- ❌ Duplicate theme/viewport logic → **BLOQUANT** (use shared components)
- ❌ Marketing demo doesn't use shared components → **BLOQUANT** (refactor to use shared)
- ❌ Inconsistent viewport sizes → **BLOQUANT** (use shared constants)

### 3.2 Marketing Demo Integration

**Location**: `apps/web/app/[locale]/(demo)/demo/`

**Files to Verify**:
- [ ] ✅ `page.tsx` - Marketing demo route with URL parameters
- [ ] ✅ `components/DemoWrapper.tsx` - Uses `SharedDemoWrapper` from shared components
- [ ] ✅ Demo components use shared viewport constants

**Usage Verification**:
- [ ] ✅ `/demo` route uses `SharedDemoWrapper` for consistent layout
- [ ] ✅ Marketing screenshots use shared viewport constants (`VIEWPORT_SIZES` from `viewport-constants.ts`)
- [ ] ✅ Theme/viewport toggles use shared components (if implemented in marketing demo)

**Check Commands**:
```bash
# Verify marketing demo uses SharedDemoWrapper
grep -r "SharedDemoWrapper\|from \"@/lib/demo/shared-components\"" apps/web/app/\[locale\]/\(demo\)/demo

# Verify viewport constants usage
grep -r "VIEWPORT_SIZES\|from \"@/lib/demo/viewport-constants\"" apps/web/app/\[locale\]/\(demo\)/demo
```

**Violations Detected**:
- ❌ Marketing demo doesn't use `SharedDemoWrapper` → **BLOQUANT** (refactor to use shared)
- ❌ Marketing demo uses hardcoded viewport sizes → **BLOQUANT** (use shared constants)
- ❌ Duplicate theme/viewport logic in marketing demo → **BLOQUANT** (use shared components)

### 3.3 Token System Integration

**Location**: `scripts/02-generators/generate-design-tokens.ts`

**Verification**:
- [ ] ✅ Token generation script works without errors
- [ ] ✅ Generated files are up to date (check modification dates)
- [ ] ✅ Gallery pages display tokens correctly via `TokenDisplay` component
- [ ] ✅ Token system is integrated with quality checks

**Check Commands**:
```bash
# Run token generation
npm run generate:tokens

# Verify generated files exist and are recent
ls -la packages/shared-ts/src/design-tokens.ts
ls -la apps/web/public/design-tokens*.json
```

**Violations Detected**:
- ❌ Token generation fails → **BLOQUANT** (fix generator script)
- ❌ Generated files are outdated → **ATTENTION** (regenerate tokens)
- ❌ Gallery pages don't display tokens → **ATTENTION** (add TokenDisplay component)

### 3.4 Page Standardization Infrastructure

**Location**: `apps/web/components/views/` and `apps/web/components/portals/`

**Files to Verify**:
- [ ] ✅ Standardized view components exist: `PageViewBase`, `DetailView`, `FormView`, `UnifiedListView`
- [ ] ✅ `PortalLayout` component exists and is used consistently
- [ ] ✅ Page architecture patterns are documented

**Usage Verification**:
- [ ] ✅ Standardized view components are available for use
- [ ] ✅ `PortalLayout` is used in all portal `layout.tsx` files
- [ ] ✅ Page architecture documentation exists and is accurate

**Check Commands**:
```bash
# Verify standardized view components exist
ls -la apps/web/components/views/*.tsx

# Verify PortalLayout usage
grep -r "PortalLayout" apps/web/app/\[locale\]/\(client\)/*/layout.tsx
```

**Violations Detected**:
- ❌ Standardized view components missing → **BLOQUANT** (create missing components)
- ❌ `PortalLayout` not used consistently → **BLOQUANT** (migrate to PortalLayout)
- ❌ Page architecture documentation missing → **ATTENTION** (create documentation)

---

## 🔍 4. TOKEN SYSTEM AUDIT

### 4.1 Check Token Generation

**Location**: `scripts/02-generators/generate-design-tokens.ts`

**Generated Files**:
- [ ] ✅ `packages/shared-ts/src/design-tokens.ts` - TypeScript types and constants
- [ ] ✅ `apps/web/public/design-tokens.json` - JSON export
- [ ] ✅ `apps/web/public/design-tokens-light.json` - Light mode tokens
- [ ] ✅ `apps/web/public/design-tokens-dark.json` - Dark mode tokens

**Check Command**:
```bash
npm run generate:tokens
# Verify no errors and files are generated
```

### 4.2 Usage Verification

**Checklist**:
- [ ] ✅ Gallery pages use `TokenDisplay` component to show token usage
- [ ] ✅ Components use CSS variables (not hardcoded colors)
- [ ] ✅ Quality check `check-color-tokens.ts` passes (warnings acceptable for legacy code)
- [ ] ✅ Quality check `check-ui-components.ts` detects hardcoded colors
- [ ] ✅ Components use design tokens across application (not just in gallery)
- [ ] ✅ Pages use design system components (not native HTML elements)

**Violations Detected**:
- ❌ Hardcoded colors in components → **BLOQUANT** (replace with CSS variables)
- ❌ Gallery page doesn't display tokens → **ATTENTION** (add TokenDisplay)
- ❌ Token generation fails → **BLOQUANT** (fix generator script)
- ❌ Components not using design tokens in application → **ATTENTION** (migrate to tokens)
- ❌ Pages using native HTML elements instead of design system components → **BLOQUANT** (use design system components)

---

## 🔍 5. DOCUMENTATION AUDIT

### 5.1 Check Documentation Files

**Files to Verify**:
- [ ] ✅ `docs/09-ui-ux/00-foundations/design-system-usage.md` - Includes Design System Gallery and Visual Regression Testing sections
- [ ] ✅ `docs/09-ui-ux/04-components/component-reference.md` - Includes links to gallery pages and tests
- [ ] ✅ `apps/web/app/[locale]/(demo)/design-system/README.md` - Gallery documentation
- [ ] ✅ `docs/07-testing/design-system-tests.md` - Testing documentation

### 5.2 Quality Checks

**Checklist**:
- [ ] ✅ All documentation is up to date
- [ ] ✅ All gallery links are correct (e.g., `/en/design-system/button`)
- [ ] ✅ All test examples are accurate
- [ ] ✅ Usage examples match actual component APIs
- [ ] ✅ Component inventory is complete

**Violations Detected**:
- ❌ Broken gallery links → **BLOQUANT** (fix links)
- ❌ Outdated documentation → **ATTENTION** (update docs)
- ❌ Missing component in inventory → **ATTENTION** (add to inventory)

---

## 🔍 6. QUALITY CHECKS AUDIT

### 6.1 Verify Quality Scripts

**Scripts to Verify**:
- [ ] ✅ `scripts/01-quality/ci/check-ui-components.ts` - Detects hardcoded colors
- [ ] ✅ `scripts/01-quality/ci/check-design-system-gallery.ts` - Verifies gallery coverage
- [ ] ✅ `scripts/01-quality/ci/check-design-system-tests.ts` - Verifies test coverage

**Integration**:
- [ ] ✅ All checks are integrated into `scripts/01-quality/ci/run-all-checks.ts` (lines 780, 786)
- [ ] ✅ Checks run in CI (non-blocking warnings)

**Run Checks**:
```bash
npm run check:design-system-gallery
npm run check:design-system-tests
npm run check:ui-components
```

**Violations Detected**:
- ❌ Quality check missing → **BLOQUANT** (add check)
- ❌ Quality check not integrated into CI → **BLOQUANT** (add to run-all-checks.ts)
- ❌ Quality check fails → **BLOQUANT** (fix check)

---

## 🔍 7. COMPONENT INVENTORY

### 7.1 UI Primitives (22 components)

**Expected gallery pages**:
- [ ] alert-dialog
- [ ] alert
- [ ] badge
- [ ] breadcrumb
- [ ] button
- [ ] card
- [ ] checkbox
- [ ] dialog
- [ ] dropdown-menu
- [ ] input
- [ ] label
- [ ] link
- [ ] locale-link
- [ ] progress
- [ ] select
- [ ] skeleton-page
- [ ] skeleton
- [ ] switch
- [ ] table
- [ ] tabs
- [ ] textarea
- [ ] tooltip

### 7.2 View Components (6 components)

**Expected gallery pages**:
- [ ] page-view-base
- [ ] list-view
- [ ] detail-view
- [ ] form-view
- [ ] settings-view
- [ ] dashboard-view

### 7.3 Portal Components (16 components)

**Expected gallery pages**:
- [ ] portal-layout
- [ ] portal-header
- [ ] portal-context-menu
- [ ] portal-search
- [ ] portal-sidebar
- [ ] portal-sidebar-container
- [ ] portal-page
- [ ] portal-page-header
- [ ] cross-portal-navigator
- [ ] company-switcher
- [ ] client-switcher
- [ ] portal-error-state
- [ ] portal-skeleton-loader
- [ ] portal-mobile-bottom-bar
- [ ] portal-skip-links
- [ ] portal-content

### 7.4 Modal Components (4 components)

**Expected gallery pages**:
- [ ] confirmation-modal
- [ ] form-modal
- [ ] danger-modal
- [ ] content-modal

### 7.5 Table Components (3 components)

**Expected gallery pages**:
- [ ] data-table
- [ ] data-table-pagination
- [ ] data-table-actions-column

### 7.6 Form Components (7 components)

**Expected gallery pages**:
- [ ] form-section
- [ ] form-field
- [ ] form-tabs
- [ ] form-error-summary
- [ ] auto-save-banner
- [ ] field-list
- [ ] form-section-collapsible

### 7.7 Guard Components (3 components)

**Expected gallery pages**:
- [ ] permission-gate
- [ ] module-gate
- [ ] portal-guard

---

## 🔍 8. TEST EXECUTION AUDIT

### 8.1 Run All Tests

**Command**:
```bash
npm run test:e2e:design-system
```

**Verify**:
- [ ] ✅ All tests pass
- [ ] ✅ No snapshot mismatches (unless intentional)
- [ ] ✅ Tests complete in reasonable time (< 10 minutes)
- [ ] ✅ No flaky tests

**Update Snapshots** (if visual changes are intentional):
```bash
npm run test:e2e:design-system -- --update-snapshots
```

**Violations Detected**:
- ❌ Tests fail → **BLOQUANT** (fix tests)
- ❌ Snapshot mismatches → **ATTENTION** (review and update if intentional)
- ❌ Tests timeout → **ATTENTION** (optimize test performance)

---

## 🔍 9. GALLERY FUNCTIONALITY AUDIT

### 9.1 Manual Testing

**Test the Gallery**:
1. Navigate to `/en/design-system`
2. Verify index page lists all components
3. Click on a component (e.g., Button)
4. Test URL parameters:
   - `?variant=destructive` - Changes variant
   - `?size=lg` - Changes size
   - `?state=hover` - Changes state
   - `?theme=dark` - Changes theme
   - `?viewport=mobile` - Changes viewport
5. Verify theme toggle works
6. Verify viewport toggle works
7. Verify props table displays correctly
8. Verify usage examples are syntax-highlighted
9. Verify token display shows CSS variables

**Test Multiple Components**:
- [ ] UI Primitives (Button, Input, Select, etc.)
- [ ] View Components (ListView, DetailView, FormView)
- [ ] Portal Components (PortalHeader, PortalLayout)
- [ ] Modal Components (ConfirmationModal, FormModal)
- [ ] Table Components (DataTable, DataTablePagination)
- [ ] Form Components (FormSection, FormField)
- [ ] Guard Components (PermissionGate, ModuleGate)

**Violations Detected**:
- ❌ Gallery doesn't load → **BLOQUANT** (fix routing/imports)
- ❌ URL parameters don't work → **BLOQUANT** (fix parameter handling)
- ❌ Theme/viewport toggles don't work → **BLOQUANT** (fix shared components)

---

## 🔍 10. INTEGRATION AUDIT

### 10.1 Verify CI Integration

**Check CI Quality Gate**:
- [ ] ✅ `check-design-system-gallery.ts` runs in CI (non-blocking)
- [ ] ✅ `check-design-system-tests.ts` runs in CI (non-blocking)
- [ ] ✅ `check-ui-components.ts` runs in CI (blocking)

**Check Test Execution**:
- [ ] ✅ Playwright tests run in CI
- [ ] ✅ Snapshot updates require explicit approval
- [ ] ✅ Visual diffs are displayed in PR comments

**Violations Detected**:
- ❌ Quality checks not in CI → **BLOQUANT** (add to CI pipeline)
- ❌ Tests not in CI → **BLOQUANT** (add to CI pipeline)

---

## 🔍 11. COMMON ISSUES TO CHECK

### 11.1 Missing Gallery Pages

**Symptoms**:
- Component exists but no gallery page
- Quality check `check-design-system-gallery.ts` reports missing pages

**Fix**:
1. Create gallery page at `apps/web/app/[locale]/(demo)/design-system/[category]/[component]/page.tsx`
2. Use `ComponentShowcase` wrapper
3. Add to gallery index page

### 11.2 Missing Playwright Tests

**Symptoms**:
- Component has gallery page but no test file
- Quality check `check-design-system-tests.ts` reports missing tests

**Fix**:
1. Create test file at `tests/e2e/specs/design-system/[category]/[component].spec.ts`
2. Use helpers from `helpers.ts`
3. Cover variants, sizes, states, themes, viewports

### 11.3 Hardcoded Colors

**Symptoms**:
- Quality check `check-ui-components.ts` reports hardcoded colors
- Components use `#ffffff` or `rgb()` instead of CSS variables

**Fix**:
1. Replace hardcoded colors with CSS variables (e.g., `hsl(var(--primary))`)
2. Verify token usage in gallery page

### 11.4 Broken Gallery Links

**Symptoms**:
- Gallery index page has broken links
- Component reference docs have incorrect gallery URLs

**Fix**:
1. Verify all gallery page paths are correct
2. Update documentation with correct URLs

### 11.5 Snapshot Mismatches

**Symptoms**:
- Playwright tests fail with snapshot mismatches
- Visual changes not reflected in snapshots

**Fix**:
1. Review visual diff to verify changes are intentional
2. Update snapshots: `npm run test:e2e:design-system -- --update-snapshots`
3. Commit updated snapshots

---

## 🔍 12. MARKETING PAGES AUDIT

### 12.1 Page Discovery & Inventory

**Location**: `apps/web/app/[locale]/(public)/`

**Pages to Audit**:
- **Landing Page**: `page.tsx`
- **Platform Pages** (6): `platform/manage-finances`, `platform/get-documents-in`, `platform/see-what-matters`, `platform/automate-your-work`, `platform/collaborate`, `platform/integrations`
- **Main Pages** (5): `about`, `pricing`, `contact`, `careers`, `careers/[role]`
- **Legal Pages** (5): `legal`, `privacy`, `terms`, `dpa`, `sla`

**Total Expected**: 17 pages

**Check Command**:
```bash
find apps/web/app/\[locale\]/\(public\) -name "page.tsx" -type f | wc -l
# Should be 17
```

**Workflow**:
1. **Discovery**: List all pages in `apps/web/app/[locale]/(public)/`
2. **Systematic Audit**: Start with Landing Page, then Platform Pages, then Main Pages, then Legal Pages
3. **Global Report**: Produce executive summary with violations grouped by priority and category

### 12.2 Design System Compliance

**CRITICAL**: All marketing pages must use design tokens exclusively. See Section 1 (Gallery Coverage) and Section 4 (Token System) for design system patterns.

**Checklist**:
- [ ] ✅ **Colors**: Uses CSS tokens (`bg-background`, `text-foreground`, `border-border`) instead of hardcoded colors (`bg-white`, `text-black`, `#007AFF`)
- [ ] ✅ **Semantic colors**: Uses semantic tokens (`bg-primary`, `text-success`, `border-warning`) instead of raw colors (`bg-blue-500`, `text-green-600`)
- [ ] ✅ **Typography**: Uses Tailwind tokens (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`) instead of hardcoded sizes (`text-[14px]`, `text-[16px]`)
- [ ] ✅ **Spacing**: Uses Tailwind tokens (`p-4`, `px-6`, `py-8`, `py-24`, `py-32`, `gap-2`, `gap-4`, `gap-6`) instead of hardcoded values (`p-[16px]`, `px-[24px]`)
- [ ] ✅ **Layout tokens**: Uses standard widths (`max-w-6xl` for standard sections, `max-w-7xl` only if justified)
- [ ] ✅ **Container structure**: Uses `container mx-auto px-4 sm:px-6` + `max-w-6xl` for standard structure

**Quality Check Integration**:
- Run `npm run check:ui-components` to detect hardcoded colors and native HTML elements
- Run `npm run check:color-tokens` to detect hardcoded color values

**Violations Detected**:
- ❌ Hardcoded colors (`bg-white`, `text-black`, `#007AFF`) → **BLOQUANT** (replace with CSS variables)
- ❌ Hardcoded sizes (`text-[14px]`, `p-[16px]`) → **BLOQUANT** (use Tailwind tokens)
- ❌ Incorrect container structure → **BLOQUANT** (use standard structure)
- ❌ Native HTML elements instead of design system components → **BLOQUANT** (use design system components)

**Reference**: See Section 1 (Gallery Coverage) for design system patterns, Section 4 (Token System) for token usage.

### 12.3 Mobile-First & Responsive Design

**CRITICAL**: 375px is the baseline, not a fallback. All pages must be perfectly usable on 375px before being enhanced for desktop.

**Checklist**:
- [ ] ✅ **Mobile-first breakpoints**: Uses `sm:`, `md:`, `lg:`, `xl:` for progressive enhancement (mobile first)
- [ ] ✅ **No horizontal scroll**: No horizontal overflow on 375px (watch for `min-w-*`, dynamic text, badges, carousels)
- [ ] ✅ **No hover-only interactions**: All interactions work on tap (no `hover:` only)
- [ ] ✅ **Adaptive layouts**: Avoids `vh`-based layouts on mobile (Safari iOS); prefers content-driven height + internal scroll
- [ ] ✅ **Desktop patterns adapted**: Desktop patterns (sticky, scrollytelling, large grids/tables) have dedicated mobile UX (guided/stepper/accordion/stacked)
- [ ] ✅ **Responsive typography**: Headings use breakpoints (`text-2xl md:text-3xl lg:text-4xl`) for progressive scaling
- [ ] ✅ **Responsive spacing**: Sections use breakpoints (`py-16 md:py-24 lg:py-32`) for progressive spacing

**Violations Detected**:
- ❌ Horizontal scroll on 375px → **BLOQUANT** (fix overflow)
- ❌ Hover-only interactions (no tap fallback) → **BLOQUANT** (add tap support)
- ❌ `vh` layouts that break on Safari iOS → **BLOQUANT** (use content-driven height)
- ❌ Desktop patterns without mobile adaptation → **BLOQUANT** (add mobile UX)

**Reference**: `docs/09-ui-ux/02-responsive/mobile-first-rules.md` ⭐ **CRITICAL**. See also Section 1 (Gallery Coverage Audit) for responsive design patterns in gallery pages.

### 12.4 Accessibility (WCAG AA+)

**CRITICAL**: All pages must be accessible (WCAG AA+).

**Checklist**:
- [ ] ✅ **Contrast**: All text meets minimum contrast (4.5:1 for body, 3:1 for large text)
- [ ] ✅ **Keyboard navigation**: All interactive elements are keyboard accessible (logical tab order)
- [ ] ✅ **Focus visible**: All focusable elements have visible focus (`ring`, `outline`)
- [ ] ✅ **ARIA labels**: All interactive elements have complete ARIA labels (`aria-label`, `aria-describedby`)
- [ ] ✅ **Screen reader**: Content is readable by screen reader (hierarchical headings, landmarks)
- [ ] ✅ **Images**: All images have descriptive `alt` text (or `alt=""` if decorative)
- [ ] ✅ **Semantic HTML**: Uses semantic HTML (`<h1>`, `<h2>`, `<h3>` in order, `<header>`, `<nav>`, `<main>`, `<footer>`, `<section>`, `<article>`)

**Violations Detected**:
- ❌ Insufficient contrast (< 4.5:1) → **BLOQUANT** (fix contrast)
- ❌ Interactive elements not keyboard accessible → **BLOQUANT** (add keyboard support)
- ❌ Invisible focus → **BLOQUANT** (add focus styles)
- ❌ Images without `alt` → **BLOQUANT** (add alt text)
- ❌ Non-hierarchical headings (level skip) → **BLOQUANT** (fix heading hierarchy)

**Reference**: `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section Accessibility)

### 12.5 Marketing & Messaging

**CRITICAL**: All pages must align with brand essence and use correct messaging.

**Checklist**:
- [ ] ✅ **Brand essence**: Aligns with "agentic finance and operations OS" (composable canvas, workflows, intelligent assistants)
- [ ] ✅ **Taglines**: Uses correct taglines:
  - Primary (Marketing): "Build. Automate. Trust your numbers."
  - Technical: "The agentic finance OS."
  - Marketing Site: "Design your back-office, not just run it."
  - Alternative: "Finance, re-engineered for intelligence."
- [ ] ✅ **Value proposition**: Uses main value proposition: "The modern finance OS that adapts to how you work — not the other way around."
- [ ] ✅ **Benefits over features**: Focuses on benefits (what for user) rather than features (what technically)
- [ ] ✅ **CTAs**: Has clear, actionable CTAs ("Start free trial", "Schedule a demo", "Get started")
- [ ] ✅ **Terminology**: Uses standardized terminology (see `docs/10-business/platform/platform-pitch-and-glossary.md`)

**Violations Detected**:
- ❌ Incorrect or invented taglines → **BLOQUANT** (use correct taglines)
- ❌ Value proposition not aligned → **BLOQUANT** (align with brand)
- ❌ Focus on features instead of benefits → **WARNING** (refocus on benefits)
- ❌ Vague CTA copy ("Click here", "Learn more" without context) → **WARNING** (make CTAs actionable)
- ❌ Inconsistent terminology → **BLOQUANT** (use standardized terminology)

**Reference**: `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section "Brand Essence", "Brand Pillars"), `docs/10-business/platform/platform-pitch-and-glossary.md` ⭐ **CANONIQUE for terminology**

### 12.6 Content & Tone

**CRITICAL**: All content must use correct tone and be clear, concise, and actionable.

**Checklist**:
- [ ] ✅ **Tone**: Precise, calm, trustworthy (Swiss style)
- [ ] ✅ **Clarity**: Clear and actionable messages (no unnecessary jargon)
- [ ] ✅ **Professional**: Confident, Swiss precision (not too casual)
- [ ] ✅ **Headlines**: Clear and actionable headlines (no vague phrases)
- [ ] ✅ **Body copy**: Concise and actionable body copy (no blabla)
- [ ] ✅ **i18n**: All user-facing text uses i18n (no hardcoded strings)

**Violations Detected**:
- ❌ Tone too casual or unprofessional → **BLOQUANT** (use professional tone)
- ❌ Excessive technical jargon without explanation → **WARNING** (explain or remove jargon)
- ❌ Vague headlines ("Welcome", "About us" without context) → **BLOQUANT** (make headlines actionable)
- ❌ Hardcoded strings in JSX → **BLOQUANT** (use i18n keys)

**Reference**: `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section "Tone"), `docs/02-development/i18n/tone-audit-guide.md`

### 12.7 Business Storytelling

**CRITICAL**: All pages must have clear narrative flow, especially platform pages.

**Checklist**:
- [ ] ✅ **Logical structure**: Structure follows logical flow (Hero → Problem → Solution → How It Works → Features → CTA)
- [ ] ✅ **Platform pages structure**: Platform pages follow standardized structure (see `docs/10-business/platform/pages/README.md`)
- [ ] ✅ **Problem → Solution**: Presents problem and solution clearly (especially for platform pages)
- [ ] ✅ **Three Moments framework**: Platform pages use Three Moments framework (Ingestion → Understanding → Decision) where applicable

**Violations Detected**:
- ❌ Illogical or confusing structure → **BLOQUANT** (restructure logically)
- ❌ Platform pages without standardized structure → **BLOQUANT** (follow standard structure)
- ❌ Vague or absent problem statement → **BLOQUANT** (add clear problem statement)

**Reference**: `docs/10-business/platform/pages/README.md` ⭐ **CANONIQUE for platform pages structure**, `docs/10-business/platform/platform-pitch-and-glossary.md` (Section "Three Moments Framework")

### 12.8 Layout Logic & Structure

**CRITICAL**: All pages must follow consistent and logical structure.

**Checklist**:
- [ ] ✅ **Hero section**: Hero section present (headline, subheadline, CTA, visual)
- [ ] ✅ **Logical sections**: Sections organized logically (Hero → Content → CTA)
- [ ] ✅ **Section spacing**: Sections have consistent spacing (`py-24 md:py-32`)
- [ ] ✅ **Container structure**: Container structure consistent (`container mx-auto px-4 sm:px-6` + `max-w-6xl`)
- [ ] ✅ **Component usage**: Uses design system components (not manual components)
- [ ] ✅ **Visual hierarchy**: Clear visual hierarchy (hierarchical headings, typography scale, spacing hierarchy)

**Violations Detected**:
- ❌ Illogical or confusing structure → **BLOQUANT** (restructure logically)
- ❌ Inconsistent section spacing → **WARNING** (use consistent spacing)
- ❌ Incorrect container structure → **BLOQUANT** (use standard structure)
- ❌ Manual components instead of design system components → **BLOQUANT** (use design system components)

**Reference**: `docs/09-ui-ux/00-foundations/branding/branding-guidelines.md` (Section "Layout & UI Logic"), `docs/09-ui-ux/03-patterns/page-architecture.md`

### 12.9 Consistency

**CRITICAL**: All pages must be consistent with other marketing pages.

**Checklist**:
- [ ] ✅ **Similar structure**: Similar structure to other pages of the same type (platform pages, legal pages, etc.)
- [ ] ✅ **Consistent tone**: Consistent tone with other marketing pages
- [ ] ✅ **Consistent design tokens**: Consistent design tokens with other pages
- [ ] ✅ **Consistent component usage**: Consistent component usage with other pages
- [ ] ✅ **Consistent terminology**: Consistent terminology with other pages

**Violations Detected**:
- ❌ Different structure from other pages of the same type → **WARNING** (align structure)
- ❌ Inconsistent tone → **BLOQUANT** (align tone)
- ❌ Inconsistent design tokens → **BLOQUANT** (use consistent tokens)

**Reference**: `docs/10-business/platform/platform-pitch-and-glossary.md` ⭐ **CANONIQUE for terminology**

### 12.10 Quality & Technical Accuracy

**CRITICAL**: All technical details must be accurate.

**Checklist**:
- [ ] ✅ **Module availability**: Module availability corresponds to pricing matrix (see `docs/10-business/pricing-architecture-alignment.md`)
- [ ] ✅ **Feature descriptions**: Feature descriptions correspond to actual implementation
- [ ] ✅ **SEO metadata**: Has correct SEO metadata (title, description, Open Graph tags)
- [ ] ✅ **Image optimization**: Images optimized (Next.js `Image` component, modern formats, lazy loading)
- [ ] ✅ **Performance**: Page is performant (code splitting, lazy loading, reasonable bundle size)

**Violations Detected**:
- ❌ Incorrect module availability → **BLOQUANT** (fix module availability)
- ❌ Feature descriptions not aligned with implementation → **BLOQUANT** (align descriptions)
- ❌ Missing or non-descriptive SEO metadata → **BLOQUANT** (add SEO metadata)
- ❌ Non-optimized images (no Next.js `Image`) → **BLOQUANT** (optimize images)

**Reference**: `packages/shared-ts/src/modules.ts`, `docs/10-business/pricing-architecture-alignment.md`

### 12.11 Shared Infrastructure Usage

**CRITICAL**: Marketing demo must use shared components. See Section 3 (Shared Infrastructure) for details.

**Checklist**:
- [ ] ✅ Marketing demo (`/demo`) uses `SharedDemoWrapper` from shared components
- [ ] ✅ Marketing screenshots use shared viewport constants (`VIEWPORT_SIZES` from `viewport-constants.ts`)
- [ ] ✅ Marketing demo uses shared theme/viewport toggles (if implemented)

**Violations Detected**:
- ❌ Marketing demo doesn't use `SharedDemoWrapper` → **BLOQUANT** (refactor to use shared)
- ❌ Marketing demo uses hardcoded viewport sizes → **BLOQUANT** (use shared constants)

**Reference**: See Section 3.2 (Marketing Demo Integration) for detailed verification steps. See also Section 3 (Shared Infrastructure Audit) for shared component usage patterns.

---

## 🔍 13. TOKEN ADOPTION AUDIT

### 13.1 Quality Check Integration

**CRITICAL**: Token adoption is verified through automated quality checks. Run these checks to assess adoption status.

**Quality Checks**:
- [ ] ✅ `scripts/01-quality/ci/check-color-tokens.ts` - Detects hardcoded colors and opacity patterns
- [ ] ✅ `scripts/01-quality/ci/check-ui-components.ts` - Detects hardcoded colors and native HTML elements
- [ ] ✅ `scripts/04-utilities/reports/audit-color-usage.ts` - Comprehensive color usage audit report

**Run Checks**:
```bash
# Check color tokens (warnings acceptable for legacy code)
npm run check:color-tokens

# Check UI components (blocking)
npm run check:ui-components

# Generate comprehensive color usage audit
npm run audit:color-usage
```

**Integration**: All checks are integrated into `scripts/01-quality/ci/run-all-checks.ts` (lines 780, 792)

**Reference**: See Section 4 (Token System Audit) for token generation and usage verification. See also Section 12.2 (Marketing Pages - Design System Compliance) for token usage in marketing pages.

### 13.2 Hardcoded Color Detection

**CRITICAL**: All code must use design tokens, never hardcoded colors.

**Patterns to Detect**:
- **Hex colors**: `#ffffff`, `#007AFF`, `#000000`
- **RGB/RGBA colors**: `rgb(255, 255, 255)`, `rgba(0, 0, 0, 0.5)`
- **Tailwind color classes**: `bg-blue-500`, `text-green-600`, `border-gray-200`
- **Opacity-based hovers**: `hover:bg-primary/90`, `hover:bg-primary/80` (should use tonal scales: `hover:bg-primary-hover`)
- **Hardcoded opacity**: `opacity-10`, `opacity-20` (should use tokens: `bg-primary/10`)

**Checklist**:
- [ ] ✅ No hex colors in components or pages
- [ ] ✅ No RGB/RGBA colors in components or pages
- [ ] ✅ No Tailwind raw color classes (`bg-blue-500`, `text-green-600`)
- [ ] ✅ Opacity-based hovers use tonal scales (`hover:bg-primary-hover` instead of `hover:bg-primary/90`)
- [ ] ✅ Opacity uses token format (`bg-primary/10` instead of `bg-primary opacity-10`)

**Violations Detected**:
- ❌ Hardcoded colors in new code → **BLOQUANT** (replace with CSS variables)
- ❌ Hardcoded colors in legacy code → **WARNING** (migrate to tokens)
- ❌ Opacity patterns that should use tonal scales → **INFO** (migrate to tonal scales)

**Reference**: See Section 4.2 (Usage Verification) for token usage patterns. See also Section 12.2 (Marketing Pages - Design System Compliance) for token usage in marketing pages.

### 13.3 Token Usage Verification

**CRITICAL**: Verify that tokens are used correctly across the application.

**Checklist**:
- [ ] ✅ Gallery pages use `TokenDisplay` component to show token usage
- [ ] ✅ Components use CSS variables (e.g., `hsl(var(--primary))`) instead of hardcoded colors
- [ ] ✅ Pages use design system components (not native HTML elements)
- [ ] ✅ Application-wide token adoption (not just in gallery)

**Verification Methods**:
1. **Gallery pages**: Check that `TokenDisplay` component shows CSS variables
2. **Component files**: Search for hardcoded color patterns in `apps/web/components/`
3. **Page files**: Search for hardcoded color patterns in `apps/web/app/`
4. **Quality checks**: Run `npm run check:color-tokens` and `npm run check:ui-components`

**Violations Detected**:
- ❌ Gallery page doesn't display tokens → **ATTENTION** (add TokenDisplay component)
- ❌ Components not using design tokens in application → **ATTENTION** (migrate to tokens)
- ❌ Pages using native HTML elements instead of design system components → **BLOQUANT** (use design system components)

**Reference**: See Section 4 (Token System Audit) for token generation and gallery token display. See also Section 1.2 (Gallery Quality Checks) for TokenDisplay component usage.

### 13.4 Migration Status Tracking

**CRITICAL**: Track token adoption progress across the application.

**Metrics to Track**:
- **Files using tokens**: Count of files using design tokens (CSS variables)
- **Files with hardcoded colors**: Count of files with hardcoded colors
- **Component-level adoption rate**: Percentage of components using tokens
- **Page-level adoption rate**: Percentage of pages using tokens

**Check Commands**:
```bash
# Generate comprehensive color usage audit report
npm run audit:color-usage

# Check for hardcoded colors
npm run check:color-tokens

# Check for native HTML elements
npm run check:ui-components
```

**Current Status** (as of last audit):
- ⚠️ Token adoption: Mostly compliant (119 files use tokens, ~5-10 files with hardcoded colors)
- ⚠️ Component adoption: High (1,126 imports across 476 files)
- ⚠️ Page standardization: 24% migrated (74/308 pages, 234 remaining)

**Violations Detected**:
- ❌ High number of files with hardcoded colors → **WARNING** (prioritize migration)
- ❌ Low component adoption rate → **WARNING** (increase adoption)

### 13.5 Violation Prioritization

**CRITICAL**: Prioritize violations based on impact and code age.

**Priorities**:
- **BLOQUANT**: Hardcoded colors in new code (must fix immediately)
- **WARNING**: Legacy code with hardcoded colors (should migrate, target: 10-20 files/month)
- **INFO**: Opacity patterns that should use tonal scales (nice to have, low priority)

**Migration Strategy**:
1. **New code**: Zero tolerance for hardcoded colors (blocking)
2. **Legacy code**: Gradual migration (10-20 files/month)
3. **Tonal scales**: Low priority, migrate when touching related code

**Reference**: See Section 16.2 (Token Adoption) for future improvements and maintenance schedule. See also Section 4 (Token System Audit) for token system infrastructure.

---

## 🔍 14. PAGE STANDARDIZATION AUDIT

### 14.1 Quality Check Integration

**CRITICAL**: Page standardization is verified through automated quality checks and documentation compliance.

**Quality Checks**:
- [ ] ✅ `scripts/01-quality/ci/check-ui-components.ts` - Detects native HTML elements and design system component usage
- [ ] ✅ Page architecture documentation exists and is accurate

**Run Checks**:
```bash
# Check UI components (blocking)
npm run check:ui-components
```

**Integration**: Check is integrated into `scripts/01-quality/ci/run-all-checks.ts` (line 780)

**Reference**: `docs/09-ui-ux/03-patterns/page-architecture.md`, `docs/09-ui-ux/01-pages/page-types.md`, `docs/01-architecture/portal/portal-layout-rule.md`

### 14.2 Portal Layout Compliance

**CRITICAL**: All portal pages must use `PortalLayout` and standardized view components.

**Checklist**:
- [ ] ✅ **PortalLayout**: All portal pages use `PortalLayout` in `layout.tsx` Next.js
- [ ] ✅ **PortalPage/PageViewBase**: All portal pages use `PortalPage` or `PageViewBase` (never direct `<div>`)
- [ ] ✅ **No manual padding**: Padding managed automatically by `PortalPage` (no `p-*` manual on page root)
- [ ] ✅ **No manual max-width**: Max-width managed automatically by `PortalPage` (no `max-w-*` manual on page root)
- [ ] ✅ **No manual background**: Background managed by `PortalLayout` (no `bg-*` manual on page root)

**Violations Detected**:
- ❌ Portal page doesn't use `PortalLayout` → **BLOQUANT** (migrate to PortalLayout)
- ❌ Portal page doesn't use `PortalPage`/`PageViewBase` → **BLOQUANT** (use standardized view)
- ❌ Manual padding/max-width/background on page root → **BLOQUANT** (remove manual styling)

**Reference**: `docs/01-architecture/portal/portal-layout-rule.md`, Section 3.4 (Page Standardization Infrastructure). See also Section 3 (Shared Infrastructure Audit) for infrastructure verification.

### 14.3 View Component Usage

**CRITICAL**: All pages must use standardized view components based on page type.

**Standardized Views**:
- **UnifiedListView**: For list pages (replaces custom list implementations)
- **DetailView**: For detail pages (replaces custom detail implementations)
- **FormView**: For form pages (replaces custom form implementations)
- **PageViewBase**: For custom pages (replaces `PortalPage` for new pages)

**Checklist**:
- [ ] ✅ **List pages**: All list pages use `UnifiedListView`
- [ ] ✅ **Detail pages**: All detail pages use `DetailView`
- [ ] ✅ **Form pages**: All form pages use `FormView`
- [ ] ✅ **Custom pages**: All custom pages use `PageViewBase` (not `PortalPage` for new pages)
- [ ] ✅ **Loading states**: `isLoading` prop passed when data fetching exists
- [ ] ✅ **Error states**: `error` prop passed when data fetching exists
- [ ] ✅ **No manual skeleton**: No manual skeleton if `isLoading` prop is passed
- [ ] ✅ **No return null**: No `return null` during loading states

**Violations Detected**:
- ❌ List page without `UnifiedListView` → **BLOQUANT** (migrate to UnifiedListView)
- ❌ Detail page without `DetailView` → **BLOQUANT** (migrate to DetailView)
- ❌ Form page without `FormView` → **BLOQUANT** (migrate to FormView)
- ❌ Custom page with `PortalPage` (new page) → **BLOQUANT** (use PageViewBase/DetailView/FormView/UnifiedListView)
- ❌ Missing `isLoading` prop when data fetching exists → **BLOQUANT** (add isLoading prop)
- ❌ Missing `error` prop when data fetching exists → **BLOQUANT** (add error prop)
- ❌ Manual skeleton when `isLoading` prop is passed → **BLOQUANT** (remove manual skeleton)
- ❌ `return null` during loading → **BLOQUANT** (use loading state)

**Reference**: `docs/09-ui-ux/03-patterns/page-architecture.md`, `docs/09-ui-ux/01-pages/page-types.md`, Section 3.4 (Page Standardization Infrastructure). See also Section 6 (Quality Checks Audit) for automated verification.

### 14.4 Standardization Status Tracking

**CRITICAL**: Track page standardization progress across the application.

**Metrics to Track**:
- **Pages using standardized views**: Count of pages using `UnifiedListView`, `DetailView`, `FormView`, `PageViewBase`
- **Pages with custom code**: Count of pages with custom implementations
- **Portal layout compliance rate**: Percentage of portal pages using `PortalLayout`
- **Component usage compliance rate**: Percentage of pages using design system components

**Check Commands**:
```bash
# Check for native HTML elements (indicates non-standardized pages)
npm run check:ui-components

# Manual verification: Search for standardized view usage
grep -r "UnifiedListView\|DetailView\|FormView\|PageViewBase" apps/web/app/\[locale\]/\(client\)/
```

**Current Status** (as of last audit):
- ⚠️ Page standardization: 24% migrated (74/308 pages, 234 remaining)
- ⚠️ Portal layout compliance: High (most portal pages use PortalLayout)
- ⚠️ Component usage: High (1,126 imports across 476 files)

**Violations Detected**:
- ❌ Low standardization rate (< 50%) → **WARNING** (prioritize migration)
- ❌ High number of pages with custom code → **WARNING** (migrate to standardized views)

### 14.5 Violation Prioritization

**CRITICAL**: Prioritize violations based on impact and code age.

**Priorities**:
- **BLOQUANT**: New pages not using standardized views (must fix immediately)
- **WARNING**: Legacy pages with custom patterns (should migrate, target: 10-20 pages/month)
- **INFO**: Pages that could benefit from standardization (nice to have, low priority)

**Migration Strategy**:
1. **New pages**: Must use standardized views (blocking)
2. **Legacy pages**: Gradual migration (10-20 pages/month)
3. **Custom patterns**: Low priority, migrate when touching related code

**Reference**: See Section 16.3 (Page Standardization) for future improvements and maintenance schedule. See also Section 3.4 (Page Standardization Infrastructure) for infrastructure verification.

---

## 📊 15. COMPLETION STATUS

### 15.1 Current Status (All Audit Areas)

**Design System Gallery**:
- ✅ Gallery infrastructure: Complete
- ✅ Gallery pages: 62/61 (complete - includes index page)
- ✅ Component showcase: All components have interactive showcase pages
- ✅ Documentation: Complete

**Playwright Visual Regression Tests**:
- ✅ Test infrastructure: Complete
- ✅ Playwright tests: 61/61 (100% coverage - all components tested)
- ✅ Test helpers: Complete
- ✅ CI integration: Complete

**Marketing Pages**:
- ⚠️ Needs audit: 17 pages to audit (Landing, 6 Platform, 5 Main, 5 Legal)
- ⚠️ Compliance status: Unknown (requires full audit)
- ⚠️ Shared infrastructure: Partially verified (see Section 3.2)

**Token Adoption**:
- ✅ Token system: Complete (generation, types, JSON exports)
- ⚠️ Token adoption: Mostly compliant (119 files use tokens, ~5-10 files with hardcoded colors)
- ⚠️ Migration status: Ongoing (target: 100% token adoption in new code)
- ⚠️ Legacy code: ~5-10 files with hardcoded colors (target: 10-20 files/month migration)

**Page Standardization**:
- ✅ Standardized view components: Complete (PageViewBase, DetailView, FormView, UnifiedListView)
- ✅ PortalLayout: Complete and used consistently
- ⚠️ Page standardization: 24% migrated (74/308 pages, 234 remaining)
- ⚠️ Migration status: Ongoing (target: 10-20 pages/month)

**Shared Infrastructure**:
- ✅ Shared components: Complete (SharedThemeToggle, SharedViewportToggle, SharedDemoWrapper)
- ✅ Viewport constants: Complete
- ⚠️ Marketing demo integration: Partially verified (see Section 3.2)
- ✅ Token system integration: Complete
- ✅ Page standardization infrastructure: Complete

**Quality Checks**:
- ✅ Quality checks: Complete (all checks integrated into CI)
- ✅ CI integration: Complete
- ✅ Documentation: Complete

### 15.2 Component Adoption Status

**Component Usage**:
- ✅ Component usage: High (1,126 imports across 476 files)
- ✅ View components: Good adoption (1,738 usages across 307 files)
- ✅ Portal components: Good adoption (132 usages across 69 files)

**Token Adoption**:
- ⚠️ Token adoption: Mostly compliant (119 files use tokens, ~5-10 files with hardcoded colors)
- ⚠️ Component-level adoption: High (most components use tokens)
- ⚠️ Page-level adoption: Moderate (some pages still use hardcoded colors)

**Page Standardization**:
- ⚠️ Page standardization: 24% migrated (74/308 pages, 234 remaining)
- ⚠️ Portal layout compliance: High (most portal pages use PortalLayout)
- ⚠️ View component adoption: Moderate (some pages still use custom code)

### 15.3 Next Steps

**Immediate Actions**:
1. Complete marketing pages audit (17 pages)
2. Verify marketing demo uses shared components (Section 3.2)
3. Continue token adoption migration (10-20 files/month)
4. Continue page standardization migration (10-20 pages/month)

**Ongoing Maintenance**:
1. Run monthly comprehensive audits using this prompt
2. Update Playwright snapshots when visual changes are intentional
3. Keep documentation in sync with component changes
4. Monitor quality check results and fix violations

**Long-term Goals**:
1. Achieve 100% token adoption in new code
2. Achieve 100% page standardization (target: 12-18 months)
3. Complete marketing pages compliance audit
4. Maintain 100% design system gallery and test coverage

---

## 🔮 16. FUTURE IMPROVEMENTS & MAINTENANCE

### 16.1 Marketing Pages

**Immediate Actions**:
- [ ] Complete comprehensive audit of all 17 marketing pages
- [ ] Fix all BLOQUANT violations (design system compliance, accessibility, i18n)
- [ ] Address WARNING violations (consistency, performance improvements)
- [ ] Migrate marketing pages to use shared components (see Section 3.2)

**Ongoing Maintenance**:
- [ ] Run marketing pages audit monthly or after major changes
- [ ] Keep marketing pages aligned with brand guidelines
- [ ] Verify SEO metadata is up to date
- [ ] Ensure all marketing pages use design system components

**Long-term Goals**:
- [ ] Achieve 100% design system compliance across all marketing pages
- [ ] Standardize marketing page structure (especially platform pages)
- [ ] Complete i18n coverage for all marketing pages

### 16.2 Token Adoption

**Immediate Actions**:
- [ ] Fix all hardcoded colors in new code (BLOQUANT violations)
- [ ] Prioritize migration of legacy code with hardcoded colors (10-20 files/month)
- [ ] Migrate opacity patterns to tonal scales where applicable

**Ongoing Maintenance**:
- [ ] Run `npm run check:color-tokens` regularly to detect new violations
- [ ] Run `npm run check:ui-components` to detect native HTML elements
- [ ] Generate color usage audit reports monthly: `npm run audit:color-usage`
- [ ] Monitor token adoption metrics

**Long-term Goals**:
- [ ] Achieve 100% token adoption in new code (zero tolerance for hardcoded colors)
- [ ] Complete legacy code migration (target: 12-18 months)
- [ ] Migrate all opacity patterns to tonal scales

### 16.3 Page Standardization

**Immediate Actions**:
- [ ] Fix all new pages not using standardized views (BLOQUANT violations)
- [ ] Prioritize migration of legacy pages (10-20 pages/month)
- [ ] Ensure all portal pages use `PortalLayout` consistently

**Ongoing Maintenance**:
- [ ] Run `npm run check:ui-components` to detect non-standardized pages
- [ ] Monitor page standardization metrics
- [ ] Review and update page architecture documentation as needed

**Long-term Goals**:
- [ ] Achieve 100% page standardization (target: 12-18 months)
- [ ] Migrate all 234 remaining pages to standardized views
- [ ] Ensure all new pages use standardized views (blocking for new code)

### 16.4 Maintenance Schedule

**Monthly Audits**:
- [ ] Run comprehensive audit using this prompt (all sections)
- [ ] Review quality check results and fix violations
- [ ] Update Playwright snapshots if visual changes are intentional
- [ ] Review and update documentation as needed

**After Major Changes**:
- [ ] Run audit after component additions/refactors
- [ ] Run audit after design system updates
- [ ] Run audit after major page changes
- [ ] Verify all quality checks still pass

**Snapshot Updates**:
- [ ] Review visual diffs to verify changes are intentional
- [ ] Update snapshots: `npm run test:e2e:design-system -- --update-snapshots`
- [ ] Commit updated snapshots with clear commit message

**Documentation Updates**:
- [ ] Keep documentation in sync with component changes
- [ ] Update component reference when components evolve
- [ ] Update gallery README when gallery structure changes
- [ ] Update testing documentation when test patterns change

---

## ✅ 17. AUDIT CHECKLIST

### 17.1 Quick Audit (10 minutes)

**Design System Gallery**:
- [ ] Run `npm run check:design-system-gallery` - Should show 0 missing pages
- [ ] Visit `/en/design-system` - Verify gallery loads and navigation works

**Playwright Tests**:
- [ ] Run `npm run check:design-system-tests` - Should show 0 missing tests
- [ ] Run `npm run test:e2e:design-system` - All existing tests should pass

**Marketing Pages**:
- [ ] Run `npm run check:ui-components` - Check for native HTML elements and hardcoded colors

**Token Adoption**:
- [ ] Run `npm run check:color-tokens` - Note hardcoded color violations (warnings acceptable for legacy code)

**Page Standardization**:
- [ ] Run `npm run check:ui-components` - Check for native HTML elements (indicates non-standardized pages)

### 17.2 Full Audit (60 minutes)

**Design System Gallery** (10 min):
- [ ] Complete Section 1 (Gallery Coverage Audit)
- [ ] Verify all 61 components have gallery pages
- [ ] Test 5+ components manually (verify URL parameters, theme/viewport toggles)

**Playwright Tests** (10 min):
- [ ] Complete Section 2 (Playwright Tests Coverage Audit)
- [ ] Verify all 61 components have test files
- [ ] Run all tests and verify they pass

**Marketing Pages** (20 min):
- [ ] Complete Section 12 (Marketing Pages Audit)
- [ ] Audit Landing Page and 2-3 Platform Pages
- [ ] Verify design system compliance, accessibility, i18n
- [ ] Check shared infrastructure usage (Section 3.2)

**Token Adoption** (10 min):
- [ ] Complete Section 13 (Token Adoption Audit)
- [ ] Run `npm run check:color-tokens` and review violations
- [ ] Run `npm run check:ui-components` and review violations
- [ ] Generate color usage audit: `npm run audit:color-usage`

**Page Standardization** (10 min):
- [ ] Complete Section 14 (Page Standardization Audit)
- [ ] Verify portal pages use `PortalLayout` consistently
- [ ] Check standardized view component usage
- [ ] Review page standardization metrics

**Shared Infrastructure** (5 min):
- [ ] Complete Section 3 (Shared Infrastructure Audit)
- [ ] Verify marketing demo uses shared components
- [ ] Verify token system integration
- [ ] Verify page standardization infrastructure

**Documentation & Quality Checks** (5 min):
- [ ] Complete Section 5 (Documentation Audit)
- [ ] Complete Section 6 (Quality Checks Audit)
- [ ] Verify all documentation is up to date
- [ ] Verify all quality checks are integrated into CI

---

**Last Updated**: 2026-01-27
**Next Audit**: Schedule monthly or after major component additions/refactors
