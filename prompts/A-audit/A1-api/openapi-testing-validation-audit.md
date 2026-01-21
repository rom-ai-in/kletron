Tu es un **auditeur senior spécialisé en Tests, Validation et Solidité** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de la solidité, complétude et fiabilité du système OpenAPI/Swagger**, en testant, validant et vérifiant que **TOUS les composants fonctionnent correctement**, sont robustes, et résistent aux cas limites et erreurs.

**⚠️ CRITICAL** : Cet audit se concentre sur la **validation pratique**, les **tests de solidité**, la **vérification de complétude**, et la **détection de failles** dans le système OpenAPI. Il complète l'audit architectural existant (`openapi-audit.md`) en se concentrant sur l'aspect **opérationnel et testable**.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **OpenAPI Complete Guide** : `docs/02-development/tools/openapi/openapi-complete-guide.md`
- **OpenAPI Test Results** : `docs/02-development/tools/openapi/openapi-test-results.md`
- **OpenAPI Generator** : `apps/api/src/docs/openapi.generator.ts`
- **OpenAPI Schemas** : `apps/api/src/docs/openapi.schemas.ts`
- **OpenAPI Config** : `apps/api/src/docs/openapi.config.ts`
- **Schema Registry** : `apps/api/src/docs/schema-registry.ts`
- **Schema Registrations** : `apps/api/src/docs/schema-registrations.ts`
- **Orval Config** : `orval.config.ts`
- **Client Generator Script** : `scripts/02-generators/generators/generate-api-client.ts`
- **CI Validation Script** : `scripts/01-quality/ci/check-openapi-consistency.ts`
- **Cloud Build Config** : `cloudbuild.yaml`, `cloudbuild-openapi-validation.yaml`

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Type** : `testing-audit` | `validation-audit` | `solidity-audit` | `completeness-audit` | `full-testing-audit`
   - **Composants à tester** : Liste complète (Generator, Registry, Validation, Client Generation, Swagger UI, CI/CD)
   - **Routes concernées** : Liste complète des endpoints avec annotations OpenAPI (méthode + chemin + portal)
   - **Scripts concernés** : Liste complète des scripts npm et scripts de validation

2. **Environnement de test** :
   - **Local** : Tests manuels et automatisés en local
   - **CI/CD** : Validation dans Cloud Build
   - **Swagger UI** : Tests d'accès et fonctionnalités
   - **Client Generation** : Tests de génération et utilisation

3. **Méthodologie de test** :
   - **Tests unitaires** : Vérification de chaque composant isolément
   - **Tests d'intégration** : Vérification des interactions entre composants
   - **Tests de régression** : Vérification que les changements ne cassent pas l'existant
   - **Tests de solidité** : Vérification de la résistance aux erreurs et cas limites
   - **Tests de complétude** : Vérification que tous les éléments requis sont présents

4. **Critères de succès** :
   - **Génération** : Spec générée sans erreurs
   - **Validation** : Spec valide selon OpenAPI 3.0
   - **Cohérence** : Spec cohérente avec le code réel
   - **Couverture** : >95% des routes documentées
   - **Client** : Client TypeScript généré sans erreurs
   - **Swagger UI** : Interface accessible et fonctionnelle

---

## 🧪 1. TESTS DE GÉNÉRATION & VALIDATION

### 1.1 Test de Génération de Spec OpenAPI

**CRITICAL** : Vérifie que la génération de spec OpenAPI fonctionne correctement dans tous les cas.

**Tests à effectuer** :

#### Test 1.1.1 : Génération de base
```bash
# Commande à exécuter
npm run docs:generate

# Vérifications
- [ ] ✅ Spec générée sans erreurs
- [ ] ✅ Fichier `apps/api/src/docs/openapi.spec.json` créé/mis à jour
- [ ] ✅ Spec contient `openapi: "3.0.0"` ou version supérieure
- [ ] ✅ Spec contient `info` avec title, version, description
- [ ] ✅ Spec contient `paths` avec au moins un endpoint
- [ ] ✅ Spec contient `components` avec schemas, responses, parameters
- [ ] ✅ Temps de génération <10s (performance)
```

#### Test 1.1.2 : Génération avec options
```typescript
// Tester avec différentes options
await generateOpenApiSpec({ excludeSuperadminRoutes: true });
await generateOpenApiSpec({ excludeSuperadminRoutes: false });
await generateOpenApiSpec({ includeSchemas: false });
await generateOpenApiSpec({ validate: false });
await generateOpenApiSpec({ tags: ['CustomTag'] });
```

**Vérifications** :
- [ ] ✅ Génération avec `excludeSuperadminRoutes: true` exclut routes `/s`
- [ ] ✅ Génération avec `excludeSuperadminRoutes: false` inclut routes `/s`
- [ ] ✅ Génération avec `includeSchemas: false` exclut schémas communs
- [ ] ✅ Génération avec `validate: false` ne valide pas (mais génère quand même)
- [ ] ✅ Génération avec `tags` ajoute tags personnalisés

#### Test 1.1.3 : Génération avec erreurs (solidité)
```typescript
// Tester résistance aux erreurs
// 1. Routes avec annotations invalides
// 2. Schémas Zod non enregistrés
// 3. Références $ref cassées
// 4. Fichiers de routes manquants
```

