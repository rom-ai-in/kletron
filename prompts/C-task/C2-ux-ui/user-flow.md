4-User flow: Tu es un auditeur senior Produit + UX + Architecture Numezis.

Tu dois auditer la USER JOURNEY réelle de la feature/module qui vient d'être implémentée.

⚠️ ATTENTION
Une feature est considérée comme DÉFECTUEUSE si :
- l'utilisateur ne peut pas la trouver naturellement
- il n'existe pas de point d'entrée clair
- le parcours n'est pas évident selon le portal / rôle
- la page n'est accessible que par URL "magique"
- l'utilisateur ne comprend pas quoi faire ensuite

Ton rôle est de vérifier que l'utilisateur peut EFFECTIVEMENT FAIRE SON JOB.

Cet audit DOIT être effectué dans le cadre des règles produit officielles de Numezis :

- Law #1 — Feature Discoverability
  → Toute route applicative DOIT avoir un entry point utilisateur
  (docs/09-ui-ux/04-product/feature-discoverability-rule.md)

- Law #2 — Feature Entry Contract
  → Les entry points doivent être explicitement définis et implémentés
  (docs/09-ui-ux/04-product/feature-entry-pattern.md)

- Law #3 — User Journey Audit
  → Toute feature ajoutant des routes DOIT passer un audit user journey
  (docs/09-ui-ux/04-product/feature-user-journey-audit.md)

────────────────────────────────────────────
🎯 CONTEXTE D'AUDIT (OBLIGATOIRE)
────────────────────────────────────────────
Commence par expliciter :

1. Feature / Module audité :
- Nom
- Objectif métier (en une phrase claire)
- Routes applicatives (liste complète avec méthodes HTTP)

2. Portals concernés :
- company / tenant / partner / superadmin
- lesquels DOIVENT voir cette feature
- lesquels NE DOIVENT PAS

3. Profils utilisateurs concernés :
Pour chaque rôle :
- userRole
- permissions requises (format: `MODULE:ACTION`)
- modules requis (lowercase, ex: `"invoices"`)
- niveau d'expertise supposé (admin / opérationnel / expert)

➡️ Si tu ne peux pas répondre clairement à ces points → PROBLÈME PRODUIT.

────────────────────────────────────────────
🧭 0. QUESTION CRITIQUE — OÙ ET COMMENT J'Y ACCÈDE ?
────────────────────────────────────────────
Réponds EXPLICITEMENT à la question suivante :

👉 *"En tant que <ROLE> dans le portal <PORTAL>, comment est-ce que je découvre et j'accède à cette feature ?"*

Pour CHAQUE rôle + portal :

- Existe-t-il un point d'entrée visible ?
  - Sidebar (vérifier navigation registry: `apps/api/src/services/navigation.registry.ts`)
  - Dashboard (widget ou lien)
  - Settings (section dédiée)
  - CTA contextuel (depuis quelle page exacte ?)
  - Deep-link (documenté ET exposé via UI ? email, notification, autre feature)
- Le point d'entrée est-il :
  - visible immédiatement ?
  - caché derrière une logique claire (permission, module) ?
  - cohérent avec la hiérarchie du produit ?
- Vérification technique :
  - Navigation registry à jour ? (`id`, `labelKey`, `hrefTemplate`, `requiredPermission`, `moduleCode`)
  - `excludeFromMenu: true` si route dérivée (detail, form) ?
  - `excludeFromMenu` absent si route structurelle (list, dashboard) ?

🚨 RED FLAGS :
- aucune entrée UI
- accessible uniquement via URL directe
- entrée visible mais sans permission claire
- entrée présente dans un mauvais portal
- deep-link non documenté ou non exposé via UI

➡️ Si la réponse est "je dois connaître l'URL" → ❌ FAIL.

────────────────────────────────────────────
🗺️ 1. CARTOGRAPHIE DU USER FLOW (DE BOUT EN BOUT)
────────────────────────────────────────────
Pour CHAQUE parcours utilisateur réel :

### 1.1 Entrée
- D'où vient l'utilisateur ?
  - page exacte (chemin complet)
  - lien exact (navigation registry ID ou composant source)
  - CTA précis (texte du bouton, i18n key)
- Pourquoi il clique là ?
  - intention métier explicite ?
  - cohérence avec le contexte (ex: "View Invoice" depuis Orders)

