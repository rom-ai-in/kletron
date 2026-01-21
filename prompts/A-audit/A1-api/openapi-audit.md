Tu es un **auditeur senior Architecture + Qualité + Coverage** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de la logique OpenAPI**, en vérifiant que **TOUS les éléments requis** sont présents, correctement implémentés, testés, documentés, et conformes aux règles strictes du monorepo.

**⚠️ CRITICAL** : Cet audit se concentre sur la génération, validation, et cohérence de la spécification OpenAPI pour les routes **Company (`/c`), Tenant (`/t`), et Partner (`/p`)**. **AUCUNE route Superadmin (`/s`)** ne doit être incluse dans cet audit (filtrage automatique).

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **OpenAPI Complete Guide** : `docs/02-development/tools/openapi/openapi-complete-guide.md`
- **OpenAPI Documentation Plan** : `docs/02-development/tools/openapi/openapi-documentation-plan.md`
- **OpenAPI Generator** : `apps/api/src/docs/openapi.generator.ts`
- **OpenAPI Schemas** : `apps/api/src/docs/openapi.schemas.ts`
- **OpenAPI Config** : `apps/api/src/docs/openapi.config.ts`
- **Schema Registry** : `apps/api/src/docs/schema-registry.ts`
- **Schema Registrations** : `apps/api/src/docs/schema-registrations.ts`
- **Orval Config** : `orval.config.ts`
- **Error Handling** : `apps/api/src/core/errors/index.ts`
- **i18n Guide** : `docs/02-development/i18n/tone-audit-guide.md`

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Type** : `full-audit` | `schema-specific` | `route-specific` | `diff-only`
   - **Services concernés** : Liste complète (OpenAPI Generator, Schema Registry, etc.)
   - **Routes concernées** : Liste complète des endpoints avec annotations OpenAPI (méthode + chemin + portal)
   - **Fichiers modifiés** : Liste complète (si diff-only)

2. **Composants OpenAPI identifiés** :
   - **OpenAPI Generator** : Génération de spec depuis JSDoc annotations
   - **Schema Registry** : Enregistrement et conversion Zod → OpenAPI
   - **Common Schemas** : Schémas réutilisables (ErrorResponse, SuccessResponse, etc.)
   - **Route Annotations** : Annotations JSDoc `@swagger` dans routes
   - **Validation Logic** : Validation de la spec générée
   - **Client Generation** : Génération client TypeScript via Orval

3. **Routes avec annotations OpenAPI** :
   - **Company Portal (`/c`)**: Liste complète des endpoints annotés
   - **Tenant Portal (`/t`)**: Liste complète des endpoints annotés
   - **Partner Portal (`/p`)**: Liste complète des endpoints annotés
   - **⚠️ Exclure Superadmin (`/s`)**: Aucune route superadmin ne doit être auditée (filtrage automatique)

4. **Intégrations identifiées** :
   - **Zod Schemas** : Conversion automatique Zod → OpenAPI
   - **JSDoc Annotations** : Extraction depuis `@swagger` comments
   - **Swagger UI** : Interface interactive `/api-docs/ui`
   - **TypeScript Client** : Génération via Orval
   - **CI/CD Validation** : Validation automatique dans Cloud Build

---

## 🔍 1. QUALITÉ DU CODE & ARCHITECTURE

### 1.1 OpenAPI Generator Architecture Cohérence

**CRITICAL** : Vérifie que l'architecture du générateur OpenAPI est cohérente et respecte les patterns du monorepo.

