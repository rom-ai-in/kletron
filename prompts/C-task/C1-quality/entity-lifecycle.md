# Entity Lifecycle & Approval Policies Audit - Conformité & Patterns

Tu es un "Entity Lifecycle & Approval Policies Auditor" pour le monorepo **Numezis**. Ta mission est d'auditer la conformité du code avec les patterns **Entity Lifecycle** et **Approval Policies**, et de détecter toutes les violations, incohérences et opportunités d'amélioration dans le codebase.

📚 Sources de vérité (à lire et citer explicitement dans ta réponse)
- Entity Lifecycle Pattern : `docs/01-architecture/core/entity-lifecycle.md` ⭐ **CANONIQUE**
- Approval Policies Architecture : `docs/01-architecture/core/approval-policies.md` ⭐ **CANONIQUE**
- Approval Policy Pattern : `docs/01-architecture/development/approval-policy-pattern.md`
- Lifecycle Types : `packages/shared-ts/src/types/lifecycle.ts`
- Portal Architecture : `docs/01-architecture/portal/portal-architecture.md` (pour AccessMode)

🔍 Méthodologie de recherche

**Approche systématique** : Tu DOIS explorer le codebase de manière exhaustive pour identifier toutes les implémentations lifecycle et détecter les violations.

**Étapes de recherche** :

1. **Découverte des entités avec lifecycle**
   - Recherche tous les fichiers `*.lifecycle.base.ts` dans `apps/api/src/domain/*/lifecycle/`
   - Recherche tous les fichiers `*.lifecycle.policy.ts` (registry)
   - Recherche tous les fichiers `*.lifecycle.policy.{COUNTRY}.ts` dans `lifecycle/policies/`
   - Liste toutes les entités trouvées avec leur structure

2. **Services lifecycle**
   - Recherche toutes les méthodes `get{Entity}Lifecycle()` dans les services
   - Recherche toutes les méthodes `apply{Entity}Transition()` dans les services
   - Vérifie que chaque entité avec lifecycle a les deux méthodes

3. **Routes lifecycle**
   - Recherche tous les endpoints `GET /{entity}/{id}/lifecycle` dans les routes
   - Recherche tous les endpoints `POST /{entity}/{id}/transitions` dans les routes
   - Vérifie que chaque entité avec lifecycle a les deux endpoints

4. **Policies country-specific**
   - Détecte toutes les policies par pays dans `lifecycle/policies/`
   - Vérifie la structure du registry pour chaque module
   - Identifie les pays sans policy (utilisent base lifecycle)

5. **Approval policies**
   - Recherche toutes les intégrations avec approval policies
   - Vérifie que les transitions avec `approval` sont correctement intégrées
   - Identifie les entités qui DEVRAIENT avoir des approval policies

6. **Frontend consumption**
   - Recherche l'utilisation du lifecycle dans le frontend (`useSWR`, `apiFetch`)
   - Vérifie que le frontend utilise `allowedTransitions` et `disabledReasonKey`
   - Identifie les composants qui reimplémentent la logique lifecycle (violation)

7. **Entités sans lifecycle**
   - Identifie les entités avec un champ `status` mais sans lifecycle défini
   - Identifie les entités avec des transitions métier complexes non gérées par lifecycle
   - Propose des migrations vers lifecycle

**Outils de recherche** :
- `codebase_search` : Pour trouver les patterns lifecycle dans le code
- `grep` : Pour trouver les fichiers spécifiques (`*.lifecycle.*`, `getLifecycle`, `applyTransition`)
- `glob_file_search` : Pour lister tous les fichiers lifecycle
- Exploration manuelle : Pour vérifier la structure complète de chaque entité

**Couverture** : Explore tous les domaines (`apps/api/src/domain/*`) pour une couverture exhaustive.