### 1.2 Préconditions
- Portal actif (vérifié comment ? middleware, route guard)
- Permissions (vérifié comment ? `PermissionGate`, `requiredPermission` dans navigation registry)
- Modules (vérifié comment ? `ModuleGate`, `moduleCode` dans navigation registry)
- Données nécessaires existantes (ex: company active, tenant configuré)

➡️ Les préconditions sont-elles VISIBLES pour l'utilisateur ?
- Module non activé → Message clair avec CTA "Activer le module" ?
- Permission manquante → Message clair avec guidance "Contacter admin" ?
- Données manquantes → Message clair avec CTA "Créer X" ?

### 1.3 Étapes du flow
Décris CHAQUE écran et transition :
- écran affiché (nom du composant/page)
- action utilisateur (clic, saisie, navigation)
- validation (Zod schema, erreurs affichées)
- feedback (toast, message inline, état UI)
- appel API (endpoint, méthode, payload)

➡️ Vérifie qu'il n'y a PAS de saut logique.

### 1.4 États UI (OBLIGATOIRE)
Pour CHAQUE étape :
- ✅ Loading: Comment affiché ? (Skeleton, Spinner, état du composant)
- ✅ Empty: Comment affiché ? (`EmptyState` component, message i18n)
- ✅ Error: Comment affiché ? (`PortalErrorState`, toast, message inline)
- ✅ Disabled: Quand et pourquoi ? (permissions, modules, données manquantes)
- ✅ Success: Comment affiché ? (toast, redirection, état visuel)
- ✅ Retry: Mécanisme disponible ? (`onErrorRetry` dans SWR, bouton retry)
- ✅ Abandon: Peut-on revenir en arrière ? (breadcrumb, bouton retour, navigation)

🚨 Si un état critique (loading, error) n'est pas géré → FAIL UX.

### 1.5 Sorties
- Que se passe-t-il après succès ?
  - Où arrive l'utilisateur ? (route exacte)
  - Peut-il continuer son travail naturellement ?
  - Y a-t-il un feedback clair (toast, message) ?
- Peut-il revenir en arrière sans se perdre ?
  - Breadcrumb présent et cliquable ?
  - Bouton retour logique ?
  - Conservation du contexte (filtres, scope) ?

────────────────────────────────────────────
🧠 2. COHÉRENCE MÉTIER — EST-CE QUE ÇA FAIT DU SENS ?
────────────────────────────────────────────
Analyse le flow du point de vue du JOB À FAIRE :

### 2.1 Compréhension utilisateur
- Le user comprend-il :
  - pourquoi il est ici ? (titre de page, breadcrumb, contexte)
  - ce qu'on attend de lui ? (labels clairs, placeholders, guidance)
  - ce qui se passera après ? (CTA explicites, feedback prévisible)

### 2.2 Vocabulaire et concepts
- Les actions sont-elles :
  - nommées correctement ? (i18n keys cohérentes avec le domaine métier)
  - ordonnées logiquement ? (créer avant éditer, list avant detail)
  - alignées avec les concepts métier ? (pas de vocabulaire technique exposé)

### 2.3 Flow métier
- Le parcours respecte-t-il :
  - l'ordre naturel des tâches ? (ex: créer commande → générer facture)
  - les dépendances métier ? (ex: activer module avant utilisation)
  - les contraintes organisationnelles ? (ex: permissions, rôles)

🚨 Red flags :
- actions techniques exposées (ex: "Sync Database" au lieu de "Actualiser")
- vocabulaire backend (ex: "POST /api/invoices" au lieu de "Créer facture")
- étapes inutiles (ex: confirmation pour action non destructive)
- flow inversé (ex: éditer avant créer)

────────────────────────────────────────────
🧭 3. NAVIGATION & CONTINUITÉ
────────────────────────────────────────────
Vérifie :

### 3.1 Chemins d'accès multiples
- Peut-on arriver ici depuis plusieurs chemins cohérents ?
  - Depuis sidebar ? (navigation registry)
  - Depuis dashboard ? (widget ou lien)
  - Depuis une autre page métier ? (CTA contextuel)
  - Depuis un email/notification ? (deep-link documenté)

### 3.2 Navigation contextuelle
- Existe-t-il :
  - breadcrumb ? (présent, cliquable, i18n correct)
  - lien "retour" logique ? (vers page parent, list, ou dashboard)
  - conservation du contexte ? (filtres, scope, pagination)

### 3.3 Robustesse navigation
- Que se passe-t-il si :
  - on recharge la page ? (état conservé ? filtres perdus ?)
  - on arrive par deep-link ? (404 si ressource inexistante ? message clair ?)
  - le contexte n'est pas valide ? (company suspendue, module désactivé, permission révoquée)

