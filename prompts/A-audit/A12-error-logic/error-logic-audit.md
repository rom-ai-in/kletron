Tu es un **auditeur senior Architecture + Qualité + Observabilité** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de la logique de gestion d'erreurs** dans le backend (`apps/api`), le frontend (`apps/web`), le MCP (`apps/mcp`), et le système de capture d'erreurs, en vérifiant que **TOUS les éléments requis** sont présents, correctement implémentés, testés, documentés, et conformes aux règles strictes du monorepo.

**⚠️ CRITICAL** : Cet audit se concentre sur la cohérence, la qualité, et l'architecture de la gestion d'erreurs à travers toutes les couches de l'application. L'audit doit vérifier la conformité avec les patterns établis, l'i18n, la capture d'erreurs, l'observabilité, et la qualité du code.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

**⚠️ IMPORTANT** : En cas de contradiction entre documentation et code, **le code est la source de vérité**.

- **Error Handling Architecture** : `docs/02-development/errors/error-handling.md` (⚠️ contient exemples obsolètes avec `success: false` - ignorer, voir type `ApiErrorResponse`)
- **Error Handling Best Practices** : `docs/02-development/errors/error-handling-best-practices.md`
- **Frontend Error Capture** : `docs/02-development/errors/frontend-error-capture.md`
- **Error Observatory** : `docs/01-architecture/observability/error-observatory.md`
- **ApiError Class** : `apps/api/src/core/errors/ApiError.ts`
- **Errors Helpers** : `apps/api/src/core/errors/index.ts`
- **Error Handler Middleware** : `apps/api/src/middleware/error-handler.ts` (source de vérité pour format réel)
- **Error Observability Service** : `apps/api/src/services/error-observability.service.ts`
- **ApiFetchError** : `apps/web/lib/api/errors.ts`
- **Error Capture Utility** : `apps/web/lib/api/error-capture.ts`
- **useApiError Hook** : `apps/web/hooks/useApiError.ts`
- **GlobalErrorBoundary** : `apps/web/components/shared/GlobalErrorBoundary.tsx`
- **PortalErrorState** : `apps/web/components/portals/PortalErrorState.tsx`
- **MCP Error Handler** : `apps/mcp/src/middleware/error-handler.ts`
- **MCP Error Classes** : `packages/mcp-shared/src/errors.ts`
- **ErrorCode Types & ApiErrorResponse** : `packages/shared-ts/src/types/api-error.ts` (⭐ **SOURCE DE VÉRITÉ pour format de réponse**)
- **i18n Guide** : `docs/02-development/i18n/tone-audit-guide.md`

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Type** : `full-audit` | `backend-only` | `frontend-only` | `mcp-only` | `capture-only` | `diff-only`
   - **Services concernés** : Liste complète (error-handler, error-observability, error-capture, etc.)
   - **Portals concernés** : `/c`, `/t`, `/p`, `/s` (vérifier cohérence inter-portals)
   - **Fichiers modifiés** : Liste complète (si diff-only)

2. **Composants Error identifiés** :
   - **Backend** : ApiError, Errors helpers, error-handler middleware, error-observability service
   - **Frontend** : ApiFetchError, useApiError, GlobalErrorBoundary, PortalErrorState, error-capture
   - **MCP** : McpError, error-handler middleware, api-error-mapper
   - **Observabilité** : error-observability service, error capture endpoints, MongoDB collections

3. **Flux d'erreurs identifiés** :
   - **Backend → Frontend** : ApiError → ApiErrorResponse → ApiFetchError → useApiError → UI
   - **Frontend → Backend** : React errors → captureWebError → POST /s/errors/capture → error-observability
   - **MCP → API** : McpError → error-handler → ApiError → ApiErrorResponse
   - **API → Observabilité** : error-handler → captureHttpError → error-observability → MongoDB

4. **Intégrations identifiées** :
   - **i18n** : Tous les messages d'erreur utilisent des clés i18n (pas de strings hardcodées)
   - **Error Codes** : Codes standardisés dans `packages/shared-ts/src/types/api-error.ts`
   - **Error Types** : Classification network/business/technical pour UX
   - **Error Capture** : Capture automatique avec rate limiting et sanitization
   - **Logging** : Logging structuré avec contexte (correlationId, requestId, userId, etc.)

---

## 🔍 1. QUALITÉ DU CODE & ARCHITECTURE

### 1.1 Backend Error Handling Architecture Cohérence

**CRITICAL** : Vérifie que l'architecture backend de gestion d'erreurs est cohérente et respecte les patterns établis.