**Checklist** :
- [ ] ✅ **Generator isolation** : Génération OpenAPI isolée et réutilisable (pas de logique métier dans generator)
- [ ] ✅ **Schema registry** : Schémas Zod enregistrés via `registerSchema()` (pas de schémas manquants)
- [ ] ✅ **Error handling** : Generator gère erreurs avec messages clairs (pas d'erreurs silencieuses)
- [ ] ✅ **Logging** : Generator logge les erreurs avec contexte structuré (pas de `console.log`)
- [ ] ✅ **Type safety** : Generator a des types explicites (pas de `any`)
- [ ] ✅ **Superadmin filtering** : Routes superadmin filtrées automatiquement (sécurité)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Generator avec types explicites, error handling, filtering
export async function generateOpenApiSpec(
  options: GenerateOpenApiOptions = {},
): Promise<OpenAPISpec> {
  const { excludeSuperadminRoutes = true } = options;
  try {
    const baseSpec = swaggerJsdoc(openapiConfig) as OpenAPISpec;
    const filteredSpec = excludeSuperadminRoutes
      ? filterSuperadminRoutes(baseSpec)
      : baseSpec;
    // ...
  } catch (error) {
    logger.error({ error }, "[OpenAPIGenerator] Failed");
    throw error;
  }
}

// ❌ WRONG: Pas de types, pas de filtering, erreurs silencieuses
function generateSpec() {
  const spec = swaggerJsdoc(config);
  return spec; // Pas de filtering, pas d'error handling
}
```

**Violations détectées** :
- ❌ Generator sans filtering superadmin → **BLOQUANT**
- ❌ Erreurs silencieuses → **BLOQUANT**
- ❌ Types `any` ou implicites → **BLOQUANT**
- ❌ Schémas Zod non enregistrés → **BLOQUANT**

### 1.2 Schema Registry & Zod Conversion

**CRITICAL** : Vérifie que la conversion Zod → OpenAPI est correcte et complète.

**Checklist** :
- [ ] ✅ **Schema registration** : Tous les schémas Zod utilisés dans routes sont enregistrés via `registerSchema()`
- [ ] ✅ **Conversion logic** : Conversion Zod → OpenAPI gère tous les types (string, number, enum, object, optional, etc.)
- [ ] ✅ **Nested schemas** : Schémas imbriqués convertis correctement
- [ ] ✅ **Array schemas** : Schémas array (`z.array()`) convertis correctement
- [ ] ✅ **Union schemas** : Schémas union (`z.union()`) convertis correctement (si applicable)
- [ ] ✅ **Date schemas** : Schémas date (`z.date()`) convertis en `type: string, format: date-time`
- [ ] ✅ **Unknown types** : Types `z.unknown()` gérés avec fallback (normalisation)

**Fichiers à vérifier** :
- `apps/api/src/docs/schema-registry.ts`
- `apps/api/src/docs/schema-registrations.ts`
- `apps/api/src/docs/openapi.generator.ts` (conversion logic)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Schema enregistré, conversion correcte
import { registerSchema } from '@/docs/schema-registry';

export const createInvoiceSchema = z.object({
  title: z.string().min(1),
  amount: z.number().positive(),
  dueDate: z.date().optional(),
});

registerSchema('CreateInvoice', createInvoiceSchema, 'Invoice creation payload');

// ❌ WRONG: Schema non enregistré, conversion manquante
export const createInvoiceSchema = z.object({ ... });
// Pas de registerSchema() → Schema manquant dans OpenAPI spec
```

**Violations détectées** :
- ❌ Schémas Zod utilisés mais non enregistrés → **BLOQUANT**
- ❌ Conversion Zod → OpenAPI incorrecte → **BLOQUANT**
- ❌ Types Zod non supportés (union, etc.) → **BLOQUANT**
- ❌ Schémas imbriqués non convertis → **BLOQUANT**

### 1.3 Route Annotations Complétude

**CRITICAL** : Vérifie que toutes les routes ont des annotations OpenAPI complètes.

**Checklist** :
- [ ] ✅ **JSDoc annotations** : Toutes les routes ont annotations `@swagger` (pas de routes sans annotations)
- [ ] ✅ **Operation ID** : Toutes les opérations ont `operationId` unique et descriptif
- [ ] ✅ **Summary & description** : Toutes les opérations ont `summary` et `description` clairs
- [ ] ✅ **Tags** : Toutes les opérations ont tags appropriés (`[Portal, Domain, Module]`)
- [ ] ✅ **Security** : Toutes les opérations protégées ont `security: [{ bearerAuth: [] }]`
- [ ] ✅ **Parameters** : Tous les paramètres (path, query) documentés avec `$ref` ou inline
- [ ] ✅ **Request body** : Tous les body (POST, PUT, PATCH) documentés avec schéma
- [ ] ✅ **Responses** : Toutes les réponses documentées (200, 400, 401, 403, 404, 500)
- [ ] ✅ **Response schemas** : Réponses utilisent `$ref` vers schémas communs (ErrorResponse, SuccessResponse)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Annotation complète avec tous les éléments
/**
 * GET / - List invoices
 * @swagger
 * /c/companies/{companyId}/sales/invoices:
 *   get:
 *     operationId: listInvoices
 *     summary: List invoices
 *     description: List all invoices for the company with pagination
 *     tags: [Company Portal, Sales, Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/companyId'
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get("/", requirePermission("INVOICES:READ"), asyncHandler(...));

// ❌ WRONG: Annotation incomplète ou manquante
router.get("/", requirePermission("INVOICES:READ"), asyncHandler(...));
// Pas d'annotation → Route non documentée dans OpenAPI
```

**Violations détectées** :
- ❌ Routes sans annotations OpenAPI → **BLOQUANT**
- ❌ Annotations incomplètes (pas de operationId, summary, etc.) → **BLOQUANT**
- ❌ Réponses non documentées (400, 500, etc.) → **BLOQUANT**
- ❌ Paramètres non documentés → **BLOQUANT**

### 1.4 Common Schemas & Reusability

**CRITICAL** : Vérifie que les schémas communs sont définis et réutilisés.

**Checklist** :
- [ ] ✅ **ErrorResponse schema** : Schéma `ErrorResponse` défini avec structure complète (code, message, details, correlationId, requestId)
- [ ] ✅ **SuccessResponse schema** : Schéma `SuccessResponse` défini avec structure complète (success, data)
- [ ] ✅ **Common parameters** : Paramètres communs définis (`companyId`, `tenantId`, `userId`, etc.)
- [ ] ✅ **Common responses** : Réponses communes définies (`ForbiddenError`, `NotFoundError`, `InternalError`, etc.)
- [ ] ✅ **Schema references** : Routes utilisent `$ref` vers schémas communs (pas de duplication)
- [ ] ✅ **AccessMode schemas** : Schémas AccessMode définis (si exposés dans API)

**Fichiers à vérifier** :
- `apps/api/src/docs/openapi.schemas.ts` (common schemas)
- `apps/api/src/docs/openapi.generator.ts` (common responses, parameters)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Schéma commun défini et réutilisé
export const openapiSchemas: OpenAPIV3.ComponentsObject["schemas"] = {
  ErrorResponse: {
    type: "object",
    required: ["error"],
    properties: {
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", enum: ["BAD_REQUEST", ...] },
          message: { type: "string" },
          // ...
        },
      },
    },
  },
};

// Dans route annotation:
// responses:
//   403:
//     $ref: '#/components/responses/ForbiddenError'

// ❌ WRONG: Schéma dupliqué ou manquant
// responses:
//   403:
//     description: Forbidden
//     content:
//       application/json:
//         schema:
//           type: object
//           properties:
//             error: { ... } // Duplication au lieu de $ref
```

**Violations détectées** :
- ❌ Schémas communs manquants (ErrorResponse, SuccessResponse) → **BLOQUANT**
- ❌ Duplication de schémas au lieu de `$ref` → **BLOQUANT**
- ❌ Paramètres communs manquants → **BLOQUANT**
- ❌ Réponses communes manquantes → **BLOQUANT**

### 1.5 Validation Logic

**CRITICAL** : Vérifie que la validation de la spec OpenAPI est robuste.

**Checklist** :
- [ ] ✅ **Spec validation** : Spec générée validée avec bibliothèque OpenAPI (syntaxe, références, schémas)
- [ ] ✅ **Reference resolution** : Toutes les références `$ref` résolues (pas de références cassées)
- [ ] ✅ **Schema validation** : Tous les schémas valides (types corrects, required fields, etc.)
- [ ] ✅ **Path uniqueness** : Pas de chemins dupliqués (même path + method)
- [ ] ✅ **Operation ID uniqueness** : Pas d'operationId dupliqués
- [ ] ✅ **Error reporting** : Erreurs de validation reportées avec contexte (fichier, ligne, erreur)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Validation avec error reporting
import { validate } from 'openapi-spec-validator';

export async function generateOpenApiSpec(): Promise<OpenAPISpec> {
  const spec = await generateSpec();
  
  if (validate) {
    const validationResult = await validate(spec);
    if (!validationResult.valid) {
      logger.error({ errors: validationResult.errors }, "[OpenAPI] Validation failed");
      throw new Error(`OpenAPI spec invalid: ${validationResult.errors.join(', ')}`);
    }
  }
  
  return spec;
}

// ❌ WRONG: Pas de validation ou validation silencieuse
export function generateSpec() {
  return swaggerJsdoc(config); // Pas de validation
}
```

**Violations détectées** :
- ❌ Pas de validation de spec → **BLOQUANT**
- ❌ Références cassées non détectées → **BLOQUANT**
- ❌ Erreurs de validation silencieuses → **BLOQUANT**
- ❌ Chemins dupliqués non détectés → **BLOQUANT**

---

## 🧪 2. COUVERTURE DE TESTS

### 2.1 Unit Tests Complétude

**CRITICAL** : Vérifie que tous les composants OpenAPI ont des tests unitaires complets.

**Checklist** :
- [ ] ✅ **Generator tests** : Tests pour `generateOpenApiSpec()` avec différents options
- [ ] ✅ **Schema registry tests** : Tests pour `registerSchema()`, `getOpenApiSchemas()`
- [ ] ✅ **Zod conversion tests** : Tests pour conversion Zod → OpenAPI (string, number, enum, object, array, date, etc.)
- [ ] ✅ **Superadmin filtering tests** : Tests pour `filterSuperadminRoutes()` (routes `/s` filtrées)
- [ ] ✅ **Validation tests** : Tests pour validation de spec (erreurs détectées)
- [ ] ✅ **Edge cases** : Tests pour cas limites (spec vide, schémas manquants, références cassées, etc.)

**Fichiers de tests à vérifier** :
- `apps/api/tests/docs/openapi.generator.test.ts` (si existe)
- `apps/api/tests/docs/schema-registry.test.ts` (si existe)
- Autres fichiers de tests (si applicable)

**Coverage attendu** :
- **OpenAPI Generator** : >80% coverage (génération, validation, filtering)
- **Schema Registry** : >80% coverage (enregistrement, conversion)
- **Zod Conversion** : >90% coverage (tous les types Zod testés)

**Violations détectées** :
- ❌ Composants sans tests unitaires → **BLOQUANT**
- ❌ Coverage <70% → **BLOQUANT**
- ❌ Types Zod non testés → **BLOQUANT**
- ❌ Filtering superadmin non testé → **BLOQUANT**

### 2.2 Integration Tests Complétude

**CRITICAL** : Vérifie que l'intégration OpenAPI est testée (si applicable).

**Checklist** :
- [ ] ✅ **Spec generation** : Test de génération complète de spec depuis routes
- [ ] ✅ **Swagger UI** : Test d'accès à `/api-docs/ui` (si applicable)
- [ ] ✅ **Spec endpoint** : Test d'accès à `/api-docs` (JSON spec)
- [ ] ✅ **Client generation** : Test de génération client TypeScript via Orval (si applicable)
- [ ] ✅ **Route coverage** : Vérification que toutes les routes sont documentées

**Violations détectées** :
- ❌ Génération de spec non testée → **BLOQUANT**
- ❌ Endpoints docs non testés → **BLOQUANT**

---

## 📖 3. DOCUMENTATION

### 3.1 Documentation Technique Complétude

**CRITICAL** : Vérifie que la documentation OpenAPI est complète et à jour.

**Checklist** :
- [ ] ✅ **OpenAPI Complete Guide** : `docs/02-development/tools/openapi/openapi-complete-guide.md` existe et est à jour
- [ ] ✅ **Annotation guide** : Guide d'annotation des routes avec exemples
- [ ] ✅ **Schema registration guide** : Guide d'enregistrement de schémas Zod
- [ ] ✅ **Client generation guide** : Guide de génération client TypeScript
- [ ] ✅ **Best practices** : Best practices documentées (réutilisation, tags, etc.)
- [ ] ✅ **Troubleshooting** : Section troubleshooting avec erreurs communes
- [ ] ✅ **CI/CD integration** : Documentation intégration CI/CD (Cloud Build)

**Sections à vérifier dans `docs/02-development/tools/openapi/openapi-complete-guide.md`** :
- Overview (OpenAPI 3.0, génération automatique)
- Quick Start (génération, validation, accès)
- Annoter les routes (structure JSDoc, schémas Zod, références)
- Génération de la spec (commandes, validation, CI/CD)
- Accès à la documentation (Swagger UI, JSON, YAML)
- Génération de client TypeScript (Orval, configuration, utilisation)
- Bonnes pratiques (annotations complètes, schémas réutilisables, tags)
- Maintenance (mise à jour automatique, validation continue, versioning)
- Troubleshooting (spec invalide, client non généré, Swagger UI inaccessible)

**Violations détectées** :
- ❌ Documentation manquante ou incomplète → **BLOQUANT**
- ❌ Exemples de code incorrects ou obsolètes → **BLOQUANT**
- ❌ Guide d'annotation manquant → **BLOQUANT**

### 3.2 Code Documentation Complétude

**CRITICAL** : Vérifie que le code OpenAPI est bien documenté.

**Checklist** :
- [ ] ✅ **JSDoc comments** : Toutes les fonctions publiques ont JSDoc
- [ ] ✅ **Parameter documentation** : Paramètres documentés avec types et descriptions
- [ ] ✅ **Return types** : Types de retour documentés
- [ ] ✅ **Error documentation** : Erreurs possibles documentées
- [ ] ✅ **Usage examples** : Exemples d'utilisation dans JSDoc (si applicable)

**Patterns attendus** :
```typescript
/**
 * Generate OpenAPI 3.0 specification from route annotations
 *
 * @param options - Generation options
 * @param options.includeSchemas - Include common schemas (default: true)
 * @param options.validate - Validate generated spec (default: true)
 * @param options.excludeSuperadminRoutes - Filter out superadmin routes (default: true)
 * @returns OpenAPI 3.0 specification
 * @throws {Error} If spec generation or validation fails
 */
export async function generateOpenApiSpec(
  options: GenerateOpenApiOptions = {},
): Promise<OpenAPISpec> {
  // ...
}
```

**Violations détectées** :
- ❌ Fonctions publiques sans JSDoc → **BLOQUANT**
- ❌ Paramètres non documentés → **BLOQUANT**

---

## 🌐 4. INTERNATIONALISATION (i18n)

### 4.1 Error Messages i18n

**CRITICAL** : Vérifie que les messages d'erreur dans la spec OpenAPI utilisent i18n (si applicable).

**Checklist** :
- [ ] ✅ **Error descriptions** : Descriptions d'erreurs dans spec utilisent clés i18n ou messages localisés
- [ ] ✅ **Schema descriptions** : Descriptions de schémas claires et actionnables
- [ ] ✅ **Parameter descriptions** : Descriptions de paramètres claires

**Note** : Les descriptions dans la spec OpenAPI sont généralement en anglais (langue technique), mais doivent être claires et actionnables.

**Violations détectées** :
- ❌ Descriptions d'erreurs vagues ou manquantes → **BLOQUANT**

---

## 🔒 5. SÉCURITÉ

### 5.1 Superadmin Route Filtering

**CRITICAL** : Vérifie que les routes superadmin sont filtrées dans la spec publique.

**Checklist** :
- [ ] ✅ **Filtering logic** : Fonction `filterSuperadminRoutes()` implémentée et testée
- [ ] ✅ **Default behavior** : `excludeSuperadminRoutes: true` par défaut (sécurité)
- [ ] ✅ **Spec generation** : Spec générée exclut routes `/s` par défaut
- [ ] ✅ **Swagger UI** : Swagger UI n'affiche pas routes superadmin
- [ ] ✅ **Client generation** : Client TypeScript généré n'inclut pas routes superadmin

**Patterns attendus** :
```typescript
// ✅ CORRECT: Filtering par défaut, sécurité
export async function generateOpenApiSpec(
  options: GenerateOpenApiOptions = {},
): Promise<OpenAPISpec> {
  const { excludeSuperadminRoutes = true } = options; // Default: true
  
  const baseSpec = swaggerJsdoc(openapiConfig);
  const filteredSpec = excludeSuperadminRoutes
    ? filterSuperadminRoutes(baseSpec)
    : baseSpec;
  
  return filteredSpec;
}

// ❌ WRONG: Pas de filtering ou default false
export function generateSpec() {
  return swaggerJsdoc(config); // Routes superadmin exposées
}
```

**Violations détectées** :
- ❌ Routes superadmin non filtrées → **BLOQUANT CRITIQUE**
- ❌ Default `excludeSuperadminRoutes: false` → **BLOQUANT CRITIQUE**
- ❌ Filtering non testé → **BLOQUANT**

### 5.2 Security Schemes

**CRITICAL** : Vérifie que les schémas de sécurité sont correctement définis.

**Checklist** :
- [ ] ✅ **Bearer auth** : Schéma `bearerAuth` défini dans `components.securitySchemes`
- [ ] ✅ **Security requirement** : Toutes les routes protégées ont `security: [{ bearerAuth: [] }]`
- [ ] ✅ **Security description** : Description de l'authentification claire (JWT token)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Security scheme défini
components: {
  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
      description: "JWT token obtained from /auth/login endpoint",
    },
  },
}

// Dans route annotation:
// security:
//   - bearerAuth: []

// ❌ WRONG: Security scheme manquant ou route sans security
// Pas de security dans annotation → Route non protégée dans spec
```

**Violations détectées** :
- ❌ Schéma de sécurité manquant → **BLOQUANT**
- ❌ Routes protégées sans `security` dans annotation → **BLOQUANT**

---

## 🚀 6. PERFORMANCE & OPTIMISATION

### 6.1 Spec Generation Performance

**CRITICAL** : Vérifie que la génération de spec est performante.

**Checklist** :
- [ ] ✅ **Caching** : Spec mise en cache (si applicable, pour éviter régénération)
- [ ] ✅ **Lazy loading** : Schémas chargés à la demande (si applicable)
- [ ] ✅ **Generation time** : Génération de spec <5s (pour monorepo de taille moyenne)

**Violations détectées** :
- ❌ Génération de spec trop lente (>10s) → **WARNING**

### 6.2 Schema Registry Performance

**CRITICAL** : Vérifie que le registry de schémas est performant.

**Checklist** :
- [ ] ✅ **Registration efficiency** : Enregistrement de schémas O(1) (Map/Set)
- [ ] ✅ **Lookup efficiency** : Lookup de schémas O(1)
- [ ] ✅ **Memory usage** : Registry n'accumule pas mémoire (pas de leaks)

**Violations détectées** :
- ❌ Registry inefficace (O(n) lookup) → **WARNING**

---

## 🔗 7. INTÉGRATION AVEC CLIENT GENERATION

### 7.1 Orval Configuration

**CRITICAL** : Vérifie que la configuration Orval est correcte.

**Checklist** :
- [ ] ✅ **Orval config** : `orval.config.ts` existe et est correct
- [ ] ✅ **Input spec** : Input pointe vers spec générée (`openapi.spec.json`)
- [ ] ✅ **Output target** : Output pointe vers client TypeScript (`apps/web/lib/api/generated/client.ts`)
- [ ] ✅ **Client type** : Client type correct (`react-query`, `axios`, etc.)
- [ ] ✅ **Mutator** : Mutator personnalisé configuré (si applicable)
- [ ] ✅ **Mode** : Mode correct (`tags-split`, `split`, etc.)

**Fichier à vérifier** : `orval.config.ts`

**Patterns attendus** :
```typescript
// ✅ CORRECT: Configuration complète
export default {
  api: {
    input: {
      target: './apps/api/src/docs/openapi.spec.json',
    },
    output: {
      target: './apps/web/lib/api/generated/client.ts',
      client: 'react-query',
      mode: 'tags-split',
      override: {
        mutator: {
          path: './apps/web/lib/api/mutator.ts',
          name: 'customInstance',
        },
      },
    },
  },
};
```

**Violations détectées** :
- ❌ Configuration Orval manquante ou incorrecte → **BLOQUANT**
- ❌ Input spec incorrect → **BLOQUANT**
- ❌ Output target incorrect → **BLOQUANT**

### 7.2 Client Generation Consistency

**CRITICAL** : Vérifie que le client généré est cohérent avec la spec.

**Checklist** :
- [ ] ✅ **Client generation** : Client TypeScript généré sans erreurs
- [ ] ✅ **Type consistency** : Types dans client correspondent aux schémas OpenAPI
- [ ] ✅ **Operation consistency** : Opérations dans client correspondent aux routes
- [ ] ✅ **Parameter consistency** : Paramètres dans client correspondent aux paramètres OpenAPI
- [ ] ✅ **Response consistency** : Types de réponse dans client correspondent aux schémas OpenAPI

**Violations détectées** :
- ❌ Client généré avec erreurs → **BLOQUANT**
- ❌ Types incohérents entre spec et client → **BLOQUANT**
- ❌ Opérations manquantes dans client → **BLOQUANT**

---

## 📊 8. ROUTES & ENDPOINTS (NON-SUPERADMIN)

### 8.1 Routes avec Annotations OpenAPI

**CRITICAL** : Vérifie que les routes ont des annotations OpenAPI complètes (Company, Tenant, Partner uniquement).

**Checklist** :
- [ ] ✅ **Portal routes** : Routes dans portals Company (`/c`), Tenant (`/t`), Partner (`/p`) annotées
- [ ] ✅ **⚠️ Exclure Superadmin** : Aucune route Superadmin (`/s`) ne doit être auditée (filtrage automatique)
- [ ] ✅ **Annotation coverage** : Toutes les routes publiques ont annotations OpenAPI
- [ ] ✅ **Annotation quality** : Annotations complètes (operationId, summary, description, tags, security, parameters, responses)
- [ ] ✅ **Schema references** : Réponses utilisent `$ref` vers schémas communs
- [ ] ✅ **Parameter references** : Paramètres utilisent `$ref` vers paramètres communs

**Routes à identifier** :
- **Company Portal (`/c`)**: Liste complète des endpoints avec annotations
- **Tenant Portal (`/t`)**: Liste complète des endpoints avec annotations
- **Partner Portal (`/p`)**: Liste complète des endpoints avec annotations

**⚠️ Routes à EXCLURE** :
- **Superadmin Portal (`/s`)**: Aucune route superadmin ne doit être auditée (filtrage automatique)

**Violations détectées** :
- ❌ Routes sans annotations OpenAPI → **BLOQUANT**
- ❌ Annotations incomplètes → **BLOQUANT**
- ❌ Réponses sans schémas → **BLOQUANT**
- ❌ Paramètres non documentés → **BLOQUANT**

### 8.2 Consistency: Code vs OpenAPI Spec

**CRITICAL** : Vérifie que la spec OpenAPI est cohérente avec le code réel.

**Checklist** :
- [ ] ✅ **Path consistency** : Chemins dans spec correspondent aux routes Express
- [ ] ✅ **Method consistency** : Méthodes HTTP dans spec correspondent aux routes
- [ ] ✅ **Parameter consistency** : Paramètres dans spec correspondent aux paramètres de route
- [ ] ✅ **Request body consistency** : Body dans spec correspond aux Zod schemas utilisés
- [ ] ✅ **Response consistency** : Réponses dans spec correspondent aux réponses réelles
- [ ] ✅ **Security consistency** : Security dans spec correspond aux guards de route
- [ ] ✅ **Status codes consistency** : Codes de statut HTTP dans spec correspondent aux réponses réelles
- [ ] ✅ **Query parameters consistency** : Paramètres de query dans spec correspondent aux validations Zod
- [ ] ✅ **Path parameters consistency** : Paramètres de path dans spec correspondent aux routes Express

**Violations détectées** :
- ❌ Chemins incohérents entre spec et code → **BLOQUANT**
- ❌ Paramètres manquants dans spec → **BLOQUANT**
- ❌ Body incohérent entre spec et code → **BLOQUANT**
- ❌ Réponses incohérentes entre spec et code → **BLOQUANT**
- ❌ Codes de statut manquants ou incorrects → **BLOQUANT**

### 8.3 Route Coverage & Completeness

**CRITICAL** : Vérifie que toutes les routes publiques sont documentées dans OpenAPI.

**Checklist** :
- [ ] ✅ **Route inventory** : Liste complète de toutes les routes publiques (Company, Tenant, Partner)
- [ ] ✅ **Coverage percentage** : >95% des routes publiques ont annotations OpenAPI
- [ ] ✅ **Missing routes** : Routes sans annotations identifiées et listées
- [ ] ✅ **Internal routes excluded** : Routes internes (health, metrics, etc.) correctement exclues ou documentées
- [ ] ✅ **Deprecated routes** : Routes dépréciées marquées avec `deprecated: true` dans spec

**Méthodologie** :
1. Scanner tous les fichiers de routes dans `apps/api/src/routes/portals/`
2. Lister toutes les routes définies (router.get, router.post, etc.)
3. Vérifier présence d'annotations `@swagger` pour chaque route
4. Calculer pourcentage de couverture
5. Identifier routes manquantes

**Violations détectées** :
- ❌ Coverage <90% → **BLOQUANT**
- ❌ Routes publiques importantes non documentées → **BLOQUANT**
- ❌ Routes dépréciées non marquées → **WARNING**

### 8.4 Annotation Quality & Standards

**CRITICAL** : Vérifie que les annotations OpenAPI respectent les standards et sont de qualité.

**Checklist** :
- [ ] ✅ **Operation ID format** : Operation IDs suivent convention (camelCase, descriptifs, uniques)
- [ ] ✅ **Summary quality** : Summaries sont concis (<80 caractères) et descriptifs
- [ ] ✅ **Description quality** : Descriptions sont complètes et expliquent le comportement
- [ ] ✅ **Tag consistency** : Tags suivent format `[Portal, Domain, Module]` de manière cohérente
- [ ] ✅ **Example values** : Exemples fournis pour paramètres et body (si applicable)
- [ ] ✅ **Enum values** : Enums documentés avec toutes les valeurs possibles
- [ ] ✅ **Required fields** : Champs required correctement marqués dans schémas
- [ ] ✅ **Default values** : Valeurs par défaut documentées pour paramètres et champs

**Patterns attendus** :
```typescript
// ✅ CORRECT: Annotation de qualité avec exemples, enums, defaults
/**
 * @swagger
 * /c/companies/{companyId}/sales/invoices:
 *   post:
 *     operationId: createInvoice
 *     summary: Create a new invoice
 *     description: Creates a new invoice for the company with validation and automatic numbering
 *     tags: [Company Portal, Sales, Invoices]
 *     parameters:
 *       - $ref: '#/components/parameters/companyId'
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [DRAFT, SENT, PAID, CANCELLED]
 *           default: DRAFT
 *         example: DRAFT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInvoice'
 *           example:
 *             title: "Invoice #2024-001"
 *             amount: 1000.50
 *             status: "DRAFT"
 */

// ❌ WRONG: Annotation de mauvaise qualité
/**
 * @swagger
 * /c/companies/{companyId}/sales/invoices:
 *   post:
 *     summary: Create invoice
 */
```

**Violations détectées** :
- ❌ Operation IDs non descriptifs ou dupliqués → **BLOQUANT**
- ❌ Summaries trop longs ou vagues → **BLOQUANT**
- ❌ Tags incohérents → **BLOQUANT**
- ❌ Enums incomplets → **BLOQUANT**
- ❌ Required fields manquants → **BLOQUANT**

### 8.5 Schema Quality & Validation

**CRITICAL** : Vérifie que les schémas OpenAPI sont de qualité et valides.

**Checklist** :
- [ ] ✅ **Schema completeness** : Tous les champs de réponse documentés dans schémas
- [ ] ✅ **Type accuracy** : Types OpenAPI correspondent aux types TypeScript/Zod
- [ ] ✅ **Format specifications** : Formats spécifiés (date-time, email, uri, etc.)
- [ ] ✅ **Validation rules** : Règles de validation documentées (min, max, pattern, etc.)
- [ ] ✅ **Nested schemas** : Schémas imbriqués correctement définis et réutilisés
- [ ] ✅ **Array schemas** : Schémas array avec items correctement définis
- [ ] ✅ **Nullable fields** : Champs nullable correctement marqués
- [ ] ✅ **OneOf/AnyOf/AllOf** : Utilisation correcte des combinaisons de schémas (si applicable)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Schéma complet avec validation, formats, nested
Invoice: {
  type: "object",
  required: ["id", "title", "amount", "status"],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string", minLength: 1, maxLength: 255 },
    amount: { type: "number", minimum: 0, multipleOf: 0.01 },
    status: { type: "string", enum: ["DRAFT", "SENT", "PAID", "CANCELLED"] },
    dueDate: { type: "string", format: "date-time", nullable: true },
    company: { $ref: "#/components/schemas/Company" },
    items: {
      type: "array",
      items: { $ref: "#/components/schemas/InvoiceItem" }
    }
  }
}