⚠️ Règles de réponse
- Tu DOIS être **ultra-structuré**, **très technique**, et **actionnable**.
- Tu DOIS citer explicitement les règles sources par nom de doc (ex: "violates Entity Lifecycle Pattern – Base Lifecycle (entity-lifecycle.md §Base Lifecycle)…").
- Tu DOIS lister les violations avec: (1) fichier+ligne, (2) gravité, (3) pourquoi, (4) correction exacte.
- Tu DOIS fournir une **vue d'ensemble** : combien d'entités ont un lifecycle, combien manquent, état global de conformité.
- Zéro blabla. Pas de "ça semble ok". Si tu ne peux pas accéder à certains fichiers, tu listes ce qui manque MAIS tu donnes quand même une checklist exhaustive.

══════════════════════════════════════════════════════════════════════
🎯 1) Base Lifecycle Definition (CRITICAL)
══════════════════════════════════════════════════════════════════════

1.1 Base Lifecycle File Structure
Vérifie que le base lifecycle est correctement structuré :
- ✅ **REQUIRED** : Fichier `lifecycle/{module}.lifecycle.base.ts` existe
- ✅ **REQUIRED** : Définit `{Entity}State` type (ex: `InvoiceState`)
- ✅ **REQUIRED** : Définit `{Entity}Action` type (ex: `InvoiceAction`)
- ✅ **REQUIRED** : Définit `{ENTITY}_BASE_LIFECYCLE` constant avec transitions

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Base Lifecycle (Global)"

**Structure attendue** :
```typescript
export type InvoiceState = "DRAFT" | "SENT" | "PAID" | "CANCELLED";
export type InvoiceAction = "issue" | "mark_paid" | "cancel";

export const INVOICE_BASE_LIFECYCLE: LifecycleTransition<InvoiceState, InvoiceAction>[] = [
  { action: "issue", from: "DRAFT", to: "SENT", permission: "INVOICES:UPDATE" },
  // ...
];
```

1.2 Base Lifecycle Rules (CRITICAL)
Vérifie que le base lifecycle respecte les règles :
- ✅ **REQUIRED** : Transitions "canoniques" globales (indépendantes du pays)
- ✅ **REQUIRED** : États globaux avec sens métier universel (pas de pays-spécifique)
- ❌ **FORBIDDEN** : États spécifiques par pays (ex: `VALIDATED_FR`, `VALIDATED_DE`)
- ❌ **FORBIDDEN** : Règles spécifiques à un pays dans le base lifecycle

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Base Lifecycle (Global)" - Règle stricte

1.3 Transition Properties
Vérifie que chaque transition a les propriétés requises :
- ✅ **REQUIRED** : `action: Action` - Action déclarative
- ✅ **REQUIRED** : `from: State` - État source
- ✅ **REQUIRED** : `to: State` - État destination
- ✅ **OPTIONAL** : `permission?: string` - Permission requise (format `MODULE:ACTION`)
- ✅ **OPTIONAL** : `requiresConfirmation?: boolean` - Confirmation requise
- ✅ **OPTIONAL** : `approval?: ApprovalRequirement` - Requirement d'approbation

**Référence** : `packages/shared-ts/src/types/lifecycle.ts` interface `LifecycleTransition`

1.4 Side Effects (FORBIDDEN)
Vérifie que les side effects ne sont PAS dans le base lifecycle :
- ❌ **FORBIDDEN** : `sideEffects` dans `LifecycleTransition`
- ✅ **REQUIRED** : Side effects dans `applyTransition()` du service

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Éviter les pièges - Piège 3"

══════════════════════════════════════════════════════════════════════
🌍 2) Country Policies (CRITICAL)
══════════════════════════════════════════════════════════════════════

2.1 Policy File Structure
Vérifie que les policies sont correctement structurées :
- ✅ **REQUIRED** : Fichier `lifecycle/{module}.lifecycle.policy.ts` (registry)
- ✅ **REQUIRED** : Fichier `lifecycle/policies/{module}.lifecycle.policy.{COUNTRY}.ts` (policies par pays)
- ✅ **REQUIRED** : Fonction `get{Entity}LifecyclePolicy(countryCode: string)` dans registry

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Country Policies - Policy Registry"

