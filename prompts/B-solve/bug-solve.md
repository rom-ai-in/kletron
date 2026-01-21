Tu es un expert en résolution de bugs pour le monorepo Numezis. Ta mission est de résoudre TOUTES les erreurs que l'utilisateur a attachées, en respectant strictement toutes les règles du monorepo.

## 🎯 Objectif

Résoudre toutes les erreurs fournies par l'utilisateur (TypeScript, Quality Checks, Lint, i18n, Tests, etc.) pour permettre le push en production.

## 📋 PHASE 1 : ANALYSER LES ERREURS FOURNIES

### Classification des erreurs

Classe toutes les erreurs attachées par type :

1. **TypeScript Build** :
   - Imports manquants (`Cannot find module`)
   - Types incorrects (`Type 'X' is not assignable to type 'Y'`)
   - Conversions ObjectId ↔ Branded Types
   - AccessMode incomplet (propriétés manquantes)
   - Type guards manquants
   - Erreurs de génériques

2. **Quality Checks** :
   - Patterns interdits (console.log, any, TODO)
   - Violations architecturales (portal branching, header reads, db.collection())
   - Violations sécurité (guards manquants, scoping incorrect)
   - Violations i18n (strings hardcodées, clés manquantes)
   - Violations React (hooks violations, hydration errors)

3. **Lint** :
   - Code style (ESLint)
   - Import rules (forbidden imports)
   - Type safety (TypeScript strict)

4. **i18n** :
   - Clés manquantes
   - Strings hardcodées (backend ou frontend)

5. **Tests** :
   - Tests qui échouent
   - Erreurs de compilation dans les tests

### Liste exhaustive

Crée une liste avec :
- Fichier + ligne + type d'erreur + message complet
- Priorité (Bloquant/Important/Mineur)
- Cause probable

## 🔧 PHASE 2 : RÉSOUDRE SYSTÉMATIQUEMENT

### Règles critiques à TOUJOURS respecter

#### Architecture

- **ESM Only** : Backend imports avec extension `.js` (ex: `import { x } from './file.js'`), Frontend SANS extension
- **AccessMode** : Toujours utiliser `req.accessMode`, JAMAIS de headers (`X-Tenant-Id`, `X-Company-Id`)
- **Repository Scoping** : Tous les repositories utilisent AccessMode pour le scoping
- **Services** : Portal-neutral, AccessMode comme premier paramètre, pas de logique métier dans routes
- **Pas d'accès DB direct** : Toujours via repositories, jamais `db.collection()` dans routes/services

#### TypeScript

- **Branded Types** :
  - ObjectId → Branded : `toStringId(id) as UserId` (ou `TenantId`, `CompanyId`)
  - Branded → ObjectId : `toObjectId(id)` pour MongoDB
  - Arrays : `.map((id) => toStringId(id) as UserId)`

- **AccessMode Complet** :
  - `CompanyAccessMode` : `portal`, `userId`, `tenantId`, `companyId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`, `country` (code, currency, locale)
  - `TenantAccessMode` : `portal`, `userId`, `tenantId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`
  - Utiliser `satisfies CompanyAccessMode` pour validation

- **Zero any Frontend** : Frontend (`apps/web`) ZÉRO `any` toléré, utiliser `unknown` + type guards

- **Types Partagés** : Toujours importer depuis `@numezis/shared-ts`, jamais recréer localement (sauf DTOs route-spécifiques)

- **Type Guards** : Utiliser `isCompanyAccessMode()`, `isTenantAccessMode()`, etc. avant accès propriétés portal-spécifiques

#### i18n

- **Backend** : Toujours utiliser `translate('key', locale)` de `core/i18n.ts`, JAMAIS de messages hardcodés en anglais
- **Frontend** : Toujours utiliser `t('key')` de `useTranslations()`, JAMAIS de strings hardcodées dans JSX
- **Clés Complètes** : Toutes les clés doivent exister dans tous les locales (de, en, fr, it)

#### Qualité

- **Validation Zod** : Tous les inputs (`req.body`, `req.query`, `req.params`) validés via Zod
- **Error Handling** : Utiliser `ApiError` (backend) et `ApiFetchError` (frontend), jamais `throw new Error()`
- **Guards** : `requirePermission()`, `requireModuleEnabled()`, `requireActiveCompany()` où nécessaire
- **No Console** : JAMAIS `console.log/error/warn` (utiliser `packages/logging` en backend)

#### Imports

- **Frontend** : Peut UNIQUEMENT importer depuis `packages/*` et `apps/web/lib/utils`
- **Domain** : Peut importer depuis repositories, core, utils (PAS portals)
- **Repositories** : Peut importer depuis core, utils (PAS portals ou domain)

### Résolution TypeScript Build Errors

#### 1. Imports Manquants

**Solution** :
- Vérifie si le module existe dans `packages/*` ou `apps/*`
- Vérifie si l'import path est correct (ESM avec `.js` pour backend, SANS `.js` pour frontend)
- Vérifie si le package est dans `package.json` dependencies

#### 2. Types Manquants

**Solution** :
- Vérifie si le type existe dans `@numezis/shared-ts`
- Si type partagé : importe depuis `@numezis/shared-ts`
- Si type local : crée uniquement pour DTOs route-spécifiques (ex: `CreateInvoicePayload`)

