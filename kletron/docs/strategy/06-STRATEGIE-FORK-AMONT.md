# 06 — Stratégie fork / amont : suivre Hermès sans maintenir Hermès

> Rédigé le 5 nov 2026 (box, Europe/Zurich). Statut : **proposition**. Les décisions sont à valider par Romain (§12 et `03-DECISIONS-PROPOSITIONS-FORK.md`).
> `00-STRATEGIE.md` prime. Ce document la précise et ne la remplace pas. Les écarts relevés sont listés en §13.
> Les faits amont renvoient aux sources du §14. « Mesuré » veut dire mesuré sur la box le 5 nov, sur le clone `ea6b602` ou sur le dépôt de travail `kletron-agent`.

---

## 0. Résumé en une page

- **Objectif.** Kletron reçoit toutes les mises à jour d'Hermès Agent : fonctions, correctifs et sécurité. Nous ne maintenons que nos customisations.
- **Moyen.** Un fork *mince*. Le code amont n'est jamais réécrit. Nos changements sont rangés dans cet ordre de préférence :
  1. configuration ou extension officielle d'Hermès ;
  2. dépôt séparé ;
  3. transformation au build (rebrand, modèle VSCodium/Cursor : les sources ne sont jamais modifiées, une copie jetable l'est) ;
  4. patch cœur, en dernier recours.
  Les patchs cœur forment une *file* rejouée automatiquement sur chaque nouvelle base amont, avec un plafond strict.
- **Politique amont : on ne demande rien à Hermès.** Aucune PR, issue, e-mail ni demande de fonctionnalité vers Nous Research (décision Romain, 5 nov 2026). Tout ce qui nous manque est absorbé chez nous : extension, build, ou patch minimal. Si l'amont ajoute de lui-même un point d'extension équivalent, le patch est retiré à la sync (§6.3).
- **Découverte clé de cette revue.** L'amont expose plus de points d'extension que prévu : packs de langue avec surcharge de l'anglais, skins CLI, SDK de plugins Desktop (panneaux, pages, barre d'état), *approval transports*, hooks `pre_tool_call` et `pre_approval_request`, config distante avec verrous. Cela permet de **sortir de la file le panneau de validations (0005)**. Le renommage de l'interface (K3) sort lui aussi de la file : il est fait **au build** (§3.4), comme VSCodium et Cursor sur VS Code. Objectif : 3 à 4 patchs cœur durables au lieu de 5.
- **Promesse réaliste.** La maintenance n'est pas nulle, mais elle reste bornée : **2 à 4 h par semaine en régime normal**, 6 à 10 h une semaine d'incident. Au-delà, des signaux d'alerte se déclenchent (§10) et un plan de sortie est prévu (§9).
- **Risque n° 1.** L'amont va *très* vite : la « patch release » v0.22.6 contient 3 448 commits et +248 579/−94 077 lignes, et les internes ont été réorganisés en septembre 2026. Nos patchs doivent donc toucher le moins de lignes possible, et seulement des points stables.

---

## 1. Principe et promesse réaliste

### 1.1 Ce qu'on obtient gratuitement
- **Toutes les fonctions et tous les correctifs d'Hermès** : agent, outils, passerelle, Desktop, modèles, packaging. Il suffit de changer la base (`UPSTREAM_REF`) et de rejouer la file. La synchro mesurée vers `ea6b602` prend 4,7 s quand il n'y a pas de conflit.
- **La suite de tests amont** : environ 7 268 fichiers de tests, soit 1,59 M de lignes de tests mesurées. C'est notre filet de non-régression principal, et nous ne l'écrivons pas.
- **Le contrat de compatibilité des plugins** (source [S4]). Les méthodes `PluginContext` documentées ne sont ni supprimées ni renommées. Les payloads de hooks n'évoluent que par ajout de mots-clés. Toute dépréciation exige un avertissement et **au moins deux versions mineures** de recouvrement. Tout ce que nous plaçons en extension (§2) profite de cette stabilité contractuelle, ce qui n'est pas le cas d'un patch.
- **La sécurité amont** : SECURITY.md, GHSA, lots de dépendances. Nous les recevons au rythme de l'amont, plus notre délai de 48 h.

### 1.2 Ce qui coûte
| Poste | Fréquence | Coût estimé |
|---|---|---|
| Sync hebdo sur tag stable : script, CI, revue du rapport de gouvernance, release | 1 fois par semaine | 1 à 2 h si aucun conflit |
| Rafraîchir un patch en conflit | ~1 fois par mois par patch Desktop, plus rare côté Python (estimation) | 0,5 à 3 h par conflit |
| Chemin sécurité 48 h (backport ou saut de base) | ~1 à 2 fois par mois (164 commits sécurité amont sur 30 j, 0 GHSA publiée sur 30 j) | 1 à 3 h |
| Revue des alertes de gouvernance : nouvel hôte, nouvel outil, nouvelle télémétrie | à chaque sync | 0,5 à 1 h |
| Maintenance des extensions Kletron (plugins) | rare grâce au contrat de dépréciation amont | ~0,5 h par semaine en moyenne |
| Revue des nouveaux littéraux « Hermes » signalés par le rebrand au build (§3.4) | à chaque sync | 0 à 0,5 h (rapport + échec CI, une ligne par décision) |
| Temps machine CI : suite complète, builds Desktop 3 OS, signature | à chaque sync | coût en minutes Actions, à chiffrer |

**Budget cible : 2 à 4 h par semaine, moyenne glissante sur 4 semaines. Seuil d'alerte : plus de 6 h par semaine en moyenne sur 4 semaines (§10).**
Ce budget **n'inclut pas** le chantier initial K3 (renommage) ni le développement des briques Kletron hors fork (passerelle, console).

### 1.3 Ce que la stratégie ne promet pas
- Aucune mise à jour « sans regarder ». Chaque mise à jour passe par la CI et la gouvernance (§6 et §7). Sur un produit destiné à des clients, appliquer une version amont sans test serait une faute.
- Aucune garantie que l'amont ne cassera jamais un point d'extension. Il les protège par contrat ; nous les protégeons en plus par nos propres tests de contrat (§7, G5).
- Le fork ne sert pas de frontière de sécurité. SECURITY.md amont déclare que validations, masquage et Skills Guard sont des *heuristiques* et que seule l'isolation OS fait frontière [S7]. La vraie barrière reste **OpenShell + passerelle MCP** (00-STRATEGIE §2).

---

## 2. Où placer une customisation : hiérarchie et arbre de décision