**Vérifications** :
- [ ] ✅ Erreurs de génération reportées clairement (pas silencieuses)
- [ ] ✅ Messages d'erreur contiennent contexte (fichier, ligne, erreur)
- [ ] ✅ Génération ne plante pas complètement (graceful degradation)
- [ ] ✅ Logs structurés pour debugging

#### Test 1.1.4 : Génération avec routes multiples
```typescript
// Tester avec toutes les routes du monorepo
// Vérifier que toutes les routes sont incluses
```

**Vérifications** :
- [ ] ✅ Toutes les routes Company (`/c`) incluses
- [ ] ✅ Toutes les routes Tenant (`/t`) incluses
- [ ] ✅ Toutes les routes Partner (`/p`) incluses
- [ ] ✅ Routes Superadmin (`/s`) exclues par défaut
- [ ] ✅ Pas de routes dupliquées (même path + method)
- [ ] ✅ Pas d'operationId dupliqués

**Violations détectées** :
- ❌ Génération échoue sans message clair → **BLOQUANT**
- ❌ Spec générée invalide → **BLOQUANT**
- ❌ Routes manquantes dans spec → **BLOQUANT**
- ❌ Routes dupliquées → **BLOQUANT**
- ❌ Temps de génération >30s → **WARNING**

### 1.2 Test de Validation de Spec OpenAPI

**CRITICAL** : Vérifie que la validation de spec OpenAPI fonctionne correctement.

**Tests à effectuer** :

#### Test 1.2.1 : Validation de spec valide
```bash
# Commande à exécuter
npm run docs:validate

# Vérifications
- [ ] ✅ Validation passe sans erreurs
- [ ] ✅ Message de succès affiché ("✅ OpenAPI spec is valid")
- [ ] ✅ Exit code 0 (succès)
- [ ] ✅ Temps de validation <5s (performance)
```

#### Test 1.2.2 : Validation de spec invalide (solidité)
```typescript
// Créer une spec invalide manuellement
// 1. Spec avec syntaxe invalide (JSON malformé)
// 2. Spec avec références $ref cassées
// 3. Spec avec schémas invalides
// 4. Spec avec chemins dupliqués
```

**Vérifications** :
- [ ] ✅ Validation détecte erreurs de syntaxe
- [ ] ✅ Validation détecte références cassées
- [ ] ✅ Validation détecte schémas invalides
- [ ] ✅ Validation détecte chemins dupliqués
- [ ] ✅ Messages d'erreur clairs et actionnables
- [ ] ✅ Exit code non-0 en cas d'erreur (CI/CD)

#### Test 1.2.3 : Validation avec SwaggerParser
```typescript
// Tester validation avec @apidevtools/swagger-parser
import SwaggerParser from '@apidevtools/swagger-parser';

const spec = await generateOpenApiSpec();
await SwaggerParser.validate(spec);
```

**Vérifications** :
- [ ] ✅ SwaggerParser valide spec correctement
- [ ] ✅ Erreurs SwaggerParser reportées
- [ ] ✅ Faux positifs connus gérés (partner paths)
- [ ] ✅ Validation ne bloque pas en dev (seulement en prod)

**Violations détectées** :
- ❌ Validation ne détecte pas erreurs → **BLOQUANT**
- ❌ Validation plante sur spec valide → **BLOQUANT**
- ❌ Messages d'erreur vagues → **BLOQUANT**
- ❌ Validation trop lente (>10s) → **WARNING**

### 1.3 Test de Cohérence Spec vs Code

**CRITICAL** : Vérifie que la spec OpenAPI est cohérente avec le code réel.

**Tests à effectuer** :

#### Test 1.3.1 : Vérification automatique de cohérence
```bash
# Script de vérification
npm run check:openapi-consistency

# Vérifications
- [ ] ✅ Script existe et fonctionne
- [ ] ✅ Détecte chemins incohérents (spec vs code)
- [ ] ✅ Détecte méthodes incohérentes (spec vs code)
- [ ] ✅ Détecte paramètres manquants (spec vs code)
- [ ] ✅ Détecte body incohérents (spec vs code)
- [ ] ✅ Détecte réponses incohérentes (spec vs code)
```

#### Test 1.3.2 : Vérification manuelle (échantillon)
```typescript
// Sélectionner 10 routes aléatoires
// Vérifier manuellement cohérence spec vs code
```

**Vérifications** :
- [ ] ✅ Chemins dans spec correspondent aux routes Express
- [ ] ✅ Méthodes HTTP dans spec correspondent aux routes
- [ ] ✅ Paramètres path dans spec correspondent aux routes
- [ ] ✅ Paramètres query dans spec correspondent aux validations Zod
- [ ] ✅ Request body dans spec correspond aux schémas Zod
- [ ] ✅ Réponses dans spec correspondent aux réponses réelles
- [ ] ✅ Codes de statut HTTP dans spec correspondent aux réponses

#### Test 1.3.3 : Vérification avec tests d'intégration
```typescript
// Utiliser tests d'intégration existants
// Vérifier que les réponses correspondent à la spec
```

