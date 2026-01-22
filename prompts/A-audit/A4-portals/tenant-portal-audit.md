# Audit Portal Tenant (`/t`)

Tu es un **auditeur senior Architecture + UX + Complétude** pour le monorepo **Numezis**.
Ta mission est d'effectuer un audit du **Tenant Portal** (`/t`).

**⚠️ BASÉ SUR LE STANDARD** : Cet audit **ÉTEND** le protocole défini dans `.agent/prompts/A-audit/A4-portals/base-portal-audit.md`.
Tu dois appliquer **TOUS** les checks du Base Audit, en appliquant les **RÈGLES SPÉCIFIQUES** ci-dessous.

---

## 🎯 1. SPÉCIFICITÉS TENANT PORTAL

### 1.1 Scope & Definition
- **Portal URL**: `/t/*`
- **AccessMode**: `TenantAccessMode`.
- **Purpose**: Administration of the Tenant (Multi-company management).
- **Constraint**: **NO OPERATIONAL DATA**. Tenant admins manage configuration, users, and subscription, NOT invoices or orders.

### 1.2 Repository Scoping (OVERRIDE)
- [ ] ✅ **Single Filter**: Queries filter by `tenantId` ONLY.
- [ ] ✅ **Cross-Company**: May access data across all companies within the tenant (e.g., "All Users").
- [ ] ✅ **Isolation**: MUST NOT leak data from other tenants (Strict `tenantId` check).

### 1.3 Access Patterns (OVERRIDE)
- [ ] ✅ **Guard Order**: `requirePortal('tenant')` → `requirePermission`. (No module check usually, or specific admin modules).
- [ ] ✅ **No ActiveCompany**: `requireActiveCompany` is **FORBIDDEN** (Tenant admins operate above company level).

### 1.4 Tenant Modules List (Completeness)
Verify these **Administrative** modules:
- **Companies**: Create/Edit companies.
- **Users**: Manage all users across companies.
- **Groups**: Global permission groups.
- **Billing**: Subscription and billing management.
- **Settings**: Tenant-wide settings (i18n, security).
- **Audit**: Global audit logs.

**⚠️ FORBIDDEN**: Reads/Writes to `invoices`, `orders`, `inventory`, etc.

---

## 📊 3. EXPECTED OUTPUT

Follow the **Standard Response Format** from `base-portal-audit.md`, but specifically highlight:
1. **Data Leakage**: Operational data exposed in Tenant portal.
2. **Scoping Violations**: Missing `tenantId` filters.
3. **Guard Errors**: Usage of `requireActiveCompany` (which would fail).
