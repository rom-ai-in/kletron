# Audit de la Solidité de la Logique d'Auto-Numérotation

Tu es un **auditeur senior Architecture & Patterns** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de la solidité, cohérence et complétude** de la logique d'auto-numérotation pour toutes les entités qui nécessitent une numérotation séquentielle automatique (invoices, orders, quotes, bills, expenses, expense-reports, purchase-orders, transfers, stocktake, returns, adjustments, ledger entries, etc.).

**CRITICAL** : Toutes les entités qui nécessitent une numérotation séquentielle **DOIVENT** utiliser le service centralisé `NumberingService`. **JAMAIS** de logique custom de numérotation.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Numbering Service Documentation** : `docs/02-development/services/numbering-service.md` ⭐ **CANONIQUE**
- **Module Creation Checklist** : `docs/01-architecture/development/module-creation-checklist.md` (section "Automatic Numbering Pattern")
- **Service Implementation** : `apps/api/src/services/numbering.service.ts`
- **MongoDB Index Management** : `docs/05-infrastructure/core/mongodb-index-management.md`
- **Country Compliance** : `docs/04-features/05-country/country-architecture.md`
- **Backend Rules** : `.cursor/rules/backend-rules.mdc`
- **Quality Architecture** : `docs/02-development/quality/quality-architecture.md`

---

## 🎯 Scope de l'Audit

### Entités à Auditer

**Entités connues utilisant l'auto-numérotation** (basé sur grep) :
- `invoices` → `invoiceNumber`
- `orders` → `orderNumber`
- `quotes` → `quoteNumber`
- `bills` → `billNumber`
- `expenses` → `expenseNumber`
- `expense-reports` → `reportNumber`
- `purchase-orders` → `orderNumber`
- `transfers` → `transferNumber`
- `stocktake` → `stocktakeNumber`
- `returns` → `returnNumber`
- `adjustments` → `adjustmentNumber`
- `ledger` → `entryNumber`

**Entités candidates à vérifier** (peuvent nécessiter auto-numérotation) :
- `credit-notes` (sales) → `creditNoteNumber`?
- `credit-notes` (purchases) → `creditNoteNumber`?
- `deliveries` → `deliveryNumber`?
- `receipts` → `receiptNumber`?
- `payments` → `paymentNumber`?
- `reconciliations` → `reconciliationNumber`?

### Fichiers à Analyser

- **Services** : `apps/api/src/domain/**/*.service.ts`
- **Repositories** : `apps/api/src/repositories/**/*.repository.ts` et `apps/api/src/domain/**/*.repository.ts`
- **Schemas** : `apps/api/src/domain/**/*.schema.ts` et `apps/api/src/domain/**/*.types.ts`
- **Service centralisé** : `apps/api/src/services/numbering.service.ts`
- **Tests** : `apps/api/tests/**/*numbering*.test.ts` et `apps/api/tests/**/*number*.test.ts`

---

## ✅ 1. IDENTIFICATION DES ENTITÉS AVEC AUTO-NUMÉROTATION

### 1.1 Recherche Complète

**CRITICAL** : Identifier TOUTES les entités qui utilisent actuellement l'auto-numérotation.

**Méthode** :
1. Rechercher `numberingService` dans `apps/api/src/domain/`
2. Rechercher les champs `*Number`, `*NumberSequence`, `*NumberYear` dans les schemas
3. Rechercher les imports de `NumberingService`
4. Vérifier les appels à `generateNextNumber()`

