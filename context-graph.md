# Graph de contexte

## 1. Objectif général
Le **graph de contexte** sert de mémoire structurée du dépôt : fichiers, symboles, relations d'import ou d'édition, dates et compteurs. Il permet au pipeline LangGraph d'ajouter des informations pertinentes aux prompts envoyés à l'agent, afin de limiter les allers-retours vers le serveur MCP et d'amener l'agent à raisonner avec l'état du code local.

## 2. Architecture du graphe
- `ContextGraphStore` (`src/context/graph/ContextGraphStore.ts`) stocke les *ContextNode* et *ContextEdge* en mémoire avec adjacence, métadonnées et stats dynamiques. Les nœuds ont une clé `id` (chemin absolu pour les fichiers) et des champs `metadata`/`stats` mis à jour lorsqu'ils sont vus ou modifiés.
- Les arêtes typiques (`imports`, `referenced_in`, `contains`, etc.) relient des nœuds autour des dépendances et du flot structurel. L'API `getNeighborhood` fournit un voisinage en N sauts pour guider la proximité pendant le classement.
- La persistance JSON s'effectue dans `.numezis/context_graph.json`, ce qui permet de recharger rapidement le graphe entre deux runs (`load`/`save`).

## 3. Construction initiale et mise à jour
- `ContextScanner` (`src/context/graph/ContextScanner.ts`) balaie l'arborescence (*fast-glob* sur `.ts/.tsx/.js/.jsx/.md/.json` en excluant `node_modules/.git/.next`) pour créer un nœud par fichier. Il analyse ensuite les `import ... from` relatifs pour ajouter des arêtes `imports` (avec résolution de suffixes) et enrichir le graphe en une passe.
- Le graphe est rechargé automatiquement au démarrage d'un run via `ensureContextGraphReady` (`src/services/agentGraphExecutor.ts:247`), qui appelle `contextGraphStore.load()` puis, si aucun nœud n'existe, déclenche un scan du dépôt configuré (`config.mcpDefaultDir`).

## 4. État de l'éditeur
- `EditorStateManager` (`src/context/graph/EditorStateManager.ts`) conserve une vue minimale des fichiers ouverts, de l'actif, de la position du curseur, des récents edits et des plages visibles. Même si aucun hook utilisateur n'est branché actuellement, `getCurrentState()` est appelé à chaque requête de classement pour influencer la proximité.

## 5. Classement des éléments pertinents
- `ContextRanker` (`src/context/graph/ContextRanker.ts`) calcule un score sur la base du prompt utilisateur et de l'état éditeur :
  1. **Récence** (`lastViewed`/`lastEdited`) avec décroissance horaire. 1.0 → maintenant, 0.5 → 24h.
  2. **Proximité graphe** : correspondance directe (
    fichier actif ouvert) → +1 · W_PROXIMITY, voisin
    (arête partage) → +0.5 · W_PROXIMITY.
  3. **Mention explicite** des noms de fichiers dans le prompt (W_MENTION).
  La liste est triée par score et tronquée à un `limit` (souvent 10‑15) en filtrant les nœuds à score > 0.1.
- `pruneToBudget` prépare une future découpe par tokens en estimant `(taille / 4)` par nœud.

## 6. Injection contextuelle pour l'agent
1. **Préparation** : juste avant chaque run (chaque exécution de nœud LangGraph), `ensureContextGraphReady()` assure que le graphe est chargé/scanné.
2. **Rangée** : `AgentGraphExecutor.executeRunStreaming` récupère le prompt utilisateur rendu par `renderUserPrompt` et l’état éditeur courant.
3. **Classement** : `ContextRanker.rank` est invoqué avec `userPrompt`, `editorState` et une limite (15, budget 30 000).
4. **Prompt enrichi** : les nœuds classés sont formatés dans `contextBlock`, qui est concaténé au `node.react.systemPrompt` avant d’appeler `streamReactAgentMessages` (`src/services/agentGraphExecutor.ts:486`).
5. **Cycle LLM** : l’agent ReAct reçoit ce système prompt enrichi et peut déclencher des outils
   (sélectionnés via `selectToolsByName` et `allMcpTools`).
6. **Outils MCP** : `streamReactAgentMessages` utilise `McpClient` indirectement via `mcpTools`, ce qui signifie que chaque appel MCP (e.g. `read_file`, `write_file`, `git_diff`) arrive dans un contexte où le LLM connaît déjà les fichiers les plus pertinents. Cela diminue les appels inutiles à MCP.