**Vérifications** :
- [ ] ✅ Tests d'intégration utilisent spec OpenAPI
- [ ] ✅ Réponses réelles correspondent aux schémas spec
- [ ] ✅ Codes de statut correspondent aux spec
- [ ] ✅ Erreurs correspondent aux schémas ErrorResponse

**Violations détectées** :
- ❌ Chemins incohérents → **BLOQUANT**
- ❌ Paramètres manquants dans spec → **BLOQUANT**
- ❌ Body incohérents → **BLOQUANT**
- ❌ Réponses incohérentes → **BLOQUANT**
- ❌ Codes de statut incorrects → **BLOQUANT**

---

## 🔍 2. TESTS DE SCHEMA REGISTRY & CONVERSION

### 2.1 Test de Registration de Schémas Zod

**CRITICAL** : Vérifie que l'enregistrement de schémas Zod fonctionne correctement.

**Tests à effectuer** :

#### Test 2.1.1 : Enregistrement de schémas de base
```typescript
import { registerSchema } from '@/docs/schema-registry';
import { z } from 'zod';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().positive(),
});

registerSchema('TestSchema', testSchema, 'Test schema');
```

**Vérifications** :
- [ ] ✅ Schéma enregistré sans erreurs
- [ ] ✅ Schéma accessible via `getOpenApiSchemas()`
- [ ] ✅ Schéma apparaît dans spec générée
- [ ] ✅ Nom du schéma correct dans spec
- [ ] ✅ Description du schéma correcte dans spec

#### Test 2.1.2 : Enregistrement de schémas complexes
```typescript
// Tester différents types Zod
const stringSchema = z.string();
const numberSchema = z.number();
const enumSchema = z.enum(['A', 'B', 'C']);
const dateSchema = z.date();
const arraySchema = z.array(z.string());
const objectSchema = z.object({ ... });
const unionSchema = z.union([z.string(), z.number()]);
const optionalSchema = z.string().optional();
const nullableSchema = z.string().nullable();
```

**Vérifications** :
- [ ] ✅ Tous les types Zod enregistrés correctement
- [ ] ✅ Conversion Zod → OpenAPI correcte pour chaque type
- [ ] ✅ Schémas imbriqués convertis correctement
- [ ] ✅ Schémas array convertis correctement
- [ ] ✅ Schémas union convertis correctement (si supporté)
- [ ] ✅ Schémas date convertis en `type: string, format: date-time`
- [ ] ✅ Schémas optional/nullable marqués correctement

#### Test 2.1.3 : Enregistrement avec erreurs (solidité)
```typescript
// Tester cas limites
registerSchema('', testSchema); // Nom vide
registerSchema('TestSchema', null as any); // Schéma invalide
registerSchema('TestSchema', testSchema); // Duplication
```

**Vérifications** :
- [ ] ✅ Erreurs de registration reportées clairement
- [ ] ✅ Duplications détectées et gérées
- [ ] ✅ Schémas invalides rejetés
- [ ] ✅ Noms vides rejetés

**Violations détectées** :
- ❌ Schémas non enregistrés → **BLOQUANT**
- ❌ Conversion Zod → OpenAPI incorrecte → **BLOQUANT**
- ❌ Types Zod non supportés → **BLOQUANT**
- ❌ Erreurs silencieuses → **BLOQUANT**

### 2.2 Test de Conversion Zod → OpenAPI

**CRITICAL** : Vérifie que la conversion Zod → OpenAPI est correcte et complète.

**Tests à effectuer** :

#### Test 2.2.1 : Conversion de types de base
```typescript
// Tester conversion pour chaque type Zod
z.string() → { type: 'string' }
z.number() → { type: 'number' }
z.boolean() → { type: 'boolean' }
z.date() → { type: 'string', format: 'date-time' }
z.enum(['A', 'B']) → { type: 'string', enum: ['A', 'B'] }
```

**Vérifications** :
- [ ] ✅ Conversion correcte pour chaque type de base
- [ ] ✅ Formats corrects (date-time, email, uri, etc.)
- [ ] ✅ Enums corrects
- [ ] ✅ Types corrects

#### Test 2.2.2 : Conversion de validations
```typescript
// Tester conversion de validations Zod
z.string().min(1) → { type: 'string', minLength: 1 }
z.string().max(100) → { type: 'string', maxLength: 100 }
z.number().positive() → { type: 'number', minimum: 0, exclusiveMinimum: true }
z.number().int() → { type: 'integer' }
z.string().email() → { type: 'string', format: 'email' }
z.string().url() → { type: 'string', format: 'uri' }
```

**Vérifications** :
- [ ] ✅ Validations min/max converties correctement
- [ ] ✅ Validations positive/negative converties correctement
- [ ] ✅ Formats email/url convertis correctement
- [ ] ✅ Types integer vs number corrects

#### Test 2.2.3 : Conversion de schémas complexes
```typescript
// Tester conversion de schémas imbriqués
z.object({
  user: z.object({
    name: z.string(),
    age: z.number(),
  }),
  items: z.array(z.string()),
  metadata: z.record(z.string(), z.unknown()),
});
```