**Checklist** :
- [ ] ✅ **ApiError class** : ApiError étend Error avec status, code, details (pas d'erreurs génériques)
- [ ] ✅ **Errors helpers** : Errors.badRequest(), Errors.notFound(), etc. utilisés partout (pas de `new Error()` direct)
- [ ] ✅ **Error handler middleware** : Middleware global traduit erreurs via i18n (pas de messages hardcodés)
- [ ] ✅ **Error response format** : Toutes les erreurs retournent ApiErrorResponse standardisé
- [ ] ✅ **i18n integration** : Tous les messages d'erreur utilisent des clés i18n (format `"errors.xxx"`)
- [ ] ✅ **Error logging** : Erreurs loggées avec contexte structuré (pas de `console.log`)
- [ ] ✅ **Error correlation** : correlationId et requestId inclus dans réponses (pour debugging)
- [ ] ✅ **Validation errors** : Erreurs Zod transformées en ApiError avec détails (pas d'erreurs brutes)
- [ ] ✅ **Type safety** : Tous les helpers ont des types explicites (pas de `any` implicite, `any` autorisé uniquement pour compatibilité legacy backend)
- [ ] ✅ **Error codes** : Tous les codes d'erreur existent dans `packages/shared-ts/src/types/api-error.ts`

**Patterns attendus** :
```typescript
// ✅ CORRECT: ApiError avec i18n, logging, correlation
export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  details?: Record<string, unknown>;
  
  constructor(
    status: number,
    code: ErrorCode,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ✅ CORRECT: Errors helpers avec i18n keys
export const Errors = {
  badRequest: (msg?: string, details?: Record<string, unknown>): ApiError => {
    return new ApiError(400, "BAD_REQUEST", msg || "errors.bad_request", details);
  },
  notFound: (msg?: string): ApiError => {
    return new ApiError(404, "NOT_FOUND", msg || "errors.not_found");
  },
  // ...
};

// ✅ CORRECT: Route handler avec validation Zod et error handling
router.post(
  "/endpoint",
  asyncHandler(async (req, res) => {
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw validationFromZod(error);
      }
      throw error;
    }
    
    const entity = await service.findById(id);
    if (!entity) {
      throw Errors.notFound("errors.entity_not_found");
    }
    
    res.json({ success: true, data: result });
  })
);

// ❌ WRONG: Erreurs génériques, pas d'i18n, pas de format standardisé
router.post("/endpoint", async (req, res) => {
  try {
    const entity = await service.findById(id);
    if (!entity) {
      res.status(404).json({ error: "Entity not found" }); // Pas de format standardisé
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message }); // Pas d'i18n, pas de code
  }
});
```

**Violations détectées** :
- ❌ Utilisation de `new Error()` au lieu de `Errors.*` → **BLOQUANT**
- ❌ Messages d'erreur hardcodés (pas d'i18n) → **BLOQUANT**
- ❌ Format de réponse non standardisé (wrapper `success: false` présent ou structure différente de `ApiErrorResponse`) → **BLOQUANT**
- ❌ Codes d'erreur non définis dans `shared-ts` → **BLOQUANT**
- ❌ Types `any` implicites (backend autorisé pour legacy, mais nouveau code doit éviter) → **WARNING** (backend) / **BLOQUANT** (frontend/MCP)
- ❌ Pas de logging structuré → **BLOQUANT**

### 1.2 Frontend Error Handling Architecture Cohérence

**CRITICAL** : Vérifie que l'architecture frontend de gestion d'erreurs est cohérente et respecte les patterns établis.

**Checklist** :
- [ ] ✅ **ApiFetchError class** : ApiFetchError étend Error avec status, code, details, correlationId, requestId
- [ ] ✅ **useApiError hook** : Hook standardisé pour gestion d'erreurs avec i18n et feedback
- [ ] ✅ **getTranslatedErrorMessage** : Fonction traduit codes d'erreur en messages i18n (pas de `error.message` direct)
- [ ] ✅ **Error boundaries** : GlobalErrorBoundary et PortalErrorBoundary capturent erreurs React
- [ ] ✅ **PortalErrorState** : Composant affiche erreurs avec type detection (network/business/technical)
- [ ] ✅ **SWR error handling** : onSWRError capture erreurs API (sauf 401 attendus)
- [ ] ✅ **Error capture** : captureWebError envoie erreurs à backend (non-blocking, rate-limited)
- [ ] ✅ **i18n integration** : Tous les messages d'erreur utilisent des clés i18n (pas de strings hardcodées)
- [ ] ✅ **Type safety** : Tous les composants ont des types explicites (ZERO `any` toléré en frontend, utiliser `unknown` + type guards)
- [ ] ✅ **Error type classification** : Erreurs classifiées network/business/technical pour UX

**Patterns attendus** :
```typescript
// ✅ CORRECT: useApiError avec i18n et feedback
export function useApiError(options: UseApiErrorOptions) {
  const { push: pushFeedback } = useFeedback();
  const tErrors = useTranslations("errors");
  
  const handleError = useCallback((error: unknown) => {
    const message = getTranslatedErrorMessage(error, tErrors, options.defaultMessage);
    
    if (options.showFeedback) {
      pushFeedback({
        tone: options.tone || "destructive",
        surface: "toast",
        title: options.title || tErrors("error_title"),
        description: message,
        scope: options.scope,
      });
    }
    
    return message;
  }, [options, pushFeedback, tErrors]);
  
  return { handleError, getErrorMessage };
}

// ✅ CORRECT: Composant avec useApiError
function MyComponent() {
  const { handleError, getErrorMessage } = useApiError({
    defaultMessage: t("error_generic"),
    showFeedback: true,
  });
  
  const handleSubmit = async () => {
    try {
      await apiFetch("/endpoint");
    } catch (error: unknown) {
      handleError(error);
    }
  };
  
  return (
    <div>
      {error && <Alert>{getErrorMessage(error)}</Alert>}
    </div>
  );
}

// ✅ CORRECT: PortalErrorState avec type detection
<PortalErrorState
  error={error}
  onRetry={() => mutate()}
  title={t("error_title")}
  description={t("error_description")}
/>

// ❌ WRONG: Utilisation directe de error.message, pas d'i18n
function MyComponent() {
  const [error, setError] = useState<Error | null>(null);
  
  return (
    <div>
      {error && <Alert>{error.message}</Alert>} {/* Pas d'i18n */}
    </div>
  );
}
```

**Violations détectées** :
- ❌ Utilisation directe de `error.message` dans JSX → **BLOQUANT**
- ❌ Messages d'erreur hardcodés (pas d'i18n) → **BLOQUANT**
- ❌ Pas de useApiError (gestion d'erreur ad-hoc) → **BLOQUANT**
- ❌ Types `any` ou implicites → **BLOQUANT** (frontend: ZERO `any` toléré)
- ❌ Error boundaries manquants dans layouts → **BLOQUANT**
- ❌ Pas de capture d'erreurs (React errors, SWR errors) → **BLOQUANT**

### 1.3 MCP Error Handling Architecture Cohérence

**CRITICAL** : Vérifie que l'architecture MCP de gestion d'erreurs est cohérente et respecte les patterns établis.

**Checklist** :
- [ ] ✅ **McpError class** : McpError étend Error avec statusCode, code, details
- [ ] ✅ **MCP Error classes** : UnauthorizedError, ForbiddenError, NotFoundError, BadRequestError
- [ ] ✅ **Error handler middleware** : Middleware traduit erreurs via i18n (pas de messages hardcodés)
- [ ] ✅ **API error mapper** : mapApiErrorToMcpError convertit ApiErrorResponse en McpError
- [ ] ✅ **Error response format** : Toutes les erreurs retournent format standardisé avec success: false
- [ ] ✅ **i18n integration** : Tous les messages d'erreur utilisent des clés i18n (pas de strings hardcodées)
- [ ] ✅ **Error logging** : Erreurs loggées avec contexte structuré (pas de `console.log`)
- [ ] ✅ **Type safety** : Tous les helpers ont des types explicites (ZERO `any` toléré en MCP, utiliser `unknown` + type guards)

**Patterns attendus** :
```typescript
// ✅ CORRECT: McpError avec i18n
export class McpError extends Error {
  statusCode: number;
  code: ErrorCode;
  details?: Record<string, unknown>;
  
  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// ✅ CORRECT: Error handler avec i18n
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const mcpReq = req as McpRequest;
  const locale = mcpReq.locale || "de";
  
  if (err instanceof McpError) {
    let translatedMessage: string;
    if (err.message && err.message.startsWith("errors.")) {
      translatedMessage = translateSync(err.message, locale);
    } else {
      translatedMessage = translateErrorSync(err.code as ErrorCode, locale, err.details);
    }
    
    res.status(err.statusCode).json({
      success: false,
      error: {
        error: err.code,
        message: translatedMessage,
        details: err.details,
      },
    });
    return;
  }
  
  // Unknown errors
  const translatedMessage = translateErrorSync("INTERNAL_ERROR", locale);
  res.status(500).json({
    success: false,
    error: {
      error: "INTERNAL_ERROR",
      message: translatedMessage,
    },
  });
}

// ✅ CORRECT: API error mapper
export function mapApiErrorToMcpError(
  response: Response,
  errorBody?: unknown,
): McpError {
  const status = response.status;
  const apiError = parseApiErrorResponse(errorBody);
  
  switch (status) {
    case 400:
      return new BadRequestError(apiError.message, apiError.details);
    case 401:
      return new UnauthorizedError(apiError.message);
    case 403:
      return new ForbiddenError(apiError.message, apiError.details);
    case 404:
      return new NotFoundError(apiError.message);
    default:
      return new McpError(
        apiError.message,
        apiError.code || "API_ERROR",
        status,
        apiError.details
      );
  }
}

// ❌ WRONG: Erreurs génériques, pas d'i18n
export function errorHandler(err: Error, req: Request, res: Response) {
  res.status(500).json({
    success: false,
    error: err.message, // Pas d'i18n, pas de format standardisé
  });
}
```

**Violations détectées** :
- ❌ Utilisation de `new Error()` au lieu de `McpError` → **BLOQUANT**
- ❌ Messages d'erreur hardcodés (pas d'i18n) → **BLOQUANT**
- ❌ Format de réponse non standardisé → **BLOQUANT**
- ❌ Pas de mapping ApiError → McpError → **BLOQUANT**
- ❌ Types `any` ou implicites → **BLOQUANT** (MCP: ZERO `any` toléré)

