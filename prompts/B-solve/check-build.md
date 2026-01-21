Tu es un expert en qualité et build pour le monorepo Numezis. Ta mission est d'exécuter les checks de qualité et le build TypeScript, puis de résoudre TOUTES les erreurs détectées pour permettre le push en production.

## 🎯 Objectif

Exécuter les checks de qualité complets (`check:all`) et le build TypeScript, puis résoudre toutes les erreurs détectées.

## 📋 PHASE 1 : EXÉCUTER LES CHECKS

### Commandes à exécuter

```bash
# 1. Build TypeScript complet (tous les workspaces)
npm run build

# 2. Quality Gate complet (check:all + build)
npm run check:3

# Alternative: Quality checks seulement (sans build)
npm run check:all
```

### Ce que vérifie `check:3`

Le command `check:3` exécute :
1. **Quality Gate (check:all)** : Tous les checks CI (2-5 min)
2. **Build complet** : Build TypeScript de tous les workspaces

**Note** : `check:3` est la commande **MANDATORY** avant de créer une PR, surtout après migrations/refactors.

### Classification des erreurs

Classe toutes les erreurs par type :

1. **TypeScript Build** :
   - Imports manquants (`Cannot find module`)
   - Types incorrects (`Type 'X' is not assignable to type 'Y'`)
   - Conversions ObjectId ↔ Branded Types
   - AccessMode incomplet (propriétés manquantes)
   - Type guards manquants
   - Erreurs de génériques

2. **Quality Checks (TIER 3 - CI Quality Gate)** :

   **Critical Checks (Bloquent CI)** :
   - Async/Await : Promesses non attendues (race conditions)
   - Promise Catch : Promesses non catchées (crashes)
   - Portal Architecture : Violations architecture multi-portail
   - API Auth : Routes API non protégées
   - Forbidden Imports : Imports interdits (runtime errors)
   - API Tenant Guards : Scoping tenant incorrect (data isolation)
   - Dangerous DB Patterns : Patterns MongoDB dangereux
   - React Hooks : Violations hooks React (infinite loops)
   - Infinite Loops : Patterns de boucles infinies
   - Type Consistency : Incohérences de types

   **Non-Critical Checks (Warnings)** :
   - Portal Page Quality
   - Hydration Errors
   - i18n Message Usage
   - Dead Code Detection
   - Orphan Routes

3. **Lint** :
   - Code style (ESLint)
   - Import rules (forbidden imports)
   - Type safety (TypeScript strict)

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
- **Async/Await** : Toujours attendre les promesses, jamais de promesses non attendues
- **Promise Catch** : Toujours catch les promesses, jamais de promesses non catchées

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

#### 1. Critical Checks (Bloquent CI)

**Async/Await** :
- Détecte : Promesses non attendues (`await` manquant)
- Solution : Ajouter `await` à toutes les opérations async

**Promise Catch** :
- Détecte : Promesses non catchées
- Solution : Ajouter `.catch()` ou `try/catch` autour des promesses

**Portal Architecture** :
- Détecte : Violations architecture multi-portail (portal branching dans services, header reads, etc.)
- Solution : Refactor selon architecture portal-neutral

**API Auth** :
- Détecte : Routes API non protégées
- Solution : Ajouter `requirePortal()`, `requirePermission()`, `requireModuleEnabled()`

**Forbidden Imports** :
- Détecte : Imports interdits (cross-layer violations)
- Solution : Corriger selon Import Rules Matrix

**API Tenant Guards** :
- Détecte : Scoping tenant incorrect
- Solution : Corriger repository scoping avec AccessMode

**Dangerous DB Patterns** :
- Détecte : Patterns MongoDB dangereux (`dropDatabase()`, `deleteMany({})`, etc.)
- Solution : Utiliser des requêtes filtrées, jamais de suppressions globales

**React Hooks** :
- Détecte : Violations hooks React (infinite loops, dependencies incorrectes)
- Solution : Corriger selon règles React

**Infinite Loops** :
- Détecte : Patterns de boucles infinies
- Solution : Corriger la logique de boucle

**Type Consistency** :
- Détecte : Incohérences de types
- Solution : Corriger les types pour cohérence

#### 2. Non-Critical Checks (Warnings)

**Portal Page Quality** :
- Détecte : Problèmes de qualité des pages portal
- Solution : Améliorer la qualité des pages

**Hydration Errors** :
- Détecte : Erreurs d'hydratation React
- Solution : Corriger SSR/client mismatch

**i18n Message Usage** :
- Détecte : Problèmes d'utilisation des messages i18n
- Solution : Corriger l'utilisation des clés i18n

**Dead Code Detection** :
- Détecte : Code mort
- Solution : Supprimer le code mort

**Orphan Routes** :
- Détecte : Routes orphelines
- Solution : Supprimer ou corriger les routes

### Résolution Lint Errors

**Solution** :
- Code Style : Corrige selon règles ESLint
- Import Rules : Vérifie Import Rules Matrix, corrige imports interdits
- Type Safety : Corrige types selon règles TypeScript strict

## ✅ PHASE 3 : VÉRIFIER SYSTÉMATIQUEMENT

### Après chaque correction

Re-exécute les checks pour vérifier :

```bash
# Build TypeScript
npm run build

# Quality Gate complet
npm run check:3
```

### CRITIQUE : Ne JAMAIS déclarer "terminé" tant que

- ❌ `npm run build` échoue (même une seule erreur)
- ❌ `npm run check:3` échoue (même un seul check critique)
- ❌ Des erreurs TypeScript persistent
- ❌ Des checks critiques échouent (bloquent CI)

### Seulement déclare "terminé" quand

- ✅ `npm run build` passe SANS ERREUR (tous les workspaces)
- ✅ `npm run check:3` passe SANS ERREUR (tous les checks critiques)
- ✅ Aucune erreur TypeScript
- ✅ Tous les checks critiques passent

**Note** : Les warnings non-critiques sont acceptables, mais doivent être documentés.

## 📊 RÉSUMÉ FINAL

À la fin, fournis un résumé complet :

### Erreurs Résolues

- **TypeScript Build** : X erreurs résolues
- **Quality Checks Critiques** : X erreurs résolues
- **Quality Checks Non-Critiques** : X warnings (documentés)
- **Lint** : X erreurs résolues

### Vérifications Finales

- ✅ `npm run build` : PASS (tous les workspaces)
- ✅ `npm run check:3` : PASS (tous les checks critiques)
- ✅ TypeScript : 0 erreurs
- ✅ Quality Checks Critiques : 0 erreurs

### Fichiers Modifiés

- `path/to/file1.ts` : [description correction]
- `path/to/file2.ts` : [description correction]

### Warnings Non-Critiques (si applicable)

- `check-name` : X warnings (non-bloquants, documentés)

### Prêt pour Push/PR

✅ **OUI** - Build et quality checks passent, code prêt pour production

## 📚 RÉFÉRENCES

- `.cursor/rules/general.mdc` - Règles générales
- `.cursor/rules/backend-rules.mdc` - Règles backend
- `.cursor/rules/frontend-rules.mdc` - Règles frontend
- `docs/02-development/quality/quality-architecture.md` - Quality system complet
- `docs/01-architecture/portal/portal-architecture.md` - Portal architecture
- `docs/01-architecture/development/typescript-branded-types.md` - Conversions ObjectId ↔ Branded Types
- `scripts/01-quality/ci/README.md` - Documentation CI Quality Gate