**Vérifications** :
- [ ] ✅ Schémas imbriqués convertis correctement
- [ ] ✅ Schémas array convertis correctement
- [ ] ✅ Schémas record/object convertis correctement
- [ ] ✅ Références $ref utilisées pour schémas réutilisables

**Violations détectées** :
- ❌ Conversion incorrecte pour certains types → **BLOQUANT**
- ❌ Validations non converties → **BLOQUANT**
- ❌ Schémas complexes non convertis → **BLOQUANT**

---

## 🎨 3. TESTS DE SWAGGER UI & ACCESSIBILITÉ

### 3.1 Test d'Accès à Swagger UI

**CRITICAL** : Vérifie que Swagger UI est accessible et fonctionnel.

**Tests à effectuer** :

#### Test 3.1.1 : Accès à Swagger UI
```bash
# Démarrer l'API
npm run dev

# Accéder à Swagger UI
curl http://localhost:8080/api-docs/ui
# OU ouvrir dans navigateur
```

**Vérifications** :
- [ ] ✅ Route `/api-docs/ui` accessible
- [ ] ✅ Swagger UI se charge sans erreurs
- [ ] ✅ Spec OpenAPI chargée correctement
- [ ] ✅ Tous les endpoints affichés
- [ ] ✅ Temps de chargement <3s (performance)
- [ ] ✅ Pas d'erreurs JavaScript dans console
- [ ] ✅ Interface responsive (mobile/desktop)

#### Test 3.1.2 : Accès à Spec JSON/YAML
```bash
# Tester endpoints de spec
curl http://localhost:8080/api-docs
curl http://localhost:8080/api-docs/yaml
```

**Vérifications** :
- [ ] ✅ Route `/api-docs` retourne spec JSON
- [ ] ✅ Route `/api-docs/yaml` retourne spec YAML (si applicable)
- [ ] ✅ Content-Type correct (`application/json`, `application/yaml`)
- [ ] ✅ Spec valide (JSON/YAML parsable)
- [ ] ✅ Spec complète (tous les endpoints présents)

#### Test 3.1.3 : Authentification dans Swagger UI
```typescript
// Tester authentification Bearer token
// 1. Cliquer sur "Authorize" dans Swagger UI
// 2. Entrer token JWT
// 3. Tester endpoint protégé
```

**Vérifications** :
- [ ] ✅ Bouton "Authorize" présent
- [ ] ✅ Authentification Bearer token fonctionnelle
- [ ] ✅ Token stocké correctement
- [ ] ✅ Endpoints protégés accessibles avec token
- [ ] ✅ Endpoints protégés rejettent requêtes sans token

**Violations détectées** :
- ❌ Swagger UI inaccessible → **BLOQUANT**
- ❌ Spec non chargée → **BLOQUANT**
- ❌ Authentification non fonctionnelle → **BLOQUANT**
- ❌ Temps de chargement >5s → **WARNING**

### 3.2 Test de Fonctionnalités Swagger UI

**CRITICAL** : Vérifie que toutes les fonctionnalités Swagger UI fonctionnent.

**Tests à effectuer** :

#### Test 3.2.1 : Test d'endpoints depuis Swagger UI
```typescript
// Pour chaque endpoint testable :
// 1. Cliquer sur endpoint
// 2. Cliquer sur "Try it out"
// 3. Remplir paramètres
// 4. Cliquer sur "Execute"
// 5. Vérifier réponse
```

**Vérifications** :
- [ ] ✅ Bouton "Try it out" fonctionne
- [ ] ✅ Paramètres éditables correctement
- [ ] ✅ Requête envoyée correctement
- [ ] ✅ Réponse affichée correctement
- [ ] ✅ Codes de statut HTTP corrects
- [ ] ✅ Erreurs affichées correctement

#### Test 3.2.2 : Filtrage et recherche
```typescript
// Tester fonctionnalités de Swagger UI
// 1. Filtrage par tag
// 2. Recherche d'endpoints
// 3. Tri des endpoints
```

**Vérifications** :
- [ ] ✅ Filtrage par tag fonctionne
- [ ] ✅ Recherche d'endpoints fonctionne
- [ ] ✅ Tri des endpoints fonctionne
- [ ] ✅ Interface intuitive

**Violations détectées** :
- ❌ Endpoints non testables → **BLOQUANT**
- ❌ Réponses incorrectes → **BLOQUANT**
- ❌ Erreurs non affichées → **BLOQUANT**

---

## 🔧 4. TESTS DE GÉNÉRATION DE CLIENT

### 4.1 Test de Génération de Client TypeScript

**CRITICAL** : Vérifie que la génération de client TypeScript fonctionne correctement.

**Tests à effectuer** :

#### Test 4.1.1 : Génération de base
```bash
# Commande à exécuter
npm run docs:client:generate

# Vérifications
- [ ] ✅ Client généré sans erreurs
- [ ] ✅ Fichier `apps/web/lib/api/generated/client.ts` créé/mis à jour
- [ ] ✅ Client TypeScript valide (pas d'erreurs de compilation)
- [ ] ✅ Types corrects (pas de `any` non nécessaire)
- [ ] ✅ Temps de génération <30s (performance)
```