### 1.4 Error Capture & Observability Architecture Cohérence

**CRITICAL** : Vérifie que l'architecture de capture et d'observabilité d'erreurs est cohérente et respecte les patterns établis.

**Checklist** :
- [ ] ✅ **Error observability service** : Service capture erreurs HTTP, worker, web avec fingerprinting
- [ ] ✅ **Error capture endpoint** : POST /s/errors/capture public avec rate limiting (10/min par IP)
- [ ] ✅ **Frontend error capture** : captureWebError envoie erreurs React, SWR, unhandled rejections
- [ ] ✅ **Rate limiting** : Client-side (1/5s par fingerprint) + server-side (10/min par IP)
- [ ] ✅ **Sanitization** : Redaction PII (emails, tokens), truncation (messages, stacks)
- [ ] ✅ **Non-blocking** : Capture ne bloque jamais UI ou API response (timeout 2s, silent failures)
- [ ] ✅ **MongoDB storage** : app_error_events, app_error_groups, app_error_timeseries avec TTL 90 jours
- [ ] ✅ **Fingerprinting** : Fingerprint stable pour groupement d'erreurs similaires
- [ ] ✅ **Error classification** : Erreurs classifiées par source (api, worker, web), kind (ApiError, Unhandled), code

**Patterns attendus** :
```typescript
// ✅ CORRECT: Frontend error capture avec sanitization et rate limiting
export function captureWebError(
  error: Error | string | unknown,
  context: ErrorCaptureContext = {},
  errorInfo?: { componentStack?: string },
): void {
  try {
    const sanitizedMessage = sanitizeMessage(
      error instanceof Error ? error.message : String(error)
    );
    const sanitizedStack = sanitizeStack(
      error instanceof Error ? error.stack : undefined
    );
    const sanitizedComponentStack = sanitizeComponentStack(errorInfo?.componentStack);
    
    const fingerprint = generateFingerprint(sanitizedMessage, context.path, errorKind);
    
    // Check rate limit
    if (isRateLimited(fingerprint)) {
      return; // Silently skip if rate limited
    }
    
    recordCapture(fingerprint);
    
    const payload = {
      message: sanitizedMessage,
      stack: sanitizedStack,
      componentStack: sanitizedComponentStack,
      errorKind,
      errorCode,
      statusCode,
      path: context.path,
      correlationId: context.correlationId,
      requestId: context.requestId,
    };
    
    // Non-blocking fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    fetch(`${apiBaseUrl}/s/errors/capture`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      credentials: "include",
    })
      .then(() => clearTimeout(timeoutId))
      .catch(() => clearTimeout(timeoutId)); // Silently ignore errors
  } catch {
    // Silently ignore capture errors (never break error boundaries)
  }
}

// ✅ CORRECT: Backend error capture avec fingerprinting
export class ErrorObservabilityService {
  async captureHttpError(params: {
    req: NumezisRequest;
    err: Error | ApiError;
    skip?: boolean;
  }): Promise<void> {
    if (params.skip) return;
    
    const { req, err } = params;
    const fingerprint = fingerprintFromParts([
      "http",
      errorKind,
      errorCode ?? "",
      String(statusCode),
      method,
      path,
    ]);
    
    const sanitizedMessage = sanitizeMessage(err.message || "Unknown error");
    const sanitizedStack = sanitizeStack(err.stack);
    const details = err instanceof ApiError ? safeErrorDetails(err.details) : undefined;
    
    // Insert event, upsert group, increment timeseries (best-effort, non-blocking)
    await Promise.allSettled([
      this.repos.appErrorEventsRepo.insert(eventDoc),
      this.repos.appErrorGroupsRepo.upsert(fingerprint, groupUpdate),
      this.repos.appErrorTimeseriesRepo.increment(fingerprint, bucketStart, bucketSize),
    ]);
  }
}

// ❌ WRONG: Capture bloquante, pas de rate limiting, pas de sanitization
export function captureError(error: Error) {
  fetch("/api/errors", {
    method: "POST",
    body: JSON.stringify({ message: error.message, stack: error.stack }),
  }); // Pas de timeout, pas de rate limiting, pas de sanitization
}
```