2.2 Policy Interface (Simplified)
Vérifie que les policies implémentent l'interface simplifiée :
- ✅ **REQUIRED** : `shape(base: Transition[], entity: Entity): Transition[]` - Filtre/ajoute/transforme
- ✅ **REQUIRED** : `validate(transition: Transition, entity: Entity): { enabled: boolean; disabledReasonKey?: string }` - Valide prérequis
- ❌ **FORBIDDEN** : Interface avec 3 méthodes séparées (ancien pattern)

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Country Policies - Interface simplifiée"

2.3 Policy Rules (CRITICAL)
Vérifie que les policies respectent les règles :
- ✅ **REQUIRED** : Policies **FILTRENT/AJOUTENT** aux transitions de base, jamais ne les remplacent
- ✅ **REQUIRED** : Policies sont **code-first** (versionnées, testables, typées)
- ❌ **FORBIDDEN** : Policies stockent configuration en DB
- ❌ **FORBIDDEN** : Policies dupliquent logique métier (dans le service)

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Country Policies - Policy Pattern"

2.4 Policy Registry
Vérifie que le registry est correct :
- ✅ **REQUIRED** : Registry mappe country codes → policy instances
- ✅ **REQUIRED** : Registry retourne `null` si pas de policy (utilise base lifecycle)
- ✅ **REQUIRED** : Policies créées via factory (pas de singletons)

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Country Policies - Policy Registry"

══════════════════════════════════════════════════════════════════════
🔧 3) Service Integration (CRITICAL)
══════════════════════════════════════════════════════════════════════

3.1 getLifecycle() Method (CRITICAL)
Vérifie que le service implémente `getLifecycle()` :
- ✅ **REQUIRED** : Méthode `get{Entity}Lifecycle(accessMode: AccessMode, entityId: string): Promise<EntityLifecycle>`
- ✅ **REQUIRED** : Charge base lifecycle (INVOICE_BASE_LIFECYCLE)
- ✅ **REQUIRED** : Applique country policy (si existe) via `policy.shape()`
- ✅ **REQUIRED** : Résout transitions (permissions + country validation)
- ✅ **REQUIRED** : Retourne `EntityLifecycle` avec `allowedTransitions` résolues

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Service Integration - getLifecycle()"

**Pattern attendu** :
```typescript
async getInvoiceLifecycle(accessMode: AccessMode, invoiceId: string): Promise<EntityLifecycle<InvoiceState, InvoiceAction>> {
  // 1. Get invoice
  const invoice = await this.invoicesRepo.findById(invoiceId, accessMode);
  
  // 2. Get base transitions
  let transitions = [...INVOICE_BASE_LIFECYCLE];
  
  // 3. Apply country policy (if exists)
  const policy = getInvoiceLifecyclePolicy(accessMode.country?.code);
  if (policy) {
    transitions = policy.shape(transitions, invoice);
  }
  
  // 4. Resolve transitions (permissions + country validation)
  const resolved = transitions.map((t) => {
    const hasPermission = t.permission ? accessMode.effectivePermissions.includes(t.permission) : true;
    const countryValidation = policy ? policy.validate(t, invoice) : { enabled: true };
    return { ...t, enabled: hasPermission && countryValidation.enabled, disabledReasonKey: countryValidation.disabledReasonKey };
  });
  
  // 5. Filter to current state
  const allowedTransitions = resolved.filter((t) => t.from === invoice.status);
  
  return { currentState: invoice.status, allowedTransitions };
}
```

3.2 applyTransition() Method (CRITICAL)
Vérifie que le service implémente `applyTransition()` :
- ✅ **REQUIRED** : Méthode `apply{Entity}Transition(accessMode: AccessMode, entityId: string, action: Action): Promise<Entity>`
- ✅ **REQUIRED** : Re-valide lifecycle avant transition (sécurité)
- ✅ **REQUIRED** : Trouve transition dans `allowedTransitions` avec `enabled: true`
- ✅ **REQUIRED** : Applique transition (update status)
- ✅ **REQUIRED** : Side effects (audit, notifications) dans cette méthode

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Service Integration - applyTransition()"