#### Test 4.1.2 : Vérification de contenu du client
```typescript
// Vérifier que le client contient :
// 1. Toutes les opérations de la spec
// 2. Types corrects pour chaque opération
// 3. Paramètres corrects
// 4. Types de réponse corrects
```

**Vérifications** :
- [ ] ✅ Toutes les opérations présentes dans client
- [ ] ✅ Types de paramètres corrects
- [ ] ✅ Types de réponse corrects
- [ ] ✅ Types d'erreur corrects
- [ ] ✅ Hooks React Query corrects (si applicable)
- [ ] ✅ Mutator personnalisé intégré (si applicable)

#### Test 4.1.3 : Génération avec erreurs (solidité)
```typescript
// Tester résistance aux erreurs
// 1. Spec invalide
// 2. Références cassées
// 3. Schémas manquants
```

**Vérifications** :
- [ ] ✅ Erreurs de génération reportées clairement
- [ ] ✅ Messages d'erreur actionnables
- [ ] ✅ Génération ne plante pas complètement

**Violations détectées** :
- ❌ Client non généré → **BLOQUANT**
- ❌ Erreurs de compilation dans client → **BLOQUANT**
- ❌ Types incorrects → **BLOQUANT**
- ❌ Opérations manquantes → **BLOQUANT**

### 4.2 Test d'Utilisation du Client Généré

**CRITICAL** : Vérifie que le client généré fonctionne correctement en utilisation réelle.

**Tests à effectuer** :

#### Test 4.2.1 : Utilisation du client dans code frontend
```typescript
// Tester utilisation du client
import { useListInvoices } from '@/lib/api/generated/client';

const { data, error, isLoading } = useListInvoices({ companyId });
```

**Vérifications** :
- [ ] ✅ Client importable sans erreurs
- [ ] ✅ Hooks React Query fonctionnent
- [ ] ✅ Types corrects (autocomplétion fonctionne)
- [ ] ✅ Requêtes envoyées correctement
- [ ] ✅ Réponses typées correctement
- [ ] ✅ Erreurs typées correctement

#### Test 4.2.2 : Cohérence client vs API réelle
```typescript
// Tester que le client correspond à l'API réelle
// 1. Appeler endpoint via client
// 2. Vérifier que la requête correspond à la spec
// 3. Vérifier que la réponse correspond à la spec
```

**Vérifications** :
- [ ] ✅ Requêtes client correspondent à spec
- [ ] ✅ Réponses API correspondent à types client
- [ ] ✅ Erreurs API correspondent à types client
- [ ] ✅ Codes de statut HTTP corrects

**Violations détectées** :
- ❌ Client non utilisable → **BLOQUANT**
- ❌ Types incorrects → **BLOQUANT**
- ❌ Incohérence client vs API → **BLOQUANT**

---

## 🚀 5. TESTS DE CI/CD & AUTOMATISATION

### 5.1 Test d'Intégration CI/CD

**CRITICAL** : Vérifie que l'intégration CI/CD fonctionne correctement.

**Tests à effectuer** :

#### Test 5.1.1 : Validation dans Cloud Build
```yaml
# Vérifier cloudbuild.yaml
# Étapes de validation OpenAPI
```

**Vérifications** :
- [ ] ✅ Génération OpenAPI dans Cloud Build
- [ ] ✅ Validation OpenAPI dans Cloud Build
- [ ] ✅ Build échoue si validation échoue
- [ ] ✅ Erreurs reportées clairement dans logs
- [ ] ✅ Temps de validation acceptable (<2min)

#### Test 5.1.2 : Test local de workflow CI/CD
```bash
# Simuler workflow CI/CD localement
npm run docs:generate
npm run docs:validate
npm run docs:client:generate
```

**Vérifications** :
- [ ] ✅ Toutes les étapes passent
- [ ] ✅ Ordre des étapes correct
- [ ] ✅ Dépendances respectées (generate avant validate)

#### Test 5.1.3 : Test avec spec invalide (solidité)
```typescript
// Créer spec invalide
// Vérifier que CI/CD détecte et bloque
```

**Vérifications** :
- [ ] ✅ CI/CD détecte spec invalide
- [ ] ✅ CI/CD bloque le build
- [ ] ✅ Erreurs reportées clairement

**Violations détectées** :
- ❌ Validation non intégrée dans CI/CD → **BLOQUANT**
- ❌ Build ne bloque pas sur erreurs → **BLOQUANT**
- ❌ Erreurs non reportées → **BLOQUANT**

### 5.2 Test de Scripts NPM

**CRITICAL** : Vérifie que tous les scripts npm fonctionnent correctement.

**Tests à effectuer** :

#### Test 5.2.1 : Scripts de base
```bash
npm run docs:generate
npm run docs:validate
npm run docs:client:generate
```

**Vérifications** :
- [ ] ✅ Tous les scripts existent
- [ ] ✅ Tous les scripts fonctionnent
- [ ] ✅ Scripts documentés dans package.json
- [ ] ✅ Messages d'erreur clairs
- [ ] ✅ Exit codes corrects (0 = succès, non-0 = erreur)

#### Test 5.2.2 : Scripts avec erreurs (solidité)
```bash
# Tester comportement avec erreurs
# 1. Spec invalide
# 2. Fichiers manquants
# 3. Permissions insuffisantes
```