**Violations détectées** :
- ❌ Capture bloquante (pas de timeout, pas de non-blocking) → **BLOQUANT**
- ❌ Pas de rate limiting (client-side ou server-side) → **BLOQUANT**
- ❌ Pas de sanitization (PII exposé) → **BLOQUANT**
- ❌ Pas de fingerprinting (groupement impossible) → **BLOQUANT**
- ❌ Capture peut casser error boundaries → **BLOQUANT**

---

## 🔍 2. COHÉRENCE DES ERROR CODES

### 2.1 ErrorCode Type Definition Complétude

**CRITICAL** : Vérifie que tous les codes d'erreur utilisés sont définis dans `packages/shared-ts/src/types/api-error.ts`.

**Checklist** :
- [ ] ✅ **ErrorCode type** : Tous les codes d'erreur utilisés existent dans le type `ErrorCode`
- [ ] ✅ **Code coverage** : Aucun code d'erreur hardcodé (tous utilisent le type `ErrorCode`)
- [ ] ✅ **Code consistency** : Même code d'erreur utilisé pour même situation (pas de variations)
- [ ] ✅ **Code mapping** : Codes d'erreur mappés correctement vers clés i18n (format `errors.{code.toLowerCase()}`)
- [ ] ✅ **New codes** : Nouveaux codes ajoutés à `shared-ts` avant utilisation

**Patterns attendus** :
```typescript
// ✅ CORRECT: Code d'erreur défini dans shared-ts
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "BAD_REQUEST"
  // ... tous les codes

// ✅ CORRECT: Utilisation du type ErrorCode
import type { ErrorCode } from "@numezis/shared-ts";

throw new ApiError(404, "NOT_FOUND" as ErrorCode, "errors.not_found");

// ❌ WRONG: Code d'erreur non défini
throw new ApiError(404, "ENTITY_NOT_FOUND" as ErrorCode, "errors.entity_not_found");
// "ENTITY_NOT_FOUND" n'existe pas dans ErrorCode type
```

**Violations détectées** :
- ❌ Codes d'erreur utilisés mais non définis dans `ErrorCode` type → **BLOQUANT**
- ❌ Codes d'erreur hardcodés (pas de type safety) → **BLOQUANT**
- ❌ Incohérences de codes (même situation, codes différents) → **BLOQUANT**

### 2.2 Error Code Usage Consistency

**CRITICAL** : Vérifie que les codes d'erreur sont utilisés de manière cohérente à travers le codebase.

**Checklist** :
- [ ] ✅ **HTTP status mapping** : Codes d'erreur mappés correctement vers status HTTP (400 → BAD_REQUEST, 401 → UNAUTHORIZED, etc.)
- [ ] ✅ **Business logic consistency** : Même situation métier utilise même code d'erreur (pas de variations)
- [ ] ✅ **Portal consistency** : Même erreur dans différents portals utilise même code (pas de variations)
- [ ] ✅ **Module consistency** : Même erreur dans différents modules utilise même code (pas de variations)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Mapping cohérent status → code
Errors.badRequest() → 400, "BAD_REQUEST"
Errors.unauthorized() → 401, "UNAUTHORIZED"
Errors.forbidden() → 403, "FORBIDDEN"
Errors.notFound() → 404, "NOT_FOUND"
Errors.conflict() → 409, "CONFLICT"
Errors.validation() → 422, "VALIDATION_ERROR"
Errors.internal() → 500, "INTERNAL_ERROR"

// ✅ CORRECT: Même situation, même code
// Dans company.routes.ts
if (!entity) {
  throw Errors.notFound("errors.entity_not_found"); // "NOT_FOUND"
}

// Dans tenant.routes.ts
if (!entity) {
  throw Errors.notFound("errors.entity_not_found"); // "NOT_FOUND" (cohérent)
}

// ❌ WRONG: Même situation, codes différents
// Dans company.routes.ts
if (!entity) {
  throw Errors.notFound("errors.entity_not_found"); // "NOT_FOUND"
}