**Checklist** :
- [ ] Liste complète des entités avec auto-numérotation créée
- [ ] Champ de numérotation identifié pour chaque entité (`invoiceNumber`, `orderNumber`, etc.)
- [ ] Entités manquantes identifiées (devraient utiliser mais ne l'utilisent pas)

**Action** : Créer un tableau avec :
| Entité | Champ Number | Champ Sequence | Champ Year | Service Utilisé | Statut |
|--------|--------------|----------------|------------|-----------------|--------|
| `invoices` | `invoiceNumber` | `invoiceNumberSequence` | `invoiceNumberYear` | `NumberingService` | ✅/⚠️/❌ |

---

## ✅ 2. VÉRIFICATION DE LA COHÉRENCE DU PATTERN

### 2.1 Service Injection (CRITICAL)

**Pattern attendu** : `docs/02-development/services/numbering-service.md` section "Pattern d'utilisation"

**Checklist par entité** :
- [ ] `NumberingService` injecté dans le constructeur
- [ ] Type correct : `private numberingService?: NumberingService` (optionnel) ou `private numberingService: NumberingService` (requis)
- [ ] Gestion d'erreur si service non disponible : `throw Errors.internal(translate("errors.numbering_service_unavailable", locale))`
- [ ] Erreur utilise i18n (pas de string hardcodée)

**Violations détectées** :
- ❌ Service non injecté → **BLOQUANT**
- ❌ Gestion d'erreur manquante → **BLOQUANT**
- ❌ Erreur hardcodée (pas i18n) → **BLOQUANT**

**Référence** : `docs/02-development/services/numbering-service.md` section "Pattern d'utilisation"

### 2.2 Génération dans create<Entity>() (CRITICAL)

**Pattern attendu** : `docs/02-development/services/numbering-service.md` section "Pattern d'utilisation"

**Checklist par entité** :
- [ ] Génération automatique si `<field>Number` non fourni
- [ ] Utilisation de `CountryComplianceService.getCountryCompliance()` pour le format
- [ ] Fallback approprié si format non disponible (ex: `compliance.invoice?.numberingFormat || "INV-{YYYY}-{NNNN}"`)
- [ ] Appel correct à `numberingService.generateNextNumber()` avec config complète
- [ ] Config inclut : `format`, `collection`, `companyIdField`, `numberField`, `sequenceField`, `yearField`
- [ ] Stockage de `number`, `sequence`, `year` dans les variables locales
- [ ] Assignation correcte des valeurs générées au document lors de la création

**Pattern de code attendu** :
```typescript
if (!data.invoiceNumber) {
  if (!this.numberingService) {
    throw Errors.internal(translate("invoices.errors.numbering_service_unavailable", locale));
  }
  
  const compliance = await this.complianceService.getCountryCompliance(company.countryCode);
  const format = compliance.invoice?.numberingFormat || "INV-{YYYY}-{NNNN}";
  
  const generated = await this.numberingService.generateNextNumber(
    {
      format,
      collection: this.invoicesRepo.collection as Collection<Record<string, unknown>>,
      companyIdField: "companyId",
      numberField: "invoiceNumber",
      sequenceField: "invoiceNumberSequence",
      yearField: "invoiceNumberYear",
    },
    accessMode.companyId,
    new Date(),
  );
  
  invoiceNumber = generated.number;
  invoiceNumberSequence = generated.sequence;
  invoiceNumberYear = generated.year;
}
```

**Violations détectées** :
- ❌ Génération manquante → **BLOQUANT**
- ❌ Pas de `CountryComplianceService` → **BLOQUANT**
- ❌ Config incomplète → **BLOQUANT**
- ❌ Cast `as any` sans justification → **ATTENTION**

**Référence** : `docs/02-development/services/numbering-service.md` section "Pattern d'utilisation"

### 2.3 Schema (CRITICAL)

**Pattern attendu** : `docs/02-development/services/numbering-service.md` section "Schéma MongoDB"

**Checklist par entité** :
- [ ] Champs `*Number?: string` présent dans interface document
- [ ] Champs `*NumberSequence?: number` présent
- [ ] Champs `*NumberYear?: number` présent
- [ ] Champs optionnels dans `createSchema` (généré automatiquement si absent)
- [ ] Types corrects (pas de `any`)

**Pattern de code attendu** :
```typescript
export interface InvoiceDocument {
  // ...
  invoiceNumber?: string; // Numéro généré (ex: "INV-2025-0001")
  invoiceNumberSequence?: number; // Séquence interne (ex: 1)
  invoiceNumberYear?: number; // Année de la séquence (ex: 2025)
  // ...
}
```

**Violations détectées** :
- ❌ Champs manquants → **BLOQUANT**
- ❌ Champs requis au lieu d'optionnels → **BLOQUANT**

**Référence** : `docs/02-development/services/numbering-service.md` section "Schéma MongoDB"

### 2.4 Repository Indexes (CRITICAL)

**Pattern attendu** : `docs/02-development/services/numbering-service.md` section "Index MongoDB requis"

**Checklist par entité** :
- [ ] Index unique créé dans `ensureIndexes()` : `{ tenantId: 1, companyId: 1, <field>Number: 1 }` avec `unique: true, sparse: true`
- [ ] Index de séquence créé : `{ companyId: 1, <field>NumberYear: 1, <field>NumberSequence: -1 }` (optionnel mais recommandé)
- [ ] Utilisation de `createIndexSafely()` pour gestion d'erreurs gracieuse
- [ ] Index créé dans `ensureIndexes()` (pas ailleurs)

**Pattern de code attendu** :
```typescript
async ensureIndexes(): Promise<void> {
  // Index unique pour garantir l'unicité
  await createIndexSafely(
    this.collection,
    { tenantId: 1, companyId: 1, invoiceNumber: 1 },
    { name: "idx_tenant_company_invoice_number", unique: true, sparse: true },
  );
  
  // Index pour optimiser les requêtes de séquence
  await createIndexSafely(
    this.collection,
    { companyId: 1, invoiceNumberYear: 1, invoiceNumberSequence: -1 },
    { name: "idx_company_year_sequence" },
  );
}
```

**Violations détectées** :
- ❌ Index unique manquant → **BLOQUANT**
- ❌ Index sans `sparse: true` → **BLOQUANT**
- ❌ Index sans `tenantId` et `companyId` → **BLOQUANT**
- ❌ Pas de `createIndexSafely()` → **BLOQUANT**

**Référence** : `docs/02-development/services/numbering-service.md` section "Index MongoDB requis"

### 2.5 Collection Access (CRITICAL)

**Checklist par entité** :
- [ ] Repository expose `collection` pour `NumberingService`
- [ ] Type cast correct : `as Collection<Record<string, unknown>>` ou équivalent
- [ ] Pas de cast `as any` (ou justifié avec commentaire ESLint `/* eslint-disable-next-line @typescript-eslint/no-explicit-any */`)

**Violations détectées** :
- ❌ Repository n'expose pas `collection` → **BLOQUANT**
- ❌ Cast `as any` sans justification → **ATTENTION**

**Référence** : `docs/02-development/services/numbering-service.md` section "Pattern d'utilisation"

---

## ✅ 3. VÉRIFICATION DE LA ROBUSTESSE

### 3.1 Gestion des Race Conditions (CRITICAL)

**Pattern attendu** : `apps/api/src/services/numbering.service.ts` méthode `generateNextNumber()`

**Checklist** :
- [ ] `NumberingService.generateNextNumber()` utilise retry logic (maxRetries: 3 par défaut)
- [ ] Vérification d'unicité avant retour (check `existing`)
- [ ] Logging des collisions détectées (via `logger.warn()`)
- [ ] Gestion d'erreur si max retries atteint (throw avec message explicite)

**Référence** : `apps/api/src/services/numbering.service.ts` lignes 107-174

**Violations détectées** :
- ❌ Pas de retry logic → **BLOQUANT**
- ❌ Pas de vérification d'unicité → **BLOQUANT**

### 3.2 Unicité Garantie (CRITICAL)

**Checklist** :
- [ ] Index unique MongoDB créé (sparse: true pour permettre null)
- [ ] Index inclut `tenantId` et `companyId` pour scoping multi-tenant
- [ ] Pas de doublons possibles (vérifier migrations existantes)
- [ ] Index unique vérifié dans tests

**Violations détectées** :
- ❌ Index unique manquant → **BLOQUANT**
- ❌ Index sans scoping multi-tenant → **BLOQUANT**

**Référence** : `docs/02-development/services/numbering-service.md` section "Index MongoDB requis"

### 3.3 Reset Annuel (CRITICAL)

**Checklist** :
- [ ] Séquence reset automatiquement par année (utilise `date.getFullYear()`)
- [ ] `yearField` utilisé correctement dans les requêtes MongoDB
- [ ] Format supporte `{YYYY}` placeholder
- [ ] Reset annuel testé

**Violations détectées** :
- ❌ Reset annuel non fonctionnel → **BLOQUANT**

**Référence** : `apps/api/src/services/numbering.service.ts` lignes 114-133

### 3.4 Formats Supportés

**Checklist** :
- [ ] Formats testés : `{YYYY}`, `{NNNN}`, `{NNN}`, `{NN}`, `{N}`
- [ ] Formats par pays configurés dans `CountryCompliance`
- [ ] Fallback approprié si format non configuré
- [ ] Formats adaptés par type d'entité (INV → ORD, INV → QUO, etc.)

**Référence** : `docs/02-development/services/numbering-service.md` section "Formats supportés"

---

## ✅ 4. IDENTIFICATION DES ENTITÉS MANQUANTES

### 4.1 Recherche des Entités Candidates

**CRITICAL** : Identifier les entités qui DEVRAIENT utiliser l'auto-numérotation mais ne l'utilisent PAS.

**Méthode** :
1. Rechercher les entités avec champs `*Number` dans les schemas
2. Vérifier si elles utilisent `NumberingService`
3. Vérifier la documentation métier (requirements)
4. Comparer avec entités similaires

**Checklist** :
- [ ] Liste des entités candidates créée
- [ ] Justification métier pour chaque entité (pourquoi devrait/non utiliser auto-numérotation)
- [ ] Priorité d'implémentation (P0, P1, P2)

**Action** : Créer un tableau avec :
| Entité | Champ Number | Devrait Utiliser? | Justification | Priorité |
|--------|--------------|-------------------|---------------|----------|
| `credit-notes` (sales) | `creditNoteNumber` | ? | ? | ? |

---

## ✅ 5. VÉRIFICATION DE L'ARCHITECTURE

### 5.1 Centralisation (CRITICAL)

**CRITICAL** : Toutes les entités utilisent `NumberingService` (pas de logique custom).

**Checklist** :
- [ ] Toutes les entités utilisent `NumberingService` (pas de logique custom)
- [ ] Pas de duplication de code de génération
- [ ] Service réutilisable et testable
- [ ] Pas de méthodes custom `getNextNumber()` dans les repositories

**Violations détectées** :
- ❌ Logique custom de numérotation → **BLOQUANT**
- ❌ Duplication de code → **BLOQUANT**

**Référence** : `.cursor/rules/general.mdc` section "Creating New Modules" - Automatic Numbering Pattern

### 5.2 Dépendances

**Checklist** :
- [ ] `NumberingService` injecté via DI (pas d'import direct)
- [ ] Service optionnel ou requis selon le contexte
- [ ] Gestion d'erreur si service non disponible

**Violations détectées** :
- ❌ Import direct au lieu de DI → **BLOQUANT**

### 5.3 Intégration Country Compliance

**Checklist** :
- [ ] Formats configurés par pays dans `CountryCompliance`
- [ ] Fallback approprié si pays non configuré
- [ ] Formats adaptés par type d'entité (INV → ORD, INV → QUO, etc.)

**Référence** : `docs/02-development/services/numbering-service.md` section "Configuration par pays"

### 5.4 Tests

**Checklist** :
- [ ] Tests unitaires pour `NumberingService`
- [ ] Tests d'intégration pour chaque entité utilisant la numérotation
- [ ] Tests de race conditions
- [ ] Tests de formats différents
- [ ] Tests de reset annuel
- [ ] Tests d'unicité (index unique bloque les doublons)

**Référence** : `docs/02-development/services/numbering-service.md` section "Tests"

---

## ✅ 6. VÉRIFICATION DE LA DOCUMENTATION

### 6.1 Documentation Technique

**Checklist** :
- [ ] `docs/02-development/services/numbering-service.md` à jour
- [ ] Exemples de code corrects
- [ ] Checklist d'intégration documentée
- [ ] Patterns et anti-patterns documentés

**Référence** : `docs/02-development/services/numbering-service.md`

### 6.2 Documentation Métier

**Checklist** :
- [ ] Formats par pays documentés
- [ ] Comportement de reset annuel documenté
- [ ] Gestion des numéros manuels documentée

### 6.3 Code Comments

**Checklist** :
- [ ] Commentaires JSDoc sur `NumberingService`
- [ ] Commentaires dans les services utilisant la numérotation
- [ ] Explications des choix de design

---

## ✅ 7. VÉRIFICATION DE LA CONFORMITÉ AUX RÈGLES

### 7.1 Module Creation Checklist

**Checklist** :
- [ ] Checklist respectée pour toutes les entités
- [ ] Pas d'écarts avec `docs/01-architecture/development/module-creation-checklist.md` section "Automatic Numbering Pattern"

**Référence** : `docs/01-architecture/development/module-creation-checklist.md` lignes 514-545

### 7.2 Quality Checks

**Checklist** :
- [ ] Pas de `console.log` dans le code de numérotation (utilise `logger`)
- [ ] Pas de `any` types (sauf backend legacy avec justification)
- [ ] Types explicites partout
- [ ] i18n utilisé pour les erreurs (pas de strings hardcodées)

**Violations détectées** :
- ❌ `console.log` présent → **BLOQUANT**
- ❌ `any` dans frontend → **BLOQUANT**
- ❌ Erreurs hardcodées → **BLOQUANT**

**Référence** : `.cursor/rules/general.mdc` section "Zero `any` Policy" et "Internationalization (CRITICAL)"

### 7.3 Security

**Checklist** :
- [ ] Pas de secrets dans les numéros générés
- [ ] Scoping correct (companyId, tenantId)
- [ ] Pas de fuite d'information entre tenants

---

## 📊 FORMAT DE RÉPONSE ATTENDU

### Structure Minimale (Priorité)

1. **📊 Résumé Exécutif** (1-2 paragraphes)
   - Nombre total d'entités auditées
   - Taux de conformité global
   - Top 5 problèmes critiques
   - Verdict global : 🟥 **CRITIQUE** | 🟨 **ATTENTION** | 🟩 **OK**

2. **📋 Inventaire des Entités** (Tableau)
   | Entité | Champ Number | Service | Schema | Indexes | Statut |
   |--------|--------------|---------|--------|---------|--------|
   | `invoices` | `invoiceNumber` | ✅ | ✅ | ✅ | ✅ Conforme |
   | `orders` | `orderNumber` | ✅ | ✅ | ⚠️ | ⚠️ Partiel |

3. **🔴 Violations Critiques** (Liste)
   - ❌ `orders` : Index unique manquant → **BLOQUANT**
   - ❌ `quotes` : Pas de gestion d'erreur si `NumberingService` non disponible → **BLOQUANT**

4. **🟡 Violations Non-Critiques** (Liste)
   - ⚠️ `bills` : Cast `as any` sans justification → **ATTENTION**

5. **📝 Entités Manquantes** (Tableau)
   | Entité | Champ Number | Devrait Utiliser? | Justification | Priorité |
   |--------|--------------|-------------------|---------------|----------|
   | `credit-notes` (sales) | `creditNoteNumber` | ✅ Oui | Entité similaire à invoices | P1 |

6. **🏗️ Analyse Architecturale** (Liste structurée)
   - **Centralisation** : ✅ Toutes les entités utilisent `NumberingService`
   - **Robustesse** : ⚠️ Race conditions gérées mais tests manquants
   - **Tests** : ❌ Tests manquants pour 3 entités

7. **📌 Actions Prioritaires** (Checklist)
   - [ ] **Priorité 1** : Corriger index unique manquant dans `orders`
   - [ ] **Priorité 2** : Ajouter tests pour `quotes`, `bills`, `expenses`
   - [ ] **Priorité 3** : Migrer `credit-notes` vers auto-numérotation

### Règles de Réponse

- ✅ **Concis** : Maximum 1 page par section (sauf violations critiques)
- ✅ **Actionnable** : Chaque violation = correction proposée avec code exact
- ✅ **Référencé** : Citer docs sources explicitement (ex: "violates `docs/02-development/services/numbering-service.md` section 'Index MongoDB requis'")
- ✅ **Technique** : Citer fichiers, lignes, patterns explicitement
- ❌ **Pas de blabla** : Pas de généralités vagues, uniquement faits techniques
- ❌ **Pas de suppositions** : Si information manquante, lister ce qui manque MAIS donner quand même une checklist exhaustive

---

## 🎯 Priorisation

### Priorité 1 (Bloquant - Corriger Immédiatement)
- Index unique manquant
- Service non injecté
- Génération manquante
- Logique custom de numérotation
- Erreurs hardcodées (pas i18n)

### Priorité 2 (Important - Corriger Avant Prochaine Release)
- Tests manquants
- Documentation incomplète
- Cast `as any` sans justification
- Entités manquantes (devraient utiliser)

### Priorité 3 (Amélioration Continue)
- Amélioration de la robustesse
- Optimisation des formats
- Documentation métier

---

## ➤ Résultat Attendu

Une réponse **ultra-structurée, détaillée, très technique, directement exploitable**, utilisant :
- Les **patterns établis** (`NumberingService`, indexes, schemas)
- Les **comparaisons inter-entités** (invoices vs orders vs quotes)
- Les **sources de vérité** (docs, code, checklists)
- Les **actions prioritaires** (fixes proposés avec code exact)

**Verdict final** :
- 🟥 **CRITIQUE** : Violations bloquantes, logique custom, index manquants
- 🟨 **ATTENTION** : Corrections nécessaires mais non-bloquantes
- 🟩 **OK** : Toutes les entités conformes, robustesse maximale, tests complets

---

## 🔧 Commandes Utiles

```bash
# Rechercher les utilisations de NumberingService
grep -r "numberingService" apps/api/src/domain/

# Rechercher les champs *Number dans les schemas
grep -r "Number\?:" apps/api/src/domain/*/**.schema.ts
grep -r "Number\?:" apps/api/src/domain/*/**.types.ts

# Rechercher les index de numérotation
grep -r "Number.*unique" apps/api/src/domain/*/**.repository.ts

# Vérifier les tests
find apps/api/tests -name "*numbering*" -o -name "*number*"
```

---

## 📌 Notes Importantes

1. **CRITICAL**: Ne jamais créer de logique custom de numérotation. Toujours utiliser `NumberingService`.
2. **CRITICAL**: Tous les index uniques doivent être `sparse: true` pour permettre les valeurs `null`.
3. **CRITICAL**: Tous les index doivent inclure `tenantId` et `companyId` pour le scoping multi-tenant.
4. **IMPORTANT**: Les formats doivent être configurables par pays via `CountryCompliance`.
5. **IMPORTANT**: La génération doit être thread-safe avec retry logic pour les race conditions.