## 7. Relation avec le protocole MCP
- Les outils exposés (`src/tools/mcpTools.ts`) sont des wrappers `tool(...)` autour de `callMcpTool`, qui prépare les chemins (`filePath`, `repoPath`, `path`) par rapport à `config.mcpDefaultDir` puis invoque `McpClient.callTool`.
- Le client MCP (`src/mcp/client.ts`) crée un `Client` SSE/stdio connecté au serveur `mcp-server`, en réutilisant le même dossier que celui scanné par le graphe. Cela garantit que l’injection contextuelle et les outils ciblent le même dépôt physique.
- À chaque requête (chaque nœud LangGraph), l’agent exécute `streamReactAgentMessages` après l’injection ; les outils MCP sélectionnés dans `node.react.toolNames` sont mis à disposition, et les résultats retardent la conclusion de l’étape. Le contexte détecté en amont guide donc les appels MCP dans cette même requête.

## 8. Observabilité et utilitaires
- Le endpoint `app/api/context/graph/route.ts` charge le graphe (`load`/`scan`) et propose deux verbes :
  - **GET** → retourne `nodes` + `edges` pour la visualisation (`ContextVisualizer`).
  - **POST** → simule une requête de classement (prompt + `editorState`) et renvoie le top N (`ContextTracePanel`).
- Cela permet de comprendre pourquoi tel fichier a été retenu et ainsi d’itérer sur la stratégie de classement sans relancer un run complet.

## 9. Synthèse de chaque requête
1. `AgentGraphExecutor` s’assure que le graphe est présent (`ensureContextGraphReady`).
2. Le prompt du nœud est rendu, puis `ContextRanker` classe les nœuds par pertinence.
3. Les fichiers candidats sont injectés dans `systemPrompt` avant l’appel LLM.
4. `streamReactAgentMessages` s’exécute, et si un outil est demandé, le wrapper MCP l’envoie à `McpClient` (même dossier que le graphe).
5. Le graphe et l’éditeur peuvent recevoir des stats (view/edit) pour alimenter les runs suivants.
6. Le processus est répétitif pour chaque nœud LangGraph, mais le graphe lui-même est rechargé une seule fois tant qu’il reste valide sur disque.

Le document ci-dessus doit rester vivant : si le scanner devient plus précis (AST, embeddings), il faudra mettre à jour la section 3) et réviser l’injection (section 6) pour refléter les nouveaux champs ou budgets. EOF
## 10. UI/UX du graphe de contexte

Le graphe n’est pas seulement une structure en mémoire : l’interface propose plusieurs portes d’accès explicites pour comprendre et contrôler son impact.

- **Context Config View** (`src/components/config/ContextConfigView.tsx#L470` et suiv.) organise trois onglets :
  1. *Project Soul* permet d’activer ou de suspendre l’injection contextuelle, de lancer un scan du dépôt, puis de voir des statistiques (nœuds/edges/stack) dans `RepoStatsCard` et d’ajuster l’audit via `AuditContextForm`.
  2. *Active Context* rend directement `ContextVisualizer` en plein écran pour inspecter tous les nœuds triés par activité et filtrés par type (`file`, `symbol`, etc.).
  3. *Trace & Debug* combine un panneau qui explique les critères de scoring et la colonne `ContextTracePanel` (`src/components/context/ContextTracePanel.tsx#L17`) : l’utilisateur y tape un prompt hypothétique et voit immédiatement les scores de pertinence renvoyés, ce qui aide à calibrer le `ContextRanker`.
  Les onglets incluent aussi un `ScanConsole` qui affiche les logs d’analyse pendant un scan en arrière-plan et introduit un bouton « Re-scan » pour régénérer le graphe.

- **Modal graph depuis la session** : dans `src/components/Agent/ActiveSession.tsx#L677`, un bouton brain ouvrant un modal affiche aussi `ContextVisualizer`. Cela permet de jeter un oeil rapide au graphe courant — nœuds, stats et filtres — sans quitter la conversation, alors que la barre de commandes contient aussi des sélecteurs `GRAPH`, `LLM` et des boutons pour le graphe et l’audit.

Ces UI donnent un feedback direct à l’utilisateur : vérifier quels fichiers ont été détectés, ré-exécuter un scan, tester un prompt hypothétique et comprendre visuellement pourquoi certains nœuds dominent le prompt. Elles complètent les logs et les modals de la session LangGraph pour garder la mémoire contextuelle visible et configurable.
