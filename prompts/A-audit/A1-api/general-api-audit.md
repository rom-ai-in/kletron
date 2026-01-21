# Audit: General API Architecture & Health

Tu es un **auditeur senior Architecture Backend** pour le monorepo **Numezis**. Ta mission est d'effectuer un audit de santé général de l'API (`apps/api`), en vérifiant **la structure**, **la conformité ESM**, **les conventions de nommage**, et **la pureté des couches**.

Contrairement à l'audit OpenAPI (qui vérifie la spec externe), cet audit vérifie la **qualité interne du code**.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Backend Rules** : `.cursor/rules/backend-rules.mdc`
- **General Rules** : `.cursor/rules/general.mdc`
- **Architecture Standards** : `docs/01-architecture/core/architecture_standards.md`
- **File Organization** : `docs/01-architecture/core/file_organization_standards.md`

---

## 🎯 CONTEXTE D'AUDIT

Commence par expliciter :
1. **Scope** : `apps/api/src` (Routes, Services, Controllers, Middleware)
2. **Exclusions** : `apps/api/src/workers` (audité séparément), `apps/api/src/docs` (OpenAPI)

---

## 🔍 1. ESM COMPLIANCE (CRITICAL)

**Checklist** :
- [ ] ✅ **Imports Backend** : Tous les imports relatifs utilisent l'extension `.js` (ex: `import { x } from './file.js'`)
- [ ] ✅ **Exports** : Pas de `module.exports` (CommonJS interdit)
- [ ] ✅ **Dynamic Imports** : `import()` utilisé corrrectement (si nécessaire)

**Violations détectées** :
- ❌ Import sans extension (`import ... from './file'`) → **BLOQUANT**
- ❌ Usage de `require()` → **BLOQUANT**

---

## 🏗️ 2. DIRECTORY STRUCTURE & ORGANIZATION

**Checklist** :
- [ ] ✅ **Routes** : Organisées par portal dans `src/routes/portals/{portal}/` (pas de routes racines en vrac)
- [ ] ✅ **Services** : Organisés par domain dans `src/services/{domain}/` ou `src/domain/{domain}/`
- [ ] ✅ **Repositories** : Dans `src/repositories/` (pas mélangés aux services)
- [ ] ✅ **Middleware** : Dans `src/middleware/` ou `src/core/middleware/`

**Violations détectées** :
- ❌ Routes définies hors de `routes/portals/` → **IMPORTANT**
- ❌ Dossiers "utils" fourre-tout (préférer `core/utils`) → **ATTENTION**

---

## 🧩 3. SERVICE LAYER PURITY

**Checklist** :
- [ ] ✅ **Portal Neutrality** : Les services n'ont AUCUNE logique spécifique au portal (pas de `if (portal === 'company')`)
- [ ] ✅ **AccessMode First** : Tous les services publics acceptent `AccessMode` comme **premier argument**
- [ ] ✅ **No Direct DB** : Les services n'appellent JAMAIS `db.collection()` (uniquement via repositories)
- [ ] ✅ **No HTTP dependency** : Les services ne connaissent pas `req` ou `res` (uniquement DTOs)

**Violations détectées** :
- ❌ Service accédant à `req.headers` → **BLOQUANT**
- ❌ Service construisant `AccessMode` manuellement → **BLOQUANT**

---

## 🛡️ 4. MIDDLEWARE PATTERNS

**Checklist** :
- [ ] ✅ **Order Consistency** : `auth` → `accessMode` → `permission` → `module` → `activeCompany` (pour writes)
- [ ] ✅ **Async Handler** : Usage systématique de `asyncHandler()` pour wrapper les middlewares async
- [ ] ✅ **Error Passing** : Appel de `next(err)` en cas d'erreur (pas de `res.status(500).send()`)

---

## 📝 5. NAMING CONVENTIONS

**Checklist** :
- [ ] ✅ **Files** : `kebab-case.ts` (ex: `invoice-service.ts`, `user.controller.ts`)
- [ ] ✅ **Classes** : `PascalCase` (ex: `InvoiceService`, `UserRepository`)
- [ ] ✅ **Interfaces** : `PascalCase` (ex: `CreateInvoicePayload`)
- [ ] ✅ **Variables** : `camelCase`

**Violations détectées** :
- ❌ Fichiers en `camelCase.ts` ou `PascalCase.ts` → **ATTENTION**

---

## 📊 FORMAT DE RÉPONSE

Structure ta réponse ainsi :

### 1. Synthèse
- Status global : ✅ / ⚠️ / 🔴
- Résumé des violations majeures.

### 2. Violations ESM (Si applicable)
| Fichier | Ligne | Erreur | Fix |
|---------|-------|--------|-----|
| `src/foo.ts` | 5 | Import sans extension | Ajouter `.js` |

### 3. Violations Architecture & Structure
- Liste des fichiers mal placés ou mal nommés.

### 4. Violations Service Layer
- Liste des services impurs (accès HTTP, logique portal, etc.).

### 5. Actions Recommandées
- Checklist des corrections à apporter.