// ❌ WRONG: Schéma incomplet ou incorrect
Invoice: {
  type: "object",
  properties: {
    id: { type: "string" }, // Pas de format, pas de required
    amount: { type: "number" } // Pas de validation
  }
}
```

**Violations détectées** :
- ❌ Schémas incomplets (champs manquants) → **BLOQUANT**
- ❌ Types incorrects → **BLOQUANT**
- ❌ Formats manquants pour types spéciaux → **BLOQUANT**
- ❌ Validation rules manquantes → **BLOQUANT**

### 8.6 Pagination & Query Parameters Consistency

**CRITICAL** : Vérifie que les paramètres de pagination et query sont cohérents et documentés.

**Checklist** :
- [ ] ✅ **Pagination parameters** : Paramètres de pagination standardisés (`page`, `limit`, `offset`, etc.)
- [ ] ✅ **Pagination response** : Réponses paginées utilisent schéma commun (si applicable)
- [ ] ✅ **Query parameters** : Tous les paramètres de query documentés avec types et exemples
- [ ] ✅ **Filter parameters** : Paramètres de filtrage documentés avec exemples
- [ ] ✅ **Sort parameters** : Paramètres de tri documentés avec valeurs possibles
- [ ] ✅ **Default values** : Valeurs par défaut documentées pour paramètres de query

**Patterns attendus** :
```typescript
// ✅ CORRECT: Paramètres de pagination standardisés
parameters:
  - name: page
    in: query
    schema:
      type: integer
      minimum: 1
      default: 1
    description: Page number (1-indexed)
    example: 1
  - name: limit
    in: query
    schema:
      type: integer
      minimum: 1
      maximum: 100
      default: 20
    description: Number of items per page
    example: 20