**Vérifications** :
- [ ] ✅ Erreurs reportées clairement
- [ ] ✅ Exit codes non-0 en cas d'erreur
- [ ] ✅ Messages d'erreur actionnables

**Violations détectées** :
- ❌ Scripts manquants → **BLOQUANT**
- ❌ Scripts non fonctionnels → **BLOQUANT**
- ❌ Erreurs silencieuses → **BLOQUANT**

---

## 📊 6. TESTS DE COMPLÉTUDE & COUVERTURE

### 6.1 Test de Couverture des Routes

**CRITICAL** : Vérifie que toutes les routes sont documentées dans OpenAPI.

**Tests à effectuer** :

#### Test 6.1.1 : Inventaire des routes
```typescript
// Scanner tous les fichiers de routes
// Lister toutes les routes définies
// Vérifier présence d'annotations OpenAPI
```

**Vérifications** :
- [ ] ✅ Liste complète de toutes les routes (Company, Tenant, Partner)
- [ ] ✅ Routes Superadmin exclues (filtrage)
- [ ] ✅ Routes internes (health, metrics) exclues ou documentées
- [ ] ✅ Routes dépréciées marquées avec `deprecated: true`

#### Test 6.1.2 : Calcul de couverture
```typescript
// Calculer pourcentage de couverture
const totalRoutes = /* toutes les routes */;
const documentedRoutes = /* routes avec annotations */;
const coverage = (documentedRoutes / totalRoutes) * 100;
```

**Vérifications** :
- [ ] ✅ Couverture >95% des routes publiques
- [ ] ✅ Routes importantes toutes documentées
- [ ] ✅ Routes manquantes identifiées et listées

**Violations détectées** :
- ❌ Couverture <90% → **BLOQUANT**
- ❌ Routes importantes non documentées → **BLOQUANT**

### 6.2 Test de Complétude des Annotations

**CRITICAL** : Vérifie que toutes les annotations OpenAPI sont complètes.

**Tests à effectuer** :

#### Test 6.2.1 : Vérification des éléments requis
```typescript
// Pour chaque route avec annotation :
// Vérifier présence de :
// - operationId
// - summary
// - description
// - tags
// - security (si protégée)
// - parameters
// - requestBody (si applicable)
// - responses
```

**Vérifications** :
- [ ] ✅ Toutes les routes ont `operationId`
- [ ] ✅ Toutes les routes ont `summary`
- [ ] ✅ Toutes les routes ont `description`
- [ ] ✅ Toutes les routes ont `tags`
- [ ] ✅ Routes protégées ont `security`
- [ ] ✅ Routes avec body ont `requestBody`
- [ ] ✅ Toutes les routes ont `responses` (200, 400, 401, 403, 404, 500)

#### Test 6.2.2 : Vérification de qualité
```typescript
// Vérifier qualité des annotations :
// - operationId uniques et descriptifs
// - summaries concis (<80 caractères)
// - descriptions complètes
// - tags cohérents
// - exemples fournis
```

**Vérifications** :
- [ ] ✅ Operation IDs uniques
- [ ] ✅ Summaries concis et descriptifs
- [ ] ✅ Descriptions complètes
- [ ] ✅ Tags cohérents (format `[Portal, Domain, Module]`)
- [ ] ✅ Exemples fournis pour paramètres et body

**Violations détectées** :
- ❌ Annotations incomplètes → **BLOQUANT**
- ❌ Operation IDs dupliqués → **BLOQUANT**
- ❌ Summaries trop longs ou vagues → **BLOQUANT**

### 6.3 Test de Complétude des Schémas

**CRITICAL** : Vérifie que tous les schémas sont complets et valides.

**Tests à effectuer** :

#### Test 6.3.1 : Vérification des schémas communs
```typescript
// Vérifier présence de schémas communs :
// - ErrorResponse
// - SuccessResponse
// - Common parameters (companyId, tenantId, etc.)
// - Common responses (ForbiddenError, NotFoundError, etc.)
```

**Vérifications** :
- [ ] ✅ Schéma `ErrorResponse` présent et complet
- [ ] ✅ Schéma `SuccessResponse` présent et complet
- [ ] ✅ Paramètres communs définis
- [ ] ✅ Réponses communes définies
- [ ] ✅ Schémas réutilisés via `$ref` (pas de duplication)

#### Test 6.3.2 : Vérification de qualité des schémas
```typescript
// Vérifier qualité des schémas :
// - Tous les champs documentés
// - Types corrects
// - Formats spécifiés (date-time, email, uri, etc.)
// - Validations documentées (min, max, pattern, etc.)
// - Required fields marqués
```

**Vérifications** :
- [ ] ✅ Tous les champs documentés
- [ ] ✅ Types corrects
- [ ] ✅ Formats spécifiés
- [ ] ✅ Validations documentées
- [ ] ✅ Required fields marqués

**Violations détectées** :
- ❌ Schémas communs manquants → **BLOQUANT**
- ❌ Schémas incomplets → **BLOQUANT**
- ❌ Duplication au lieu de `$ref` → **BLOQUANT**

---