// Dans tenant.routes.ts
if (!entity) {
  throw Errors.badRequest("errors.entity_not_found"); // "BAD_REQUEST" (incohérent)
}
```

**Violations détectées** :
- ❌ Mapping status → code incorrect → **BLOQUANT**
- ❌ Même situation, codes différents → **BLOQUANT**
- ❌ Incohérences inter-portals → **BLOQUANT**
- ❌ Incohérences inter-modules → **BLOQUANT**

---

## 🔍 3. INTÉGRATION I18N

### 3.1 Error Message i18n Complétude

**CRITICAL** : Vérifie que tous les messages d'erreur utilisent des clés i18n et que toutes les clés existent dans tous les locales.

**Checklist** :
- [ ] ✅ **i18n keys usage** : Tous les messages d'erreur utilisent des clés i18n (format `"errors.xxx"` ou `"{module}.errors.xxx"`)
- [ ] ✅ **No hardcoded strings** : Aucun message d'erreur hardcodé (pas de strings en anglais/français/allemand)
- [ ] ✅ **Key existence** : Toutes les clés i18n existent dans tous les locales (de, en, fr, it)
- [ ] ✅ **Key format** : Clés suivent le format standard (`errors.*` pour erreurs globales, `{module}.errors.*` pour erreurs module)
- [ ] ✅ **Translation completeness** : Toutes les traductions sont complètes (pas de placeholders, pas de clés manquantes)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Clé i18n utilisée
throw Errors.notFound("errors.entity_not_found");

// ✅ CORRECT: Clé i18n module-specific
throw Errors.notFound("documents.errors.not_found");

// ✅ CORRECT: Backend translation
const translatedMessage = err.message.startsWith("errors.")
  ? translate(err.message, locale)
  : translateError(err.code, locale, err.details);

// ✅ CORRECT: Frontend translation
const errorMessage = getTranslatedErrorMessage(error, tErrors, fallback);

// ❌ WRONG: Message hardcodé
throw Errors.notFound("Entity not found"); // Pas de clé i18n

// ❌ WRONG: Clé i18n manquante
throw Errors.notFound("errors.entity_not_found");
// "errors.entity_not_found" n'existe pas dans packages/i18n/messages/*/errors.json
```

**Violations détectées** :
- ❌ Messages d'erreur hardcodés (pas de clés i18n) → **BLOQUANT**
- ❌ Clés i18n manquantes dans certains locales → **BLOQUANT**
- ❌ Format de clés non standard → **BLOQUANT**
- ❌ Traductions incomplètes (placeholders, clés manquantes) → **BLOQUANT**

### 3.2 Error Message Translation Flow

**CRITICAL** : Vérifie que le flux de traduction d'erreurs fonctionne correctement de bout en bout.

**Checklist** :
- [ ] ✅ **Backend translation** : Backend traduit erreurs via `translate()` ou `translateError()` selon format
- [ ] ✅ **Frontend translation** : Frontend traduit erreurs via `getTranslatedErrorMessage()` avec `useTranslations("errors")`
- [ ] ✅ **MCP translation** : MCP traduit erreurs via `translateSync()` ou `translateErrorSync()`
- [ ] ✅ **Locale detection** : Locale détectée correctement (header `x-ab-locale`, `req.locale`, `accessMode.locale`)
- [ ] ✅ **Fallback handling** : Fallback vers locale par défaut si locale manquante ou clé manquante

**Patterns attendus** :
```typescript
// ✅ CORRECT: Backend translation flow
// 1. Error créé avec clé i18n
throw Errors.notFound("errors.entity_not_found");

// 2. Error handler traduit
const translatedMessage = err.message.startsWith("errors.")
  ? translate(err.message, locale) // "errors.entity_not_found" → "Entité introuvable" (fr)
  : translateError(err.code, locale, err.details);

// 3. Response avec message traduit
res.status(404).json({
  error: {
    code: "NOT_FOUND",
    message: "Entité introuvable", // Traduit
    details: undefined,
  },
});

// ✅ CORRECT: Frontend translation flow
// 1. ApiFetchError reçu avec code et message
const error = new ApiFetchError({
  code: "NOT_FOUND",
  message: "errors.entity_not_found", // Clé i18n
});

// 2. getTranslatedErrorMessage traduit
const tErrors = useTranslations("errors");
const errorMessage = getTranslatedErrorMessage(error, tErrors, fallback);
// "errors.entity_not_found" → "Entité introuvable" (locale frontend)

// ❌ WRONG: Pas de traduction
const errorMessage = error.message; // Message backend (locale backend, pas frontend)
```

**Violations détectées** :
- ❌ Backend ne traduit pas erreurs (messages bruts) → **BLOQUANT**
- ❌ Frontend ne traduit pas erreurs (utilise `error.message` direct) → **BLOQUANT**
- ❌ Locale non détectée correctement → **BLOQUANT**
- ❌ Pas de fallback si locale/clé manquante → **BLOQUANT**

---

## 🔍 4. ERROR RESPONSE FORMAT CONSISTENCY

### 4.1 Backend Error Response Format

**CRITICAL** : Vérifie que toutes les réponses d'erreur backend suivent le format `ApiErrorResponse` standardisé.