```

**Violations détectées** :
- ❌ Paramètres de pagination incohérents entre routes → **BLOQUANT**
- ❌ Paramètres de query non documentés → **BLOQUANT**
- ❌ Valeurs par défaut manquantes → **WARNING**

### 8.7 Error Response Consistency

**CRITICAL** : Vérifie que les réponses d'erreur sont cohérentes et utilisent les schémas communs.

**Checklist** :
- [ ] ✅ **Error schema usage** : Toutes les réponses d'erreur utilisent `$ref: '#/components/schemas/ErrorResponse'`
- [ ] ✅ **Error codes consistency** : Codes d'erreur cohérents avec enum ErrorCode
- [ ] ✅ **Status code mapping** : Mapping correct entre codes HTTP et codes d'erreur
- [ ] ✅ **Error examples** : Exemples d'erreurs fournis pour chaque code de statut
- [ ] ✅ **Error details** : Structure `details` documentée pour erreurs de validation

**Patterns attendus** :
```typescript
// ✅ CORRECT: Réponses d'erreur cohérentes avec exemples
responses:
  400:
    $ref: '#/components/responses/BadRequestError'
  401:
    $ref: '#/components/responses/UnauthorizedError'
  403:
    $ref: '#/components/responses/ForbiddenError'
  404:
    $ref: '#/components/responses/NotFoundError'
  500:
    $ref: '#/components/responses/InternalError'

