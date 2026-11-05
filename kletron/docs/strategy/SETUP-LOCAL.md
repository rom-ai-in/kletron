# SETUP-LOCAL — reproduire le setup Kletron sur une machine Linux (box)

Tout est local : aucune clé, aucun appel LLM, rien n'est poussé. Ce document décrit l'état du 5 nov 2026 à ~14:00 (Europe/Zurich), après le refactor « fork mince » (docs/06) et le **rebrand au build** (modèle VSCodium/Cursor, docs/06 §3.4).

## 0. Outils
```bash
source /workspace/kletron/.tools/env.sh   # node 26.13.0, toolchain micromamba (make, gcc/g++), HERMES_HOME isolé
```
- Sur la box, apt était en panne (miroir HTTP 500). Ailleurs, `apt install build-essential` suffit. Il faut aussi **uv** (≥ 0.13) et Node ≥ 22.
- **Restauration de la box** (constatée le 5 nov vers 11:23) : les répertoires nommés `build/`, `dist/`, `node_modules/` et `.venv/` ne sont pas conservés. Après un redémarrage :
  - lancer `git status` ;
  - restaurer les fichiers suivis manquants avec `git checkout -- <fichiers>` ;
  - relancer `npm ci`.
  - Le venv vit hors de l'arbre (§3), il survit donc.
  - **Avant vitest/pack** : `[ -d node_modules ] && [ -d apps/desktop/node_modules ] || npm ci --no-audit --no-fund`.
  - `/tmp` est vidé : les worktrees jetables (`run-baseline.sh`, `apply-patches.sh`) disparaissent ; `git worktree prune` les nettoie.
  - Les jobs en arrière-plan sont tués : tenir le journal `reports/*-setup-proofs-N.md` au fil de l'eau et relancer l'étape interrompue.

## 1. Dépôt local
```bash
cd /workspace/kletron
git clone file://$PWD/hermes-agent kletron-agent && cd kletron-agent
git remote remove origin
git remote add upstream https://github.com/NousResearch/hermes-agent.git
git remote set-url --push upstream DISABLED-no-push
git config remote.upstream.tagopt --no-tags
git fetch upstream main
kletron/scripts/sync-upstream.sh ea6b60274f8a8a92652f62521368d9a43fd099cf   # base actuelle (exception sécurité, 03-DECISIONS)
```

## 2. File de patchs (docs/06)
- `kletron/UPSTREAM_REF` : base épinglée. `kletron/VERSION` : `X.Y.Z-k.N` (`kletron/tools/version.mjs`).
- `kletron/patches/series` : **0001-identity** et **0002-nous-neutralize**. Chaque patch porte des en-têtes DEP-3 (Owner, Test, Forwarded, Upstreamable, Budget, Last-Update).
- `kletron/scripts/apply-patches.sh [base] [target]` :
  - travaille dans un worktree jetable avec `git am --3way --committer-date-is-author-date` ;
  - ajoute le commit overlay, daté du dernier patch, sans bytecode ;
  - **même entrée, même SHA de commit** ;
  - exit 2 en cas de conflit, et la branche cible n'est pas touchée.
- `kletron/scripts/sync-upstream.sh <tag|sha>` : essai sur des branches temporaires. En cas d'échec, rien ne bouge.
- `kletron/scripts/export-patches.sh` : régénère `patches/*.patch` (`--binary --zero-commit`) depuis les commits `kletron-patch: NNNN slug`.
- **Modifier un patch** :
  1. `git worktree add -b patch-dev ../work/wt-dev kletron~1` (branche jetable = patchs sans overlay ; à supprimer après : `git worktree remove ../work/wt-dev && git branch -D patch-dev`).
  2. Éditer, puis `git commit --fixup=<patch>` et `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash --committer-date-is-author-date upstream-base`.
  3. Dans le worktree, lancer `export-patches.sh` et copier `kletron/patches/*` dans le checkout principal.
  4. Lancer `apply-patches.sh`, puis `governance.sh`.
  - Pour lancer `tests/kletron` dans le worktree, copier `kletron/` (non suivi) : ces tests lisent l'overlay.
  - Deux patchs qui ajoutent une ligne au même endroit (ex. les 2 imports Kletron en tête de `electron/main.ts`) donnent un conflit **interne** au rebase : le résoudre une fois (ordre : netguard puis brand-main). Ce n'est pas un conflit amont.
