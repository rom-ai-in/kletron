# Audit Portal Company (`/c`)

Tu es un **auditeur senior Architecture + UX + Complétude** pour le monorepo **Numezis**.
Ta mission est d'effectuer un audit du **Company Portal** (`/c`).

**⚠️ BASÉ SUR LE STANDARD** : Cet audit **ÉTEND** le protocole défini dans `.agent/prompts/A-audit/A4-portals/base-portal-audit.md`.
Tu dois appliquer **TOUS** les checks du Base Audit, en appliquant les **RÈGLES SPÉCIFIQUES** ci-dessous.

---

## 🎯 1. SPÉCIFICITÉS COMPANY PORTAL

### 1.1 Scope & Definition
- **Portal URL**: `/c/*`
- **AccessMode**: `CompanyAccessMode` (Requires `tenantId` AND `companyId`).
- **Modules**: FULL access to all Operational Modules.

### 1.2 Repository Scoping (OVERRIDE)
**CRITICAL**: Company portal requires Strict Dual Scoping.
- [ ] ✅ **Dual Filter**: All queries MUST filter by `companyId` AND `tenantId` (from `AccessMode`).
- [ ] ✅ **Hierarchy Check**: Validate that `company.tenantId === accessMode.tenantId`.
- [ ] ✅ **Write Protection**: All write operations must respect `requireActiveCompany()`.

### 1.3 Access Patterns (OVERRIDE)
- [ ] ✅ **Guard Order**: `requirePortal('company')` → `requireModuleEnabled` → `requirePermission` → **`requireActiveCompany`**.
- [ ] ✅ **ActiveCompany**: REQUIRED for all WRITE operations (POST, PUT, DELETE).

### 1.4 Operational Modules List (Completeness)
Verify that **ALL** these modules are fully implemented (List/Detail/Create/Edit/Delete):
- **Sales**: `invoices`, `orders`, `quotes`
- **Purchases**: `expenses`, `supplier_invoices`
- **Accounting**: `banking`, `ledger`, `fixed_assets`, `compliance`
- **Projects**: `projects`, `tasks`, `time_entries`
- **HR**: `employees`, `payroll`
- **Inventory**: `inventory`
- **Intelligence**: `reports`, `analytics`
- **Communication**: `documents`, `comments`, `approvals`
- **Foundation**: `contacts`

---

## 🧭 2. PORTAL-SPECIFIC USER JOURNEYS

### 2.1 Operational Workflows
- **Create Invoice**: Flow from `invoices` list -> create form -> success.
- **Approve Document**: Flow from `documents` list -> detail -> approve action.
- **Pay Bill**: Flow from `supplier_invoices` -> detail -> mark as paid.

### 2.2 Configuration
- **Company Settings**: `/c/settings` (Access to module config, branding, users).

---

## 📊 3. EXPECTED OUTPUT

Follow the **Standard Response Format** from `base-portal-audit.md`, but specifically highlight:
1. **Repository Scoping Violations** (Missing `tenantId` or `companyId`).
2. **Module Gaps** (Missing operational features).
3. **ActiveCompany Guard Gaps** (Security risk on writes).
