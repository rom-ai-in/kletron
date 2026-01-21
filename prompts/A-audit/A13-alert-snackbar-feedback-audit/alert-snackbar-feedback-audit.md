Tu es un **auditeur senior Architecture + Qualité + UX** pour le monorepo **Numezis**. Ta mission est d'effectuer un **audit exhaustif de la logique d'alertes, snackbars, et feedback utilisateur**, en vérifiant que **TOUS les éléments requis** sont présents, correctement implémentés, testés, documentés, et conformes aux règles strictes du monorepo.

**⚠️ CRITICAL** : Cet audit se concentre sur la cohérence, la qualité, et l'architecture du système de feedback utilisateur dans le backend (`apps/api`), le frontend (`apps/web`), et l'intégration entre les deux. L'audit doit vérifier la conformité avec les patterns établis, l'accessibilité, l'i18n, et la qualité du code.

---

## 📚 Sources de Vérité (à lire et citer explicitement)

- **Feedback Architecture** : `docs/09-ui-ux/07-states-and-feedback/feedback.md`
- **Error Handling Architecture** : `docs/02-development/errors/error-handling.md`
- **Error Handling Best Practices** : `docs/02-development/errors/error-handling-best-practices.md`
- **FeedbackProvider** : `apps/web/providers/FeedbackProvider.tsx`
- **FeedbackHost** : `apps/web/components/feedback/FeedbackHost.tsx`
- **InlineFeedback** : `apps/web/components/feedback/InlineFeedback.tsx`
- **useApiError** : `apps/web/hooks/useApiError.ts`
- **useToast** : `apps/web/hooks/useToast.ts`
- **useFeedbackHelpers** : `apps/web/hooks/useFeedbackHelpers.ts`
- **useNotificationsFeed** : `apps/web/hooks/useNotificationsFeed.ts`
- **usePageFeedback** : `apps/web/hooks/usePageFeedback.ts`
- **Error Handler Middleware** : `apps/api/src/middleware/error-handler.ts`
- **ApiError** : `apps/api/src/core/errors/ApiError.ts`
- **Errors Helpers** : `apps/api/src/core/errors/index.ts`
- **ApiFetchError** : `apps/web/lib/api/errors.ts`
- **GlobalErrorBoundary** : `apps/web/components/shared/GlobalErrorBoundary.tsx`
- **Alert Component** : `apps/web/components/ui/alert.tsx`
- **Notification Service** : `apps/api/src/services/notifications.ts`
- **i18n Guide** : `docs/02-development/i18n/tone-audit-guide.md`

---

## 🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)

Commence par expliciter :

1. **Scope de l'audit** :
   - **Type** : `full-audit` | `frontend-only` | `backend-only` | `integration-only`
   - **Composants concernés** : Liste complète (FeedbackProvider, FeedbackHost, useApiError, error-handler, etc.)
   - **Portals concernés** : `/c`, `/t`, `/p`, `/s` (vérifier cohérence inter-portals)
   - **Fichiers modifiés** : Liste complète (si diff-only)

2. **Composants Feedback identifiés** :
   - **Frontend** : FeedbackProvider, FeedbackHost, InlineFeedback, useToast, useApiError, usePageFeedback, useNotificationsFeed
   - **Backend** : error-handler middleware, ApiError, Errors helpers, notification service
   - **Intégration** : API error responses → frontend feedback, server notifications → toasts
   - **UI Components** : Alert, Toast (via Radix), GlobalErrorBoundary

3. **Surfaces Feedback identifiées** :
   - **Inline Alert** : Validation forms, erreurs contextuelles persistantes
   - **Toast/Snackbar** : Feedback éphémère après actions async
   - **Banners** : Status workspace-wide (impersonation, maintenance)
   - **Portal Badges** : Compteurs non lus dans navigation
   - **System Notifications** : Événements long-running (backend → frontend)

4. **Intégrations identifiées** :
   - **Error Flow** : API Error → ApiFetchError → useApiError → FeedbackProvider → Toast/Inline
   - **Notification Flow** : Backend notification → useNotificationsFeed → FeedbackProvider → Toast/Inline
   - **i18n Integration** : Tous les messages utilisent des clés i18n (pas de strings hardcodées)
   - **Accessibility** : aria-live, role="status", screen reader support

---

## 🔍 1. QUALITÉ DU CODE & ARCHITECTURE

### 1.1 Frontend Feedback Architecture Cohérence

**CRITICAL** : Vérifie que l'architecture frontend du système de feedback est cohérente et respecte les patterns établis.