### 2.1 Les quatre niveaux, par ordre de préférence
| Niveau | Mécanisme | Coût de maintenance | Exemples Kletron |
|---|---|---|---|
| **(a) Config / extension amont** | config distante `/v1/config/self` avec verrous [S2] · Managed Scope `/etc/hermes` [S3] · plugins Python : hooks `pre_tool_call`, `pre_approval_request`, `post_approval_response`, middleware, `register_approval_transport` [S4][S5] · **SDK plugins Desktop** (panneaux, pages, barre d'état, palette) [S6] · **packs de langue / surcharge `locales/en.yaml`** [S8] · **skins CLI** (`branding.agent_name`, `welcome`…) [S9] · distributions de profil [S10] | ≈ 0 (contrat de compatibilité amont) | config verrouillée (K11), contrôle avant outil (K8/K9), validation par un tiers via *approval transport*, panneau « Validations » en plugin Desktop, distribution des skills (K16), icônes via `--icons` |
| **(b) Dépôt séparé** | `kletron-platform`, `kletron-skills`, `kletron-plugins` (proposé) | le nôtre, sans conflit amont | passerelle MCP, Console, LiteLLM, blueprints, OpenShell, plugins Kletron |
| **(c) Transformation au build** | `kletron/build/rebrand/` : règles (`rules.yaml`) + décisions revues (`data-literals.txt`) appliquées à une **copie jetable** de l'arbre, jamais aux sources (§3.4) | faible : 0 conflit possible (aucune ligne amont modifiée) ; revue des nouveaux littéraux signalés à chaque sync | « Hermes » → « Kletron » dans toutes les chaînes affichées : CLI (`--help`, bannière, messages), Desktop (UI, page de crash, menus), logs, i18n |
| **(d) Patch cœur** | fichier dans `kletron/patches/`, rejoué à chaque sync | **élevé**, à chaque sync | identité produit (appId, productName, titre de fenêtre), neutralisation des points d'émission réseau Nous, verrou YOLO résiduel |

### 2.2 Arbre de décision
```
Besoin de customisation
│
├─ Q1. Une clé de config (distante ou managed) le couvre-t-elle ?
│      oui → (a) config, verrouillée si c'est un enjeu de gouvernance. STOP.
├─ Q2. Un point d'extension documenté le couvre-t-il ?
│      (hook, middleware, approval transport, plugin Desktop, pack de langue, skin, distribution)
│      oui → (a) plugin dans kletron-plugins + test de contrat (§7 G5). STOP.
├─ Q3. Le changement vit-il hors du processus agent ?
│      (passerelle, console, proxy modèles, sandbox)
│      oui → (b) kletron-platform / kletron-skills. STOP.
├─ Q4. Est-ce une réécriture textuelle de ce qui est AFFICHÉ (nom du produit, logo ASCII, préfixe de log) ?
│      oui → (c) règle de rebrand au build + test (§3.4). STOP.
├─ Q5. Est-ce une obligation légale, de marque ou de sécurité, impossible autrement ?
│      oui → (d) patch cœur, dans le budget (§3) et après revue (§3.5).
└─ sinon → on NE FAIT PAS. On l'inscrit au backlog, et on réexamine à chaque sync si l'amont a ajouté de lui-même une extension.
```

### 2.3 Critères qui excluent un patch cœur
Un patch est refusé si l'un des points suivants est vrai :
- il dépasse le budget de lignes (§3.2) ;
- il touche un fichier qui a changé dans plus de 3 des 4 derniers tags amont (fichier « chaud ») alors qu'une autre voie existe ;
- il réimplémente ou copie un fichier amont entier. Brave l'interdit explicitement : les copies figées vieillissent et rendent chaque rebase plus dur [S12] ;
- il n'a pas de test associé ;
- il modifie le comportement d'un test amont au lieu d'ajouter le nôtre.

### 2.4 Conséquence sur les cinq patchs prévus
| Patch prévu (00-STRATEGIE §4) | Placement recommandé | Patch cœur résiduel |
|---|---|---|
| 1. Marque | **rebrand au build** (§3.4) : ~8 000 remplacements dans ~1 240 fichiers de l'arbre jetable (Python, TS/TSX, YAML, HTML, JSON), i18n comprise | **oui, minimal** : ce qui n'est pas une chaîne affichée — `productName`, appId, alias console `kletron`, entrée `.desktop`, `NOTICE` (0001 : 7 fichiers, 33 lignes de contact) |
| 2. Domaines Nous | config (fournisseur Nous Portal désactivé et verrouillé, télémétrie off verrouillée) | **oui** : table d'endpoints unique + points d'émission runtime (≈ 20 à 30 sites selon le plan 0002), flux de mise à jour Desktop et CLI |
| 3. Managed Scope macOS/Windows | **(d) patch 0003** : logique dans un fichier nouveau (`kletron_managed.py`), crochet d'une ligne dans `get_managed_dir()` (documenté par l'amont comme « single seam for macOS / Windows » [S3]) | **oui, petit et durable** (rien n'est demandé à l'amont) ; retiré si l'amont implémente ces emplacements de lui-même |
| 4. Blocage YOLO | config verrouillée `approvals.mode` + plugin `pre_tool_call` côté passerelle | **peut-être** : seulement pour `--yolo`, `/yolo` et `HERMES_YOLO_MODE` si la config ne les couvre pas (à prouver par test) |
| 5. Panneau validations | **(a) plugin Desktop** (SDK : panneaux, pages, barre d'état) + **approval transport** [S5][S6] | **non** visé |

**Cible : 3 à 4 patchs cœur durables (0001 identité, 0002 neutralisation réseau, 0003 Managed Scope, 0004 verrou YOLO résiduel si la config ne suffit pas).** Le plafond de 5 reste une limite dure, pas un objectif à atteindre.

---

## 3. Règles du fork mince

### 3.1 Plafond de patchs
- **5 patchs cœur au maximum** dans `series` (00-STRATEGIE §4). Cette limite est déjà contrôlée par `governance.sh`.
- Les **backports de sécurité** temporaires (`9xxx-backport-*`, §5.2) ne comptent pas dans le plafond. Ils doivent être retirés à la sync suivante qui contient le correctif. Leur durée de vie maximale est de **14 jours**.

### 3.2 Budget de diff
Mesure : `git diff --numstat upstream-base kletron`, hors `kletron/` et hors workflow Kletron.
| Indicateur | Plafond | 5 nov, 10 h 40 (`dev`) | 5 nov, 13 h (renommage dans 0001) | **5 nov, 13 h 50 (rebrand au build)** |
|---|---|---|---|---|
| **Lignes de contact** : lignes +/− dans des fichiers amont *modifiés* | **≤ 400 au total, ≤ 150 par patch** | 152 | 86 | **73** (0001 : 33) |
| Fichiers amont modifiés | **≤ 40** | 47 ⚠️ | 15 | **11** (0001 : 7) |
| Lignes dans des fichiers **nouveaux** (`kletron_*`, NOTICE) | ≤ 1 500 | 648 (9 fichiers) | 1 132 (15) | **557 (9)** |
| Tests amont modifiés | **0 visé**, ≤ 5 tolérés | 9 ⚠️ | 0 | **0** |

→ Le renommage n'est plus dans la file : il est fait au build (§3.4). 0001 est passé de +607 à +32 lignes nouvelles.

Les lignes de contact coûtent cher, les fichiers nouveaux presque rien : un fichier qui n'existe pas en amont ne peut pas entrer en conflit. D'où la règle : **toute logique va dans un fichier nouveau** (`kletron_endpoints.py`, `kletron-identity.cjs`…). Le fichier amont ne reçoit qu'un *crochet* d'une à trois lignes (import + appel). Brave applique le même principe : « We aim to make the only patches required to be trivial changes, and not nested logic changes » [S12].

### 3.3 Interdits
1. **Renommer des modules, paquets, identifiants internes, variables d'environnement ou chemins** : `hermes_cli`, `HERMES_HOME`, `~/.hermes`, `hermes` comme commande, clés de config, noms de hooks. Ces noms ne sont pas visibles par l'utilisateur final, mais chaque renommage provoque des conflits à chaque sync. L'alias `kletron` de la commande est *ajouté* ; `hermes` est conservé.
2. **Reformater, réindenter ou réordonner** du code amont. Les formateurs amont (`ruff` / `prettier`) restent la référence.
3. **Déplacer, supprimer ou scinder un fichier amont**, y compris les 58 workflows amont : ils sont désactivés dans GitHub, pas supprimés (§6.6).
4. **Copier un fichier amont entier** pour le modifier.
5. **Modifier un test amont** pour le faire passer. On ajoute un test Kletron. Si un test amont vérifie une chaîne de marque, il reste intact et passe sur l'arbre SOURCE (non renommé) ; sur l'arbre transformé, il est vérifié par l'arbre de vérification `--with-tests` (§3.4), jamais livré.
6. **Monkey-patcher l'amont à l'exécution** (`setattr` sur un module, remplacement de méthodes). L'amont dit explicitement que ce n'est pas un point d'extension supporté et le refuse dans son catalogue [S4].
7. **Supprimer massivement des références** : docs, `website/`, tests, commentaires. Elles ne sont pas distribuées dans le binaire et génèrent des conflits. Voir §13 pour l'écart avec « suppression des 300+ adresses ».

### 3.4 Rebrand au build (modèle VSCodium/Cursor)
**Principe.** VSCodium et Cursor ne patchent pas les chaînes de VS Code une à une : ils gardent les sources amont intactes, fournissent leur identité (`product.json`) et transforment l'arbre **au moment du build**. Kletron fait de même :
- **Patchs minimaux** : 0001 identité (l'équivalent de `product.json` : `productName`, appId, alias `kletron`, entrée `.desktop`, NOTICE) et 0002 neutralisation Nous. Aucune chaîne affichée n'est patchée dans les sources (contrôlé par `governance.sh` §6).
- **Transformation** : `kletron/build/rebrand/apply.py` exporte la ref (`git archive`) dans une copie jetable (`BUILD_DIR`, par défaut `/workspace/kletron/_out/tree`) et y réécrit uniquement les **littéraux affichés**. Refus d'écrire dans le dépôt.
  - Python : tokenisation (`tokenize`) ; docstrings = affichées (`--help`, schémas d'outils).
  - TS/TSX : AST du compilateur TypeScript (`ts-literals.cjs`) ; texte JSX, chaînes, gabarits ; les regex sont des *consommateurs* (règle `regex-accepts-both` : elles acceptent `Kletron|Hermes`).
  - YAML (catalogues i18n `locales/*.yaml`) : valeurs seulement ; JSON listés (installeur, `intro-copy.jsonl`) : valeurs seulement ; HTML : texte hors balises.
  - Logo ASCII (`blocks`, ligne à ligne), préfixe de log `[hermes]` → `[kletron]`.
- **Ce qui n'est jamais réécrit** : identifiants (`hermes_cli`, `HERMES_HOME`, la commande `hermes`, `~/.hermes`), modèles « Hermes 3/4 », attribution « based on Hermes Agent by Nous Research », et les **littéraux de données** (comparaisons, clés, `startswith`, chemins, regex brutes…). Ces derniers sont sautés et listés ; chacun reçoit une décision revue `keep | rewrite` dans `kletron/build/rebrand/data-literals.txt` (empreinte fichier + raison + texte). Exemple : un consommateur dont le producteur est renommé au build doit suivre (`rewrite`).
- **Fichiers** : `rules.yaml` (périmètres, exclusions, règles, liste keep), `data-literals.txt` (décisions), `kletron/build/scan-allow.txt` (liste blanche du scan des artefacts), `kletron/build/build.sh` (chaîne complète), `scan.py`, `help-dump.py`.

**Contrôles (tous bloquants dans `build.sh` et la CI, avant le pack)** :
1. `apply.py --check` : exit 2 si un littéral de données « Hermes » n'a pas de décision (**nouvelle chaîne amont non couverte**) ou si une décision ne correspond plus à rien (périmée).
2. Idempotence : une 2e passe sur l'arbre transformé = 0 remplacement. Déterminisme : un 2e export donne le même `rebrand-manifest.sha256` (aucun horodatage, tri stable).
3. Scan des **artefacts** (`scan.py`) : aide de **chaque** sous-commande (`help-dump.py`, 436 parseurs), `locales/`, contenu du `app.asar` packé → 0 « Hermes » visible hors liste blanche.
4. Tests amont sur l'arbre **source** (inchangé) ; sur l'arbre transformé : smoke CLI (`kletron --version`, `--help`, imports depuis l'arbre transformé), smoke Desktop (démarrage, titre, captures), et arbre de vérification `apply.py --with-tests` (tests amont renommés eux aussi, jamais livré) pour un sous-ensemble.

**Procédure à chaque sync** (après `sync-upstream.sh`, §6.2) :
1. `kletron/build/build.sh`. S'il passe : rien à faire.
2. `UNREVIEWED <fichier>:<ligne> [raison] '<texte>'` : nouveau littéral de données amont. Lire le code : si la valeur est comparée à une donnée externe non renommée (fichier écrit par un script amont, API), `keep` ; si son producteur est renommé au build, `rewrite`. Ajouter la ligne (copier l'empreinte du rapport `rebrand-report.json`) avec un « pourquoi ».
3. `STALE` : la ligne amont a changé ou disparu → supprimer ou remplacer la décision.
4. Hit du scan d'artefacts : chaîne affichée hors périmètre (nouveau dossier, nouveau format) → élargir `rules.yaml` (périmètre ou règle) et ajouter un cas à `kletron/tests/py/test_rebrand.py` ; ou, si la mention est légitime (attribution, modèle), ajouter un motif commenté à `scan-allow.txt`.
5. Relancer `build.sh` jusqu'à `BUILD: ALL PASS`, puis consigner le nombre de décisions ajoutées dans le rapport de sync.

**Limites connues** : le nom de commande minuscule `hermes` (argparse `prog`, « `hermes setup` ») n'est pas réécrit, car il a des consommateurs (`_parser.py`, `left_core_migration.py`, `console_engine.py`) ; les deux binaires `hermes` et `kletron` sont installés. Les empreintes de décision sont volontairement grossières (fichier + raison + texte, sans numéro de ligne) : une décision suit la ligne quand le code bouge, mais deux littéraux identiques dans un même fichier partagent la même décision.

Critère d'acceptation K3 : aucune occurrence visible de « Hermes » sur les écrans des parcours de démonstration (accueil, onboarding, réglages, à propos, fenêtre, barre de tâches, page de crash, `--help`, `--version`), hors mention d'origine « basé sur Hermes Agent ». Preuve : `build.sh` (scans) + captures.

### 3.5 Revue obligatoire de tout nouveau patch ou de toute extension d'un patch
Une demande de patch est un document court, dans la PR ou dans `kletron/patches/<NNNN>.meta`, qui répond aux questions suivantes :
1. Pourquoi les niveaux (a), (b) et (c) ne suffisent pas. On cite le point d'extension examiné.
2. Le budget : lignes de contact, fichiers, fichiers « chauds » (`git log --oneline <4 derniers tags> -- <fichier>`).
3. Le test associé (Kletron) et le test de gouvernance mis à jour.
4. `Forwarded: not-needed` (politique : rien n'est demandé à l'amont, §8).
5. La décision : **OK Romain obligatoire** pour tout *nouveau* patch cœur. Pour une simple mise à jour d'un patch existant, la revue technique suffit.

---

## 4. Format de la file de patchs

### 4.1 Arborescence (dans `kletron-agent`, déjà en place pour l'essentiel)
```
kletron/
  UPSTREAM_REF            # repo, ref (tag), SHA du commit, SHA de l'objet tag annoté, date
  patches/
    series                # ordre d'application, un nom par ligne (format Electron .patches / quilt)
    0001-identity.patch   # git format-patch, en-têtes DEP-3 dans le message
    0002-nous-network.patch
    0004-yolo-lock.patch
    9001-backport-<sha12>.patch   # temporaire, §5.2
  patches.lock            # sha256 de chaque .patch + sha256 de l'arbre résultat (reconstruction vérifiable)
  governance/
    hosts-allowlist.txt   # hôtes réseau runtime revus (§7 G1)
    tools-snapshot.json   # inventaire outils / toolsets / classes d'approbation (G2)
    config-snapshot.json  # clés sensibles par défaut : approvals, telemetry, update, plugins (G3, G4)
    hooks-contract/       # plugins de test du contrat (G5)
    (G7 : voir kletron/build/rebrand/ et kletron/build/scan-allow.txt)
  scripts/ apply-patches.sh · sync-upstream.sh · export-patches.sh · check-upstream.sh (à créer) · health.sh (à créer)
  tests/   governance.sh (+ G1–G12)
  planned/ (plans non implémentés)
```
Ce format est inspiré d'Electron (`patches/<cible>/.patches` + `.patch`, outils import/export) [S13] et de Debian (quilt `series` + en-têtes DEP-3) [S14]. Electron explique ainsi pourquoi l'ordre est porté par un fichier `series` plutôt que par la numérotation seule : cela évite les collisions de numéros et le bruit lors d'insertions [S13]. Chez nous, la numérotation reste stable et `series` fait foi.

### 4.2 Métadonnées obligatoires par patch (en-têtes DEP-3 adaptés, dans le message du commit `kletron-patch:`)
```
Subject: kletron-patch: 0002 nous-network — neutralise les points d'émission réseau Nous
Description: <but, en 3 lignes max ; pourquoi aucune extension ne suffit>
Owner: <personne responsable>                      # propriétaire
Test: kletron/tests/test_nous_network.py ; governance G1, G3, G4
Forwarded: not-needed                               # politique Kletron : rien n'est demandé à l'amont (§8)
Upstreamable: no
Touches-hot-files: apps/desktop/electron/main.ts (3/4 derniers tags)
Budget: contact=+18/-6 files=7
Last-Update: 2026-11-05
Expires: <date ou "à la sortie de vX.Y.Z"> (obligatoire pour 9xxx-backport)
```
`governance.sh` doit refuser un patch dont l'en-tête `Owner`, `Test`, `Forwarded` ou `Upstreamable` manque.

### 4.3 Reconstruction déterministe
- La branche `kletron` est **toujours générée** à partir de `UPSTREAM_SHA`, de `series` et de l'overlay. Elle n'est jamais modifiée à la main : on modifie la file, puis on régénère. C'est déjà le cas avec `apply-patches.sh`, et l'idempotence est prouvée (arbre `945a2117…` identique sur deux reconstructions).
- **Déjà fait selon STATUS-BOX (10 h 41)** : les SHA des commits de patch sont eux aussi reproductibles (`e5e90217e` / `aa41c13a7` identiques sur deux reconstructions).
- **À ajouter** :
  - écrire `patches.lock` ;
  - faire vérifier par la CI que `hash(arbre reconstruit) == patches.lock`.
- La branche `upstream-base` = exactement `UPSTREAM_SHA`, jamais de commit Kletron dessus.
- Un tag amont n'est accepté que si l'objet tag annoté pointe vers le commit attendu (`git rev-parse vX.Y.Z^{commit}`). L'amont traite ses tags finaux comme des « receipts » immuables [S1].

---

## 5. Cadence

### 5.1 Sync hebdomadaire sur tag stable (mode normal)
- **Base = dernier tag `vX.Y.Z` publié**, jamais un tag `canary` ni un `rc.*` [S1].
- **Fenêtre de décantation de 48 h** après publication d'un tag avant de l'adopter, hors sécurité. Ce n'est pas théorique : v0.22.1 a été « built from the wrong commit » et remplacée par v0.22.2 [S11]. Si un nouveau tag sort pendant la fenêtre, on vise le plus récent, avec un nouveau délai de 48 h, plafonné à 7 jours de retard.
- **Une sync par semaine au plus**, même si l'amont publie plusieurs tags (par exemple deux tags le 21 oct).
- **Déclenchement : manuel**, jamais par une routine du bot (règle Numezis). Romain lance la sync, ou la demande au bot dans une session, ou déclenche le workflow `workflow_dispatch` « Kletron sync » quand la CI existera (§5.3).
- **Note** : la base actuelle est `ea6b602`, un commit de `main` adopté pour récupérer les correctifs sécurité du 3 au 5 nov. Elle doit **revenir sur un tag** (v0.22.8 ou suivant) à la première sync. Un `main` non taggé n'a pas passé le portail « Stable Release » amont (tests Docker, Nix, builds signés, upgrade) [S1].

### 5.2 Chemin sécurité en 48 h
Il se déclenche sur l'un de ces événements : GHSA ou CVE publiée sur hermes-agent ; release amont dont les notes contiennent « Security » ; commit `fix(security|approval|mcp|auth|sandbox)` ou lot `deps` de sécurité sur `main` ; alerte Dependabot ou OSV sur notre miroir.

| Cas | Action | Délai |
|---|---|---|
| Correctif contenu dans un **tag** publié | sync anticipée vers ce tag (sans décantation), procédure §6 complète | ≤ 48 h |
| Correctif **seulement sur `main`**, isolé (quelques fichiers) | **backport** : `git format-patch -1 <sha>` → `9001-backport-<sha12>.patch` avec `Origin: upstream, <URL commit>` et `Expires`, en fin de `series` ; CI complète | ≤ 48 h |
| Correctif sur `main`, **non isolé** (lot de dépendances, refactor) | **saut de base** vers le SHA de `main` qui le contient (ce qui a été fait le 5 nov), CI complète + smoke étendu ; retour sur tag à la sync suivante | ≤ 48 h |
| Vulnérabilité dans un de **nos** patchs ou extensions | correctif Kletron + release | ≤ 48 h |
| Pas de correctif amont disponible | mitigation par config verrouillée ou policy OpenShell/passerelle ; si nécessaire, correctif Kletron en backport `9xxx` (rien n'est demandé à l'amont) | ≤ 48 h pour la mitigation |

Le délai de 48 h court à partir de la *publication* du correctif amont, pas de sa découverte par nous. Une détection tardive doit être consignée.

### 5.3 Surveillance des releases et advisories, sans routine du bot
Options, de la moins à la plus automatisée :
1. **Notifications GitHub du compte de Romain** (zéro automation de notre part, recommandé dès maintenant) : *Watch → Custom → Releases + Security alerts* sur `NousResearch/hermes-agent`. GitHub envoie alors un e-mail à chaque release et à chaque avis.
2. **Script manuel `kletron/scripts/check-upstream.sh`** (lecture seule), lancé par Romain ou par le bot à la demande. Il affiche : dernier tag et sa date, nombre de commits `security|deps|fix(approval|mcp)` sur `main` depuis la base, GHSA du dépôt et de la base globale (`affects=hermes-agent`), alertes OSV sur nos lockfiles, et le retard sur l'amont.
3. **GitHub Actions `upstream-watch.yml`** (à valider, voir §13) : `schedule` hebdomadaire + `workflow_dispatch`. Il est **lecture seule** : pas de push ni de sync, et il ouvre seulement une *issue* dans `kletron-agent`. C'est une automation côté GitHub, pas une routine du bot, mais la règle du README (« Aucune automation ») l'exclut tant que Romain n'a pas tranché.
4. **Dependabot / OSV** sur le miroir, pour les alertes de dépendances (`uv.lock`, `package-lock.json`). À activer avec OK Romain lors de la création du dépôt.

---

## 6. Procédure de sync pas à pas

### 6.1 Préparation (≈ 10 min)
1. `check-upstream.sh` : choisir la cible (tag, ou SHA pour la sécurité) et lire les notes de release (`gh release view vX.Y.Z -R NousResearch/hermes-agent`).
2. Vérifier la cible : l'objet tag pointe vers le commit attendu, et celui-ci descend de la base actuelle (`git merge-base --is-ancestor`). **Une base qui recule est refusée** (§6.5).
3. Rapport d'impact (fourni par le script, lecture seule) : fichiers touchés par nos patchs et modifiés en amont entre les deux bases (`git diff --stat OLD NEW -- $(fichiers des patchs)`), changement de `LICENSE`, nouveaux workflows, diff des lockfiles.

### 6.2 Essai (≈ 5 min, déjà scripté)
4. `kletron/scripts/sync-upstream.sh <tag|sha>`. Il travaille sur des branches temporaires ; sur conflit, il sort avec le code 2 et ne modifie rien (prouvé).
5. Si le code de sortie vaut 0, `UPSTREAM_REF` et `upstream-base` sont mis à jour et `kletron` est reconstruite.

### 6.3 Gestion des conflits
6. Pour chaque patch en conflit, dans l'ordre de `series` :
   - `git checkout -b refresh/<NNNN> <nouvelle-base>` puis `git am --3way` des patchs précédents, puis du patch en conflit ;
   - on résout **en gardant l'intention du patch, pas son texte**. Si l'amont a déplacé le code, on suit le déplacement ; si l'amont a supprimé la fonction, on se demande d'abord si le patch est encore utile (méthode Brave [S15]) ;
   - **si l'amont a désormais un point d'extension équivalent, le patch est supprimé et remplacé par une extension** : c'est le meilleur résultat possible ;
   - `git am --continue`, `export-patches.sh`, mise à jour des en-têtes (`Last-Update`, `Budget`).
7. On relance `sync-upstream.sh`.
8. **Temps passé** : au-delà de 3 h sur un seul patch, on s'arrête et on escalade (§10). Le patch devient candidat à la réécriture en extension ou en règle de build (§3.4).

### 6.4 Tests et critères go/no-go
| Étape | Commande / job | Critère GO |
|---|---|---|
| T1 File de patchs | `governance.sh` (série, reproductibilité, plafonds, en-têtes) | ALL PASS |
| T2 Gouvernance risques | G1 à G12 (§7) | ALL PASS ; tout FAIL est soit corrigé, soit accepté *explicitement* par écrit (allowlist mise à jour + justification) |
| T3 Suite amont complète | `scripts/run_tests.sh` (toute la suite, CI) | **0 échec nouveau** par rapport au même tag amont sans patchs (baseline). Un test qui échoue aussi en amont est noté, non bloquant |
| T4 Tests Kletron | tests des patchs + contrats d'extension (G5) | 100 % verts |
| T5 JS / Desktop | `npm ci`, `npm test`, `npm run build`, `npm run pack` (Linux), builds macOS/Windows en CI | verts ; `app-update.yml` pointe vers l'org Kletron ou n'existe pas |
| T6 Smoke Desktop | lancement, écran d'accueil, connexion à une passerelle Kletron de test, appel d'outil bloqué par `pre_tool_call`, demande de validation | captures sans « Hermes » visible (G7) ; aucun trafic vers un hôte hors allowlist (G1 runtime) |
| T7 Smoke CLI | `kletron --version`, `--help`, une session avec config distante verrouillée, tentative `--yolo` | refus attendu, version correcte |
| T8 Revue humaine | rapport de sync (§10) lu par Romain **pour toute release client** | OK écrit |

**NO-GO** dans l'un de ces cas : un FAIL G1/G3/G4/G5 non accepté, un échec nouveau dans T3, un dépassement de plafond (§3), une base qui recule, ou un `LICENSE` amont modifié (→ §11, analyse avant toute adoption).

### 6.5 Rollback
- **Avant release** : on ne fait rien. `sync-upstream.sh` ne modifie rien en cas d'échec. Après succès, on revient avec `git checkout <ancien UPSTREAM_REF>` puis `apply-patches.sh` ; la branche précédente est conservée sous `kletron-prev`.
- **Après release** : les updaters amont comparent des *versions*, pas des URL [S1], et ne redescendent pas tout seuls. **Un rollback client = republier le code précédent sous un numéro de version supérieur** (`…-k.N+1`). Les artefacts signés de chaque release sont conservés au moins 90 jours.
- **Données** : avant de publier, on vérifie que la nouvelle version ne fait pas de migration irréversible de l'état (`state.db`, config). Les notes amont « migration » / `hermes migrate` sont lues en T8. Si une migration existe, on ne publie qu'avec un test d'upgrade *et* de retour.

### 6.6 Workflows amont dans notre miroir (au moment du premier push, avec OK Romain)
- Les 58 workflows amont **ne sont pas supprimés** (interdit n° 3). Ils sont désactivés (`gh workflow disable`) et le token par défaut est en **lecture seule** au niveau org.
- **Aucun secret** au niveau dépôt. Les secrets de signature et de release vivent dans un *environment* `release` protégé, avec Romain comme approbateur requis.
- G9 détecte chaque nouveau workflow amont à la sync, pour le désactiver avant push.
- Point de vigilance : un workflow `on: push` nouvellement apparu peut se déclencher au push même qui l'introduit. Sans secrets et avec un token en lecture seule, ce déclenchement est inoffensif ; il ne devient dangereux que si ces deux garde-fous manquent.

### 6.7 Versionnage Kletron
**Contrainte découverte** : en SemVer, la métadonnée de build (`+k1`) est **ignorée pour l'ordre de précédence**. Pour un updater, `0.22.7+k1` et `0.22.7+k2` sont donc *égaux* et un correctif Kletron ne serait pas proposé. De plus, l'amont fige `0.0.0` dans le dépôt et dérive la version au moment de la release [S1]. MSIX exige en outre un quadruplet numérique.
Proposition (décision D6) :
- **Version de paquet** = `X.Y.Z-k.N`, X.Y.Z étant le tag amont de base et N le compteur Kletron sur cette base (1, 2, 3…). L'ordre est strictement croissant : `0.22.7-k.1 < 0.22.7-k.2 < 0.22.8-k.1`. Kletron ne publie jamais de `X.Y.Z` nu, donc pas de collision avec l'amont. L'updater Kletron doit être configuré pour accepter ces versions comme stables (à vérifier en T5 sur electron-updater et sur le quadruplet MSIX : `X.Y.Z*100+N`).
- **Libellé humain** : « Kletron 0.22.7-k.2 (base Hermes Agent v0.22.7, b200f5bc) » dans `--version` et À propos.
- **Tag Git Kletron** : `kletron-v0.22.7-k.2`, annoté, avec `UPSTREAM_SHA`, `patches.lock` et le rapport de sync. Ce préfixe évite tout conflit avec les tags `v*` amont (nous ne poussons pas les tags amont, `tagopt --no-tags` est déjà configuré).
- Alternative : une numérotation Kletron indépendante (`1.4.0`), comme Brave par rapport à Chromium, avec la base amont en métadonnée. Elle est plus simple côté updater, mais moins lisible pour savoir « quelle version d'Hermès ». À trancher (D6).

---

## 7. Tests de non-régression gouvernance (une MAJ amont réintroduit-elle un risque ?)

Principe : chaque contrôle compare la **nouvelle base** à un **instantané revu** (`kletron/governance/*`). Toute nouveauté fait **FAIL** tant qu'un humain ne l'a pas classée. Le but n'est pas de juger l'amont, mais d'empêcher qu'une nouveauté passe sans être vue. Le contrôle négatif (gouvernance FAIL sur l'amont brut) est déjà prouvé et doit être conservé pour chaque G.

| ID | Risque réintroduit | Détection statique (sur l'arbre) | Détection dynamique (smoke) |
|---|---|---|---|
| **G1** | Nouvelle URL ou hôte Nous, ou tout nouvel hôte réseau runtime | extraction des hôtes (`https?://…`, chaînes de domaines) dans le code runtime (Python hors `tests/`, `apps/*/src`, `apps/*/electron`, configs par défaut), hors `website/` et docs ; diff avec `hosts-allowlist.txt` ; tout `*.nousresearch.com` hors liste de neutralisation → FAIL | lancement CLI et Desktop dans un namespace réseau où seul le loopback et la passerelle de test sont joignables ; journal netguard / proxy : **0 tentative** hors allowlist |
| **G2** | Nouvel outil, toolset ou mode qui contourne la validation (« nouveau YOLO ») | instantané `tools-snapshot.json` : noms d'outils, toolsets, classe d'approbation ; recherche des nouveaux symboles `yolo|bypass|auto_approve|skip_approval|dangerously|--no-confirm`, des nouvelles variables `HERMES_*` liées aux approbations, des nouveaux slash-commands ; diff des valeurs `approvals.*` et `security.*` dans `config_defaults.py` | session avec config verrouillée `approvals.mode=manual` : `--yolo`, `/yolo`, `HERMES_YOLO_MODE=1`, `approvals.mode off` → tous refusés ou sans effet ; un outil dangereux déclenche toujours la validation |
| **G3** | Nouvel auto-update ou téléchargement amont | recherche de `autoUpdater`, `electron-updater`, `app-update.yml`, `OFFICIAL_REPOSITORY`, `_PUBLIC_BASE` (`hermes_cli/source_releases.py`), `releases/latest`, `release-candidates.json`, des URL d'installeur et de nouvelles sous-commandes `update` ; appartenance au dépôt `NousResearch/*` → FAIL | dans l'artefact packagé : `resources/app-update.yml` absent ou propriétaire = org Kletron ; `kletron update --plan` ne vise ni GitHub Nous ni le R2 Nous ; l'installation locale du Desktop ne télécharge rien d'amont |
| **G4** | Nouvelle télémétrie, analytics ou rapport de crash | instantané des clés `telemetry|metrics|analytics|crash|usage|shared_metrics|sentry|posthog` et de leurs valeurs par défaut (doivent rester `false`) ; diff `package.json` / `pyproject` / lockfiles pour de nouveaux SDK (`@sentry/*`, `posthog*`, `segment`, `mixpanel`, `amplitude`, `datadog`, `opentelemetry` exporteurs) | G1 runtime : aucune requête vers `telemetry.*` ni vers un endpoint d'analytics |
| **G5** | Changement de contrat des hooks et extensions dont Kletron dépend | `VALID_HOOKS` contient toujours `pre_tool_call`, `pre_approval_request`, `post_approval_response` ; signatures documentées inchangées ; le client config distante appelle toujours `/v1/config/self?profile=` ; `register_approval_transport` existe ; contrat du SDK Desktop (version du module `@hermes/plugin-sdk`) ; les avertissements de dépréciation amont mentionnant nos API → FAIL (on a deux mineures pour migrer [S4]) | plugins de test `hooks-contract/` chargés dans un `HERMES_HOME` isolé, sur le modèle des « frozen external-plugin fixtures » de l'amont [S4] : un `pre_tool_call` bloque `terminal` **en mode normal, YOLO, cron, sous-agent, passerelle** ; un hook trop lent bloque (fail-closed documenté [S5]) ; **cas connu : une exception dans le dispatcher ne bloque pas** (`_pre_tool_block_message` : « failures never block », mesuré) → nos plugins ne doivent jamais lever d'exception, ce que vérifie un test dédié ; les verrous de config distante sont respectés |
| **G6** | Verrouillage contournable | — | `kletron config set <clé verrouillée>` échoue ; un overlay utilisateur ne surcharge pas une clé verrouillée ; Managed Scope : permissions des fichiers |
| **G7** | Marque visible et réintroduction d'« Hermes » | `productName`, `appId`, `desktopName` ; `apply.py --check` (nouveau littéral de données sans décision, décision périmée) ; scan de l'arbre transformé et des artefacts (`build.sh` : aide de chaque sous-commande, `locales/`, `app.asar`) avec `scan-allow.txt` | smoke Desktop + captures (accueil, page de crash), `kletron --help` |
| **G8** | Licence et attribution | `LICENSE` identique à l'amont (existant), `NOTICE` présent (existant) ; **diff du `LICENSE` amont entre les deux bases** → FAIL bloquant (§9, R2) ; nouveaux fichiers `LICENSE*` / `COPYING` / en-têtes SPDX non MIT dans l'arbre amont → revue | — |
| **G9** | Nouveaux workflows ou nouvelle CI amont | liste `.github/workflows/*` comparée à l'instantané → les nouveaux sont à désactiver avant push | — |
| **G10** | Nouveaux points d'entrée ou services | diff des `console_scripts` / entry points, des unités systemd/launchd générées, des ports d'écoute par défaut, des routes HTTP publiques de la passerelle | `ss -ltn` après démarrage : ports attendus seulement |
| **G11** | Nouveau plugin intégré chargé hors allow-list | l'amont charge automatiquement les plugins « bundled always-works » (plateformes, backends, fournisseurs de modèles) [S5] → instantané de `plugins/` intégrés ; tout nouveau → revue ; `~/.hermes/hooks/` (fiable par simple présence [S5]) placé sous Managed Scope / OpenShell | — |
| **G12** | Dépendances et supply chain | diff des lockfiles avec liste des paquets nouveaux ou majeurs ; `osv-scanner` ; SBOM CycloneDX par release ; règles de pinning amont respectées (CONTRIBUTING §dépendances [S16]) | — |

Implémentation : `kletron/tests/governance.sh` est étendu, ou mieux, découpé en `kletron/tests/gov_*.sh|py` appelés par la CI job `patch-queue`. **Ces fichiers sont des fichiers nouveaux**, donc ils n'entrent pas dans le budget de contact.

---

## 8. Politique amont : on ne demande rien à Hermès

Décision de Romain (5 nov 2026) : **aucune PR, issue, demande de fonctionnalité ni prise de contact vers Nous Research.** Kletron consomme l'amont tel qu'il est publié. Conséquences :
- Ce que l'amont ne paramètre pas est absorbé chez nous, dans cet ordre : extension documentée (§2, niveau a), transformation au build (§3.4, niveau c), patch minimal dans un fichier nouveau avec crochet d'une à trois lignes (niveau d).
- En-têtes DEP-3 : `Forwarded: not-needed`, `Upstreamable: no`, pour tous les patchs.
- À chaque sync, on vérifie si l'amont a **de lui-même** ajouté un point d'extension qui rend un patch inutile ; si oui, le patch est retiré (§6.3). C'est la seule voie de réduction de la file qui ne dépend pas de nous.
- Les anciens candidats « à proposer en amont » sont traités ainsi : identité paramétrable et chaînes codées en dur → rebrand au build (fait) ; Managed Scope macOS/Windows → patch 0003 durable ; endpoints réseau et auto-update → 0002 + config ; option « interdire YOLO » → config verrouillée + plugin, patch 0004 seulement si nécessaire.

---

## 9. Registre des risques

P = probabilité, I = impact (F faible, M moyen, É élevé).

| # | Risque | P | I | Mitigation | Signal d'alerte |
|---|---|---|---|---|---|
| R1 | **L'amont change d'architecture** (réorganisation des modules, réécriture du Desktop) | **É** (déjà arrivé : découpage des modules de sept. 2026, chemins d'import retirés [S4]) | M→É | crochets de 1 à 3 lignes, logique dans des fichiers nouveaux, extensions sous contrat ; lecture des notes de version en §6.1 | un patch en conflit 2 syncs de suite ; > 3 h sur un patch |
| R2 | **Changement de licence** (vers non-MIT ou source-available) | F–M | É | le code déjà publié sous MIT le reste ; G8 bloque l'adoption automatique ; gel sur la dernière base MIT (plan de sortie A) | diff `LICENSE`, CLA ajouté, nouvelle politique |
| R3 | **Abandon ou fort ralentissement** du projet | F (≈ 2 500 contributeurs sur v0.22.0 [S11]) | É | plan de sortie B (hard fork) ; nos briques critiques sont hors fork | aucun tag en 30 j, chute de l'activité, départ des mainteneurs |
| R4 | **Les hooks ou extensions cassent** | M | É (gouvernance) | contrat amont + deux mineures de dépréciation [S4] ; G5 ; la sécurité ne repose pas sur les hooks (OpenShell + passerelle) | FAIL G5, avertissement de dépréciation |
| R5 | **Rythme trop rapide** (365 commits en 2 j ; patch releases de +248 k lignes [S11]) | **É** | M | un tag par semaine au plus, décantation 48 h, suite amont complète comme filet, fichiers « chauds » évités | retard > 2 tags, temps de sync > budget |
| R6 | **Marque / trademark** (« HERMES AGENT » USPTO 50111354 en instance ; précédent F-Droid) | M | É (juridique / commercial) | renommage complet visible, NOTICE de non-affiliation, aucun logo Hermès ; dépôt public seulement après K3 ; avis juridique (§11) | demande de Nous ; résidus G7 |
| R7 | **Dépendances vulnérables** | É | M–É | lots sécurité amont + chemin 48 h + OSV / Dependabot | alerte OSV / GHSA |
| R8 | **Supply chain** (tag amont compromis, dépendance malveillante, plugin du catalogue) | F–M | É | vérification de l'objet tag et du commit, lockfiles, `npm ci` / `uv sync --locked`, SBOM ; **installation de plugins du catalogue désactivée ou verrouillée** côté clients ; aucun secret dans les workflows amont | hash inattendu, nouveau paquet installé par `postinstall` |
| R9 | **Auto-update vers Hermès** (Desktop `app-update.yml`, `hermes update`, installeur local) | **É** (P0 actuel, mesuré) | É | 0002 + G3 statique et dynamique ; `source_releases.py` : un fork GitHub suit *ses propres* releases (« GitHub forks own their releases », mesuré) → nos releases sur l'org Kletron | FAIL G3 |
| R10 | **Divergence du Desktop** (surface la plus mouvante : ~3 173 « Hermes », Electron 44) | É | M | rebrand au build (0 ligne amont modifiée) + SDK de plugins Desktop au lieu de patchs ; aucun JSX modifié | conflits 0001 répétés ; hausse des décisions de rebrand par sync |
| R11 | **Télémétrie réactivée ou ajoutée** | F–M | É (clients suisses / LPD) | défauts verrouillés, G4, G1 runtime | FAIL G4 |
| R12 | **Fausse sécurité** (hooks fail-open sur exception, Managed Scope « advisory » [S3]) | M | É | défense en profondeur : OpenShell + passerelle MCP + droits ; plugins qui ne lèvent jamais d'exception ; tests G5 / G6 | incident, test G5 rouge |
| R13 | **Coût de la CI amont** (suite complète, builds 3 OS signés) | M | M | baseline + suite complète au moins 1 fois par sync ; sous-ensemble ciblé en itération | durée CI > 2 h, factures Actions |
| R14 | **Dépendance à une seule personne** | É | É | doc + scripts (ce document, SETUP-LOCAL), procédures rejouables par le bot à la demande | sync non faite 2 semaines |

### Plan de sortie
- **A. Gel** sur la dernière version saine. Déclencheurs : R2, une rupture majeure non absorbable, ou un budget dépassé 4 semaines de suite. Pendant le gel, on ne fait que des backports de sécurité (`9xxx-backport`) et on réévalue chaque mois. Durée maximale raisonnable : **3 mois** avant de choisir entre B et un retour au suivi.
- **B. Hard fork.** Déclencheurs : R3, ou R2 sans retour possible. On reprend la maintenance nous-mêmes, ce qui contredit l'objectif de Romain. On l'acte comme un changement de stratégie avec un chiffrage (équipe, coût). Alternative à évaluer en même temps : changer de base d'agent, puisque nos briques critiques (passerelle, console, skills, OpenShell) sont déjà hors fork.
- **Pré-requis dès aujourd'hui** pour que A et B soient possibles : clone **complet** (non shallow) archivé, miroir de chaque tag adopté, artefacts signés conservés, et dépendances reconstructibles hors ligne (cache `uv` / `npm`, à évaluer).

---

## 10. Indicateurs de santé du fork

Produits par `kletron/scripts/health.sh` (à créer, lecture seule) à chaque sync et joints au rapport.

| Indicateur | Vert | Orange | Rouge (escalade Romain) |
|---|---|---|---|
| Patchs cœur dans `series` | ≤ 3 | 4–5 | > 5 (interdit) |
| Backports `9xxx` actifs | 0 | 1–2, < 14 j | > 2 ou > 14 j |
| Lignes de contact (+/−) | ≤ 250 | 251–400 | > 400 |
| Fichiers amont modifiés | ≤ 25 | 26–40 | > 40 (**état actuel 11**) |
| Tests amont modifiés | 0 | 1–5 | > 5 |
| Temps de sync (humain, conflits compris) | ≤ 2 h | 2–6 h | > 6 h, ou > 6 h/sem en moyenne sur 4 sem |
| Conflits par mois | 0–2 | 3–5 | > 5, ou le même patch 2 syncs de suite |
| Retard sur l'amont (tags stables) | ≤ 1 tag et ≤ 7 j | 2 tags ou ≤ 14 j | > 2 tags ou > 14 j |
| Correctif sécurité amont non intégré | 0 | — | tout correctif > 48 h |
| Gouvernance G1–G12 | ALL PASS | exceptions acceptées ≤ 2 | FAIL non traité |
| Écart de tests vs baseline amont | 0 | — | ≥ 1 échec nouveau |
| Rebrand au build (`build.sh`) | ALL PASS, ≤ 5 décisions ajoutées | 6–20 décisions ajoutées | FAIL non traité, ou > 20 décisions (refonte amont des chaînes) |

**Rapport à Romain** : une page en français par sync, dans `reports/sync-AAAA-MM-JJ.md`. Il contient : base avant → après, résumé des notes amont utiles, conflits et temps passé, résultats T1 à T8, indicateurs (couleur), décisions demandées (GO release ?). Un **bilan mensuel** donne la tendance des indicateurs, les décisions de rebrand ajoutées et les patchs supprimés ou ajoutés.

---

## 11. Juridique : licence MIT et marque

> Ce qui suit décrit des pratiques et signale des questions. **Ce n'est pas un avis juridique.** Les points marqués ⚖️ demandent un avis d'avocat (droit des marques CH / UE / US).

**Ce que nous faisons, déjà en place ou prévu :**
- **Aucun artefact signé ou publié au nom de Nous Research** : éditeur MSIX, Developer ID macOS, `desktopName`, propriétaire du feed de mise à jour. Aujourd'hui, `OUT_OF_STORE_PUBLISHER` = « CN=Nous Research Inc. » et `desktopName` = `com.nousresearch.hermes` (mesuré) : les deux sont à corriger avant toute build distribuée.
- **`LICENSE` amont intact** (MIT, « Copyright (c) 2025 Nous Research »), conservé dans le dépôt et **dans chaque binaire distribué**. Le MIT exige que la notice de copyright et la permission accompagnent « all copies or substantial portions ». À vérifier en T5 : la licence figure bien dans les artefacts Desktop, Docker et wheel.
- **`NOTICE`** : origine (NousResearch/hermes-agent), licence MIT, demande de marque « HERMES AGENT » USPTO 50111354, **non-affiliation** (« not affiliated with, endorsed by, or sponsored by Nous Research »). Déjà présent ; G8 le contrôle.
- **Le code Kletron ajouté** dans `kletron-agent` est sous MIT, cohérent avec un dépôt public. Les dépôts `kletron-platform` / `kletron-skills` sont privés et non concernés.
- **Aucun nom ni logo Hermès** dans le produit visible : nom, icônes, écran d'accueil, stores, site. Seule exception, la mention factuelle d'origine (« basé sur Hermes Agent de Nous Research ») dans À propos / NOTICE / README.
- **Aucun usage marketing** du nom Hermès ou Nous Research : pas de « Hermès entreprise », pas de logo dans les decks.
- **Identifiants techniques non visibles** (`hermes_cli`, `HERMES_HOME`, commande `hermes`) conservés pour la maintenabilité (§3.3).

**Questions pour un avis juridique ⚖️**
1. Le maintien des identifiants techniques internes contenant « hermes » (module, commande `hermes`, variables) dans un produit commercial distribué est-il acceptable vis-à-vis de la demande de marque ? (Notre hypothèse technique : oui, s'ils sont non visibles ou purement descriptifs ; à confirmer.)
2. Formulation exacte et emplacement de la mention d'origine et de non-affiliation : about, stores, contrats clients.
3. Portée de la demande USPTO 50111354 en Suisse / UE (aucune recherche faite ici), et risque sur le nom « Kletron » lui-même (recherche d'antériorité non faite).
4. Une autorisation écrite de Nous Research est-elle juridiquement nécessaire (option « c » de l'audit) ? Politique produit : on ne demande rien à l'amont ; le renommage complet au build vise à la rendre inutile. Question posée à l'avocat seulement.
5. Conditions du « Nous Portal » (§12.1, revendication des noms) : sans objet si le fournisseur Nous est désactivé, à confirmer.
6. Licences des dépendances tierces incluses dans les binaires (Electron, Chromium, Node, paquets Python et npm) : obligations d'attribution dans le paquet Desktop. Un générateur de notices tiers est à prévoir en CI.

---

## 12. Décisions à faire valider par Romain (avec recommandation)

| # | Décision | Recommandation |
|---|---|---|
| D1 | Adopter cette hiérarchie (a) config/extension → (b) dépôt séparé → (c) transformation au build → (d) patch, avec l'arbre §2.2 | **Oui** |
| D2 | Objectif de **3 à 4 patchs cœur durables** (0001 identité, 0002 réseau, 0003 Managed Scope, 0004 YOLO résiduel si nécessaire), 0005 remplacé par un plugin Desktop + approval transport ; plafond dur de 5 maintenu | **Oui** |
| D3 | Budget de diff : ≤ 400 lignes de contact, ≤ 40 fichiers amont modifiés, 0 test amont modifié visé ; **revue + OK Romain pour tout nouveau patch** | **Oui** (état : 11 fichiers, 73 lignes de contact, 0 test) |
| D4 | Rebrand **au build** (modèle VSCodium/Cursor, §3.4) : 0001 minimal + transformation d'une copie jetable, contrôles bloquants | **Fait** (Romain, 5 nov) |
| D5 | Cadence : sync **hebdo, manuelle**, sur **tag stable** avec décantation 48 h ; chemin sécurité 48 h (backport ≤ 14 j ou saut de base) ; retour sur tag dès v0.22.8 | **Oui** |
| D6 | Versionnage `X.Y.Z-k.N` (tag `kletron-vX.Y.Z-k.N`), ou numérotation Kletron indépendante | **`X.Y.Z-k.N`**, sous réserve du test updater / MSIX |
| D7 | Surveillance amont : (1) Watch GitHub Releases + Security sur le compte de Romain **maintenant** ; (2) script manuel ; (3) GitHub Action `upstream-watch` lecture seule (exception à la règle « aucune automation ») | **(1) + (2) maintenant** ; (3) à trancher |
| D8 | Politique amont (§8) : rien n'est demandé à Hermès | **Décidé** (Romain, 5 nov) |
| D9 | Demander un avis juridique sur les questions §11 avant le premier dépôt public / la première release client | **Oui** |
| D10 | Plan de sortie : clone complet archivé et miroir des tags dès la création des dépôts ; gel max 3 mois, puis décision hard fork ou changement de base | **Oui** |

---

## 13. Écarts et contradictions avec la documentation existante (non modifiée)

1. **« Suppression des 300+ adresses Nous Research » (00-STRATEGIE §4.2)** contre la stratégie ici, et le plan 0002 : on **neutralise** seulement les points d'émission réseau runtime (≈ 20 à 30 sites) et on ne touche ni aux docs ni aux tests, soit 767 des 1 037 occurrences sur v0.22.7. Une suppression totale contredirait le fork mince. Les chiffres diffèrent aussi : 300+ contre ~988 contre 1 037 à 1 056 mesurées.
2. **« Rebase hebdomadaire » (00 §4)** : on ne rebase pas une branche, on **régénère** `kletron` depuis la base et la file (déterministe). Le sens est le même, la méthode diffère ; à reformuler dans 00 si Romain valide.
3. **« Cinq patchs seulement » (00 §4)** : l'amont offre des extensions qui couvrent 0005 (SDK Desktop + approval transport), probablement 0004 (config verrouillée + hook) ; le renommage de 0001 passe au build (§3.4). La cible devient 3 à 4. Ce n'est pas une contradiction de fond, mais la liste de 00 n'est plus la meilleure répartition.
4. **README, règle « Aucune automation : tout est lancé manuellement par Romain »** contre le besoin de surveillance et la CI : une CI sur push, des builds et une Action `schedule` sont des automations GitHub. La CI déclenchée par un push manuel est compatible ; une veille planifiée ne l'est pas sans exception explicite (D7). Il y a aussi une tension de fond : Romain ne veut pas maintenir lui-même, mais tout doit être lancé manuellement. Proposition : le bot exécute la sync quand Romain le demande en session.
5. **00 §8, « Phase 4 : suivi amont hebdo, sécurité < 48 h »** : le suivi sécurité est nécessaire **dès la Phase 1** (démo ELCA sur une base exposée). Le 5 nov, v0.22.7 manquait déjà 3 correctifs sécurité.
6. **00 §4, « Sans patch : config centrale verrouillée »** : en mode config distante, `/etc/hermes/config.yaml` (Managed Scope) est **ignoré** ; seuls les verrous du plan s'appliquent, et le `.env` managé reste actif [S2]. Managed Scope v1 est « advisory » si l'utilisateur a les droits d'écriture [S3]. Le patch 0003 (macOS/Windows) n'a donc de sens que si l'on utilise Managed Scope *en plus* ou *au lieu* de la config distante : **à clarifier dans l'architecture K11**.
7. **Base épinglée** : `upstream-base` = `ea6b602` (main non taggé). C'est conforme à la règle « tag stable sauf correctif sécurité » désormais inscrite en PROPOSÉ dans 03-DECISIONS (10 h 41), ce qui est cohérent avec §5.2 ici. SETUP-LOCAL §1 initialise encore `upstream-base` sur v0.22.7 (la sync vient ensuite) : il faut préciser que la base de référence est `UPSTREAM_REF`. Le retour sur tag (v0.22.8) reste à faire.
8. **Budget** : dépassé le matin du 5 nov (47 fichiers, 9 tests amont modifiés) par le renommage en édition directe ; résorbé par le rebrand au build (11 fichiers, 0 test, §3.2).
9. **Le versionnage `0.22.7+k1`** évoqué dans le brief ne fonctionne pas pour un updater (métadonnée de build ignorée) → D6.
10. `04-SOURCES-A-PORTER.md` existe depuis 10 h 41, mais seulement comme **squelette** (toutes les lignes « ? »). Sans incidence sur le fork.
11. **Répartition des patchs** : 03-DECISIONS place l'appId dans 0002 (`product-identity.cjs`), alors qu'ici l'identité produit est regroupée dans 0001. Il faut une seule source d'identité dans un seul patch, sinon les deux patchs touchent le même fichier et créent un conflit interne à la file. À arbitrer au prochain refresh.
12. **Signature MSIX** : `scripts/msix-shared.mjs` contient encore `OUT_OF_STORE_PUBLISHER` = « CN=Nous Research Inc. » (03-DECISIONS, Ouvertes). Il faut le traiter par une variable de build plutôt que par un patch, et le contrôler dans G7. Publier un paquet signé sous le nom de Nous serait aussi un problème de marque (§11).

---

## 14. Sources

Amont (doc au commit `ea6b602`, également lue sur la box dans `hermes-agent/website/docs/`) :
- [S1] Stable releases, versions, tags, receipts, `0.0.0` committé : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/developer-guide/stable-releases.md
- [S2] Remote Config (verrous ; Managed Scope ignoré en mode distant) : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/user-guide/remote-config.md · seam : …/website/docs/developer-guide/config-backend.md
- [S3] Managed Scope (limites v1, macOS/Windows « may come later ») : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/user-guide/managed-scope.md
- [S4] Build a Hermes Plugin : contrat de compatibilité, politique de dépréciation, découpage des modules de sept. 2026 : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/developer-guide/plugins/index.md
- [S5] Plugins (opt-in, allow-list, approval transports, hooks, `hook_callback_timeout` fail-closed, hooks passerelle fiables par simple présence) : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/user-guide/features/plugins.md · hooks : …/website/docs/user-guide/features/hooks.md · middleware : …/website/docs/developer-guide/middleware.md
- [S6] Desktop Plugin SDK : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/developer-guide/desktop-plugin-sdk.md
- [S7] SECURITY.md : https://github.com/NousResearch/hermes-agent/blob/main/SECURITY.md
- [S8] Language Packs (couches, surcharges partielles de l'anglais) : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/user-guide/features/language-packs.md
- [S9] Skins (branding CLI) : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/user-guide/features/skins.md
- [S10] Profile Distributions : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/website/docs/user-guide/profile-distributions.md
- [S11] Releases (v0.22.0 à v0.22.7, volumes, incident v0.22.1, canal stable) : https://github.com/NousResearch/hermes-agent/releases
- [S16] CONTRIBUTING (plugins standalone, « widen the generic plugin surface », pinning des dépendances, ratchet) : https://github.com/NousResearch/hermes-agent/blob/ea6b60274f8a8a92652f62521368d9a43fd099cf/CONTRIBUTING.md
- Mesures box : `reports/2026-11-05-phase0-audit.md`, `reports/2026-11-05-setup-proofs.md` ; code : `hermes_cli/source_releases.py` (l.16-17, 26), `agent/agent_runtime_helpers.py` (`_pre_tool_block_message`), `hermes_cli/managed_scope.py`.

Bonnes pratiques de forks en aval :
- [S12] Brave, patching et `chromium_src` (préférer les overrides, patchs triviaux, ne pas copier de fichiers entiers) : https://github.com/brave/brave-core/blob/master/docs/patching_and_chromium_src.md · best practices : https://github.com/brave/brave-core/blob/master/docs/best-practices/chromium-src-overrides.md (miroir lu : https://fossies.org/linux/brave-core/docs/best-practices/chromium-src-overrides.md)
- [S15] Brave, procédure de rebase Chromium (patchs qui échouent, fichiers déplacés ou supprimés) : https://github.com/brave/brave-browser/wiki/Chromium-rebases
- [S13] Electron, gestion des patchs (`.patches`, import/export, raison d'être dans le message de commit) : https://electronjs.org/docs/latest/development/patches · https://github.com/electron/build-tools
- [S14] Debian DEP-3 (en-têtes de patchs : Origin, Forwarded, Applied-Upstream, Last-Update) : https://dep-team.pages.debian.net/deps/dep3/
- [S17] VSCodium (produit configuré par `product.json` fusionné, patchs avec placeholders `!!APP_NAME!!`, build qui sort tôt s'il n'y a pas de nouvelle release amont) : https://github.com/VSCodium/vscodium/blob/master/prepare_vscode.sh · https://github.com/VSCodium/vscodium/blob/master/utils.sh · https://github.com/vscodium/vscodium/blob/master/README.md
- [S18] GitHub, visibilité des forks (un fork public reste public et partage le réseau) : https://docs.github.com/en/enterprise-cloud@latest/pull-requests/collaborating-with-pull-requests/working-with-forks/about-permissions-and-visibility-of-forks