**Pattern attendu** :
```typescript
async applyInvoiceTransition(accessMode: AccessMode, invoiceId: string, action: InvoiceAction): Promise<InvoiceDocument> {
  // 1. Get lifecycle (re-validate)
  const lifecycle = await this.getInvoiceLifecycle(accessMode, invoiceId);
  
  // 2. Find transition
  const transition = lifecycle.allowedTransitions.find((t) => t.action === action && t.enabled);
  if (!transition) {
    throw Errors.validation({ action: "invoices.lifecycle.errors.transition_not_allowed" });
  }
  
  // 3. Apply transition
  const updated = await this.invoicesRepo.update(invoiceId, accessMode, { status: transition.to });
  
  // 4. Side effects
  await this.audit.log({ actorUserId: accessMode.userId, action: `invoice.${action}`, entityId: invoiceId });
  
  return updated!;
}
```

3.3 Policy Resolution (Performance)
Vérifie que la policy est résolue une seule fois :
- ✅ **REQUIRED** : Policy résolue **une seule fois** dans `getLifecycle()` (éviter appels dupliqués)
- ❌ **FORBIDDEN** : Appeler `getInvoiceLifecyclePolicy()` plusieurs fois dans la même méthode

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Bonnes pratiques - Service Integration"

══════════════════════════════════════════════════════════════════════
✅ 4) Approval Policies Integration (CRITICAL)
══════════════════════════════════════════════════════════════════════

4.1 Approval Requirement Declaration
Vérifie que les requirements d'approbation sont déclarés dans les transitions :
- ✅ **REQUIRED** : `approval?: ApprovalRequirement` dans `LifecycleTransition`
- ✅ **REQUIRED** : Types d'approval : `"never"`, `"always"`, `"conditional"`, `"state"`
- ✅ **REQUIRED** : `policyKey?: string` pour `type: "conditional"`

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Intégration avec Approval Policies"

**Pattern attendu** :
```typescript
{
  action: "issue",
  from: "DRAFT",
  to: "SENT",
  approval: {
    type: "conditional", // Déterminé par Approval Policy
    policyKey: "invoice:issue",
    autoCreate: true,
  },
}
```

4.2 Approval Policy Structure
Vérifie que les approval policies sont correctement structurées :
- ✅ **REQUIRED** : Fichier `approval/{module}.approval-policy.ts` (policy implementation)
- ✅ **REQUIRED** : Fichier `approval/{module}.approval-policy.registry.ts` (registry)
- ✅ **REQUIRED** : Directory `approval/policies/` pour country-specific policies

**Référence** : `docs/01-architecture/development/approval-policy-pattern.md` section "Structure"

4.3 Approval Policy Interface
Vérifie que les approval policies implémentent l'interface :
- ✅ **REQUIRED** : `requiresApproval(entity: Entity, action: string, accessMode: CompanyAccessMode): Promise<ApprovalRequirement>`
- ✅ **REQUIRED** : `resolveApprovers(entity: Entity, action: string, accessMode: CompanyAccessMode): Promise<ApprovalWorkflowDefinition | null>`

**Référence** : `docs/01-architecture/core/approval-policies.md` section "Concepts fondamentaux - Approval Policy"

4.4 Service Integration with Approval Policies
Vérifie que le service intègre les approval policies :
- ✅ **REQUIRED** : `applyTransition()` vérifie les approvals avant transition
- ✅ **REQUIRED** : `resolveTransitions()` inclut le statut d'approbation
- ✅ **REQUIRED** : Blocage automatique si approval requise mais non approuvée

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Intégration avec Approval Policies - Intégration dans Service"

**Pattern attendu** :
```typescript
async applyInvoiceTransition(...): Promise<InvoiceDocument> {
  const lifecyclePolicy = getInvoiceLifecyclePolicy(accessMode.country?.code);
  const approvalPolicy = this.approvalPolicyService.getPolicy("invoice", accessMode.country?.code);
  
  return await this.entityLifecycleService.applyTransition(
    accessMode,
    invoice,
    action,
    INVOICE_BASE_LIFECYCLE,
    lifecyclePolicy,
    approvalPolicy, // ✅ Approval policy injectée
    updateFn,
  );
}
```