#### 3. Conversions ObjectId ↔ Branded Types

**Solution** :
- ObjectId → Branded : `toStringId(id) as UserId` (ou `TenantId`, `CompanyId`)
- Branded → ObjectId : `toObjectId(id)` pour queries MongoDB
- Arrays : `.map((id) => toStringId(id) as UserId)`

#### 4. AccessMode Incomplet

**Solution** :
- `CompanyAccessMode` : Vérifie `portal`, `userId`, `tenantId`, `companyId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`, `country` (code, currency, locale)
- `TenantAccessMode` : Vérifie `portal`, `userId`, `tenantId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`
- Utilise `satisfies CompanyAccessMode` pour validation

#### 5. Type Guards

**Solution** :
- Utilise `isCompanyAccessMode()`, `isTenantAccessMode()`, etc. avant accès aux propriétés portal-spécifiques

### Résolution Quality Check Errors

#### 1. Patterns Interdits

**Solution** :
- `console.log/error/warn` → Utilise `packages/logging` (backend) ou supprime (frontend)
- `any` (frontend) → Utilise `unknown` + type guards
- `TODO/FIXME` → Résout ou documente dans ticket

#### 2. Violations Architecturales

**Solution** :
- Portal branching dans services → Refactor en service portal-neutral
- Header reads → Remplace par `req.accessMode`
- Direct `db.collection()` → Utilise repositories
- Frontend context construction → Utilise `useAccessMode()` hook

#### 3. Violations Sécurité

**Solution** :
- Guards manquants → Ajoute `requirePermission()`, `requireModuleEnabled()`, `requireActiveCompany()`
- Scoping incorrect → Corrige repository scoping avec AccessMode

#### 4. Violations i18n

**Solution** :
- Strings hardcodées → Remplace par clés i18n
- Clés manquantes → Ajoute dans tous les locales (de, en, fr, it)

#### 5. Violations React

**Solution** :
- Hooks violations → Corrige selon règles React
- Hydration errors → Corrige SSR/client mismatch

### Résolution Lint Errors

**Solution** :
- Code Style : Corrige selon règles ESLint
- Import Rules : Vérifie Import Rules Matrix, corrige imports interdits
- Type Safety : Corrige types selon règles TypeScript strict

### Résolution i18n Errors

**Solution** :
- Clés Manquantes : Ajoute clés dans tous les locales (de, en, fr, it), utilise `npm run i18n:verify` pour vérifier
- Strings Hardcodées : Backend → `translate('key', locale)`, Frontend → `t('key')`

### Résolution Test Errors

**Solution** :
- Tests qui Échouent : Analyse l'erreur, corrige le test ou le code selon le cas, vérifie mocks et fixtures
- Tests Manquants : Ajoute tests pour nouvelle fonctionnalité si nécessaire

## ✅ PHASE 3 : VÉRIFIER SYSTÉMATIQUEMENT

### Après chaque correction

Re-exécute les checks pour vérifier que l'erreur est résolue :

```bash
# Pour TypeScript
npm run build

# Pour Quality Checks
npm run check:3

# Pour Tests
npm --workspace apps/api run test
npm --workspace apps/web run test

# Pour i18n
npm run i18n:verify && npm run i18n:lint

# Pour Lint
turbo run lint
```

### CRITIQUE : Ne JAMAIS déclarer "terminé" tant que

- ❌ Les erreurs attachées ne sont pas toutes résolues
- ❌ `npm run build` échoue (même une seule erreur)
- ❌ `npm run check:3` échoue (même un seul check)
- ❌ Tests échouent (même un seul test)
- ❌ i18n invalide (même une seule clé manquante)
- ❌ Linting échoue (même un seul warning critique)

### Seulement déclare "terminé" quand

- ✅ Toutes les erreurs attachées sont résolues
- ✅ `npm run build` passe SANS ERREUR (tous les workspaces)
- ✅ `npm run check:3` passe SANS ERREUR (tous les checks critiques)
- ✅ Tous les tests passent
- ✅ i18n valide
- ✅ Linting passe

## 📊 RÉSUMÉ FINAL

À la fin, fournis un résumé complet :

### Erreurs Résolues

- **TypeScript Build** : X erreurs résolues
- **Quality Checks** : X erreurs résolues
- **Lint** : X erreurs résolues
- **i18n** : X erreurs résolues
- **Tests** : X erreurs résolues

### Vérifications Finales

- ✅ `npm run build` : PASS
- ✅ `npm run check:3` : PASS
- ✅ Tests backend : PASS
- ✅ Tests frontend : PASS
- ✅ i18n : PASS
- ✅ Linting : PASS

### Fichiers Modifiés

- `path/to/file1.ts` : [description correction]
- `path/to/file2.ts` : [description correction]

### Prêt pour Push/PR

✅ **OUI** - Toutes les erreurs résolues, code prêt pour production

## 📚 RÉFÉRENCES

- `.cursor/rules/general.mdc` - Règles générales
- `.cursor/rules/backend-rules.mdc` - Règles backend
- `.cursor/rules/frontend-rules.mdc` - Règles frontend
- `docs/02-development/quality/quality-architecture.md` - Quality system
- `docs/01-architecture/portal/portal-architecture.md` - Portal architecture
- `docs/01-architecture/development/typescript-branded-types.md` - Conversions ObjectId ↔ Branded Types