## 🛡️ 7. TESTS DE SOLIDITÉ & RÉSISTANCE AUX ERREURS

### 7.1 Test de Résistance aux Erreurs de Génération

**CRITICAL** : Vérifie que le système résiste aux erreurs et cas limites.

**Tests à effectuer** :

#### Test 7.1.1 : Routes avec annotations invalides
```typescript
// Créer routes avec :
// 1. Annotations JSON invalides
// 2. Références $ref cassées
// 3. Schémas manquants
// 4. Types incorrects
```

**Vérifications** :
- [ ] ✅ Erreurs détectées et reportées
- [ ] ✅ Génération ne plante pas complètement
- [ ] ✅ Routes valides toujours générées
- [ ] ✅ Messages d'erreur clairs

#### Test 7.1.2 : Schémas Zod invalides
```typescript
// Tester avec :
// 1. Schémas Zod non enregistrés
// 2. Schémas Zod avec types non supportés
// 3. Schémas Zod avec références circulaires
```

**Vérifications** :
- [ ] ✅ Erreurs détectées et reportées
- [ ] ✅ Génération continue avec schémas valides
- [ ] ✅ Messages d'erreur actionnables

#### Test 7.1.3 : Fichiers manquants ou inaccessibles
```typescript
// Tester avec :
// 1. Fichiers de routes manquants
// 2. Fichiers de routes avec permissions insuffisantes
// 3. Répertoires manquants
```

**Vérifications** :
- [ ] ✅ Erreurs détectées et reportées
- [ ] ✅ Génération continue avec fichiers disponibles
- [ ] ✅ Messages d'erreur clairs

**Violations détectées** :
- ❌ Génération plante complètement sur erreur → **BLOQUANT**
- ❌ Erreurs silencieuses → **BLOQUANT**
- ❌ Messages d'erreur vagues → **BLOQUANT**

### 7.2 Test de Performance & Scalabilité

**CRITICAL** : Vérifie que le système est performant et scalable.

**Tests à effectuer** :

#### Test 7.2.1 : Performance de génération
```typescript
// Mesurer temps de génération avec :
// 1. Nombre de routes croissant (10, 50, 100, 200+)
// 2. Nombre de schémas croissant (10, 50, 100+)
```