// Dans components/responses:
BadRequestError:
  description: Bad request
  content:
    application/json:
      schema:
        $ref: '#/components/schemas/ErrorResponse'
      example:
        error:
          code: "BAD_REQUEST"
          message: "Invalid request parameters"
          details:
            field: "amount"
            reason: "Must be positive"
```

**Violations détectées** :
- ❌ Réponses d'erreur sans schéma commun → **BLOQUANT**
- ❌ Codes d'erreur incohérents → **BLOQUANT**
- ❌ Exemples d'erreurs manquants → **WARNING**

---

## 🔧 9. SCRIPTS & AUTOMATION

### 9.1 NPM Scripts & Commands

**CRITICAL** : Vérifie que les scripts npm pour OpenAPI sont présents et fonctionnels.

**Checklist** :
- [ ] ✅ **docs:generate** : Script `npm run docs:generate` génère spec OpenAPI
- [ ] ✅ **docs:validate** : Script `npm run docs:validate` valide spec générée
- [ ] ✅ **docs:client:generate** : Script `npm run docs:client:generate` génère client TypeScript
- [ ] ✅ **Scripts documentation** : Scripts documentés dans `package.json` ou README
- [ ] ✅ **Error handling** : Scripts gèrent erreurs et affichent messages clairs
- [ ] ✅ **Output files** : Fichiers générés aux emplacements attendus

**Fichiers à vérifier** :
- `package.json` (scripts section)
- `apps/api/package.json` (si scripts spécifiques)

**Patterns attendus** :
```json
{
  "scripts": {
    "docs:generate": "node scripts/generate-openapi.js",
    "docs:validate": "node scripts/validate-openapi.js",
    "docs:client:generate": "orval"
  }
}
```

**Violations détectées** :
- ❌ Scripts manquants → **BLOQUANT**
- ❌ Scripts non fonctionnels → **BLOQUANT**
- ❌ Fichiers générés aux mauvais emplacements → **BLOQUANT**

### 9.2 CI/CD Integration

**CRITICAL** : Vérifie que l'intégration CI/CD pour OpenAPI est correcte.

**Checklist** :
- [ ] ✅ **Cloud Build integration** : Génération et validation OpenAPI dans `cloudbuild.yaml`
- [ ] ✅ **Validation step** : Étape de validation qui fait échouer le build si spec invalide
- [ ] ✅ **Client generation** : Génération client TypeScript dans CI (si applicable)
- [ ] ✅ **Spec artifact** : Spec générée sauvegardée comme artifact (si applicable)
- [ ] ✅ **Error reporting** : Erreurs de validation reportées clairement dans logs CI

**Fichiers à vérifier** :
- `cloudbuild.yaml`
- `cloudbuild-openapi-validation.yaml` (si existe)
- GitHub Actions workflows (si applicable)

**Patterns attendus** :
```yaml
# ✅ CORRECT: Intégration CI/CD complète
- name: 'gcr.io/cloud-builders/npm'
  args: ['run', 'docs:generate']
