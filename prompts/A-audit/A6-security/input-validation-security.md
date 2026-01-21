Tu es un **auditeur senior Sécurité & Architecture** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de la validation des inputs**, en vérifiant que **TOUTES les routes API** utilisent des schemas Zod pour valider les inputs (body, query, params), que les erreurs de validation sont correctement gérées et localisées, et qu'aucune route n'accepte d'inputs non validés.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Zod Validation i18n** : `docs/02-development/backend/zod-validation-i18n.md`
- **Zod Validation Patterns Audit** : `docs/audits/zod-validation-patterns-audit.md`
- **Complete Rules Reference** : `docs/02-development/rules/complete-rules-reference.md`
- **Module Creation Checklist** : `docs/01-architecture/development/module-creation-checklist.md`
- **Route Helpers** : `apps/api/src/middleware/route-helpers.ts`
- **Error Handling** : `apps/api/src/core/errors/index.ts`
- **Quality Checks** : `scripts/01-quality/ci/check-api-quality.ts`

## ⚠️ NOTE IMPORTANTE - Gestion des Erreurs Zod

**CRITICAL** : Le middleware `error-handler` NE gère PAS automatiquement les `ZodError`. 

- ❌ **NE PAS utiliser** `schema.parse()` directement - Les `ZodError` ne seront pas converties en `ApiError` et deviendront des erreurs 500 non traduites
- ✅ **Utiliser** `schema.safeParse()` + `validationFromZod()` pour validation inline
- ✅ **Utiliser** `createProtectedRoute({ validateBody: schema })` pour validation middleware (automatique)

**Pattern correct** :
```typescript
// ✅ CORRECT
const bodyResult = schema.safeParse(req.body);
if (!bodyResult.success) {
  throw validationFromZod(bodyResult.error, locale);
}
const body = bodyResult.data;
```

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Type** : `full-audit` | `module-specific` | `portal-specific` | `diff-only`
   - **Portals concernés** : `company` | `tenant` | `partner` | `superadmin` | `all`
   - **Routes concernées** : Liste complète (ou `all`)
   - **Fichiers modifiés** : Liste complète (si diff-only)

