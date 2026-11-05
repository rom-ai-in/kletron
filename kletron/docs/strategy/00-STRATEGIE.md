# 00 — Stratégie Kletron (miroir box, 5 nov 2026)
> Référence qui prime sur tout le reste. Source : 04-advisory/kletron/00-STRATEGIE.md (Numezis Business).

## 1. Les trois lignes
| Ligne | Rôle |
|---|---|
| Numezis | ERP SaaS suisse, son propre MCP |
| Numezis Advisory & Engineering | vend, installe, accompagne Kletron |
| Kletron | le produit |

## 2. Composants
1. **Kletron Agent** — fork d'Hermès Agent (Nous Research, MIT).
2. **Passerelle MCP client** — connecteurs, droits par groupe, validations, journal.
3. **Passerelle modèles** — LiteLLM → EveryWare (ELCA) ; clé + budget par employé.
4. **Console centrale** — config verrouillée, utilisateurs, journal.
5. **Bibliothèque de skills**.
6. **OpenShell** — isolation de chaque agent.

## 3. Une pile par client
Chaque client a sa pile complète sur sa VM chez ELCA. Répliquer un client = déployer une pile, pas paramétrer une base partagée.

## 4. Fork mince
Hermès ≈ 1 M lignes Python, versions très fréquentes → toucher le code le moins possible.
**Sans patch (extensions Hermès) :** config centrale verrouillée (la console sert l'URL de config distante), contrôle avant chaque outil, connexion d'entreprise, distribution des skills.
**Cinq patchs seulement :**
1. Marque Kletron.
2. Suppression des 300+ adresses Nous Research (box : 1 056 occurrences `nousresearch.com` dans 431 fichiers @ ea6b602, dont 255 sites runtime ; neutralisées à l'exécution par le patch 0002).
3. Verrouillage macOS et Windows (aujourd'hui Linux seulement).
4. Blocage du mode sans validation.
5. Panneau de validations dans l'application.
**Suivi amont :** rebase hebdomadaire ; correctifs sécurité sous 48 h.

## 5. Passerelle MCP client
Construite à neuf. Copie unique du code éprouvé de l'ERP (connecteurs bexio, Abacus, Odoo, Microsoft 365, Google ; droits par ressource ; exécution validée — voir 04-SOURCES-A-PORTER.md), puis zéro dépendance à l'ERP.

## 6. Dépôts proposés (non créés)
- `kletron-agent` — fork Hermès + patchs + marque + Desktop — public (MIT)
- `kletron-platform` — passerelle MCP client, Console, LiteLLM, blueprints, OpenShell — privé
- `kletron-skills` — bibliothèque SKILL.md — privé
- `rom-ai-in/kletron` — v1 à archiver (`v1-final`)
Org GitHub : **à décider**. Kletron v1 TypeScript (`rom-ai-in/kletron`, dernier commit 4 juin 2026) : archivé.

## 7. Offre
Advisory vend l'installation, l'accompagnement et l'exploitation d'une pile Kletron par client (hébergée chez ELCA, modèles EveryWare). Pas de dépendance à l'ERP Numezis.

## 8. Roadmap (estimations)
| Phase | Dates | Fini quand |
|---|---|---|
| 0 Fondations | 9–13 nov | dépôts créés, fork compilé, marque Kletron appliquée, suivi amont scripté |
| 1 Démo ELCA | 16–27 nov | un employé lit bexio depuis Kletron Desktop, sur EveryWare, et l'appel apparaît au journal |
| 2 Gouvernance | → 18 déc | validations, droits par groupe, écritures, verrouillage OK et testés |
| 3 Industrialisation | janvier | nouveau client déployé en < 1 jour |
| 4 Exploitation | ensuite | suivi amont hebdo, sécurité < 48 h, clients multiples |

## 9. Backlog
K1–K21 : voir 02-BACKLOG.md.