- name: 'gcr.io/cloud-builders/npm'
  args: ['run', 'docs:validate']
  # Build fails if validation fails
```

**Violations détectées** :
- ❌ Pas d'intégration CI/CD → **BLOQUANT**
- ❌ Validation ne fait pas échouer le build → **BLOQUANT**
- ❌ Erreurs non reportées → **BLOQUANT**

### 9.3 Swagger UI Accessibility

**CRITICAL** : Vérifie que Swagger UI est accessible et fonctionnel.

**Checklist** :
- [ ] ✅ **Route Swagger UI** : Route `/api-docs/ui` accessible et fonctionnelle
- [ ] ✅ **Route JSON spec** : Route `/api-docs` retourne spec JSON
- [ ] ✅ **Route YAML spec** : Route `/api-docs/yaml` retourne spec YAML (si applicable)
- [ ] ✅ **Authentication** : Swagger UI permet authentification Bearer token
- [ ] ✅ **CORS** : CORS configuré correctement pour Swagger UI (si applicable)
- [ ] ✅ **Error handling** : Erreurs de génération de spec gérées gracieusement
- [ ] ✅ **Performance** : Swagger UI se charge rapidement (<2s)

**Fichiers à vérifier** :
- Routes docs dans `apps/api/src/routes/` ou `apps/api/src/app.ts`

**Violations détectées** :
- ❌ Swagger UI inaccessible → **BLOQUANT**
- ❌ Authentification non fonctionnelle → **BLOQUANT**
- ❌ Performance dégradée → **WARNING**

---

## 🔄 10. VERSIONING & EVOLUTION

### 10.1 Spec Versioning

**CRITICAL** : Vérifie que le versioning de la spec OpenAPI est correct.

**Checklist** :
- [ ] ✅ **Version field** : Champ `info.version` présent et à jour
- [ ] ✅ **Version consistency** : Version dans spec correspond à version de l'API
- [ ] ✅ **Versioning strategy** : Stratégie de versioning documentée (semantic versioning, etc.)
- [ ] ✅ **Breaking changes** : Changements breaking documentés dans changelog
- [ ] ✅ **Deprecation** : Routes/paramètres dépréciés marqués avec `deprecated: true`

**Patterns attendus** :
```typescript
// ✅ CORRECT: Version cohérente
info: {
  title: "Numezis API",
  version: "1.0.0", // Correspond à version package.json
  description: "..."
}

