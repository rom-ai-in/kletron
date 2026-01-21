# 🧪 Testing Prompt - Run & Fix Tests

Tu es un expert en tests pour le monorepo Numezis. Ta mission est d'exécuter TOUS les tests et de résoudre TOUTES les erreurs pour garantir que le code est prêt pour la production.

## 🎯 Objectif

Exécuter et corriger tous les tests du monorepo :
- Tests backend (`apps/api`)
- Tests frontend (`apps/web`)
- Tests d'intégration (`tests/integration`)
- Tests E2E (`tests/e2e`)

## 📋 PHASE 1 : IDENTIFIER TOUTES LES ERREURS DE TESTS

### Commandes à exécuter

```bash
# Tests backend (Vitest avec mongomock)
npm --workspace apps/api run test

# Tests frontend (Vitest)
npm --workspace apps/web run test

# Tests d'intégration (requiert MONGO_URI)
npm --workspace tests/integration run test

# Tests E2E (Playwright)
npm run test:e2e
```

### Classification des erreurs

Classe toutes les erreurs par type :

1. **Tests qui échouent** :
   - Backend : Erreurs dans `apps/api/tests/`
   - Frontend : Erreurs dans `apps/web/tests/`
   - Intégration : Erreurs dans `tests/integration/`
   - E2E : Erreurs dans `tests/e2e/`

2. **Types d'erreurs** :
   - Assertions échouées (expect, assert)
   - Erreurs de compilation TypeScript dans les tests
   - Mocks manquants ou incorrects
   - Fixtures manquantes ou incorrectes
   - Erreurs de timing (async/await)
   - Erreurs de scoping (AccessMode, tenant/company)
   - Erreurs de conversion (ObjectId ↔ Branded Types)

3. **Priorité** :
   - **Bloquant** : Tests critiques qui échouent
   - **Important** : Tests de régression qui échouent
   - **Mineur** : Tests non-critiques qui échouent

### Liste exhaustive

Crée une liste avec :
- Fichier de test + ligne + nom du test
- Type d'erreur + message complet
- Priorité (Bloquant/Important/Mineur)
- Cause probable

## 🔧 PHASE 2 : RÉSOUDRE SYSTÉMATIQUEMENT

### Règles critiques à TOUJOURS respecter

#### Architecture & Scoping

- **AccessMode dans les tests** : Créer des AccessMode complets pour les tests
  - `CompanyAccessMode` : `portal`, `userId`, `tenantId`, `companyId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`, `country`
  - `TenantAccessMode` : `portal`, `userId`, `tenantId`, `userRole`, `effectivePermissions`, `enabledModules`, `locale`
  - Utiliser `satisfies CompanyAccessMode` pour validation

- **Repository Scoping** : Tous les tests de repositories doivent tester le scoping avec différents AccessMode
  - Company Portal : Filtre par `companyId` et `tenantId`
  - Tenant Portal : Filtre par `tenantId`
  - Partner Portal : Filtre par `accessibleCompanyIds`
  - Superadmin Portal : Pas de filtrage automatique

- **Mocks & Fixtures** : Utiliser les factories dans `tests/factories/` pour créer des données de test

#### TypeScript dans les tests

- **Branded Types** :
  - ObjectId → Branded : `toStringId(id) as UserId` (ou `TenantId`, `CompanyId`)
  - Branded → ObjectId : `toObjectId(id)` pour MongoDB
  - Arrays : `.map((id) => toStringId(id) as UserId)`

- **Types Partagés** : Toujours importer depuis `@numezis/shared-ts`, jamais recréer localement

- **Zero any Frontend** : Frontend (`apps/web`) ZÉRO `any` toléré, utiliser `unknown` + type guards

#### Patterns de test

- **Isolation** : Chaque test doit être indépendant, pas de dépendances entre tests
- **Cleanup** : Utiliser des IDs uniques par test (via `makeTestId(prefix)`)
- **MongoDB** : 
  - Tests unitaires : Utiliser `USE_MEMORY_MONGO=true` avec `mongodb-memory-server`
  - Tests d'intégration : Utiliser MongoDB Atlas avec des IDs uniques et des requêtes filtrées
  - **JAMAIS** : `dropDatabase()`, `collection.drop()`, `deleteMany({})` sans filtres

- **Async/Await** : Toujours utiliser `async/await` correctement, pas de promesses non attendues

### Résolution des erreurs de tests

#### 1. Assertions échouées

**Cause** : Logique de test incorrecte ou code testé incorrect

**Solution** :
- Vérifier la logique du test
- Vérifier la logique du code testé
- Vérifier les mocks et fixtures
- Vérifier les conversions ObjectId ↔ Branded Types

#### 2. Erreurs de compilation TypeScript

**Cause** : Types incorrects dans les tests

**Solution** :
- Vérifier les imports depuis `@numezis/shared-ts`
- Vérifier les conversions ObjectId ↔ Branded Types
- Vérifier les AccessMode complets
- Vérifier les types de retour explicites

#### 3. Mocks manquants ou incorrects

**Cause** : Mocks non configurés ou incorrects

