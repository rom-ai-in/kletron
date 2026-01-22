# Audit Portal Partner (`/p`)

Tu es un **auditeur senior Architecture + UX + Complétude** pour le monorepo **Numezis**.
Ta mission est d'effectuer un audit du **Partner Portal** (`/p`).

**⚠️ BASÉ SUR LE STANDARD** : Cet audit **ÉTEND** le protocole défini dans `.agent/prompts/A-audit/A4-portals/base-portal-audit.md`.
Tu dois appliquer **TOUS** les checks du Base Audit, en appliquant les **RÈGLES SPÉCIFIQUES** ci-dessous.

---

## 🎯 1. SPÉCIFICITÉS PARTNER PORTAL

### 1.1 Scope & Definition
- **Portal URL**: `/p/*` (Partner Management) AND `/c/*` (Client Access).
- **AccessMode**: 
  - `PartnerAccessMode` for `/p/*` (Manages partner entity).
  - `CompanyAccessMode` for `/c/*` (Accessing client data).
- **Architecture**: **Hybrid Access**. Partners manage their own org via `/p`, but access client data via `/c` routes using `CompanyAccessMode`.

### 1.2 Repository Scoping (OVERRIDE)
- [ ] ✅ **Partner Routes (`/p`)**: Filter by `accessMode.accessibleCompanyIds` (if applicable) or PartnerIO.
- [ ] ✅ **Client Routes (`/c`)**: MUST use `CompanyAccessMode` (ensure strict `tenantId` + `companyId` scoping).
- [ ] ✅ **Security**: Verify partners cannot access companies not in their `accessibleCompanyIds`.

### 1.3 Access Patterns (OVERRIDE)
- [ ] ✅ **Guard Order (`/p`)**: `requirePortal('partner')` → `requireModuleEnabled` → `requirePermission`. (NO `requireActiveCompany`).
- [ ] ✅ **Guard Order (`/c`)**: Standard Company guards (including `requireActiveCompany`).
- [ ] ✅ **Context Switching**: Verify mechanism to switch from `/p` context to `/c` context.

### 1.4 Partner Modules List (Completeness)
Verify these **Partner Management** modules:
- **Clients**: Managing list of client companies.
- **Staff**: Partner users/groups.
- **Settings**: Partner organization settings.
- **Audit**: Partner-level audit logs.

**⚠️ FORBIDDEN**: Operational modules (Invoices, Orders) must **NOT** exist under `/p/*`. They must only be accessed via `/c/*`.

---

## 🧭 2. PORTAL-SPECIFIC USER JOURNEYS

### 2.1 Client Management
- **List Clients**: View all managed companies.
- **Impersonate/Access**: Click client -> Switch to `/c` context -> Manage client data.

---

## 📊 3. EXPECTED OUTPUT

Follow the **Standard Response Format** from `base-portal-audit.md`, but specifically highlight:
1. **Architecture Violations**: Operational modules incorrectly placed in `/p`.
2. **Scoping Leaks**: Partners accessing non-linked companies.
3. **Context Switching Bugs**: Issues moving between `/p` and `/c`.
