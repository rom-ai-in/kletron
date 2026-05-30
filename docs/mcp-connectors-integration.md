# Integration MCP & Connectors (Reference Complete)

Ce document est la reference de bout en bout pour l'integration MCP dans Kletron:

- frontend web/desktop
- routes API
- services backend
- runtime d'execution agent
- securite, secret management, troubleshooting

Il complete les docs techniques agentiques existantes et sert de guide operationnel "comment ca marche en vrai".

---

## 1) Vue d'ensemble

Kletron combine trois couches:

1. **Configuration produit (frontend)**  
   L'utilisateur configure des connecteurs (integrations SaaS + serveurs MCP) depuis l'UI.
2. **Persistance + orchestration (backend)**  
   Le backend stocke les connecteurs, gere les bindings par workspace, chiffre les secrets et expose les APIs de probe/discover.
3. **Execution runtime (agent + MCP client)**  
   Au demarrage d'un run agent, Kletron synchronise les serveurs MCP externes actifs et expose leurs outils comme `slug__toolName`.

---

## 2) Glossaire

- **Connector / Connecteur**: terme produit generique (SaaS ou MCP).
- **Integration**: connecteur SaaS (GitHub, Sentry, Google, etc.).
- **MCP Server**: serveur Model Context Protocol ajoute par l'utilisateur.
- **Account-level connector**: connecteur stocke au niveau compte (bibliotheque utilisateur).
- **Workspace binding**: activation/desactivation d'un connecteur pour un workspace donne.
- **External MCP tool**: outil venant d'un MCP externe, namespace `slug__tool`.
- **Bundled MCP**: serveur MCP integre au repo (`apps/mcp-server`).

---

## 3) Surface frontend

### 3.1 Web (surface principale)

Points d'entree:

- `apps/web/app/app/config/connectors/page.tsx`
- `apps/web/components/workspace/WorkspaceConnectorsManager.tsx`
- `apps/web/hooks/useConnectors.ts`

Fonctionnalites:

- creer/editer/supprimer un serveur MCP
- tester une configuration MCP sans persistance (probe)
- discover des outils d'un serveur enregistre
- activer/desactiver un connecteur pour un workspace
- gerer les bindings multi-workspace pour connecteurs account-level
- lancer OAuth pour les integrations SaaS

### 3.2 Hooks UI partages

- `packages/ui/src/hooks/workspaceConnectorsShared.ts`
- `packages/ui/src/hooks/useWorkspaceConnectors.ts`
- `packages/ui/src/components/CommandCenter/WorkspaceConnectorsHint.tsx`

Notes:

- cache snapshot connecteurs (TTL 60s)
- hint visuel dans l'experience agent (integrations actives + MCP actifs)

### 3.3 Desktop

Fichiers:

- `apps/desktop/src/app/App.tsx`
- `apps/desktop/src/app/PopoutConversation.tsx`
- `apps/desktop/src/app/DesktopSettingsView.tsx`
- `apps/desktop/src/portalLinks.ts`

Comportement:

- le desktop reutilise les informations connecteurs (hint/strips)
- la configuration detaillee est redirigee vers le portail web (`/app/config/connectors`)

---

## 4) Contrats API utilises par le frontend

### 4.1 Workspace-scoped MCP

- `GET /api/workspaces/:workspaceId/connectors/mcp-servers`
- `POST /api/workspaces/:workspaceId/connectors/mcp-servers`
- `PUT /api/workspaces/:workspaceId/connectors/mcp-servers/:id`
- `DELETE /api/workspaces/:workspaceId/connectors/mcp-servers/:id`
- `POST /api/workspaces/:workspaceId/connectors/mcp-servers/probe`
- `POST /api/workspaces/:workspaceId/connectors/mcp-servers/:id/discover`

Routes:

- `apps/web/app/api/workspaces/[workspaceId]/connectors/mcp-servers/route.ts`
- `apps/web/app/api/workspaces/[workspaceId]/connectors/mcp-servers/[id]/route.ts`
- `apps/web/app/api/workspaces/[workspaceId]/connectors/mcp-servers/probe/route.ts`
- `apps/web/app/api/workspaces/[workspaceId]/connectors/mcp-servers/[id]/discover/route.ts`

### 4.2 Account library + bindings

- `GET /api/account/connectors/mcp-servers`
- `POST /api/account/connectors/mcp-servers`
- `DELETE /api/account/connectors/mcp-servers/:id`
- `GET /api/account/connectors/mcp-servers/:id/workspace-bindings`
- `PUT /api/account/connectors/mcp-servers/:id/workspace-bindings`

Routes:

- `apps/web/app/api/account/connectors/mcp-servers/route.ts`
- `apps/web/app/api/account/connectors/mcp-servers/[id]/route.ts`
- `apps/web/app/api/account/connectors/mcp-servers/[id]/workspace-bindings/route.ts`

### 4.3 Integrations SaaS (complemente MCP)

Routes equivalentes sous:

- `apps/web/app/api/workspaces/[workspaceId]/connectors/integrations/...`
- `apps/web/app/api/account/connectors/integrations/...`
- `apps/web/app/api/workspaces/[workspaceId]/connectors/bindings/route.ts`
- OAuth entrypoint: `/api/auth/connect/:provider`

---

## 5) Modele de donnees et persistance

Schemas partages:

- `packages/shared/src/connectors/types.ts`
- `packages/shared/src/connectors/accountBindings.ts`
- `packages/shared/src/connectors/catalog.ts`

Collections principales:

- `account_mcp_servers`
- `account_integrations`
- `workspace_connector_bindings`

Legacy encore supporte en lecture selon les chemins:

- `workspace_mcp_servers`
- `workspace_integrations`

Services:

- `packages/server/src/services/accountConnectorsService.ts`
- `packages/server/src/services/connectorBindingsService.ts`
- `packages/server/src/services/connectorsService.ts`

---

## 6) Chiffrement et secret management

Fichier central:

- `packages/server/src/lib/crypto/secrets.ts`

Principes:

- AES-256-GCM pour chiffrer credentials/headers/env en base
- cle derivee depuis:
  1. `KLETRON_ENCRYPTION_KEY` (prioritaire)
  2. fallback `NEXTAUTH_SECRET`
- helpers `encryptJson` / `decryptJson`

Impact:

- les secrets des connecteurs account-level ne sont pas stockes en clair
- la meme cle symetrique sert aussi au signing des tokens MCP locaux (voir section 11)

---

## 7) Probe vs Discover (difference cle)

### Probe (ephemere, non persiste)

Route:

- `apps/web/app/api/workspaces/[workspaceId]/connectors/mcp-servers/probe/route.ts`

Caracteristiques:

- utilise uniquement le body de requete (`McpServerProbeInput`)
- ne lit/crit pas la collection connecteurs
- retourne `ok/tools` ou `ok:false/error`

### Discover (sur serveur enregistre, persiste)

Route:

- `apps/web/app/api/workspaces/[workspaceId]/connectors/mcp-servers/[id]/discover/route.ts`

Caracteristiques:

- charge la config enregistree (ou fallback liste complete)
- tente une connexion MCP + `listTools`
- persiste status + `discoveredTools` via `recordMcpServerStatus`

Probe runtime:

- `packages/server/src/lib/mcpDiscoverProbe.ts`

---

## 8) Runtime d'execution des outils MCP externes

### 8.1 Client MCP principal (singleton)

Fichier:

- `packages/mcp-client/src/client.ts`

Responsabilites:

- connexion au MCP bundled
- map des connexions externes **isolee par workspace**
- routage des calls `slug__tool`
- reconnect sur erreurs recoverables (`tool not found`, `-32603`)

Structures cle:

- `externalByWorkspace: Map<workspaceId, Map<slug, connection>>`

### 8.2 Namespacing et routage

Fichiers:

- `packages/mcp-client/src/multiClient.ts`
- `packages/mcp-client/src/workspaceExternalRouting.ts`

Regles:

- nom externe: `slug__toolName`
- si `workspaceId` explicite: routage strict sur ce workspace
- sans `workspaceId`: routage accepte seulement si un seul workspace match

### 8.3 Sync runtime des serveurs actifs

Service:

- `packages/server/src/services/mcpWorkspaceSync.ts`

Flow:

1. `getExternalMcpRuntimeConfig(workspaceId)`
2. mapping vers `ExternalMcpClientConfig`
3. `McpClient.getInstance().syncExternalServers(workspaceId, mapped)`

### 8.4 Wrappers LangChain dynamiques

Fichier:

- `packages/agent-core/src/tools/dynamicExternalTools.ts`

Role:

- recupere `McpClient.listExternalTools(workspaceId)`
- construit des tools LangChain
- chaque wrapper appelle `client.callTool(toolName, args, { workspaceId })`

Important:

- conserver le meme `workspaceId` entre sync et call pour eviter un mauvais routage inter-workspace

---

## 9) Resolution des capacites workspace

Service:

- `packages/server/src/services/workspaceCapabilityResolver.ts`

Le resolver combine:

- skills actives
- integrations actives
- outils baseline + unlocked tools
- serveurs MCP externes actifs (runtime config)

Sortie:

- `enabledTools`
- `enabledIntegrationProviderIds`
- `externalMcpServers`

Cache:

- TTL court (5s) pour limiter les recalculs

---

## 10) Integration avec l'executor agent

Service:

- `packages/server/src/services/agentGraphExecutor.ts`

Cycle simplifie:

1. resolve capabilities
2. sync connecteurs MCP externes
3. build dynamic external tools
4. fusion avec outils bundled selon la selection de node
5. execution des appels outils

Effet produit:

- les tools MCP externes apparaissent dans les traces avec leur namespace `slug__...`

---

## 11) Endpoint MCP workspace local (cas specifique)

Route:

- `apps/web/app/api/mcp/workspace/[workspaceId]/route.ts`

Authentification:

- bearer verifie par `verifyLocalMcpToken`
- token emis par `issueLocalMcpToken`
- implementation: `packages/server/src/lib/codexLocalMcpAuth.ts`

Important:

- cet endpoint expose un serveur MCP HTTP lie au workspace (notamment outils Google Workspace)
- ce n'est pas la meme chose que la bibliotheque generale de MCP externes user-configures

---

## 12) Variables d'environnement importantes

### Runtime MCP

- `MCP_URL`  
  URL du serveur MCP bundled. Dans `McpClient`, si non defini, fallback vers `http://localhost:9000/sse`.
- `DISABLE_AUTO_INDEX`  
  desactive l'init auto-index au bootstrap du client.

### Securite / secrets

- `KLETRON_ENCRYPTION_KEY`
- `NEXTAUTH_SECRET` (fallback)

### Hosted/local hybrid

- `WORKSPACE_SKIP_LOCAL_FS_VALIDATION`
- `KLETRON_REMOTE_FILE_MCP_SLUG`

### MCP local HTTP tokenized (codex/local bridge)

- `KLETRON_LOCAL_MCP_BASE_URL` (selon usage backend)

---

## 13) Runbook operationnel

### Ajouter un serveur MCP

1. ouvrir `Configuration -> Connectors`
2. `Add connection` -> onglet MCP
3. saisir transport + config (`stdio` ou URL/headers)
4. sauvegarder
5. lancer `Discover`
6. verifier la liste des tools decouverts

### Diagnostiquer "tool introuvable"

Checklist:

1. verifier que le serveur MCP est `enabled`
2. relancer `Discover`
3. verifier le namespace appele (`slug__tool`)
4. verifier que le run passe le bon `workspaceId`
5. controler la connectivite reseau (SSE/HTTP) ou commande stdio

### Diagnostiquer echec d'un connecteur account-level

Checklist:

1. verifier credentials stockes (rotation si necessaire)
2. verifier bindings workspace (`workspace-bindings`)
3. verifier statut via discover/test
4. controler variables de chiffrement (cle stable)

---

## 14) Limites et points d'attention

- **Singleton process**: `McpClient` garde un etat global en memoire (par process Node).
- **Transports stdio**: le binaire/commande s'execute sur l'hote serveur, pas sur le navigateur.
- **Routage ambigu sans workspaceId**: interdit si plusieurs workspaces matchent le meme slug.
- **Cache capacites (5s)**: un leger delai peut exister apres un changement de connecteur.
- **Separation des surfaces**: endpoint `/api/mcp/workspace/:id` != catalogue connecteurs MCP utilisateur.

---

## 15) Fichiers source "source of truth"

Frontend:

- `apps/web/components/workspace/WorkspaceConnectorsManager.tsx`
- `apps/web/hooks/useConnectors.ts`
- `packages/ui/src/hooks/workspaceConnectorsShared.ts`

Backend:

- `packages/server/src/services/connectorsService.ts`
- `packages/server/src/services/accountConnectorsService.ts`
- `packages/server/src/services/connectorBindingsService.ts`
- `packages/server/src/lib/mcpDiscoverProbe.ts`
- `packages/server/src/services/workspaceCapabilityResolver.ts`
- `packages/server/src/services/mcpWorkspaceSync.ts`
- `packages/server/src/services/agentGraphExecutor.ts`

MCP runtime:

- `packages/mcp-client/src/client.ts`
- `packages/mcp-client/src/workspaceExternalRouting.ts`
- `packages/agent-core/src/tools/dynamicExternalTools.ts`

---

## 16) Liens utiles

- MCP tools (agentic): `docs/agentic/07-mcp-tools.md`
- architecture agentic globale: `docs/agentic/01-architecture-overview.md`
- hosted + local files/tunnel MCP: `docs/workspace-local-files-hosted-kletron.md`
- architecture repo (haut niveau): `ARCHITECTURE.md`