- **Branches locales** : `kletron` (produit), `upstream-base` (amont épinglé). Les anciennes itérations sont gardées en `backup/<nom>-2026-11-05` (`dev` = v2 « 0001-brand » 47 fichiers, `kletron-v3`) ; rien d'autre.
- Le hook pre-commit (lefthook) appelle `ruff` : mettre `.venvs/agent/bin` dans le PATH.

## 3. Dépendances et tests
```bash
export UV_PROJECT_ENVIRONMENT=/workspace/kletron/.venvs/agent      # venv HORS de l'arbre (obligatoire, voir ci-dessous)
uv sync --locked --python 3.14 --inexact --extra all --group dev --group test
uv pip install --python $UV_PROJECT_ENVIRONMENT/bin/python -e . --no-deps   # entry points hermes + alias kletron
export HERMES_PYTHON=$UV_PROJECT_ENVIRONMENT/bin/python PATH=$UV_PROJECT_ENVIRONMENT/bin:$PATH
npm ci --no-audit --no-fund
kletron/tests/run-upstream-subset.sh -j 6               # sous-ensemble (≈ 180 fichiers, ≈ 4 min)
kletron/tests/run-upstream-subset.sh -j 5 --impacted    # tout fichier qui touche un module patché (≈ 900 fichiers, ≈ 25 min)
kletron/tests/run-baseline.sh <log> -j 4                # rejoue les fichiers en échec sur upstream-base pur (worktree jetable)
$HERMES_PYTHON kletron/tests/check-deviations.py --pytest-log <log> --baseline <log>.baseline.log
# relance -j 1 des fichiers CRASHED, puis classement combiné (--baseline et --rerun sont répétables) :
#   check-deviations.py --pytest-log <log> --baseline <log>.baseline.log --baseline <rerun>.baseline.log --rerun <rerun>.log
# vitest : npx vitest run --reporter=json --outputFile=<json> (dans apps/desktop), puis --vitest-json <json> [--baseline <json upstream-base>]
cd apps/desktop && npx vitest run --reporter=json --outputFile=out.json && $HERMES_PYTHON ../../kletron/tests/check-deviations.py --vitest-json out.json
```
- **Pourquoi le venv hors de l'arbre.** Avec un `.venv` dans le checkout, le module amont `hermes_cli/update_owning_install.py` « répare » l'install : les tests `update` relancent alors l'updater réel contre le checkout. Cela produisait environ 60 faux échecs et présente un risque pour l'arbre. `run-upstream-subset.sh` refuse ce cas. Il échoue aussi avec rc 97 si les tests modifient un fichier suivi.
- **Classement des échecs** (`check-deviations.py`) : EXPECTED (listé, rattaché à un patch), BASELINE (échoue aussi sur upstream-base, même hôte), UNEXPECTED (à corriger), STALE (listé mais passe), **INCOMPLETE** (fichier CRASHED — souvent SIGKILL de l'OOM killer — ou « no tests ran » : ce n'est jamais un succès, jamais STALE, exit 1 ; relancer en `-j 1`). `run-baseline.sh` rejoue aussi les fichiers CRASHED / « no tests ran ».
- **OOM** : avec `-j 5`, le run `--impacted` déclenche l'OOM killer (`dmesg | grep oom-kill`) ; les victimes (rc −9) passent en isolé. Relancer les fichiers touchés en `-j 1` avant de conclure.
- **Clone shallow** : le checkout box est un clone `--depth` ; 5 fichiers `tests/e2e/core/upgrade/*` (hostile_commit, path_shapes, proxy_only_egress, stamps_and_doctor, install_fresh) clonent le checkout et échouent aussi sur upstream-base (« Could not read <objet> », « invalid index-pack »). Ils ne sont valides qu'en CI (`fetch-depth: 0`) ou après `git fetch --unshallow upstream`.
- **Tests amont jamais modifiés.** Un échec dû à un patch est listé dans `kletron/tests/expected-upstream-deviations.txt`, avec le patch et la raison. Un échec qui se reproduit aussi sur upstream-base, sur le même hôte, est classé BASELINE (hôte/env) et n'est jamais listé. Une entrée qui repasse est signalée STALE.
- `HERMES_PYTHON` doit être un chemin absolu. Sans lui, run_tests.sh tente un provisioning « pm » (échec SSL).
- Pas de RAM pour tout lancer en parallèle (15 Go). Enchaîner pytest puis vitest (`work/run-tests-3.sh`).

