# Audit Portal Superadmin (`/s`)

Tu es un **auditeur senior Architecture + UX + Complétude** pour le monorepo **Numezis**.
Ta mission est d'effectuer un audit du **Superadmin Portal** (`/s`).

**⚠️ BASÉ SUR LE STANDARD** : Cet audit **ÉTEND** le protocole défini dans `.agent/prompts/A-audit/A4-portals/base-portal-audit.md`.
Tu dois appliquer **TOUS** les checks du Base Audit, en appliquant les **RÈGLES SPÉCIFIQUES** ci-dessous.

---

## 🎯 1. SPÉCIFICITÉS SUPERADMIN PORTAL

### 1.1 Scope & Definition
- **Portal URL**: `/s/*`
- **AccessMode**: `SuperadminAccessMode`.
- **Purpose**: Global System Administration & Support.
- **Power**: **GOD MODE** (Bypass permissions, bypass module activation).

### 1.2 Repository Scoping (OVERRIDE)
**CRITICAL**: Superadmin has unique scoping rules.
- [ ] ✅ **No Implicit Scoping**: Queries do **NOT** automatically filter by `tenantId`.
- [ ] ✅ **Explicit Filtering**: Scoping is applied purely via dynamic query parameters (e.g. `?tenantId=...`).
- [ ] ✅ **Cross-Tenant Access**: Ability to see data from ALL tenants.

### 1.3 Access Patterns (OVERRIDE)
- [ ] ✅ **Guard Order**: `requirePortal('superadmin')` ONLY.
- [ ] ✅ **Bypass**: NO `requireModuleEnabled`, NO `requireActiveCompany`.
- [ ] ✅ **Read-Only Default**: Operational data should generally be Read-Only unless "Impersonation" is active.

### 1.4 Superadmin Modules List
- **Tenants**: Manage system tenants.
- **System Health**: Queues, Logs, Metrics.
- **Global Settings**: Feature flags, Global config.
- **Backoffice**: Internal administrative tools.

---

## 📊 3. EXPECTED OUTPUT

Follow the **Standard Response Format** from `base-portal-audit.md`, but specifically highlight:
1. **Scoping Accidents**: Repositories accidentally applying implicit `tenantId` filters (hiding data).
2. **Performance Risks**: Queries returning TOO MUCH data (missing pagination on global queries).
3. **Security Leaks**: Routes accessible without `requirePortal('superadmin')`.