// Dans route annotation:
// deprecated: true
// x-deprecation-date: "2024-12-31"
// x-sunset-date: "2025-12-31"
```

**Violations détectées** :
- ❌ Version manquante ou incorrecte → **BLOQUANT**
- ❌ Changements breaking non documentés → **BLOQUANT**
- ❌ Dépréciations non marquées → **WARNING**

### 10.2 Spec Evolution & Regression Testing

**CRITICAL** : Vérifie que l'évolution de la spec est suivie et testée.

**Checklist** :
- [ ] ✅ **Spec diff** : Diff de spec entre versions suivi (si applicable)
- [ ] ✅ **Regression tests** : Tests de régression pour vérifier cohérence spec
- [ ] ✅ **Breaking changes detection** : Détection automatique de changements breaking (si applicable)
- [ ] ✅ **Client compatibility** : Vérification compatibilité client généré avec nouvelles versions

**Violations détectées** :
- ❌ Pas de suivi d'évolution → **WARNING**
- ❌ Tests de régression manquants → **WARNING**

---

## ✅ 11. CHECKLIST FINALE

### 11.1 Résumé des Violations

**CRITICAL** : Produis un résumé final de toutes les violations détectées, organisé par catégorie.

**Format** :
```
## Résumé des Violations

### BLOQUANT CRITIQUE (doit être corrigé immédiatement)
- [ ] Description de la violation + fichier + ligne + impact