**Solution** :
- Vérifier les mocks avec `vi.mock()` (Vitest)
- Vérifier les factories dans `tests/factories/`
- Vérifier les fixtures et données de test

#### 4. Erreurs de timing (async/await)

**Cause** : Promesses non attendues ou timing incorrect

**Solution** :
- Utiliser `await` pour toutes les opérations async
- Utiliser `waitFor()` pour les opérations asynchrones dans les tests
- Vérifier les timeouts et délais

#### 5. Erreurs de scoping (AccessMode)

**Cause** : AccessMode incomplet ou incorrect dans les tests

**Solution** :
- Créer des AccessMode complets avec toutes les propriétés requises
- Utiliser `satisfies CompanyAccessMode` pour validation
- Vérifier le scoping des repositories avec différents AccessMode

#### 6. Erreurs de conversion (ObjectId ↔ Branded Types)

**Cause** : Conversions incorrectes entre ObjectId et Branded Types

**Solution** :
- ObjectId → Branded : `toStringId(id) as UserId`
- Branded → ObjectId : `toObjectId(id)` pour MongoDB
- Arrays : `.map((id) => toStringId(id) as UserId)`

### Patterns de correction

#### Pattern 1 : Test de repository avec AccessMode

```typescript
import { toStringId } from "../../repositories/base.repository.js";
import type { CompanyAccessMode, UserId, TenantId, CompanyId } from "@numezis/shared-ts";
import { ObjectId } from "mongodb";

// ✅ CORRECT: AccessMode complet dans les tests
const mockAccessMode: CompanyAccessMode = {
  portal: "company",
  userId: new ObjectId().toString() as UserId,
  tenantId: new ObjectId().toString() as TenantId,
  companyId: new ObjectId().toString() as CompanyId,
  userRole: "COMPANY_ADMIN",
  effectivePermissions: [],
  enabledModules: [],
  locale: "en",
  country: {
    code: "CH",
    currency: "CHF",
    locale: "fr-CH",
  },
} satisfies CompanyAccessMode;

// Test avec AccessMode
it("should filter by companyId", async () => {
  const result = await invoiceRepo.findByCompany(mockAccessMode.companyId);
  expect(result).toHaveLength(1);
});
```

#### Pattern 2 : Test avec conversions ObjectId

```typescript
import { toStringId, toObjectId } from "../../repositories/base.repository.js";
import type { UserId } from "@numezis/shared-ts";

// ✅ CORRECT: Conversion ObjectId → Branded Type
const userId: UserId = toStringId(user._id) as UserId;

// ✅ CORRECT: Conversion Branded Type → ObjectId pour MongoDB
const filter = {
  userId: toObjectId(userId),
};
```

#### Pattern 3 : Test avec mocks

```typescript
import { vi } from "vitest";

// ✅ CORRECT: Mock avec Vitest
vi.mock("@/domain/invoices/invoice.service", () => ({
  invoiceService: {
    listInvoices: vi.fn().mockResolvedValue([]),
  },
}));
```

## ✅ PHASE 3 : VÉRIFIER SYSTÉMATIQUEMENT

### Après chaque correction

Re-exécute les tests pour vérifier :

```bash
npm --workspace apps/api run test
npm --workspace apps/web run test
npm --workspace tests/integration run test
npm run test:e2e
```

### CRITIQUE : Ne JAMAIS déclarer "terminé" si

- ❌ Tests backend échouent (même un seul test)
- ❌ Tests frontend échouent (même un seul test)
- ❌ Tests d'intégration échouent (même un seul test)
- ❌ Tests E2E échouent (même un seul test)
- ❌ Erreurs de compilation TypeScript dans les tests

### Seulement déclare "terminé" quand

- ✅ Tous les tests backend passent
- ✅ Tous les tests frontend passent
- ✅ Tous les tests d'intégration passent (si applicable)
- ✅ Tous les tests E2E passent (si applicable)
- ✅ Aucune erreur de compilation TypeScript

## 📊 RÉSUMÉ FINAL

À la fin, fournis un résumé complet :

### Tests Résolus

- **Backend** : X tests corrigés
- **Frontend** : X tests corrigés
- **Intégration** : X tests corrigés
- **E2E** : X tests corrigés

### Vérifications Finales

- ✅ Tests backend : PASS
- ✅ Tests frontend : PASS
- ✅ Tests d'intégration : PASS (si applicable)
- ✅ Tests E2E : PASS (si applicable)

### Fichiers Modifiés

- `path/to/test1.test.ts` : [description correction]
- `path/to/test2.test.ts` : [description correction]

### Prêt pour Push/PR

✅ **OUI** - Tous les tests passent, code prêt pour production

## 📚 RÉFÉRENCES

- `.cursor/rules/general.mdc` - Règles générales
- `.cursor/rules/backend-rules.mdc` - Règles backend
- `.cursor/rules/frontend-rules.mdc` - Règles frontend
- `docs/07-testing/` - Documentation complète des tests
- `docs/01-architecture/portal/portal-architecture.md` - Architecture des portails
- `docs/01-architecture/development/typescript-branded-types.md` - Conversions ObjectId ↔ Branded Types