- **Tests e2e upgrade sur la box** (`tests/e2e/core/upgrade/*`) : le checkout est un clone shallow ; depuis un worktree détaché le clone de l'installateur échoue (« Could not read <sha> »), depuis le checkout principal l'installation réelle tourne et l'OOM killer tue pytest (15 Go). Même résultat sur upstream-base → hôte (INCOMPLETE). Ils doivent tourner en CI sur un clone complet (`fetch-depth: 0`).

## 4. Rebrand au build (obligatoire avant pack)
```bash
export BUILD_DIR=/workspace/kletron/_out
kletron/build/build.sh HEAD    # archive → rebrand → idempotence → déterminisme → scan → venv transformé → help-dump → pack Desktop → scan asar
# Attend BUILD: ALL PASS. Échoue (exit ≠ 0) si littéral de données non revu, décision périmée, « Hermes » visible hors scan-allow.txt, ou feed auto-update.
```
- Moteur : `kletron/build/rebrand/{rules.yaml, apply.py, ts-literals.cjs, data-literals.txt, assets/}`. Les **sources du dépôt ne sont jamais modifiées**.
- Nouvelle chaîne amont : `apply.py --check` imprime `UNREVIEWED <fichier>:<ligne> [raison] '…'` → ajouter une décision `keep|rewrite` dans `data-literals.txt` (docs/06 §3.4 procédure sync).
- Scan : `kletron/build/scan.py` + liste blanche `kletron/build/scan-allow.txt` (attribution, modèles « Hermes 3/4 », chemins `~/.hermes`).
- Nom de commande `hermes` (prog argparse) **non réécrit** ; alias console `kletron` ajouté par 0001. Mot produit « Hermes » = 0 hors attribution.

## 5. Desktop Linux (depuis l'arbre transformé)
```bash
# Préféré : via build.sh (pack depuis $BUILD_DIR/tree)
# Manuel (arbre déjà transformé) :
kletron/scripts/pack-desktop.sh   # si lancé hors build.sh, packer depuis le checkout source (marque partielle) — préférer build.sh
HOME=/workspace/kletron/.desktop-home3 DISPLAY=:29 timeout 60 \
  /workspace/kletron/_out/tree/apps/desktop/release/linux-unpacked/Kletron --no-sandbox --disable-gpu --remote-debugging-port=9333
```
- Identité : `productName` / appId via 0001 (`product-identity.cjs`). Icônes : `--icons kletron/brand` (overlay, aucun asset amont modifié).
- Chaînes UI (accueil, menus, page de crash, titres) : **rebrand au build**, pas de plugin runtime ni de monkey-patch.
- Sans `--disable-gpu`, l'app plante sur la box.
- Captures CDP : `work/cdp.py` (port 9333). Preuves : `reports/proofs-4/`.

## 6. Gouvernance
`kletron/tests/governance.sh` (24 PASS attendus ; exit ≠ 0 si un seul échoue) contrôle :
- le budget (≤ 5 patchs, ≤ 40 fichiers amont, ≤ 400 lignes de contact, ≤ 150 par patch, 0 test amont, 0 asset binaire, DEP-3) ;
- LICENSE et NOTICE ;
- que la series reproduit HEAD ; l'absence d'URL de push ;
- l'identité Desktop/CLI (productName, appId, alias `kletron`) ;
- **rebrand au build** : `--check`, idempotence, titre `<title>Kletron</title>`, `--version` « Kletron Agent v… », et **aucune** chaîne affichée patchée dans le source (`_parser`, `banner`, `index.html`, `locales`) ;
- le netguard Python/Electron ; l'absence de feed par défaut et d'installateur distant ; télémétrie off ;
- l'inventaire anti-dérive des refs `NousResearch/` ;
- que chaque déviation est rattachée à un patch ; le format de version ; overlay sans bytecode + ruff.

#