**Checklist** :
- [ ] ✅ **Response format** : Toutes les erreurs retournent `ApiErrorResponse` avec structure `{ error: { code, message, details?, correlationId?, requestId? } }` (SANS wrapper `success: false`)
- [ ] ✅ **Source de vérité** : Format défini dans `packages/shared-ts/src/types/api-error.ts` (type `ApiErrorResponse`) - **NOTE** : La documentation `error-handling.md` contient des exemples obsolètes avec `success: false` (lignes 182, 357, 555, 563) - ignorer ces exemples, utiliser le type `ApiErrorResponse` comme référence
- [ ] ✅ **Status code mapping** : Status HTTP correspond au code d'erreur (400 → BAD_REQUEST, 401 → UNAUTHORIZED, etc.)
- [ ] ✅ **Correlation IDs** : correlationId et requestId inclus dans headers (`x-correlation-id`, `x-request-id`) et response body
- [ ] ✅ **Details structure** : Details optionnels avec structure cohérente (pas de structures arbitraires)
- [ ] ✅ **No success wrapper** : Pas de wrapper `{ success: false, error: ... }` (format direct `{ error: ... }` comme défini dans `ApiErrorResponse`)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Format ApiErrorResponse standardisé
{
  error: {
    code: "NOT_FOUND",
    message: "errors.entity_not_found", // Clé i18n ou message traduit
    details: {
      entityId: "123",
      entityType: "invoice",
    },
    correlationId: "abc-123",
    requestId: "req-456",
  }
}

// ✅ CORRECT: Headers avec correlation IDs
res.setHeader("x-correlation-id", req.context?.correlationId);
res.setHeader("x-request-id", req.context?.requestId);
res.status(404).json(errorResponse);

// ❌ WRONG: Format non standardisé
{
  success: false,
  error: "Entity not found", // Pas de structure, pas de code
}

// ❌ WRONG: Format avec wrapper success
{
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "errors.entity_not_found",
  },
}
```

**Violations détectées** :
- ❌ Format de réponse non standardisé → **BLOQUANT**
- ❌ Pas de correlationId/requestId → **BLOQUANT**
- ❌ Structure details incohérente → **BLOQUANT**
- ❌ Wrapper `success: false` présent → **BLOQUANT**

### 4.2 Frontend Error Response Handling

**CRITICAL** : Vérifie que le frontend gère correctement les réponses d'erreur backend.

**Checklist** :
- [ ] ✅ **ApiFetchError parsing** : `apiFetch()` parse correctement `ApiErrorResponse` en `ApiFetchError`
- [ ] ✅ **Error extraction** : Code, message, details, correlationId, requestId extraits correctement
- [ ] ✅ **Error type detection** : Type d'erreur détecté correctement (network/business/technical) pour UX
- [ ] ✅ **Retry logic** : Retry affiché seulement pour network/technical errors (pas pour business errors)
- [ ] ✅ **Error display** : Erreurs affichées via `PortalErrorState` ou `useApiError` (pas d'affichage ad-hoc)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Parsing ApiErrorResponse
export async function apiFetch<T>(endpoint: string, options?: ApiClientOptions): Promise<T> {
  const response = await fetch(endpoint, options);
  
  if (!response.ok) {
    const errorData = await response.json() as ApiErrorResponse;
    const correlationId = response.headers.get("x-correlation-id") || undefined;
    const requestId = response.headers.get("x-request-id") || undefined;
    
    throw new ApiFetchError({
      message: errorData.error.message,
      status: response.status,
      code: errorData.error.code,
      correlationId,
      requestId,
      details: errorData.error.details,
    });
  }
  
  const data = await response.json() as ApiSuccessResponse<T>;
  return data.data;
}

// ✅ CORRECT: Error type detection
export function getErrorType(error: unknown): ErrorType {
  if (isApiFetchError(error)) {
    if (error.status === 0) return "network";
    if (error.status >= 400 && error.status < 500) return "business";
    if (error.status >= 500) return "technical";
  }
  return "technical";
}

// ✅ CORRECT: Retry logic basée sur type
const shouldShowRetry = errorType === "network" || errorType === "technical";

// ❌ WRONG: Parsing incorrect
const errorData = await response.json();
throw new Error(errorData.error); // Pas de structure ApiFetchError
```

**Violations détectées** :
- ❌ Parsing `ApiErrorResponse` incorrect → **BLOQUANT**
- ❌ Extraction code/message/details incorrecte → **BLOQUANT**
- ❌ Détection type d'erreur incorrecte → **BLOQUANT**
- ❌ Retry affiché pour business errors → **BLOQUANT**

### 4.3 MCP Error Response Format

**CRITICAL** : Vérifie que toutes les réponses d'erreur MCP suivent le format standardisé.

**Checklist** :
- [ ] ✅ **Response format** : Toutes les erreurs retournent format `{ success: false, error: { error, message, details? } }`
- [ ] ✅ **Status code mapping** : Status HTTP correspond au code d'erreur (400 → BAD_REQUEST, 401 → UNAUTHORIZED, etc.)
- [ ] ✅ **i18n integration** : Messages traduits via `translateSync()` ou `translateErrorSync()`
- [ ] ✅ **API error mapping** : Erreurs API mappées correctement vers format MCP

**Patterns attendus** :
```typescript
// ✅ CORRECT: Format MCP standardisé
{
  success: false,
  error: {
    error: "NOT_FOUND",
    message: "errors.entity_not_found", // Traduit
    details: {
      entityId: "123",
    },
  },
}

// ✅ CORRECT: Mapping API → MCP
export function mapApiErrorToMcpError(
  response: Response,
  errorBody?: unknown,
): McpError {
  const apiError = parseApiErrorResponse(errorBody);
  return new NotFoundError(apiError.message, apiError.details);
}

// ❌ WRONG: Format non standardisé
{
  error: "Entity not found", // Pas de structure, pas de code
}
```

**Violations détectées** :
- ❌ Format de réponse non standardisé → **BLOQUANT**
- ❌ Mapping API → MCP incorrect → **BLOQUANT**
- ❌ Messages non traduits → **BLOQUANT**

---

## 🔍 5. ERROR CAPTURE & OBSERVABILITY

### 5.1 Error Capture Coverage

**CRITICAL** : Vérifie que tous les types d'erreurs sont capturés correctement.

