# 05 — Référence Hermès
## SHA figé
`ea6b60274f8a8a92652f62521368d9a43fd099cf` (main du 5 nov 2026, 09:17 Europe/Zurich), = `upstream-base` de Kletron depuis le 5 nov (règle « tag stable sauf correctif sécurité », voir 03-DECISIONS). Corrigé : la doc interne citait `6c2bf4b9` = `6c2bf4b99bf96ed038f0b38b7eea2f38788437af` (main, 5 nov 2026, 08:41 Europe/Zurich, « plugin-catalog: re-pin patsnap… »). C'est un ancêtre de ea6b602, à 3 commits de distance : l'amont a simplement avancé. Le SHA de référence est désormais celui ci-dessus. Tag stable précédent : v0.22.7 = `b200f5bc6`.

## Liens
- SECURITY : https://github.com/NousResearch/hermes-agent/blob/main/SECURITY.md
- Managed Scope / config centrale et profile distributions : voir docs Hermès (dossier `website/` ou `docs/` du clone) — URLs exactes à confirmer.
- Dépôt : https://github.com/NousResearch/hermes-agent

## Inventaire (box, 5 nov 2026)
| Chemin | Présent |
|---|---|
| plugins/config_backends/remote/ | ✅ |
| hermes_cli/plugins.py | ✅ |
| apps/desktop/package.json | ✅ — `"productName": "Hermes"` |
- Licence : MIT, © 2025 Nous Research.
- `nousresearch.com` (insensible à la casse, `git grep -i -o`) : **1 056 occurrences dans 431 fichiers** @ ea6b602. Corrigé : l'ancien « ~988 / 422 » venait d'un autre mode de comptage. À v0.22.7 : 1 037 / 429. Branche kletron : 1 071, dont les nouveaux tests et la blocklist. Répartition à v0.22.7 : test 394, doc 373, **runtime 255 (165 fichiers)**, config 8, ci 7. Inventaire : `kletron-agent/kletron/planned/0002-nous-domains-inventory.csv`.

## Télémétrie (amont)
- `hermes_cli/observability/shared_metrics_send_config.py` : `DEFAULT_ENDPOINT = https://telemetry.nousresearch.com/v1/telemetry`. `resolve_send_config(config)` lit `telemetry.shared_metrics.{enabled,send,endpoint}` (défauts dans `config_defaults.py`).
- Desktop : `electron/desktop-shared-metrics*.ts` relaie vers le même pipeline.
- **Kletron** : `KLETRON_FORCE_OFF = True` impose `SendConfig(enabled=False, send=False, endpoint="")`. De plus, le netguard bloque l'hôte.

## Auto-update (amont)
- Build : `apps/desktop/electron-builder.config.cjs` `publish`. CI amont : feed generic `CLOUDFLARE_R2_PUBLIC_URL`. Build local ou fork : **github `GITHUB_REPOSITORY || NousResearch/hermes-agent`**. Le `app-update.yml` d'un build local pointait donc vers NousResearch. macOS : `mac.publish` sur R2, plus `updater/mac-client.ts` `setFeedURL`.
- Runtime : `electron/updater/*` (index, app-updater, feed-config : `updates.desktop_feed_base_url` dans config.yaml, vide par défaut ; MSIX App Installer sur Windows).
- Installation locale : `electron/bootstrap-runner.ts` télécharge `https://raw.githubusercontent.com/NousResearch/hermes-agent/<ref>/scripts/install.sh|ps1`.
- **Kletron** :
  - `publish` est `null` par défaut (pas d'`app-update.yml`) ; `KLETRON_UPDATE_URL` donne un feed generic.
  - L'installation distante passe par `KLETRON_INSTALL_SOURCE` (vide = désactivé avec un message clair).
  - Hôtes Nous bloqués par `electron/kletron-netguard.ts`.
- Clone : 22 400 fichiers, 401 Mo, aucune dépendance installée.