### BLOQUANT (doit être corrigé avant merge)
- [ ] Description de la violation + fichier + ligne + impact

### WARNING (devrait être corrigé)
- [ ] Description de la violation + fichier + ligne + impact

### Par Catégorie
- **Architecture & Code Quality**: [nombre] violations
- **Schema Registry & Conversion**: [nombre] violations
- **Route Annotations**: [nombre] violations
- **Common Schemas**: [nombre] violations
- **Validation Logic**: [nombre] violations
- **Test Coverage**: [nombre] violations
- **Documentation**: [nombre] violations
- **Security**: [nombre] violations
- **Performance**: [nombre] violations
- **Client Generation**: [nombre] violations
- **Route Coverage**: [nombre] violations
- **Consistency**: [nombre] violations
- **Scripts & CI/CD**: [nombre] violations
- **Versioning**: [nombre] violations
```

### 11.2 Recommandations

**CRITICAL** : Produis des recommandations pour améliorer la qualité, organisées par priorité et impact.

**Format** :
```
## Recommandations

### Priorité CRITIQUE (Impact Sécurité/Stabilité)
- [ ] Recommandation 1 (impact, effort, bénéfice)
- [ ] Recommandation 2 (impact, effort, bénéfice)

### Priorité HAUTE (Impact Qualité/Expérience)
- [ ] Recommandation 3 (impact, effort, bénéfice)
- [ ] Recommandation 4 (impact, effort, bénéfice)

### Priorité MOYENNE (Impact Maintenance/Évolutivité)
- [ ] Recommandation 5 (impact, effort, bénéfice)
- [ ] Recommandation 6 (impact, effort, bénéfice)

### Priorité BASSE (Nice to Have)
- [ ] Recommandation 7 (impact, effort, bénéfice)
```

### 11.3 Métriques & Statistiques

**CRITICAL** : Produis des métriques quantitatives pour mesurer la qualité OpenAPI.

**Format** :
```
## Métriques OpenAPI

### Couverture
- Routes documentées: [X] / [Y] ([Z]%)
- Schémas enregistrés: [X]
- Paramètres communs définis: [X]
- Réponses communes définies: [X]

### Qualité
- Annotations complètes: [X] / [Y] ([Z]%)
- Schémas avec validation: [X] / [Y] ([Z]%)
- Réponses avec exemples: [X] / [Y] ([Z]%)
- Operation IDs uniques: [X] / [Y] ([Z]%)

### Tests
- Coverage unit tests: [X]%
- Coverage integration tests: [X]%
- Tests de régression: [X] / [Y] ([Z]%)

### Performance
- Temps génération spec: [X]s
- Temps validation spec: [X]s
- Temps génération client: [X]s
```

---

## 📝 12. RAPPORT FINAL

**CRITICAL** : Produis un rapport final structuré et exhaustif.

**Format** :
```
## Rapport d'Audit OpenAPI - [Date]

### Executive Summary
- **Scope**: [full-audit | schema-specific | route-specific | diff-only]
- **Routes auditées**: [X] routes (Company: [X], Tenant: [X], Partner: [X])
- **Schémas enregistrés**: [X]
- **Tests coverage**: [X]%
- **Durée audit**: [X] minutes

### Résultats Globaux
- ✅ **Points forts**: [liste des 3-5 points forts principaux]
- ❌ **Violations bloquantes**: [X] (dont [X] critiques)
- ⚠️ **Warnings**: [X]
- 📊 **Score qualité**: [X]/10

### Détail par Catégorie

#### 1. Architecture & Code Quality
- ✅ Points forts: [liste]
- ❌ Violations: [X]
- ⚠️ Warnings: [X]
- 📝 Actions: [liste]

#### 2. Schema Registry & Zod Conversion
- ✅ Points forts: [liste]
- ❌ Violations: [X]
- ⚠️ Warnings: [X]
- 📝 Actions: [liste]

#### 3. Route Annotations & Coverage
- ✅ Points forts: [liste]
- ❌ Violations: [X]
- ⚠️ Warnings: [X]
- 📝 Actions: [liste]

[... Répéter pour chaque catégorie ...]

### Actions Requises (Priorisées)

#### Immédiat (Avant merge)
1. [Action 1] - [Fichier] - [Ligne] - [Impact]
2. [Action 2] - [Fichier] - [Ligne] - [Impact]

#### Court terme (Cette semaine)
1. [Action 3] - [Fichier] - [Ligne] - [Impact]
2. [Action 4] - [Fichier] - [Ligne] - [Impact]

#### Moyen terme (Ce mois)
1. [Action 5] - [Fichier] - [Ligne] - [Impact]
2. [Action 6] - [Fichier] - [Ligne] - [Impact]

### Prochaines Étapes
- [ ] Corriger violations bloquantes critiques
- [ ] Corriger violations bloquantes
- [ ] Améliorer coverage tests (objectif: >80%)
- [ ] Mettre à jour documentation
- [ ] Vérifier cohérence spec vs code (100%)
- [ ] Améliorer qualité annotations (objectif: >95%)
- [ ] Implémenter tests de régression
- [ ] Automatiser validation dans CI/CD

### Risques Identifiés
- **Risque Sécurité**: [Description] - [Impact] - [Probabilité]
- **Risque Stabilité**: [Description] - [Impact] - [Probabilité]
- **Risque Maintenance**: [Description] - [Impact] - [Probabilité]

### Conclusion
[2-3 paragraphes résumant l'état général, les priorités, et les recommandations principales]
```

---

**⚠️ RAPPEL CRITIQUE** : Cet audit se concentre sur les routes **Company (`/c`), Tenant (`/t`), et Partner (`/p`)** uniquement. **AUCUNE route Superadmin (`/s`)** ne doit être incluse dans cet audit (filtrage automatique dans le générateur).