**Checklist** :
- [ ] ✅ **API errors** : Erreurs API capturées via `error-handler` middleware (sauf 401 attendus sur auth-check)
- [ ] ✅ **Worker errors** : Erreurs worker capturées via `captureWorkerJobError()` (best-effort)
- [ ] ✅ **Frontend React errors** : Erreurs React capturées via `GlobalErrorBoundary` et `PortalErrorBoundary`
- [ ] ✅ **Frontend SWR errors** : Erreurs SWR capturées via `onSWRError` (sauf 401 attendus)
- [ ] ✅ **Unhandled rejections** : Rejections non gérées capturées via `window.unhandledrejection`
- [ ] ✅ **Error boundaries** : Tous les layouts ont error boundaries (pas de layouts sans protection)

**Patterns attendus** :
```typescript
// ✅ CORRECT: API error capture
export function errorHandler(err: Error | ApiError, req: NumezisRequest, res: Response) {
  // Skip expected 401s on auth-check endpoints
  if (err instanceof ApiError && err.status === 401 && isAuthCheckEndpoint(req.path)) {
    res.status(401).json(errorResponse);
    return;
  }
  
  // Capture all other errors (best-effort, non-blocking)
  const services = req.app?.locals?.services as Services | undefined;
  const capture = services?.errorObservabilityService?.captureHttpError({
    req,
    err,
    skip: false,
  });
  if (capture) {
    capture.catch(() => {}); // Ignore capture failures
  }
  
  res.status(err.status).json(errorResponse);
}

// ✅ CORRECT: Frontend React error capture
export class GlobalErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    captureWebError(error, {
      path: window.location.pathname,
      correlationId: getCorrelationId(),
      requestId: getRequestId(),
    }, {
      componentStack: errorInfo.componentStack,
    });
  }
}

// ✅ CORRECT: SWR error capture
onSWRError: (error: unknown) => {
  if (isApiFetchError(error) && error.status === 401) {
    // Skip expected 401s (auth-check, public pages)
    return;
  }
  
  captureWebError(error, {
    path: window.location.pathname,
    correlationId: error.correlationId,
    requestId: error.requestId,
  });
}

// ❌ WRONG: Pas de capture
export function errorHandler(err: Error, req: Request, res: Response) {
  res.status(500).json({ error: err.message }); // Pas de capture
}
```