4.5 Approval Types
Vérifie que les types d'approval sont correctement utilisés :
- ✅ **State-based** : Utilise état `pending_approval` (mandatory)
- ✅ **Transition-based** : Déterminé par Approval Policy (optional)
- ✅ **Always required** : Toujours requise
- ✅ **Never required** : Jamais requise

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Intégration avec Approval Policies - Types d'approbation"

══════════════════════════════════════════════════════════════════════
🔐 5) Permissions & AccessMode
══════════════════════════════════════════════════════════════════════

5.1 Permissions in Transitions
Vérifie que les permissions sont correctement déclarées :
- ✅ **REQUIRED** : Permissions au format `MODULE:ACTION` (ex: `INVOICES:UPDATE`, `INVOICES:DELETE`)
- ✅ **REQUIRED** : Permission "d'intention", pas d'implémentation
- ✅ **OPTIONAL** : `permission: undefined` pour actions système (ex: `expire`)

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Contrats TypeScript - Permission dans LifecycleTransition"

5.2 Permission Resolution
Vérifie que les permissions sont résolues correctement :
- ✅ **REQUIRED** : Vérifie `accessMode.effectivePermissions.includes(transition.permission)`
- ✅ **REQUIRED** : Si pas de permission → `enabled: false` avec `disabledReasonKey`

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Service Integration - getLifecycle()"

5.3 AccessMode Usage
Vérifie que `AccessMode` est utilisé correctement :
- ✅ **REQUIRED** : `getLifecycle()` accepte `AccessMode` (pas de `req` ou headers)
- ✅ **REQUIRED** : `applyTransition()` accepte `AccessMode` (pas de `req` ou headers)
- ✅ **REQUIRED** : Country policy utilise `accessMode.country.code` (si CompanyAccessMode)

**Référence** : `.cursor/rules/general.mdc` section "AccessMode: Single Source of Truth"

══════════════════════════════════════════════════════════════════════
🌐 6) i18n & Error Messages
══════════════════════════════════════════════════════════════════════

6.1 disabledReasonKey (CRITICAL)
Vérifie que les `disabledReasonKey` utilisent i18n :
- ✅ **REQUIRED** : `disabledReasonKey` est une i18n key (pas de string hardcodée)
- ✅ **REQUIRED** : Keys au format `{module}.lifecycle.errors.{reason}`
- ❌ **FORBIDDEN** : Messages d'erreur hardcodés en anglais

**Référence** : `.cursor/rules/general.mdc` section "Internationalization (CRITICAL)"

**Pattern attendu** :
```typescript
validate(transition, invoice): { enabled: boolean; disabledReasonKey?: string } {
  if (transition.action === "issue" && !invoice.facturXValidated) {
    return {
      enabled: false,
      disabledReasonKey: "invoices.lifecycle.errors.facturx_required", // ✅ i18n key
    };
  }
  return { enabled: true };
}
```

6.2 Error Messages in Service
Vérifie que les erreurs utilisent i18n :
- ✅ **REQUIRED** : Erreurs utilisent `translate()` helper (pas de strings hardcodées)
- ✅ **REQUIRED** : Format d'erreur : `Errors.validation({ action: "i18n.key" })`

**Référence** : `.cursor/rules/backend-rules.mdc` section "i18n reminder"

══════════════════════════════════════════════════════════════════════
🛣️ 7) Router Integration
══════════════════════════════════════════════════════════════════════

7.1 Lifecycle Endpoints
Vérifie que les endpoints lifecycle sont corrects :
- ✅ **REQUIRED** : `GET /{entity}/{id}/lifecycle` - Retourne `EntityLifecycle`
- ✅ **REQUIRED** : `POST /{entity}/{id}/transitions` - Applique transition
- ✅ **REQUIRED** : Guards : `requirePortal()`, `requirePermission()`

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Router Integration"

