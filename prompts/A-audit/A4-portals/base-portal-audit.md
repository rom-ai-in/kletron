# Base Portal Audit Template

This file defines the **STANDARD AUDIT PROTOCOL** shared by all Numezis portals (`/c`, `/p`, `/t`, `/s`).
Specific portal audits (`company-portal-audit.md`, etc.) **EXTEND** this template by overriding specific sections (modules, scoping rules, access modes).

**⚠️ INSTRUCTION TO AUDITOR**:
When conducting a portal audit, you must **ALWAYS** verify these base patterns UNLESS the specific portal audit explicitly overrides them.

---

## 📚 1. COMMON SOURCES OF TRUTH

- **Portal Architecture**: `docs/01-architecture/portal/portal-architecture.md`
- **Portal Modules Matrix**: `docs/01-architecture/portal/portal-modules-matrix.md`
- **Navigation Registry**: `apps/api/src/services/navigation.registry.ts`
- **AccessMode Types**: `packages/shared-ts/src/types/access-mode.ts`
- **Quality Architecture**: `docs/02-development/quality/quality-architecture.md`
- **Internationalization Standards**: `docs/01-architecture/core/internationalization-standards.md`

---

## 🔍 2. COMMON ARCHITECTURE & COHERENCE

### 2.1 Backend Patterns (Standard)
**CRITICAL**: All portals must strictly follow these backend patterns.

**Checklist**:
- [ ] ✅ **Route Structure**: Routes organized by portal (`apps/api/src/routes/portals/<portal>.routes.ts`).
- [ ] ✅ **AccessMode**: Routes extract `AccessMode` from `req.accessMode` (NEVER from headers `X-Tenant-Id`/`X-Company-Id`).
- [ ] ✅ **Service Calls**: Routes delegate strictly to Domain Services (no business logic in controllers).
- [ ] ✅ **Validation**: All inputs validated via Zod schemas.
- [ ] ✅ **Error Handling**: All errors use `translate()` with i18n keys and standard error codes.
- [ ] ✅ **Audit Logging**: Write operations emit audit events.
- [ ] ✅ **Quality Gates**: Must pass `npm run check:3` (No TypeScript errors, no forbidden patterns).

### 2.2 Frontend Patterns (Standard)
**CRITICAL**: All portals must strictly follow these frontend patterns.

**Checklist**:
- [ ] ✅ **Page Composition**: Pages use `ListView`, `DetailView`, `FormView` (no ad-hoc layouts).
- [ ] ✅ **Hooks**: Pages use `useAccessMode()` (NEVER parse URL or localStorage for context).
- [ ] ✅ **Navigation**: Uses `@/navigation` typed router (no `next/link` direct usage).
- [ ] ✅ **Loading/Empty**: Standardized `Skeletons` and `EmptyStates` with CTAs.
- [ ] ✅ **Error Boundaries**: Hierarchy includes `ErrorBoundaryWrapper`.
- [ ] ✅ **Type Safety**: NO `any` allowed in frontend code (Tier 1 check).

### 2.3 Service Neutrality
**CRITICAL**: Domain services must remain portal-agnostic.

**Checklist**:
- [ ] ✅ **No Branching**: Services do NOT switch logic based on `if (portal === 'company')`.
- [ ] ✅ **AccessMode Input**: Services accept `AccessMode` as the first argument.

---

## 🧭 3. NAVIGATION & MENU LOGIC

### 3.1 Registry Integrity
**Checklist**:
- [ ] ✅ **Completeness**: Every frontend route has a corresponding entry in `navigation.registry.ts`.
- [ ] ✅ **Derived Routes**: Detail/Edit/Create pages exist in registry with `excludeFromMenu: true`.
- [ ] ✅ **Properties**: `id` is unique, `labelKey` exists in i18n, `requiredPermission` is correct.

### 3.2 Breadcrumbs
**Checklist**:
- [ ] ✅ **Metadata Driven**: Breadcrumbs generated via `getRouteMetadata()` from registry.
- [ ] ✅ **Hierarchy**: Correct `parentId` links in registry ensuring proper breadcrumb trails.
- [ ] ✅ **i18n**: Labels use translation keys (no hardcoded strings).

### 3.3 Feature Discoverability
**CRITICAL**: Every route must be reachable via the UI.
- [ ] ✅ **Entry Points**: Every route has a menu item, button, link, or tab leading to it.

---

## 📱 4. MOBILE & RESPONSIVE DESIGN

### 4.1 Mobile-First Standard
**CRITICAL**: Design must be mobile-first (starting at 375px).
- [ ] ✅ **No Overflow**: No horizontal scrolling at 375px.
- [ ] ✅ **Touch Targets**: All interactive elements ≥ 44x44px.
- [ ] ✅ **Responsive Components**: Tables -> Stacked/Cards on mobile. Forms -> Single column on mobile.

---

## 🔐 5. ACCESS CONTROL (BASE PATTERNS)

### 5.1 Guard Layering
**CRITICAL**: Guards must strictly follow the standard order precedence.
1. `PortalGuard` / `requirePortal()` (Is this the right entry point?)
2. `ModuleGate` / `requireModuleEnabled()` (Is the feature active?)
3. `PermissionGate` / `requirePermission()` (Does user have rights?)
4. `ActiveCompanyGate` / `requireActiveCompany()` (Write-safety - *if applicable*)

### 5.2 Permission Consistency
- [ ] ✅ **Code Alignment**: Frontend `PermissionGate` uses identical string codes as Backend `requirePermission`.
- [ ] ✅ **Superadmin Bypass**: Superadmin role bypasses permission/module checks.

---

## 📊 6. STANDARD RESPONSE FORMAT

When reporting audit results, use the following structure:

1. **Executive Summary** (Verdict: 🟥 CRITICAL / 🟨 WARNING / 🟩 OK)
2. **Critical Violations Table** (Source, Problem, Fix)
3. **Consistency Matrix** (Comparison against patterns)
4. **Feature Completeness Matrix** (CRUD, i18n, Tests)
5. **Mobile/UX Report**
6. **Prioritized Action Plan**
