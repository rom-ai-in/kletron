# 03 — Décisions
## Validées (Romain, 4–5 nov 2026)
- Kletron = fork d'Hermès Agent.
- Nom : Kletron.
- Passerelle MCP client distincte du MCP de l'ERP.

## PROPOSÉ — provisoire, à confirmer par Romain (5 nov 2026, 10:16 Europe/Zurich)
Romain : « J'en sais rien, tu fais tout ». Les choix ci-dessous sont appliqués **en local sur la box uniquement**. Aucun n'a d'effet externe tant que Romain ne les a pas confirmés.
| Sujet | Choix provisoire | Où c'est appliqué |
|---|---|---|
| Organisation GitHub | `kletron` (repli `kletron-ai`) | Rien n'est créé. Nom utilisé seulement dans les docs. |
| Modèle de fork | **Miroir** de NousResearch/hermes-agent + branche `upstream-base`. Pas de bouton « fork » GitHub. | `kletron-agent` : remote `upstream` en lecture seule, push désactivé |
| Marque | Renommage complet de l'affichage (CLI, Desktop, i18n, icônes) + `NOTICE` (origine, MIT, non-affiliation). Aucune demande à Nous Research. | patch 0001 |
| appId | `ch.numezis.kletron` (`-light` / `-bundled` pour les variantes). MSIX : `Numezis.Kletron*`. | patch 0002 (`product-identity.cjs`) |
| Visibilité du dépôt agent | Public **seulement après** le renommage complet de l'UI. Le build Desktop est maintenant prouvé sans « Hermes » visible. Restent le CLI Python et les messages du backend (voir STATUS-BOX). | — |
| Neutralisation Nous | Blocklist centrale (netguard Python + Electron). Aucun feed de mise à jour, aucune installation distante et aucune télémétrie par défaut. | patch 0002 |

## Règle de base amont (PROPOSÉ — provisoire, à confirmer par Romain)
- `upstream-base` = **dernier tag stable** de l'amont.
- **Exception sécurité** : si `main` porte un correctif de sécurité absent du tag, `upstream-base` passe sur **le commit de `main`** qui le contient, via `kletron/scripts/sync-upstream.sh <sha>`. On revient sur un tag stable dès qu'un tag inclut ce correctif.
- Appliqué le 5 nov 2026 : `upstream-base` passe de v0.22.7 (`b200f5bc6`) à **`ea6b60274f8a8a92652f62521368d9a43fd099cf`** (main du 5 nov 2026, 09:17 Europe/Zurich). Motif : correctifs deps, MCP et approval du 3 au 5 nov.

## Propositions (à valider)
- Fork mince (extensions + 5 patchs max). Aujourd'hui : 2 patchs.
- Une pile complète par client.
- Code ERP copié une seule fois dans la passerelle.
- Dépôt de l'agent public (après le renommage complet, voir plus haut).

## Ouvertes
- URL du feed de mise à jour Kletron (`KLETRON_UPDATE_URL`) et source d'installation (`KLETRON_INSTALL_SOURCE`). Vides tant que rien n'est décidé.
- Certificats de signature (Windows MSIX `OUT_OF_STORE_PUBLISHER` = encore « CN=Nous Research Inc. » dans `scripts/msix-shared.mjs` ; macOS notarisation).