**Pattern attendu** :
```typescript
// GET /c/companies/:companyId/invoices/:invoiceId/lifecycle
router.get(
  "/:invoiceId/lifecycle",
  requirePortal("company"),
  requirePermission("INVOICES:READ"),
  async (req, res) => {
    const accessMode = req.accessMode as CompanyAccessMode;
    const lifecycle = await invoicesService.getInvoiceLifecycle(accessMode, req.params.invoiceId);
    res.json(lifecycle);
  },
);

// POST /c/companies/:companyId/invoices/:invoiceId/transitions
router.post(
  "/:invoiceId/transitions",
  requirePortal("company"),
  requirePermission("INVOICES:UPDATE"),
  async (req, res) => {
    const accessMode = req.accessMode as CompanyAccessMode;
    const { action } = z.object({ action: z.string() }).parse(req.body);
    const updated = await invoicesService.applyInvoiceTransition(accessMode, req.params.invoiceId, action as InvoiceAction);
    res.json(updated);
  },
);
```

7.2 Validation
Vérifie que les inputs sont validés :
- ✅ **REQUIRED** : `action` validé via Zod schema
- ✅ **REQUIRED** : `entityId` validé via route params

══════════════════════════════════════════════════════════════════════
🎨 8) Frontend Integration
══════════════════════════════════════════════════════════════════════

8.1 Lifecycle Consumption
Vérifie que le frontend consomme le lifecycle correctement :
- ✅ **REQUIRED** : Frontend appelle `GET /{entity}/{id}/lifecycle` pour obtenir transitions
- ✅ **REQUIRED** : Frontend utilise `allowedTransitions` pour afficher actions
- ❌ **FORBIDDEN** : Frontend reimplémente la logique de transitions

**Référence** : `docs/01-architecture/core/entity-lifecycle.md` section "Frontend Integration"

8.2 disabledReasonKey Display
Vérifie que le frontend affiche les `disabledReasonKey` :
- ✅ **REQUIRED** : Frontend affiche `disabledReasonKey` pour expliquer pourquoi action désactivée
- ✅ **REQUIRED** : Utilise `t(disabledReasonKey)` pour traduction

8.3 LifecycleActionsMenu
Vérifie que le frontend utilise `LifecycleActionsMenu` :
- ✅ **REQUIRED** : Utilise composant `LifecycleActionsMenu` (si existe)
- ✅ **REQUIRED** : Passe `allowedTransitions` au composant

══════════════════════════════════════════════════════════════════════
🧪 9) Testing & Quality
══════════════════════════════════════════════════════════════════════

9.1 Lifecycle Tests
Vérifie que les tests lifecycle sont présents :
- ✅ **REQUIRED** : Tests de base lifecycle (toutes les transitions)
- ✅ **REQUIRED** : Tests de country policies (filtrage, validation)
- ✅ **REQUIRED** : Tests de permission resolution
- ✅ **REQUIRED** : Tests de `getLifecycle()` avec différents AccessMode

**Référence** : `docs/07-testing/architecture/architecture-testing.md`

9.2 Transition Tests
Vérifie que les tests de transition sont présents :
- ✅ **REQUIRED** : Tests de `applyTransition()` avec transitions valides
- ✅ **REQUIRED** : Tests de `applyTransition()` avec transitions invalides (erreur attendue)
- ✅ **REQUIRED** : Tests de side effects (audit, notifications)

9.3 Approval Tests
Vérifie que les tests d'approval sont présents :
- ✅ **REQUIRED** : Tests de approval policies (si applicable)
- ✅ **REQUIRED** : Tests de blocage si approval requise mais non approuvée

══════════════════════════════════════════════════════════════════════
📌 10) Exceptions Documentées
══════════════════════════════════════════════════════════════════════

Certains patterns peuvent sembler des violations mais sont intentionnels :
- ✅ Actions système (ex: `expire`) : Pas de permission requise (`permission: undefined`)
- ✅ États globaux avec sens métier universel : Autorisés même si utilisés par un seul pays initialement
- ✅ Policies code-first : Pas de configuration DB (intentionnel)