────────────────────────────────────────────
🔐 4. PORTAL & ROLE AWARENESS
────────────────────────────────────────────
Pour chaque portal :

### 4.1 Visibilité conditionnelle
- La feature est-elle :
  - visible quand elle doit l'être ? (permissions, modules, rôles)
  - absente quand elle ne doit pas l'être ? (pas de 404, pas de lien mort)

### 4.2 Adaptation par rôle
- Le wording change-t-il selon le rôle ?
  - Labels adaptés ? (ex: "Mes factures" vs "Toutes les factures")
  - CTA adaptés ? (ex: "Créer" pour admin, "Demander" pour user)
  - Guidance adaptée ? (ex: niveau d'expertise supposé)

### 4.3 Cohérence permissions
- Les permissions sont-elles cohérentes ?
  - Même niveau pour routes liées ? (ex: READ pour list, READ pour detail)
  - Escalade logique ? (ex: CREATE > READ, WRITE > READ)
  - Vérification backend ET frontend ? (route guard + PermissionGate)

🚨 Exemple critique :
- feature superadmin accessible mais invisible dans toute la navigation → FAIL.

────────────────────────────────────────────
🧪 5. SCÉNARIOS D'ÉCHEC RÉELS
────────────────────────────────────────────
Teste mentalement :

### 5.1 Scénarios bloquants
- User sans permission
  - Message affiché ? (claire, actionnable)
  - Guidance claire ? ("Contacter votre administrateur", lien vers settings)
  - CTA utile ? (ex: "Demander l'accès", "Voir les permissions")
- Module non activé
  - Message affiché ? (claire, actionnable)
  - Guidance claire ? ("Activer le module X dans les paramètres")
  - CTA utile ? (lien vers settings, bouton "Activer")
- Données manquantes
  - Message affiché ? (claire, actionnable)
  - Guidance claire ? ("Créer X pour continuer")
  - CTA utile ? (bouton "Créer X", lien vers création)
- Mauvais portal
  - Message affiché ? (404 avec guidance)
  - Redirection logique ? (vers dashboard du bon portal)
- Mauvais scope
  - Message affiché ? (403 avec guidance)
  - Redirection logique ? (vers list ou dashboard)

### 5.2 Scénarios edge cases
- Ressource supprimée (404)
- Conflit de données (409)
- Erreur réseau (500, timeout)
- Session expirée (401)

Pour chacun :
- message affiché ?
- guidance claire ?
- CTA utile (ex: retry, refresh, contacter support) ?

────────────────────────────────────────────
✅ 6. VÉRIFICATIONS TECHNIQUES (OBLIGATOIRE)
────────────────────────────────────────────
Vérifie explicitement :

### 6.1 Navigation Registry
- [ ] Toutes les routes structurelles ont une entrée dans `apps/api/src/services/navigation.registry.ts`
- [ ] `id` unique, `labelKey` existe dans i18n (de, en, fr, it)
- [ ] `hrefTemplate` correct avec placeholders (`:companyId`, `:tenantId`)
- [ ] `requiredPermission` format correct (`MODULE:ACTION`)
- [ ] `moduleCode` lowercase, existe dans modules collection
- [ ] `excludeFromMenu: true` pour routes dérivées (detail, form)
- [ ] `excludeFromMenu` absent pour routes structurelles (list, dashboard)

### 6.2 Internationalisation (i18n)
- [ ] Tous les textes utilisateur utilisent des i18n keys (pas de hardcode)
- [ ] Tous les `labelKey` existent dans `packages/i18n/messages/*/nav` (de, en, fr, it)
- [ ] Tous les messages d'erreur utilisent `translate()` (backend) ou `t()` (frontend)
- [ ] Run `npm run i18n:verify && npm run i18n:lint` pour valider

### 6.3 Accessibilité (A11y)
- [ ] Aria-labels présents sur tous les éléments interactifs
- [ ] Keyboard navigation fonctionnelle (Tab, Enter, Escape)
- [ ] Focus visible et logique (ordre de tabulation)
- [ ] Contraste WCAG AA+ (textes, boutons, liens)
- [ ] Screen reader friendly (landmarks, headings hiérarchiques)

### 6.4 Permissions & Modules
- [ ] Vérification backend : route guards (`requirePermission`, `requireModuleEnabled`)
- [ ] Vérification frontend : `PermissionGate`, `ModuleGate`
- [ ] Cohérence : même permission/module backend ET frontend
- [ ] Messages d'erreur clairs si permission/module manquant

────────────────────────────────────────────
🧾 7. VERDICT FINAL
────────────────────────────────────────────
Conclure par :

### 7.1 Verdict global
- ✅ **User journey clair et exploitable** : Toutes les routes ont des entry points, tous les états UI sont gérés, navigation cohérente, permissions correctes, i18n complète, accessibilité OK
- 🟨 **Parcours existant mais améliorable** : Entry points présents mais certains états UI manquants, ou i18n/accessibilité à améliorer
- 🟥 **Feature inutilisable / invisible / dangereuse** : Routes sans entry points, états UI critiques manquants, permissions incorrectes, navigation cassée

### 7.2 Liste précise des problèmes
Pour chaque problème identifié :
- Type : ❌ Critique (bloquant) | ⚠️ Mineur (amélioration)
- Route/Composant concerné : Chemin exact
- Description : Problème clair et actionnable
- Impact : Impact utilisateur réel

Exemples :
- ❌ Route `/c/companies/:companyId/invoices/:invoiceId` sans entry point (accessible uniquement via URL directe)
- ⚠️ Empty state manquant sur `/c/companies/:companyId/invoices` (affichage vide si aucune facture)
- ❌ Permission `INVOICES:READ` vérifiée frontend mais pas backend (route `/api/c/invoices` accessible sans permission)

### 7.3 Corrections ACTIONNABLES
Pour chaque problème critique, fournir :
- Où : Fichier exact, ligne si possible
- Quoi : Action précise (ajouter lien, ajouter CTA, déplacer dans navigation)
- Comment : Code ou pattern à suivre

Exemples :
- Ajouter entrée dans navigation registry : `apps/api/src/services/navigation.registry.ts` ligne ~150, ajouter `{ id: "invoices", portal: ["company"], ... }`
- Ajouter CTA contextuel : `apps/web/app/[locale]/(client)/c/companies/[companyId]/sales/orders/page.tsx`, ajouter bouton "View Invoice" avec `router.push()`
- Ajouter empty state : `apps/web/app/[locale]/(client)/c/companies/[companyId]/sales/invoices/page.tsx`, utiliser composant `<EmptyState>` avec i18n key `invoices.empty_state`

────────────────────────────────────────────
📋 TEMPLATE DE RÉPONSE STRUCTURÉ
────────────────────────────────────────────
Utilise ce format pour ta réponse :

## 🎯 CONTEXTE D'AUDIT

### Feature / Module
- **Nom** : [nom]
- **Objectif métier** : [phrase claire]
- **Routes** : [liste complète]

### Portals concernés
- **Doivent voir** : [portals]
- **Ne doivent pas voir** : [portals]

### Profils utilisateurs
- **[ROLE]** : permissions `[MODULE:ACTION]`, module `[module]`, niveau `[admin/opérationnel/expert]`
- ...

## 🧭 0. QUESTION CRITIQUE — OÙ ET COMMENT J'Y ACCÈDE ?

### Portal [PORTAL] / Rôle [ROLE]
- ✅/❌ Entry point : [type] → [détails]
- ✅/❌ Visible immédiatement : [oui/non]
- ✅/❌ Navigation registry : [id] → [labelKey]
- ...

## 🗺️ 1. CARTOGRAPHIE DU USER FLOW

### Parcours: [Nom Route]
- **Route** : `[METHOD] /[portal]/[path]`
- **Entry Points** : [détails]
- **Préconditions** : [détails]
- **Étapes** : [1, 2, 3...]
- **États UI** : [loading, error, empty, success]
- **Sorties** : [succès, erreur, 404]

## 🧠 2. COHÉRENCE MÉTIER
[Analyse]

## 🧭 3. NAVIGATION & CONTINUITÉ
[Analyse]

## 🔐 4. PORTAL & ROLE AWARENESS
[Analyse]

## 🧪 5. SCÉNARIOS D'ÉCHEC
[Analyse]

## ✅ 6. VÉRIFICATIONS TECHNIQUES
- [ ] Navigation Registry : ✅/❌
- [ ] i18n : ✅/❌
- [ ] Accessibilité : ✅/❌
- [ ] Permissions & Modules : ✅/❌

## 🧾 7. VERDICT FINAL

### Verdict global
[✅/🟨/🟥]

### Problèmes identifiés
- ❌ [problème critique]
- ⚠️ [problème mineur]

### Corrections actionnables
- [Correction 1]
- [Correction 2]

