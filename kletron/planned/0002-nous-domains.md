# Patch 0002 — Neutralisation Nous Research (IMPLÉMENTÉ : patches/0002-nous-neutralize.patch, refonte 2026-11-05)

Principe : **à la source d'abord** (ce qui appelle réellement le réseau), garde de résolution en défense en profondeur.
Aucun client HTTP ni code amont n'est remplacé à l'exécution (docs/06 §3.3 règle 6) : seuls les résolveurs DNS
(stdlib Python, Node `dns`, Chromium `host-resolver-rules`) refusent les hôtes Nous — un hôte bloqué se comporte
comme un hôte inconnu, chemin « hors ligne » que tout l'amont gère déjà. Docs et tests amont : non touchés.

## Chemins réseau couverts
| Chemin | Neutralisation | Preuve |
|---|---|---|
| Auto-update Desktop (electron-builder `publish` → `app-update.yml`, electron-updater) | `publish: null` sauf `KLETRON_UPDATE_URL` (generic) ; plus jamais `provider: github` | governance §7, `kletron-netguard.test.ts` |
| Feed runtime Desktop (`updates.feed_base_url` de config.yaml) | vide par défaut (amont) ; hôtes Nous non résolus | netguard Electron |
| Installateur distant Desktop (`bootstrap-runner.ts`) | `KLETRON_INSTALL_SOURCE` ; vide = refusé | test vitest |
| `hermes update` / `kletron update` (pointeurs de canal `hermes-assets.nousresearch.com`) | hôte non résolu → mise à jour « indisponible » | `test_update_*` |
| Catalogue de modèles (primaire Nous + repli raw GitHub NousResearch) | primaire non résolu ; repli → `kletron_sources` (vide) | `test_automatic_github_content_fetches_are_disabled` |
| Catalogue local-runtime (rafraîchi depuis NousResearch@main toutes les 6 h) | → `kletron_sources` (vide) : copie packagée seule | idem |
| Télémétrie shared-metrics | **pas de patch** : défauts amont `enabled/send = False` + consentement ; verrouillés en gouvernance | governance §7 |
| Tous hôtes `*.nousresearch.com`, `nousresearch.github.io`, `nous.dev` | garde DNS Python (`hermes_cli/__init__.py`, importé par tous les points d'entrée) + Electron | `test_every_runtime_nous_host_is_unresolvable`, `test_every_entry_point_installs_the_guard` |

## Anti-dérive
- `kletron/tools/nous-refs.py` + `tests/kletron/nous_github_refs.json` : chaque fichier runtime citant `NousResearch/` est
  classé (comment, text, ua, docker, update, user-action…). Un sync amont qui en ajoute un fait échouer la gouvernance.
- L'inventaire des hôtes `*.nousresearch.com` est recalculé à chaque test (aucune liste figée à maintenir).

## Limites connues (assumées, documentées)
1. Proxy HTTP(S) explicite : le proxy résout lui-même. 2. Sous-processus (git, curl, pip, docker) hors garde.
→ Déploiement géré : règle DNS/pare-feu OS (`*.nousresearch.com`, `nous.dev`) — recommandé, hors code.
3. Appels GitHub API `api.github.com/repos/NousResearch/...` (comparaison de version sur installs embarqués, Skills Hub
   officiel sur action utilisateur, `hermes update` sur un clone dont `origin`/`upstream` vise NousResearch) : GitHub, pas
   l'infrastructure Nous ; lecture publique. À fermer quand le dépôt Kletron existe (décision Romain) : 1 ligne
   `OFFICIAL_REPOSITORY` dans `source_releases.py` ou contribution amont « dépôt officiel configurable ».
4. Images Docker par défaut `nousresearch/hermes-sandbox` (Docker Hub) : configurables (`terminal.docker_image`) ;
   miroir Kletron = décision D10.