**Violations détectées** :
- ❌ Erreurs API non capturées → **BLOQUANT**
- ❌ Erreurs React non capturées (pas d'error boundaries) → **BLOQUANT**
- ❌ Erreurs SWR non capturées → **BLOQUANT**
- ❌ Rejections non gérées non capturées → **BLOQUANT**
- ❌ Layouts sans error boundaries → **BLOQUANT**

### 5.2 Error Observability Quality

**CRITICAL** : Vérifie que le système d'observabilité d'erreurs fonctionne correctement.

**Checklist** :
- [ ] ✅ **Fingerprinting** : Fingerprint stable généré pour groupement d'erreurs similaires
- [ ] ✅ **Error grouping** : Erreurs groupées par fingerprint dans `app_error_groups`
- [ ] ✅ **Time series** : Time series créées pour visualisation de tendances
- [ ] ✅ **Event storage** : Événements stockés dans `app_error_events` avec TTL 90 jours
- [ ] ✅ **Sanitization** : PII redacted (emails, tokens), stacks truncatés
- [ ] ✅ **Rate limiting** : Rate limiting client-side (1/5s) et server-side (10/min) fonctionne
- [ ] ✅ **Non-blocking** : Capture ne bloque jamais (timeout 2s, silent failures)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Fingerprinting stable
const fingerprint = fingerprintFromParts([
  "http",
  errorKind, // "ApiError" | "Unhandled"
  errorCode ?? "",
  String(statusCode),
  method,
  path,
]);

// ✅ CORRECT: Sanitization
const sanitizedMessage = sanitizeMessage(err.message || "Unknown error");
// Redacts emails: "user@example.com" → "[redacted_email]"
// Redacts tokens: "Bearer abc123" → "Bearer [redacted_token]"
// Truncates: max 2048 chars

const sanitizedStack = sanitizeStack(err.stack);
// Truncates: max 32768 chars

// ✅ CORRECT: Rate limiting
function isRateLimited(fingerprint: string): boolean {
  const lastCapture = lastCaptures.get(fingerprint);
  if (lastCapture && Date.now() - lastCapture < 5000) {
    return true; // Rate limited: 1 per 5 seconds
  }
  return false;
}

// ❌ WRONG: Pas de fingerprinting
const fingerprint = err.message; // Pas stable, pas de groupement

// ❌ WRONG: Pas de sanitization
const payload = {
  message: err.message, // PII exposé
  stack: err.stack, // Stack complet, pas de truncation
};
```

**Violations détectées** :
- ❌ Fingerprinting non stable (pas de groupement) → **BLOQUANT**
- ❌ Pas de sanitization (PII exposé) → **BLOQUANT**
- ❌ Pas de rate limiting (spam possible) → **BLOQUANT**
- ❌ Capture bloquante (peut casser error boundaries) → **BLOQUANT**

---

## 🔍 6. QUALITY CHECKS & CONSISTENCY

### 6.1 Error Handling Pattern Compliance

**CRITICAL** : Vérifie que tous les patterns de gestion d'erreurs sont respectés.

**Checklist** :
- [ ] ✅ **No direct Error()** : Aucun `new Error()` direct (tous utilisent `Errors.*` ou `McpError`)
- [ ] ✅ **No error.message in JSX** : Aucun `error.message` direct dans JSX (tous utilisent `getTranslatedErrorMessage()`)
- [ ] ✅ **No silent catch** : Aucun catch silencieux sans gestion d'erreur (tous les catch ont `handleError()` ou logging)
- [ ] ✅ **Error boundaries** : Tous les layouts ont error boundaries (`GlobalErrorBoundary` ou `ErrorBoundaryWrapper`)
- [ ] ✅ **Type guards** : Type guards utilisés avant accès propriétés (`isApiFetchError()`, `isMcpError()`)
- [ ] ✅ **No any types** : Aucun type `any` dans gestion d'erreurs frontend/MCP (tous utilisent `unknown` + type guards) - Backend autorisé pour legacy uniquement, nouveau code doit éviter

**Patterns attendus** :
```typescript
// ✅ CORRECT: Utilisation Errors helpers
throw Errors.notFound("errors.entity_not_found");

// ✅ CORRECT: Type guard avant accès
if (isApiFetchError(error)) {
  const code = error.code; // Type-safe
}

// ✅ CORRECT: Catch avec gestion
try {
  await apiFetch("/endpoint");
} catch (error: unknown) {
  handleError(error);
}

// ❌ WRONG: new Error() direct
throw new Error("Entity not found");

// ❌ WRONG: error.message dans JSX
{error && <Alert>{error.message}</Alert>}

// ❌ WRONG: Catch silencieux
try {
  await apiFetch("/endpoint");
} catch (error) {
  // Empty catch
}
```

**Violations détectées** :
- ❌ Utilisation `new Error()` direct → **BLOQUANT**
- ❌ `error.message` dans JSX → **BLOQUANT**
- ❌ Catch silencieux → **BLOQUANT**
- ❌ Pas de type guards → **BLOQUANT**
- ❌ Types `any` → **BLOQUANT** (frontend/MCP) / **WARNING** (backend nouveau code)

### 6.2 Error Handling Test Coverage

**CRITICAL** : Vérifie que la gestion d'erreurs est testée correctement.

**Checklist** :
- [ ] ✅ **Backend tests** : Tests pour `ApiError`, `Errors` helpers, `error-handler` middleware
- [ ] ✅ **Frontend tests** : Tests pour `ApiFetchError`, `useApiError`, `getTranslatedErrorMessage`
- [ ] ✅ **MCP tests** : Tests pour `McpError`, `error-handler` middleware, `mapApiErrorToMcpError`
- [ ] ✅ **Integration tests** : Tests end-to-end pour flux d'erreurs (API → Frontend, MCP → API)
- [ ] ✅ **Error capture tests** : Tests pour `captureWebError`, `captureHttpError`, rate limiting, sanitization

**Patterns attendus** :
```typescript
// ✅ CORRECT: Test backend
describe("Errors helpers", () => {
  it("should create ApiError with correct status and code", () => {
    const error = Errors.notFound("errors.entity_not_found");
    expect(error.status).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("errors.entity_not_found");
  });
});

// ✅ CORRECT: Test frontend
describe("useApiError", () => {
  it("should translate error codes to i18n messages", () => {
    const { getErrorMessage } = useApiError({ defaultMessage: "Error" });
    const error = new ApiFetchError({ code: "NOT_FOUND", status: 404, message: "errors.entity_not_found" });
    const message = getErrorMessage(error);
    expect(message).toBe("Entité introuvable"); // Traduit
  });
});

// ❌ WRONG: Pas de tests
// Aucun test pour gestion d'erreurs
```

**Violations détectées** :
- ❌ Pas de tests backend → **BLOQUANT**
- ❌ Pas de tests frontend → **BLOQUANT**
- ❌ Pas de tests MCP → **BLOQUANT**
- ❌ Pas de tests integration → **BLOQUANT**
- ❌ Pas de tests error capture → **BLOQUANT**

---

## 📊 RAPPORT D'AUDIT

### Résumé Exécutif

**Statut global** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`

**Métriques** :
- **Backend errors** : X violations détectées
- **Frontend errors** : X violations détectées
- **MCP errors** : X violations détectées
- **Error capture** : X violations détectées
- **i18n integration** : X violations détectées
- **Error codes** : X violations détectées
- **Test coverage** : X% couverture

### Violations Critiques (BLOQUANT)

Liste toutes les violations **BLOQUANT** détectées avec :
- **Fichier** : Chemin complet
- **Ligne** : Numéro de ligne
- **Violation** : Description de la violation
- **Pattern attendu** : Code correct attendu
- **Pattern actuel** : Code incorrect actuel

### Violations Non-Critiques (WARNINGS)

Liste toutes les violations **WARNINGS** détectées avec :
- **Fichier** : Chemin complet
- **Ligne** : Numéro de ligne
- **Violation** : Description de la violation
- **Recommandation** : Suggestion d'amélioration

### Recommandations

Liste les recommandations d'amélioration :
1. **Priorité haute** : Améliorations critiques pour qualité/consistance
2. **Priorité moyenne** : Améliorations pour meilleure UX/maintenabilité
3. **Priorité basse** : Améliorations optionnelles (nice-to-have)

### Prochaines Étapes

1. **Corrections immédiates** : Liste des violations à corriger en priorité
2. **Tests à ajouter** : Liste des tests manquants à créer
3. **Documentation à mettre à jour** : Liste des docs à mettre à jour
4. **Refactoring suggéré** : Liste des refactorings suggérés

---

## ✅ CHECKLIST FINALE

Avant de conclure l'audit, vérifie :

- [ ] ✅ Tous les fichiers error handling audités (backend, frontend, MCP)
- [ ] ✅ Toutes les violations critiques documentées avec exemples de code
- [ ] ✅ Toutes les violations non-critiques documentées avec recommandations
- [ ] ✅ Métriques calculées (violations, couverture tests, etc.)
- [ ] ✅ Recommandations prioritaires listées
- [ ] ✅ Prochaines étapes clairement définies
- [ ] ✅ Rapport d'audit complet et actionnable