2. **Routes à vérifier** :
   - Liste complète des routes dans `apps/api/src/routes/portals/*`
   - Méthodes HTTP : `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
   - Inputs à valider : `req.body`, `req.query`, `req.params`

3. **Schemas à vérifier** :
   - Liste complète des schemas Zod dans `apps/api/src/domain/*/schemas.ts`
   - Validation : `body`, `query`, `params`

---

## 🔍 1. VALIDATION DES INPUTS - RÈGLES GÉNÉRALES

### 1.1 Toutes les Routes DOIVENT Valider les Inputs

**CRITICAL** : Aucune route ne doit accepter d'inputs non validés.

**Règles** :
- ✅ **req.body** : DOIT être validé avec schema Zod (sauf GET/HEAD)
- ✅ **req.query** : DOIT être validé avec schema Zod (si query params utilisés)
- ✅ **req.params** : DOIT être validé via route middleware (si params utilisés)
- ✅ **Schemas Zod** : DOIVENT être définis dans `<module>.schemas.ts`
- ✅ **Type Inference** : DOIT utiliser `z.infer<typeof schema>` pour TypeScript types

**Pattern attendu** :
```typescript
// ✅ CORRECT: safeParse() + validationFromZod() (validation inline)
import { z } from "zod";
import { asyncHandler } from "../middleware/error-handler.js";
import { validationFromZod } from "../core/errors/index.js";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
});

router.post(
  "/endpoint",
  asyncHandler(async (req, res) => {
    const locale = req.locale || "en";
    const bodyResult = createSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw validationFromZod(bodyResult.error, locale);
    }
    const body = bodyResult.data;
    // ... rest of handler
  })
);
```

**Violations détectées** :
- ❌ Route sans validation `req.body` → **BLOQUANT**
- ❌ Route sans validation `req.query` (si query params utilisés) → **BLOQUANT**
- ❌ Route qui lit `req.body` directement sans validation → **BLOQUANT**

### 1.2 Schemas Zod - Pas de Messages Hardcodés

**CRITICAL** : Les schemas Zod NE DOIVENT PAS contenir de messages hardcodés en anglais.

**Règles** :
- ✅ **Pas de messages** : Schemas utilisent contraintes sans messages (ex: `.min(1)`, `.max(200)`)
- ✅ **Traduction automatique** : `validationFromZod()` traduit automatiquement les erreurs
- ✅ **i18n keys** : Messages d'erreur utilisent keys i18n (ex: `validation.min_string`, `validation.max_string`)

**Pattern attendu** :
```typescript
// ✅ CORRECT: Schema sans messages hardcodés
export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
  email: z.string().email(),
});

// ❌ WRONG: Schema avec messages hardcodés
export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be max 200 characters"),
  amount: z.number().positive("Amount must be positive"),
});
```

**Violations détectées** :
- ❌ Schema avec messages hardcodés en anglais → **ATTENTION** (doit être traduit)
- ❌ Schema avec messages hardcodés dans autres langues → **ATTENTION** (doit utiliser i18n)

### 1.3 Validation Error Handling

**CRITICAL** : Les erreurs de validation Zod DOIVENT être converties en `ApiError` avant d'être lancées. Le middleware error-handler NE gère PAS automatiquement `ZodError`.

**Règles** :
- ✅ **safeParse() + validationFromZod()** : Pattern recommandé pour validation inline
- ✅ **createProtectedRoute()** : Pattern recommandé pour validation middleware (automatique)
- ❌ **parse() direct** : Ne PAS utiliser - `ZodError` ne sera pas gérée correctement par le middleware
- ⚠️ **Try/catch avec parse()** : Fonctionne mais moins élégant que `safeParse()`

**Pattern attendu** :
```typescript
// ✅ CORRECT: safeParse() + validationFromZod() (validation inline)
import { validationFromZod } from "../core/errors/index.js";

router.post(
  "/endpoint",
  asyncHandler(async (req, res) => {
    const locale = req.locale || "en";
    const bodyResult = createSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw validationFromZod(bodyResult.error, locale);
    }
    const body = bodyResult.data;
    // ... rest of handler
  })
);

// ✅ CORRECT: createProtectedRoute() (validation middleware - BEST PRACTICE)
router.post(
  "/endpoint",
  ...createProtectedRoute({
    validateBody: createSchema,
    permission: "MODULE:ACTION",
  }),
  asyncHandler(async (req, res) => {
    const body = (req as any).validatedBody; // Déjà validé
    // ... rest of handler
  })
);

// ❌ WRONG: parse() direct (ZodError ne sera pas gérée)
router.post(
  "/endpoint",
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body); // ZodError → 500 Internal Error
    // ... rest of handler
  })
);

// ⚠️ ATTENTION: Try/catch avec parse() (fonctionne mais moins élégant)
router.post(
  "/endpoint",
  asyncHandler(async (req, res) => {
    const locale = req.locale || "en";
    try {
      const body = createSchema.parse(req.body);
      // ... rest of handler
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw validationFromZod(error, locale);
      }
      throw error;
    }
  })
);
```

**Violations détectées** :
- ❌ Route utilisant `schema.parse()` directement → **BLOQUANT** (`ZodError` non gérée)
- ⚠️ Route utilisant try/catch avec `parse()` → **ATTENTION** (fonctionne mais moins élégant)
- ✅ Route utilisant `safeParse()` + `validationFromZod()` → **CORRECT**
- ✅ Route utilisant `createProtectedRoute()` → **BEST PRACTICE**

### 1.4 Middleware Validation (Pattern Recommandé)

**CRITICAL** : Pour les routes réutilisables, utiliser middleware de validation.

**Pattern attendu** :
```typescript
// ✅ CORRECT: Middleware validation (best practice)
import { createProtectedRoute } from "../middleware/route-helpers.js";

router.post(
  "/endpoint",
  ...createProtectedRoute({
    validateBody: createSchema,
    permission: "MODULE:ACTION",
  }),
  asyncHandler(async (req, res) => {
    const body = (req as any).validatedBody; // Déjà validé
    // ... rest of handler
  })
);
```

**Avantages** :
- ✅ Validation dans middleware (séparation des responsabilités)
- ✅ Route handler propre (pas de validation inline)
- ✅ Réutilisable (même middleware pour plusieurs routes)

---

## 🛡️ 2. VALIDATION PAR TYPE D'INPUT

### 2.1 Request Body Validation

**CRITICAL** : Toutes les routes POST/PUT/PATCH DOIVENT valider `req.body`.

**Checklist** :
- [ ] ✅ **Schema défini** : Schema Zod défini dans `<module>.schemas.ts`
- [ ] ✅ **Validation appliquée** : Route utilise `schema.safeParse(req.body)` + `validationFromZod()` ou middleware
- [ ] ✅ **Type inference** : Type TypeScript dérivé de schema (`z.infer<typeof schema>`)
- [ ] ✅ **Pas de req.body direct** : Route ne lit jamais `req.body` directement sans validation

**Pattern attendu** :
```typescript
// ✅ CORRECT: Validation body avec safeParse()
import { validationFromZod } from "../core/errors/index.js";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  amount: z.number().positive(),
});

router.post(
  "/invoices",
  asyncHandler(async (req, res) => {
    const locale = req.locale || "en";
    const bodyResult = createSchema.safeParse(req.body);
    if (!bodyResult.success) {
      throw validationFromZod(bodyResult.error, locale);
    }
    const body = bodyResult.data;
    // body est typé: { title: string, amount: number }
    await invoiceService.create(accessMode, body);
    res.json({ success: true });
  })
);
```

**Violations détectées** :
- ❌ Route POST/PUT/PATCH sans validation `req.body` → **BLOQUANT**
- ❌ Route qui lit `req.body.title` directement sans validation → **BLOQUANT**

### 2.2 Query Parameters Validation

**CRITICAL** : Toutes les routes qui utilisent `req.query` DOIVENT valider les query parameters.

**Checklist** :
- [ ] ✅ **Schema défini** : Schema Zod défini pour query params
- [ ] ✅ **Validation appliquée** : Route utilise `schema.safeParse(req.query)` + `validationFromZod()` ou middleware
- [ ] ✅ **Type inference** : Type TypeScript dérivé de schema
- [ ] ✅ **Pas de req.query direct** : Route ne lit jamais `req.query` directement sans validation

**Pattern attendu** :
```typescript
// ✅ CORRECT: Validation query params avec safeParse()
import { validationFromZod } from "../core/errors/index.js";

const listSchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 100),
  status: z.enum(["active", "archived"]).optional(),
});

router.get(
  "/invoices",
  asyncHandler(async (req, res) => {
    const locale = req.locale || "en";
    const queryResult = listSchema.safeParse(req.query);
    if (!queryResult.success) {
      throw validationFromZod(queryResult.error, locale);
    }
    const query = queryResult.data;
    // query est typé: { page?: number, limit?: number, status?: "active" | "archived" }
    const invoices = await invoiceService.list(accessMode, query);
    res.json(invoices);
  })
);
```

**Violations détectées** :
- ❌ Route qui lit `req.query.page` directement sans validation → **BLOQUANT**
- ❌ Route qui utilise `req.query` sans schema → **BLOQUANT**

### 2.3 Path Parameters Validation

**CRITICAL** : Tous les path parameters DOIVENT être validés via route middleware.

**Checklist** :
- [ ] ✅ **Validation route** : Path params validés via route middleware (ex: `:id` → ObjectId)
- [ ] ✅ **Type safety** : Path params typés correctement (ex: `CompanyId`, `TenantId`)
- [ ] ✅ **Pas de req.params direct** : Route ne lit jamais `req.params` directement sans validation

**Pattern attendu** :
```typescript
// ✅ CORRECT: Path params validés via route
router.get(
  "/invoices/:id",
  asyncHandler(async (req, res) => {
    const id = req.params.id as InvoiceId; // Validé par route middleware
    const invoice = await invoiceService.findById(accessMode, id);
    if (!invoice) {
      throw Errors.notFound("errors.invoice_not_found");
    }
    res.json(invoice);
  })
);
```

**Violations détectées** :
- ❌ Route qui lit `req.params.id` sans validation ObjectId → **BLOQUANT**
- ❌ Route qui utilise `req.params` sans type safety → **ATTENTION**

---

## 🚨 3. VIOLATIONS COMMUNES & CORRECTIONS

### 3.1 Violations Critiques (🔴 BLOQUANT)

**Violation 1** : Route sans validation body
```
❌ router.post("/invoices", async (req, res) => {
     const title = req.body.title; // Pas de validation
     await invoiceService.create(accessMode, { title });
   });
✅ router.post("/invoices", asyncHandler(async (req, res) => {
     const locale = req.locale || "en";
     const bodyResult = createSchema.safeParse(req.body);
     if (!bodyResult.success) {
       throw validationFromZod(bodyResult.error, locale);
     }
     const body = bodyResult.data;
     await invoiceService.create(accessMode, body);
   }));
```

**Violation 2** : Route sans validation query
```
❌ router.get("/invoices", async (req, res) => {
     const page = parseInt(req.query.page as string) || 1; // Pas de validation
     const invoices = await invoiceService.list(accessMode, { page });
   });
✅ router.get("/invoices", asyncHandler(async (req, res) => {
     const locale = req.locale || "en";
     const queryResult = listSchema.safeParse(req.query);
     if (!queryResult.success) {
       throw validationFromZod(queryResult.error, locale);
     }
     const query = queryResult.data;
     const invoices = await invoiceService.list(accessMode, query);
   }));
```

**Violation 3** : Schema avec messages hardcodés
```
❌ const createSchema = z.object({
     title: z.string().min(1, "Title is required"),
   });
✅ const createSchema = z.object({
     title: z.string().min(1), // Pas de message - traduction automatique
   });
```

**Violation 4** : Utilisation de parse() direct (ZodError non gérée)
```
❌ router.post("/invoices", asyncHandler(async (req, res) => {
     const body = createSchema.parse(req.body); // ZodError → 500 Internal Error
     await invoiceService.create(accessMode, body);
   }));
✅ router.post("/invoices", asyncHandler(async (req, res) => {
     const locale = req.locale || "en";
     const bodyResult = createSchema.safeParse(req.body);
     if (!bodyResult.success) {
       throw validationFromZod(bodyResult.error, locale);
     }
     const body = bodyResult.data;
     await invoiceService.create(accessMode, body);
   }));
```

### 3.2 Violations Non-Critiques (🟡 ATTENTION)

**Violation 1** : Try/catch avec parse() (fonctionne mais moins élégant)
```
⚠️ router.post("/invoices", asyncHandler(async (req, res) => {
     const locale = req.locale || "en";
     try {
       const body = createSchema.parse(req.body);
       await invoiceService.create(accessMode, body);
     } catch (error) {
       if (error instanceof z.ZodError) {
         throw validationFromZod(error, locale);
       }
       throw error;
     }
   }));
✅ router.post("/invoices", asyncHandler(async (req, res) => {
     const locale = req.locale || "en";
     const bodyResult = createSchema.safeParse(req.body);
     if (!bodyResult.success) {
       throw validationFromZod(bodyResult.error, locale);
     }
     const body = bodyResult.data;
     await invoiceService.create(accessMode, body);
   }));
```

**Violation 2** : Validation inline au lieu de middleware
```
⚠️ router.post("/endpoint", asyncHandler(async (req, res) => {
     const locale = req.locale || "en";
     const bodyResult = createSchema.safeParse(req.body);
     if (!bodyResult.success) {
       throw validationFromZod(bodyResult.error, locale);
     }
     const body = bodyResult.data; // Validation inline
   }));
✅ router.post("/endpoint", 
     ...createProtectedRoute({ validateBody: createSchema }),
     asyncHandler(async (req, res) => {
       const body = (req as any).validatedBody; // Déjà validé par middleware
     })
   );
```

---

## 📊 4. FORMAT DE RÉPONSE ATTENDU

### Structure Minimale (Priorité)

1. **📊 Résumé Exécutif** (1-2 paragraphes)
   - Nombre total de violations par catégorie (Body, Query, Params)
   - Top 5 problèmes critiques
   - Verdict sécurité : 🟥 **CRITIQUE** | 🟨 **ATTENTION** | 🟩 **OK**

2. **🔴 Violations Critiques** (Tableau)
   | Type | Route | Méthode | Problème | Gravité | Fix |
   |------|-------|---------|----------|---------|-----|
   | Body | `POST /c/invoices` | `createInvoice()` | Pas de validation body | 🔴 BLOQUANT | Ajouter schema.safeParse(req.body) + validationFromZod() |
   | Query | `GET /c/invoices` | `listInvoices()` | Pas de validation query | 🔴 BLOQUANT | Ajouter schema.safeParse(req.query) + validationFromZod() |
   | Body | `POST /c/invoices` | `createInvoice()` | Utilise schema.parse() direct | 🔴 BLOQUANT | Remplacer par safeParse() + validationFromZod() |
   | Schema | `invoices.schemas.ts` | `createSchema` | Messages hardcodés | 🟡 ATTENTION | Retirer messages, utiliser traduction automatique |

3. **🟡 Violations Non-Critiques** (Liste à puces)
   - Route : Try/catch manuel (redundant mais fonctionne)
   - Route : Validation inline au lieu de middleware

4. **🛡️ Matrice Validation par Route** (Tableau)
   | Portal | Route | Body Validation | Query Validation | Params Validation | Status |
   |--------|-------|-----------------|------------------|------------------|--------|
   | Company | POST /invoices | ✅ Schema | ❌ N/A | ❌ N/A | ✅ Conforme |
   | Company | GET /invoices | ❌ N/A | ❌ Pas de validation | ❌ N/A | ❌ Violation |
   | Company | GET /invoices/:id | ❌ N/A | ❌ N/A | ✅ Route middleware | ✅ Conforme |

5. **📌 Actions Prioritaires** (Checklist)
   - [ ] **Priorité 1** : Routes POST/PUT/PATCH sans validation body (sécurité)
   - [ ] **Priorité 1** : Routes avec req.query sans validation (sécurité)
   - [ ] **Priorité 1** : Schemas avec messages hardcodés (i18n)
   - [ ] **Priorité 2** : Try/catch manuel (qualité)
   - [ ] **Priorité 2** : Validation inline au lieu de middleware (qualité)

### Règles de Réponse

- ✅ **Concis** : Maximum 1 page par section (sauf violations critiques)
- ✅ **Actionnable** : Chaque violation = correction proposée avec code exact
- ✅ **Référencé** : Citer docs sources explicitement (ex: "violates Zod Validation i18n – No Hardcoded Messages")
- ✅ **Technique** : Citer fichiers, lignes, patterns explicitement
- ❌ **Pas de blabla** : Pas de généralités vagues, uniquement faits techniques
- ❌ **Pas de suppositions** : Si information manquante, lister ce qui manque MAIS donner quand même une checklist exhaustive

---

## 🎯 Priorisation

### Priorité 1 (Bloquant - Corriger Immédiatement)
- Routes POST/PUT/PATCH sans validation body (sécurité)
- Routes avec req.query sans validation (sécurité)
- Routes qui lisent req.body/req.query directement (sécurité)
- Routes utilisant `schema.parse()` directement (ZodError non gérée → 500 Internal Error)

### Priorité 2 (Important - Corriger Avant Prochaine Release)
- Schemas avec messages hardcodés (i18n)
- Try/catch manuel (qualité)
- Validation inline au lieu de middleware (qualité)

### Priorité 3 (Amélioration Continue)
- Documentation des patterns de validation
- Tests de validation pour toutes les routes

---

## ➤ Résultat Attendu

Une réponse **ultra-structurée, détaillée, très technique, directement exploitable**, utilisant :
- Les **patterns établis** (schema.safeParse + validationFromZod, createProtectedRoute middleware)
- Les **comparaisons par type d'input** (Body, Query, Params)
- Les **matrices de validation** (par route, par type)
- Les **actions prioritaires** (fixes proposés avec code exact)

**Focus** : Uniquement **validation des inputs et sécurité**, pas **features métier optionnelles**.

**Verdict final** :
- 🟥 **CRITIQUE** : Routes sans validation détectées (sécurité)
- 🟨 **ATTENTION** : Corrections nécessaires mais non-bloquantes
- 🟩 **OK** : Toutes les routes valident correctement les inputs (rare)