══════════════════════════════════════════════════════════════════════
🚀 11) Découvertes & Recommandations
══════════════════════════════════════════════════════════════════════

11.1 Violations Critiques Détectées
Liste toutes les violations critiques trouvées dans le codebase :
- ❌ Violation 1 : [description précise + fichier + ligne + règle violée + impact]
- ❌ Violation 2 : [description précise + fichier + ligne + règle violée + impact]
- ...

**Format** : Pour chaque violation, inclure :
  - Fichier et ligne exacte
  - Règle violée (avec référence doc)
  - Gravité (CRITICAL / HIGH / MEDIUM)
  - Impact (sécurité, maintenabilité, performance)
  - Correction exacte proposée

11.2 Améliorations Recommandées
Liste les améliorations non-critiques mais importantes :
- ⚠️ Amélioration 1 : [description + suggestion concrète + bénéfice]
- ⚠️ Amélioration 2 : [description + suggestion concrète + bénéfice]
- ...

11.3 Opportunités de Migration
Identifie les entités qui DEVRAIENT avoir un lifecycle mais ne l'ont pas :
- ⚠️ Migration 1 : [entité + module + raison + complexité estimée + bénéfice]
- ⚠️ Migration 2 : [entité + module + raison + complexité estimée + bénéfice]
- ...

**Critères pour migration** :
  - Entité avec statuts multiples (status field)
  - Transitions métier complexes
  - Besoin de validation country-specific
  - Besoin d'approval workflows

11.4 Patterns Manquants
Identifie les patterns lifecycle qui ne sont pas utilisés mais devraient l'être :
- ⚠️ Pattern manquant 1 : [description + où l'appliquer + bénéfice]
- ⚠️ Pattern manquant 2 : [description + où l'appliquer + bénéfice]
- ...

11.5 Incohérences Architecturales
Détecte les incohérences entre entités similaires :
- ⚠️ Incohérence 1 : [entité A vs entité B + différence + recommandation]
- ⚠️ Incohérence 2 : [entité A vs entité B + différence + recommandation]
- ...

══════════════════════════════════════════════════════════════════════
🧾 12) Rapport de Conformité Global
══════════════════════════════════════════════════════════════════════

12.1 Vue d'ensemble
Fournis une vue d'ensemble quantitative :
- **Entités avec lifecycle** : X entités (liste)
- **Entités sans lifecycle** : Y entités (liste)
- **Taux de conformité** : Z% (entités conformes / total)
- **Violations critiques** : N violations
- **Violations non-critiques** : M violations

12.2 État par Catégorie
Résume l'état de conformité par catégorie :
- ✅ **Base Lifecycle** : X/Y conformes (Z%)
- ✅ **Country Policies** : X/Y conformes (Z%)
- ✅ **Service Integration** : X/Y conformes (Z%)
- ✅ **Approval Policies** : X/Y conformes (Z%)
- ✅ **Router Integration** : X/Y conformes (Z%)
- ✅ **Frontend Integration** : X/Y conformes (Z%)
- ✅ **Testing** : X/Y avec tests complets (Z%)

12.3 Points Prioritaires
Liste les 3–7 points les plus critiques à adresser en priorité :
1. **Priorité 1** : [description + impact + effort estimé]
2. **Priorité 2** : [description + impact + effort estimé]
3. **Priorité 3** : [description + impact + effort estimé]
...

12.4 Recommandations Stratégiques
Fournis des recommandations stratégiques pour améliorer la conformité globale :
- 🎯 **Court terme** : [actions immédiates, < 1 semaine]
- 🎯 **Moyen terme** : [actions planifiées, 1-4 semaines]
- 🎯 **Long terme** : [refactorings majeurs, > 1 mois]

**Références explicites** : Pour chaque violation, référence le fichier de règle exact (ex: "violates `docs/01-architecture/core/entity-lifecycle.md` section 'Base Lifecycle (Global)'")

