# Fichiers locaux + Kletron hébergé (`www.kletron.com`)

Les workspaces enregistrent un **`rootPath`** qui reflète souvent votre machine de développement (ex. `/Users/…/business`). Le **backend SaaS** tourne sur Linux dans **Cloud Run** : ce chemin **n’existe pas** là-bas.

Ce document clarifie les deux mécanismes qui permettent tout de même un usage cohérent : **API / sessions** d’un côté, **outils repo** de l’autre.

---

## 1. Pourquoi deux réglages distincts ?

| Besoin | Mécanisme |
|--------|-----------|
| Éviter **`422 WORKSPACE_PATH_MISSING`** sur `/api/sessions`, résolution workspace | **`WORKSPACE_SKIP_LOCAL_FS_VALIDATION=true`** sur le service web Cloud Run |
| Que **`list_files`**, **`read_file`**, **`git_*`**, etc. lisent **votre disque local** | **`KLETRON_REMOTE_FILE_MCP_SLUG`** + connecteur MCP externe + tunnel HTTPS vers votre MCP local |

Sans (2), le backend continue d’appeler le **MCP bundled** déployé avec la plateforme : il voit le **filesystem du conteneur**, pas votre Mac.

---

## 2. `WORKSPACE_SKIP_LOCAL_FS_VALIDATION` (déjà dans le dépôt)

- Quand il est à **`true`** ou **`1`**, le serveur **n’exige plus** que `rootPath` existe sur le disque Cloud Run.
- Les **`rootPath` « desktop »** restent la vérité métier pour le contexte (chemins passés aux outils, affichage, alignement avec votre clone local).

À provisionner sur Cloud Run (ou via `.env` + `infra/gcp/provision_secrets.py` si vous utilisez ce flux). Voir commentaire dans **`env.example`**.

**Limite** : seul le blocage FS sur la résolution workspace est levé ; les outils fichiers restent incorrects tant que vous n’avez pas la section 3.

---

## 3. `KLETRON_REMOTE_FILE_MCP_SLUG` — repo sur votre machine

### Idée

1. Vous lancez **`apps/mcp-server`** sur votre Mac (ou une machine qui contient le repo), avec accès au même **`rootPath`** logique que dans Kletron.
2. Vous exposez le endpoint **SSE** du MCP (souvent **`http://127.0.0.1:9000/sse`**) via un tunnel **HTTPS** (ngrok, Cloudflare Tunnel, etc.).
3. Dans Kletron (**Configuration → Connecteurs / MCP** du workspace), vous ajoutez un serveur MCP avec :
   - **Transport** : SSE (URL publique du tunnel),
   - **Slug** : un identifiant stable, ex. **`desktop`** (doit être unique pour ce workspace).
4. Sur **Cloud Run**, vous définissez :

   **`KLETRON_REMOTE_FILE_MCP_SLUG=desktop`**

   (la valeur doit **exactement** correspondre au **slug** du connecteur — casse gérée côté routage MCP pour les appels externes, mais gardez le même libellé que dans l’UI).

### Ce que fait le code

Pour une liste d’outils « bundled » qui touchent au repo ou au git/bash local (`list_files`, `read_file`, `git_*`, `write_file`, `execute_bash`, …), les appels sont transformés en **`desktop__list_files`**, etc., et routés vers **votre** serveur MCP via la connexion externe déjà synchronisée (`syncWorkspaceExternalMcpServers`).

Les chemins absolus du type **`/Users/…`** sont inchangés dans les arguments : votre MCP **local** les comprend.

**Non redirigés** (restent sur le serveur hébergé ou la logique serveur) : entre autres **`semantic_code_search`** (index vectoriel côté cloud), **`web_search`**, **`fetch_url`**, **`github_api`**, outils skills / formatage.

### Multi-tenant

`KLETRON_REMOTE_FILE_MCP_SLUG` est une variable **globale par déploiement**. Elle convient si tous les utilisateurs concernés utilisent le **même slug** (ex. équipe interne). Pour des slugs différents par organisation, il faudrait une évolution produit (préférence stockée par workspace).

---

## 4. Checklist opérationnelle

1. Cloud Run : `WORKSPACE_SKIP_LOCAL_FS_VALIDATION=true`
2. Cloud Run : `KLETRON_REMOTE_FILE_MCP_SLUG=<slug>` identique au connecteur UI
3. Mac : `npm run …` ou process manager pour **`apps/mcp-server`** avec **`MCP_INTERNAL_TOKEN`** (et **`KLETRON_WEB_BASE_URL=https://www.kletron.com`**) alignés sur les secrets du déploiement — le MCP doit pouvoir authentifier les appels internes si votre setup l’exige
4. Tunnel stable vers **`…/sse`** pendant que vous travaillez
5. Dans l’app : **synchroniser / reconnecter** les connecteurs MCP pour le workspace avant un run agent

---

## 5. Sécurité

Un tunnel vers votre MCP expose une surface d’attaque. Limitez la durée d’exposition, utilisez des **tokens** forts sur le connecteur (headers), et des contrôles d’accès ngrok/tunnel quand c’est possible. **`execute_bash`** redirigé vers votre machine exécute du shell **sur cette machine**.

---

## 6. Alternatives

| Approche | Cas d’usage |
|----------|-------------|
| **Self-host** Kletron (web + MCP) sur la même machine que le repo | Pas de tunnel ; chemins réels sur l’hôte |
| **Repo dans le cloud** (clone CI, volume conteneur) | `rootPath` pointant vers un chemin Linux réel dans l’image ; pas besoin de slug distant |
| **App desktop** avec backend **local** | Parité FS native ; différent de « UI web prod uniquement » |

---

## Voir aussi

- **LLM local + tunnel** — exécuter un LLM en local exposé via un tunnel HTTPS (orthogonal aux fichiers workspace).
- **`docs/agentic/07-mcp-tools.md`** — Architecture MCP et `slug__tool`.
- **`packages/agent-core/src/tools/mcpTools.ts`** — liste `REMOTE_REDIRECT_BUNDLED_MCP_TOOLS` et logique de redirection.