**Checklist** :
- [ ] ✅ **FeedbackProvider isolation** : Provider isolé et réutilisable (pas de logique métier dans provider)
- [ ] ✅ **FeedbackHost rendering** : Host rend toasts avec auto-dismiss, stacking, accessibility
- [ ] ✅ **InlineFeedback usage** : InlineFeedback utilisé pour feedback persistant (validation, erreurs contextuelles)
- [ ] ✅ **useToast consistency** : useToast utilise FeedbackProvider (pas de logique dupliquée)
- [ ] ✅ **useApiError integration** : useApiError intègre FeedbackProvider (pas de gestion d'erreur ad-hoc)
- [ ] ✅ **usePageFeedback cleanup** : usePageFeedback nettoie feedback par scope au unmount
- [ ] ✅ **useNotificationsFeed integration** : useNotificationsFeed transforme notifications serveur en FeedbackEvent
- [ ] ✅ **Error boundary** : GlobalErrorBoundary capture erreurs React et affiche feedback utilisateur
- [ ] ✅ **Type safety** : Tous les composants ont des types explicites (pas de `any`)
- [ ] ✅ **Portal support** : Feedback system fonctionne dans tous les portals (`/c`, `/t`, `/p`, `/s`)

**Patterns attendus** :
```typescript
// ✅ CORRECT: FeedbackProvider avec types explicites, error handling
export function FeedbackProvider({ children }: FeedbackProviderProps) {
  const [events, setEvents] = useState<FeedbackEvent[]>([]);
  
  const push = useCallback((event: Omit<FeedbackEvent, "id">) => {
    const newEvent: FeedbackEvent = {
      id: generateId(),
      ...event,
    };
    setEvents((prev) => [...prev, newEvent]);
  }, []);
  
  // ...
}

// ✅ CORRECT: useApiError intègre FeedbackProvider
export function useApiError(options: UseApiErrorOptions) {
  const { push: pushFeedback } = useFeedback();
  
  const handleError = useCallback((error: unknown) => {
    const message = getTranslatedErrorMessage(error, tErrors, options.defaultMessage);
    pushFeedback({
      tone: options.tone || "destructive",
      surface: "toast",
      title: options.title || tErrors("error_title"),
      description: message,
      scope: options.scope,
    });
    return message;
  }, [options, pushFeedback, tErrors]);
  
  // ...
}

// ❌ WRONG: Gestion d'erreur ad-hoc sans FeedbackProvider
function MyComponent() {
  const [error, setError] = useState<string | null>(null);
  // Pas d'intégration avec FeedbackProvider
}
```

**Violations détectées** :
- ❌ FeedbackProvider avec logique métier → **BLOQUANT**
- ❌ useApiError sans intégration FeedbackProvider → **BLOQUANT**
- ❌ Types `any` ou implicites → **BLOQUANT**
- ❌ Feedback non nettoyé au unmount → **BLOQUANT**
- ❌ Pas de support multi-portal → **BLOQUANT**

### 1.2 Backend Error Handling Architecture Cohérence

**CRITICAL** : Vérifie que l'architecture backend de gestion d'erreurs est cohérente et respecte les patterns établis.

**Checklist** :
- [ ] ✅ **ApiError class** : ApiError étend Error avec status, code, details (pas d'erreurs génériques)
- [ ] ✅ **Errors helpers** : Errors.badRequest(), Errors.notFound(), etc. utilisés partout (pas de new Error() direct)
- [ ] ✅ **Error handler middleware** : Middleware global traduit erreurs via i18n (pas de messages hardcodés)
- [ ] ✅ **Error response format** : Toutes les erreurs retournent ApiErrorResponse standardisé
- [ ] ✅ **i18n integration** : Tous les messages d'erreur utilisent des clés i18n (pas de strings hardcodées)
- [ ] ✅ **Error logging** : Erreurs loggées avec contexte structuré (pas de console.log)
- [ ] ✅ **Error correlation** : correlationId et requestId inclus dans réponses (pour debugging)
- [ ] ✅ **Validation errors** : Erreurs Zod transformées en ApiError avec détails (pas d'erreurs brutes)
- [ ] ✅ **Type safety** : Tous les helpers ont des types explicites (pas de `any`)

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

// ✅ CORRECT: Error handler traduit via i18n
export function errorHandler(err: Error | ApiError, req: Request, res: Response) {
  if (err instanceof ApiError) {
    const locale = req.locale || "de";
    let translatedMessage: string;
    if (err.message && err.message.startsWith("errors.")) {
      translatedMessage = translate(err.message, locale);
    } else {
      translatedMessage = translateError(err.code, locale, err.details);
    }
    
    res.status(err.status).json({
      error: {
        code: err.code,
        message: translatedMessage,
        details: err.details,
        correlationId: req.context?.correlationId,
      },
    });
    return;
  }
  // ...
}

// ❌ WRONG: Erreurs hardcodées, pas de i18n
throw new Error("User not found"); // Pas de traduction, pas de code standardisé
```

**Violations détectées** :
- ❌ Erreurs sans ApiError → **BLOQUANT**
- ❌ Messages d'erreur hardcodés → **BLOQUANT**
- ❌ Pas de traduction i18n → **BLOQUANT**
- ❌ Pas de logging structuré → **BLOQUANT**
- ❌ Types `any` ou implicites → **BLOQUANT**

### 1.3 Integration Backend-Frontend Cohérence

**CRITICAL** : Vérifie que l'intégration entre backend et frontend est cohérente et respecte les patterns établis.

**Checklist** :
- [ ] ✅ **Error response format** : Backend retourne ApiErrorResponse, frontend parse via ApiFetchError
- [ ] ✅ **Error translation** : Frontend traduit erreurs via useApiError (pas de messages bruts)
- [ ] ✅ **Feedback mapping** : Erreurs API mappées vers FeedbackEvent avec tone approprié
- [ ] ✅ **Notification integration** : Notifications serveur transformées en FeedbackEvent via useNotificationsFeed
- [ ] ✅ **Scope consistency** : Scopes utilisés de manière cohérente (backend → frontend)
- [ ] ✅ **Portal awareness** : Feedback scoped par portal (backend et frontend alignés)
- [ ] ✅ **Error correlation** : correlationId propagé backend → frontend (pour debugging)
- [ ] ✅ **Type safety** : Types partagés entre backend et frontend (via shared-ts)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Backend retourne ApiErrorResponse standardisé
res.status(404).json({
  error: {
    code: "NOT_FOUND",
    message: translate("errors.user_not_found", locale),
    details: { userId },
    correlationId: req.context?.correlationId,
  },
});

// ✅ CORRECT: Frontend parse et traduit erreur
try {
  await apiFetch("/users/123");
} catch (error: unknown) {
  if (error instanceof ApiFetchError) {
    const { handleError } = useApiError({
      defaultMessage: t("error_generic"),
    });
    handleError(error, (message) => {
      pushFeedback({
        tone: "destructive",
        surface: "toast",
        title: t("error_title"),
        description: message,
      });
    });
  }
}

// ❌ WRONG: Frontend utilise message brut sans traduction
catch (error: any) {
  toast.error(error.message); // Pas de traduction, pas de format standardisé
}
```

**Violations détectées** :
- ❌ Format d'erreur non standardisé → **BLOQUANT**
- ❌ Pas de traduction frontend → **BLOQUANT**
- ❌ Pas de mapping tone approprié → **BLOQUANT**
- ❌ Types non partagés → **BLOQUANT**

---

## 🔍 2. COHÉRENCE & CONSISTANCE

### 2.1 Cohérence Inter-Portals

**CRITICAL** : Vérifie que le système de feedback est cohérent entre tous les portals (`/c`, `/t`, `/p`, `/s`).

**Checklist** :
- [ ] ✅ **FeedbackProvider usage** : FeedbackProvider utilisé de manière identique dans tous les portals
- [ ] ✅ **Error handling** : useApiError utilisé de manière identique dans tous les portals
- [ ] ✅ **Toast patterns** : Patterns de toast identiques (tone, duration, stacking)
- [ ] ✅ **Inline feedback** : Patterns d'InlineFeedback identiques (validation, erreurs contextuelles)
- [ ] ✅ **Error boundaries** : GlobalErrorBoundary présent dans tous les layouts
- [ ] ✅ **Notification feed** : useNotificationsFeed activé dans tous les portals
- [ ] ✅ **Scope naming** : Noms de scope cohérents entre portals (ex: `"transactions"`, `"workflow:123"`)
- [ ] ✅ **i18n keys** : Clés i18n utilisées de manière cohérente (pas de duplication)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Usage cohérent dans tous les portals
// apps/web/app/[locale]/(client)/c/transactions/page.tsx
function TransactionsPage() {
  const { push } = useFeedback();
  const { handleError } = useApiError({ defaultMessage: t("error_generic") });
  usePageFeedback("transactions");
  // ...
}

// apps/web/app/[locale]/(client)/t/transactions/page.tsx
function TenantTransactionsPage() {
  const { push } = useFeedback();
  const { handleError } = useApiError({ defaultMessage: t("error_generic") });
  usePageFeedback("transactions"); // Même scope, même pattern
  // ...
}

// ❌ WRONG: Patterns différents entre portals
// Portal /c utilise useToast directement
const { toast } = useToast();
toast.error("Error");

// Portal /t utilise FeedbackProvider
push({ tone: "destructive", surface: "toast", title: "Error" });
```

**Violations détectées** :
- ❌ Patterns différents entre portals → **BLOQUANT**
- ❌ Scopes incohérents → **BLOQUANT**
- ❌ i18n keys dupliquées → **BLOQUANT**

### 2.2 Cohérence Tone & Surface

**CRITICAL** : Vérifie que les tones et surfaces sont utilisés de manière cohérente dans tout le codebase.

**Checklist** :
- [ ] ✅ **Tone mapping** : Mapping tone cohérent (success, info, warning, destructive)
- [ ] ✅ **Surface usage** : Surface "inline" pour validation persistante, "toast" pour feedback éphémère
- [ ] ✅ **Tone consistency** : Même tone pour même type d'erreur (ex: validation → destructive)
- [ ] ✅ **Surface consistency** : Même surface pour même type de feedback (ex: async action → toast)
- [ ] ✅ **Design tokens** : Design tokens partagés pour tones (--feedback-success, --feedback-destructive, etc.)
- [ ] ✅ **Component alignment** : Alert et Toast utilisent mêmes tones (pas de divergence)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Tone et surface cohérents
// Validation error → destructive + inline
push({
  tone: "destructive",
  surface: "inline",
  title: t("form.validation_error"),
  scope: "my-form",
});

// Async action success → success + toast
push({
  tone: "success",
  surface: "toast",
  title: t("transaction.approved"),
  scope: "transactions",
});

// ❌ WRONG: Tone et surface incohérents
// Validation error avec toast (devrait être inline)
push({
  tone: "destructive",
  surface: "toast", // Devrait être "inline"
  title: t("form.validation_error"),
});

// Success avec inline (devrait être toast)
push({
  tone: "success",
  surface: "inline", // Devrait être "toast"
  title: t("transaction.approved"),
});
```

**Violations détectées** :
- ❌ Tone incohérent pour même type d'erreur → **BLOQUANT**
- ❌ Surface inappropriée (validation avec toast) → **BLOQUANT**
- ❌ Design tokens non partagés → **BLOQUANT**

### 2.3 Cohérence i18n

**CRITICAL** : Vérifie que tous les messages de feedback utilisent des clés i18n (pas de strings hardcodées).

**Checklist** :
- [ ] ✅ **Backend i18n** : Tous les messages d'erreur backend utilisent `translate()` avec clés i18n
- [ ] ✅ **Frontend i18n** : Tous les messages frontend utilisent `t()` avec clés i18n
- [ ] ✅ **Error messages** : Messages d'erreur traduits via useApiError (pas de messages bruts)
- [ ] ✅ **Toast messages** : Messages toast utilisent clés i18n (pas de strings hardcodées)
- [ ] ✅ **Alert messages** : Messages alert utilisent clés i18n (pas de strings hardcodées)
- [ ] ✅ **i18n keys existence** : Toutes les clés i18n existent dans tous les locales (de, en, fr, it)
- [ ] ✅ **i18n key format** : Format cohérent pour clés (ex: `errors.*`, `feedback.*`, `common.*`)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Backend utilise translate() avec clé i18n
throw Errors.notFound("errors.user_not_found");

// ✅ CORRECT: Frontend utilise t() avec clé i18n
push({
  tone: "success",
  surface: "toast",
  title: t("transaction.approved"), // Clé i18n
  scope: "transactions",
});

// ✅ CORRECT: useApiError traduit automatiquement
const { handleError } = useApiError({
  defaultMessage: t("error_generic"), // Clé i18n
});

// ❌ WRONG: Strings hardcodées
throw new Error("User not found"); // Pas de clé i18n
push({ tone: "success", title: "Transaction approved" }); // Pas de clé i18n
```

**Violations détectées** :
- ❌ Messages hardcodés dans backend → **BLOQUANT**
- ❌ Messages hardcodés dans frontend → **BLOQUANT**
- ❌ Clés i18n manquantes → **BLOQUANT**
- ❌ Clés i18n non traduites dans tous les locales → **BLOQUANT**

---

## 🔍 3. ACCESSIBILITÉ & UX

### 3.1 Accessibilité Feedback

**CRITICAL** : Vérifie que le système de feedback est accessible (screen readers, keyboard navigation, ARIA).

**Checklist** :
- [ ] ✅ **aria-live regions** : FeedbackHost inclut `<div role="status" aria-live="polite">` pour screen readers
- [ ] ✅ **Toast accessibility** : Toasts ont aria-labels et role="status" (via Radix Toast)
- [ ] ✅ **Alert accessibility** : Alerts ont aria-labels et icons avec aria-hidden="true"
- [ ] ✅ **Keyboard navigation** : Toasts et alerts accessibles au clavier (dismiss, action buttons)
- [ ] ✅ **Focus management** : Focus géré correctement lors de l'affichage de feedback
- [ ] ✅ **Screen reader announcements** : Messages annoncés correctement (pas de doublons, pas de bruit)
- [ ] ✅ **Color contrast** : Contrast WCAG AA+ pour tous les tones (success, info, warning, destructive)
- [ ] ✅ **Icon accessibility** : Icons décoratifs ont aria-hidden="true" (pas de bruit screen reader)

**Patterns attendus** :
```tsx
// ✅ CORRECT: FeedbackHost avec aria-live
<div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
  {latestEvent && (
    <span>
      {latestEvent.title} {latestEvent.description}
    </span>
  )}
</div>

// ✅ CORRECT: Alert avec icon accessible
<Alert>
  <AlertCircle className="h-4 w-4" aria-hidden="true" />
  <AlertTitle>{t("error_title")}</AlertTitle>
  <AlertDescription>{t("error_description")}</AlertDescription>
</Alert>

// ❌ WRONG: Pas d'aria-live, pas d'accessibilité
<div>{errorMessage}</div> // Pas de role="status", pas d'aria-live
```

**Violations détectées** :
- ❌ Pas d'aria-live regions → **BLOQUANT**
- ❌ Pas d'aria-labels sur toasts/alerts → **BLOQUANT**
- ❌ Icons sans aria-hidden → **BLOQUANT**
- ❌ Contrast insuffisant → **BLOQUANT**

### 3.2 UX Feedback Patterns

**CRITICAL** : Vérifie que les patterns UX de feedback sont cohérents et respectent les guidelines.

**Checklist** :
- [ ] ✅ **Toast duration** : Durées cohérentes (success: 4s, warning: 6s, destructive: manual dismiss)
- [ ] ✅ **Toast stacking** : Limite de 3 toasts concurrents (overflow → queue)
- [ ] ✅ **Scope cleanup** : Feedback nettoyé par scope au unmount (via usePageFeedback)
- [ ] ✅ **Deduplication** : Feedback dédupliqué (même message/tone → un seul toast)
- [ ] ✅ **Action buttons** : Action buttons présents quand approprié (retry, dismiss, view)
- [ ] ✅ **Loading states** : Loading states affichés pendant async actions (pas de feedback prématuré)
- [ ] ✅ **Error recovery** : Options de recovery présentées (retry, escalate, view details)
- [ ] ✅ **Mobile responsiveness** : Feedback responsive (toasts stack correctement sur mobile)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Toast avec durée appropriée et action
push({
  tone: "success",
  surface: "toast",
  title: t("transaction.approved"),
  scope: "transactions",
  // Auto-dismiss après 4s (défaut pour success)
});

push({
  tone: "destructive",
  surface: "toast",
  title: t("transaction.failed"),
  description: t("transaction.retry_hint"),
  scope: "transactions",
  action: {
    label: t("retry"),
    onClick: () => retryTransaction(),
  },
  // Pas d'auto-dismiss (destructive nécessite action)
});

// ❌ WRONG: Durées incohérentes, pas d'action
push({
  tone: "destructive",
  surface: "toast",
  title: t("transaction.failed"),
  // Auto-dismiss après 2s (trop court pour destructive)
  // Pas d'action retry
});
```

**Violations détectées** :
- ❌ Durées incohérentes → **BLOQUANT**
- ❌ Pas de cleanup scope → **BLOQUANT**
- ❌ Pas de deduplication → **BLOQUANT**
- ❌ Pas d'action buttons quand nécessaire → **BLOQUANT**

---

## 🔍 4. QUALITÉ DU CODE

### 4.1 Type Safety

**CRITICAL** : Vérifie que tous les composants de feedback ont des types explicites (pas de `any`).

**Checklist** :
- [ ] ✅ **FeedbackProvider types** : FeedbackEvent, FeedbackTone, FeedbackSurface typés explicitement
- [ ] ✅ **useApiError types** : UseApiErrorOptions, UseApiErrorReturn typés explicitement
- [ ] ✅ **useToast types** : ToastFunction, ToastPayload, ToastVariant typés explicitement
- [ ] ✅ **Error types** : ApiError, ApiFetchError, ApiErrorResponse typés explicitement
- [ ] ✅ **No any types** : Aucun type `any` dans composants feedback (frontend strict)
- [ ] ✅ **Type imports** : Types importés depuis shared-ts quand approprié (pas de duplication)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Types explicites partout
export type FeedbackTone = "success" | "info" | "warning" | "destructive";
export type FeedbackSurface = "inline" | "toast";

export interface FeedbackEvent {
  id: string;
  title?: string;
  description?: string;
  tone: FeedbackTone;
  surface: FeedbackSurface;
  scope?: string;
  action?: { label: string; onClick: () => void };
  meta?: Record<string, unknown>;
}

export interface UseApiErrorOptions {
  defaultMessage: string;
  title?: string;
  tone?: FeedbackTone;
  scope?: string;
  showFeedback?: boolean;
  logError?: boolean;
}

// ❌ WRONG: Types any ou implicites
function useApiError(options: any) { // Pas de type explicite
  const push = useFeedback().push as any; // Pas de type explicite
}
```

**Violations détectées** :
- ❌ Types `any` dans frontend → **BLOQUANT**
- ❌ Types implicites → **BLOQUANT**
- ❌ Types dupliqués (pas de shared-ts) → **BLOQUANT**

### 4.2 Error Handling

**CRITICAL** : Vérifie que la gestion d'erreurs est robuste et ne laisse pas d'erreurs non gérées.

**Checklist** :
- [ ] ✅ **Try-catch blocks** : Tous les appels async wrappés dans try-catch
- [ ] ✅ **Error boundaries** : GlobalErrorBoundary présent dans layout (capture erreurs React)
- [ ] ✅ **Error logging** : Erreurs loggées avec contexte (pas d'erreurs silencieuses)
- [ ] ✅ **Error translation** : Erreurs traduites avant affichage (pas de messages bruts)
- [ ] ✅ **Fallback messages** : Messages de fallback présents (si traduction échoue)
- [ ] ✅ **Error recovery** : Options de recovery présentées (retry, escalate)
- [ ] ✅ **Network errors** : Erreurs réseau gérées spécifiquement (timeout, offline)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Try-catch avec error handling complet
async function handleApprove() {
  try {
    await approveTransaction(id);
    push({
      tone: "success",
      surface: "toast",
      title: t("transaction.approved"),
    });
  } catch (error: unknown) {
    const { handleError } = useApiError({
      defaultMessage: t("error_generic"),
    });
    handleError(error, (message) => {
      push({
        tone: "destructive",
        surface: "toast",
        title: t("transaction.approval_failed"),
        description: message,
        action: {
          label: t("retry"),
          onClick: () => handleApprove(),
        },
      });
    });
  }
}

// ❌ WRONG: Pas de try-catch, pas d'error handling
async function handleApprove() {
  await approveTransaction(id); // Pas de gestion d'erreur
  push({ tone: "success", title: "Approved" }); // Pas de traduction
}
```

**Violations détectées** :
- ❌ Appels async sans try-catch → **BLOQUANT**
- ❌ Pas d'error boundary → **BLOQUANT**
- ❌ Erreurs non loggées → **BLOQUANT**
- ❌ Pas de fallback messages → **BLOQUANT**

### 4.3 Code Quality

**CRITICAL** : Vérifie que le code respecte les standards de qualité (DRY, SOLID, naming, etc.).

**Checklist** :
- [ ] ✅ **DRY principle** : Pas de duplication de logique feedback (réutilisation hooks)
- [ ] ✅ **Single responsibility** : Chaque composant/hook a une responsabilité unique
- [ ] ✅ **Naming consistency** : Noms cohérents (useFeedback, useApiError, useToast)
- [ ] ✅ **Function length** : Fonctions <40 lignes (extraction helpers si nécessaire)
- [ ] ✅ **Comments** : Comments uniquement pour non-obvious rationale (pas de narrative)
- [ ] ✅ **Early returns** : Early returns utilisés (pas de nesting profond)
- [ ] ✅ **No side effects** : Fonctions pures où possible (pas d'effets cachés)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Fonction courte, early return, responsabilité unique
export function useApiError(options: UseApiErrorOptions) {
  const { push: pushFeedback } = useFeedback();
  const tErrors = useTranslations("errors");
  
  const handleError = useCallback((error: unknown) => {
    if (!error) return "";
    
    const message = getTranslatedErrorMessage(error, tErrors, options.defaultMessage);
    if (options.showFeedback !== false) {
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
  
  return { handleError, getErrorMessage: handleError };
}

// ❌ WRONG: Fonction longue, nesting profond, responsabilités multiples
export function useApiError(options: any) {
  const { push } = useFeedback();
  const t = useTranslations("errors");
  
  const handleError = (error: any) => {
    if (error) {
      if (error instanceof ApiFetchError) {
        if (error.message) {
          const message = t(error.message) || options.defaultMessage;
          if (options.showFeedback) {
            push({
              tone: options.tone || "destructive",
              surface: "toast",
              title: options.title || t("error_title"),
              description: message,
              scope: options.scope,
            });
          }
          return message;
        }
      }
    }
    return "";
  };
  
  return { handleError };
}
```

**Violations détectées** :
- ❌ Duplication de logique → **BLOQUANT**
- ❌ Fonctions >40 lignes → **BLOQUANT**
- ❌ Nesting profond → **BLOQUANT**
- ❌ Responsabilités multiples → **BLOQUANT**

---

## 🔍 5. INTÉGRATION & TESTING

### 5.1 Backend-Frontend Integration

**CRITICAL** : Vérifie que l'intégration backend-frontend fonctionne correctement.

**Checklist** :
- [ ] ✅ **Error response parsing** : Frontend parse ApiErrorResponse correctement
- [ ] ✅ **Error code mapping** : Error codes backend mappés vers tones frontend
- [ ] ✅ **Notification transformation** : Notifications serveur transformées en FeedbackEvent
- [ ] ✅ **Scope propagation** : Scopes propagés backend → frontend (cohérence)
- [ ] ✅ **Correlation IDs** : correlationId propagé backend → frontend (debugging)
- [ ] ✅ **Portal scoping** : Feedback scoped par portal (backend et frontend alignés)
- [ ] ✅ **Type sharing** : Types partagés via shared-ts (pas de duplication)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Backend retourne format standardisé
res.status(404).json({
  error: {
    code: "NOT_FOUND",
    message: translate("errors.user_not_found", locale),
    details: { userId },
    correlationId: req.context?.correlationId,
  },
});

// ✅ CORRECT: Frontend parse et transforme
try {
  await apiFetch("/users/123");
} catch (error: unknown) {
  if (error instanceof ApiFetchError) {
    // Error code → tone mapping
    const tone = error.code === "NOT_FOUND" ? "destructive" : "destructive";
    push({
      tone,
      surface: "toast",
      title: t("error_title"),
      description: error.message, // Déjà traduit par backend
      scope: "users",
    });
  }
}

// ❌ WRONG: Format non standardisé, pas de mapping
res.status(404).json({ message: "User not found" }); // Pas de code, pas de format standardisé
```

**Violations détectées** :
- ❌ Format d'erreur non standardisé → **BLOQUANT**
- ❌ Pas de mapping error code → tone → **BLOQUANT**
- ❌ Types non partagés → **BLOQUANT**

### 5.2 Notification Integration

**CRITICAL** : Vérifie que l'intégration des notifications serveur fonctionne correctement.

**Checklist** :
- [ ] ✅ **Notification service** : Service notifications backend expose endpoints corrects
- [ ] ✅ **useNotificationsFeed** : Hook transforme notifications en FeedbackEvent
- [ ] ✅ **Tone mapping** : Tones serveur mappés vers FeedbackTone (success, info, warning, destructive)
- [ ] ✅ **Surface mapping** : Surfaces serveur mappés vers FeedbackSurface (inline, toast)
- [ ] ✅ **Deduplication** : Notifications dédupliquées (même ID → un seul FeedbackEvent)
- [ ] ✅ **Portal scoping** : Notifications scoped par portal (cohérence)
- [ ] ✅ **Real-time support** : Support WebSocket pour notifications real-time (si implémenté)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Notification service backend
export async function getNotifications(
  accessMode: AccessMode,
  options: NotificationOptions
): Promise<Notification[]> {
  return notificationRepo.findByAccessMode(accessMode, options);
}

// ✅ CORRECT: useNotificationsFeed transforme notifications
export function useNotificationsFeed() {
  const { data: notifications } = useNotifications();
  const { push } = useFeedback();
  
  useEffect(() => {
    if (!notifications) return;
    
    notifications.forEach((notification) => {
      const tone = mapNotificationTone(notification.tone);
      const surface = mapNotificationSurface(notification.surface);
      
      push({
        id: notification.id,
        tone,
        surface,
        title: notification.title,
        description: notification.body,
        scope: notification.scope,
      });
    });
  }, [notifications, push]);
}

// ❌ WRONG: Pas de transformation, pas de mapping
useEffect(() => {
  notifications?.forEach((n) => {
    push({ title: n.title }); // Pas de tone, pas de surface, pas de mapping
  });
}, [notifications]);
```

**Violations détectées** :
- ❌ Pas de transformation notifications → **BLOQUANT**
- ❌ Pas de mapping tone/surface → **BLOQUANT**
- ❌ Pas de deduplication → **BLOQUANT**

### 5.3 Testing Coverage

**CRITICAL** : Vérifie que les composants de feedback sont testés.

**Checklist** :
- [ ] ✅ **Unit tests** : FeedbackProvider, useApiError, useToast testés (Vitest)
- [ ] ✅ **Component tests** : FeedbackHost, InlineFeedback testés (Vitest)
- [ ] ✅ **Integration tests** : Error flow backend → frontend testé
- [ ] ✅ **E2E tests** : Feedback affiché correctement dans UI (Playwright)
- [ ] ✅ **Accessibility tests** : Screen reader announcements testés
- [ ] ✅ **Error boundary tests** : GlobalErrorBoundary capture erreurs testé

**Patterns attendus** :
```typescript
// ✅ CORRECT: Tests unitaires pour hooks
describe("useApiError", () => {
  it("should translate error and push feedback", () => {
    const { result } = renderHook(() => useApiError({
      defaultMessage: "Generic error",
    }));
    
    const error = new ApiFetchError(404, "NOT_FOUND", "errors.user_not_found");
    result.current.handleError(error);
    
    expect(mockPushFeedback).toHaveBeenCalledWith({
      tone: "destructive",
      surface: "toast",
      title: "Error",
      description: "User not found",
    });
  });
});

// ❌ WRONG: Pas de tests
// Aucun test pour useApiError
```

**Violations détectées** :
- ❌ Pas de tests unitaires → **BLOQUANT**
- ❌ Pas de tests d'intégration → **BLOQUANT**
- ❌ Pas de tests E2E → **BLOQUANT**

---

## 🔍 6. DOCUMENTATION & GUIDELINES

### 6.1 Documentation Complétude

**CRITICAL** : Vérifie que la documentation est complète et à jour.

**Checklist** :
- [ ] ✅ **Architecture docs** : `docs/09-ui-ux/07-states-and-feedback/feedback.md` à jour
- [ ] ✅ **Error handling docs** : `docs/02-development/errors/error-handling.md` à jour
- [ ] ✅ **Usage examples** : Exemples d'usage présents dans docs
- [ ] ✅ **API documentation** : API des hooks/composants documentée (JSDoc)
- [ ] ✅ **Migration guide** : Guide de migration legacy → nouveau système présent
- [ ] ✅ **Best practices** : Best practices documentées (quand utiliser toast vs inline)

**Patterns attendus** :
```markdown
# Feedback System Usage

## When to use Toast vs Inline

- **Toast**: Ephemeral feedback after async actions (save, approve, sync)
- **Inline**: Persistent validation errors, contextual guidance

## Example Usage

```tsx
const { push } = useFeedback();
const { handleError } = useApiError({ defaultMessage: t("error_generic") });

try {
  await apiFetch("/endpoint");
  push({ tone: "success", surface: "toast", title: t("success") });
} catch (error) {
  handleError(error);
}
```
```

**Violations détectées** :
- ❌ Documentation manquante → **BLOQUANT**
- ❌ Documentation obsolète → **BLOQUANT**
- ❌ Pas d'exemples d'usage → **BLOQUANT**

### 6.2 Guidelines Compliance

**CRITICAL** : Vérifie que le code respecte les guidelines établies.

**Checklist** :
- [ ] ✅ **Feedback guidelines** : Guidelines feedback respectées (duration, stacking, tone)
- [ ] ✅ **Error handling guidelines** : Guidelines error handling respectées (i18n, logging, recovery)
- [ ] ✅ **Accessibility guidelines** : Guidelines accessibility respectées (aria-live, keyboard nav)
- [ ] ✅ **i18n guidelines** : Guidelines i18n respectées (pas de strings hardcodées)
- [ ] ✅ **Code style guidelines** : Guidelines code style respectées (DRY, SOLID, naming)

**Patterns attendus** :
```typescript
// ✅ CORRECT: Respecte toutes les guidelines
// - i18n: utilise t() avec clé
// - Error handling: utilise useApiError
// - Feedback: utilise FeedbackProvider
// - Accessibility: aria-live, role="status"
const { push } = useFeedback();
const { handleError } = useApiError({ defaultMessage: t("error_generic") });

try {
  await apiFetch("/endpoint");
  push({
    tone: "success",
    surface: "toast",
    title: t("transaction.approved"), // i18n
    scope: "transactions",
  });
} catch (error: unknown) {
  handleError(error); // Error handling standardisé
}

// ❌ WRONG: Ne respecte pas les guidelines
// - Pas d'i18n: string hardcodée
// - Pas d'error handling: try-catch manquant
// - Pas de FeedbackProvider: useState local
const [message, setMessage] = useState("");
await apiFetch("/endpoint");
setMessage("Transaction approved"); // Pas d'i18n, pas de FeedbackProvider
```

**Violations détectées** :
- ❌ Guidelines non respectées → **BLOQUANT**
- ❌ Patterns legacy encore utilisés → **BLOQUANT**

---

## 📊 RAPPORT D'AUDIT

### Résumé Exécutif

**Statut global** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`

**Statistiques** :
- **Total checks** : X
- **Passed** : X
- **Warnings** : X
- **Failures** : X

**Priorités** :
- **🔴 CRITICAL** : X violations bloquantes
- **🟡 HIGH** : X violations importantes
- **🟢 MEDIUM** : X violations mineures

### Détails par Catégorie

#### 1. Qualité du Code & Architecture
- **Status** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`
- **Violations détectées** : Liste complète avec fichiers et lignes
- **Recommandations** : Actions correctives prioritaires

#### 2. Cohérence & Consistance
- **Status** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`
- **Violations détectées** : Liste complète avec fichiers et lignes
- **Recommandations** : Actions correctives prioritaires

#### 3. Accessibilité & UX
- **Status** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`
- **Violations détectées** : Liste complète avec fichiers et lignes
- **Recommandations** : Actions correctives prioritaires

#### 4. Qualité du Code
- **Status** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`
- **Violations détectées** : Liste complète avec fichiers et lignes
- **Recommandations** : Actions correctives prioritaires

#### 5. Intégration & Testing
- **Status** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`
- **Violations détectées** : Liste complète avec fichiers et lignes
- **Recommandations** : Actions correctives prioritaires

#### 6. Documentation & Guidelines
- **Status** : `✅ PASS` | `⚠️ WARNINGS` | `❌ FAIL`
- **Violations détectées** : Liste complète avec fichiers et lignes
- **Recommandations** : Actions correctives prioritaires

### Actions Correctives Prioritaires

**🔴 CRITICAL (Bloquant)** :
1. [Violation 1] - Description, fichier, ligne, correction recommandée
2. [Violation 2] - Description, fichier, ligne, correction recommandée

**🟡 HIGH (Important)** :
1. [Violation 1] - Description, fichier, ligne, correction recommandée
2. [Violation 2] - Description, fichier, ligne, correction recommandée

**🟢 MEDIUM (Mineur)** :
1. [Violation 1] - Description, fichier, ligne, correction recommandée
2. [Violation 2] - Description, fichier, ligne, correction recommandée

### Métriques de Qualité

**Cohérence** :
- Patterns cohérents : X%
- i18n compliance : X%
- Type safety : X%

**Accessibilité** :
- aria-live regions : X%
- Keyboard navigation : X%
- Screen reader support : X%

**Testing** :
- Unit test coverage : X%
- Integration test coverage : X%
- E2E test coverage : X%

### Recommandations Finales

1. **Priorité immédiate** : Actions correctives pour violations CRITICAL
2. **Court terme** : Actions correctives pour violations HIGH
3. **Moyen terme** : Améliorations pour violations MEDIUM
4. **Long terme** : Évolutions architecturales recommandées

---

## ✅ CHECKLIST FINALE

Avant de finaliser l'audit, vérifie :

- [ ] ✅ Tous les fichiers feedback analysés (backend + frontend)
- [ ] ✅ Tous les portals vérifiés (`/c`, `/t`, `/p`, `/s`)
- [ ] ✅ Toutes les intégrations testées (error flow, notification flow)
- [ ] ✅ Toutes les violations documentées avec fichiers et lignes
- [ ] ✅ Toutes les recommandations priorisées (CRITICAL, HIGH, MEDIUM)
- [ ] ✅ Rapport d'audit complet avec métriques et actions correctives

---

**Dernière mise à jour** : 2026-01-14