**Vérifications** :
- [ ] ✅ Génération <10s pour 100 routes
- [ ] ✅ Génération <30s pour 500 routes
- [ ] ✅ Performance dégrade gracieusement (pas d'exponentiel)
- [ ] ✅ Mémoire utilisée raisonnable (<500MB)

#### Test 7.2.2 : Performance de validation
```typescript
// Mesurer temps de validation avec :
// 1. Specs de différentes tailles
// 2. Nombre de références croissant
```

**Vérifications** :
- [ ] ✅ Validation <5s pour spec moyenne
- [ ] ✅ Validation <15s pour spec grande
- [ ] ✅ Performance dégrade gracieusement

#### Test 7.2.3 : Performance de Swagger UI
```typescript
// Mesurer temps de chargement Swagger UI avec :
// 1. Nombre d'endpoints croissant
// 2. Nombre de schémas croissant
```

**Vérifications** :
- [ ] ✅ Chargement <3s pour 100 endpoints
- [ ] ✅ Chargement <5s pour 500 endpoints
- [ ] ✅ Interface reste responsive

**Violations détectées** :
- ❌ Génération >60s pour 100 routes → **WARNING**
- ❌ Mémoire >1GB → **WARNING**
- ❌ Chargement Swagger UI >10s → **WARNING**

---

## ✅ 8. CHECKLIST FINALE & RAPPORT

### 8.1 Résumé des Tests Effectués

**CRITICAL** : Produis un résumé de tous les tests effectués.

**Format** :
```
## Résumé des Tests

### Tests de Génération & Validation
- [ ] Génération de base : ✅ PASS / ❌ FAIL
- [ ] Génération avec options : ✅ PASS / ❌ FAIL
- [ ] Génération avec erreurs : ✅ PASS / ❌ FAIL
- [ ] Validation de spec valide : ✅ PASS / ❌ FAIL
- [ ] Validation de spec invalide : ✅ PASS / ❌ FAIL
- [ ] Cohérence spec vs code : ✅ PASS / ❌ FAIL

### Tests de Schema Registry & Conversion
- [ ] Registration de schémas : ✅ PASS / ❌ FAIL
- [ ] Conversion Zod → OpenAPI : ✅ PASS / ❌ FAIL
- [ ] Schémas complexes : ✅ PASS / ❌ FAIL

### Tests de Swagger UI
- [ ] Accès à Swagger UI : ✅ PASS / ❌ FAIL
- [ ] Accès à Spec JSON/YAML : ✅ PASS / ❌ FAIL
- [ ] Authentification : ✅ PASS / ❌ FAIL
- [ ] Test d'endpoints : ✅ PASS / ❌ FAIL

### Tests de Génération de Client
- [ ] Génération de base : ✅ PASS / ❌ FAIL
- [ ] Vérification de contenu : ✅ PASS / ❌ FAIL
- [ ] Utilisation du client : ✅ PASS / ❌ FAIL

### Tests de CI/CD
- [ ] Validation dans Cloud Build : ✅ PASS / ❌ FAIL
- [ ] Scripts NPM : ✅ PASS / ❌ FAIL

### Tests de Complétude
- [ ] Couverture des routes : [X]% (objectif: >95%)
- [ ] Complétude des annotations : [X]% (objectif: 100%)
- [ ] Complétude des schémas : [X]% (objectif: 100%)

### Tests de Solidité
- [ ] Résistance aux erreurs : ✅ PASS / ❌ FAIL
- [ ] Performance : ✅ PASS / ❌ FAIL
```

### 8.2 Violations Détectées

**CRITICAL** : Liste toutes les violations détectées, organisées par priorité.

**Format** :
```
## Violations Détectées

### BLOQUANT CRITIQUE (doit être corrigé immédiatement)
- [ ] Description + fichier + ligne + impact + test qui a détecté

### BLOQUANT (doit être corrigé avant merge)
- [ ] Description + fichier + ligne + impact + test qui a détecté

### WARNING (devrait être corrigé)
- [ ] Description + fichier + ligne + impact + test qui a détecté

### Par Catégorie
- **Génération & Validation**: [nombre] violations
- **Schema Registry**: [nombre] violations
- **Swagger UI**: [nombre] violations
- **Client Generation**: [nombre] violations
- **CI/CD**: [nombre] violations
- **Complétude**: [nombre] violations
- **Solidité**: [nombre] violations
```

### 8.3 Recommandations

**CRITICAL** : Produis des recommandations pour améliorer la solidité et complétude.

**Format** :
```
## Recommandations

### Priorité CRITIQUE (Impact Sécurité/Stabilité)
- [ ] Recommandation 1 (impact, effort, bénéfice, test à ajouter)

### Priorité HAUTE (Impact Qualité/Expérience)
- [ ] Recommandation 2 (impact, effort, bénéfice, test à ajouter)

### Priorité MOYENNE (Impact Maintenance/Évolutivité)
- [ ] Recommandation 3 (impact, effort, bénéfice, test à ajouter)
```

### 8.4 Métriques & Statistiques

**CRITICAL** : Produis des métriques quantitatives.

**Format** :
```
## Métriques de Test

### Couverture
- Routes documentées: [X] / [Y] ([Z]%)
- Annotations complètes: [X] / [Y] ([Z]%)
- Schémas enregistrés: [X]
- Tests passés: [X] / [Y] ([Z]%)

### Performance
- Temps génération spec: [X]s (objectif: <10s)
- Temps validation spec: [X]s (objectif: <5s)
- Temps génération client: [X]s (objectif: <30s)
- Temps chargement Swagger UI: [X]s (objectif: <3s)

### Solidité
- Tests de résistance aux erreurs: [X] / [Y] ([Z]%)
- Tests de performance: [X] / [Y] ([Z]%)
- Tests de complétude: [X] / [Y] ([Z]%)
```

### 8.5 Rapport Final

**CRITICAL** : Produis un rapport final structuré.

**Format** :
```
## Rapport d'Audit Testing & Validation OpenAPI - [Date]

### Executive Summary
- **Scope**: [testing-audit | validation-audit | solidity-audit | full-testing-audit]
- **Tests effectués**: [X] tests
- **Tests passés**: [X] / [Y] ([Z]%)
- **Violations détectées**: [X] (dont [X] bloquantes)
- **Durée audit**: [X] minutes

### Résultats Globaux
- ✅ **Points forts**: [liste des 3-5 points forts principaux]
- ❌ **Violations bloquantes**: [X] (dont [X] critiques)
- ⚠️ **Warnings**: [X]
- 📊 **Score solidité**: [X]/10
- 📊 **Score complétude**: [X]/10

### Détail par Catégorie

#### 1. Génération & Validation
- ✅ Tests passés: [X] / [Y]
- ❌ Violations: [X]
- ⚠️ Warnings: [X]
- 📝 Actions: [liste]

#### 2. Schema Registry & Conversion
- ✅ Tests passés: [X] / [Y]
- ❌ Violations: [X]
- ⚠️ Warnings: [X]
- 📝 Actions: [liste]

[... Répéter pour chaque catégorie ...]

### Actions Requises (Priorisées)

#### Immédiat (Avant merge)
1. [Action 1] - [Fichier] - [Ligne] - [Impact] - [Test qui a détecté]

#### Court terme (Cette semaine)
1. [Action 2] - [Fichier] - [Ligne] - [Impact] - [Test qui a détecté]

### Tests à Ajouter

#### Tests manquants critiques
- [ ] Test 1: [Description] - [Impact] - [Effort]
- [ ] Test 2: [Description] - [Impact] - [Effort]

#### Tests de régression
- [ ] Test 1: [Description] - [Impact] - [Effort]
- [ ] Test 2: [Description] - [Impact] - [Effort]

### Conclusion
[2-3 paragraphes résumant l'état général, les priorités, et les recommandations principales]
```

---

**⚠️ RAPPEL CRITICAL** : Cet audit se concentre sur la **validation pratique**, les **tests de solidité**, et la **vérification de complétude**. Il complète l'audit architectural existant en se concentrant sur l'aspect **opérationnel et testable** du système OpenAPI/Swagger.
