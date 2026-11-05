# kletron/ — overlay Kletron sur Hermes Agent (local box, non poussé)
Contrat : docs/06-STRATEGIE-FORK-AMONT.md (budget bloquant, DEP-3, 0 test amont modifié). Tout ce qui n'est pas
dans `patches/` vit ici et ne touche aucun fichier amont.

- `UPSTREAM_REF` : base amont épinglée · `VERSION` : version Kletron `X.Y.Z-k.N` (`tools/version.mjs`).
- `patches/series` : **0001-identity** (nom produit, appId, alias CLI `kletron`, NOTICE — minimal) ·
  **0002-nous-neutralize** (appels réseau réels vers Nous). Appliqués par `git am --3way`. Rien n'est demandé à l'amont.
- `build/` : **rebrand au build (modèle VSCodium/Cursor)**, jamais dans les sources. `build/build.sh [REF]` exporte REF
  dans `$BUILD_DIR/tree` (défaut `/workspace/kletron/_out`), applique `build/rebrand/apply.py` (règles `rules.yaml`,
  tokenisation Python, AST TypeScript via `ts-literals.cjs`, valeurs YAML/JSON ; littéraux de données → décision dans
  `data-literals.txt`), vérifie idempotence + déterminisme, crée le venv, prouve `kletron --version/--help`, scanne
  l'aide de chaque sous-commande, `locales/` et `app.asar` (`build/scan.py`, liste blanche `build/scan-allow.txt`),
  package le Desktop (icônes `--icons kletron/brand`). `KLETRON_SKIP_DESKTOP=1` pour la partie CLI seule.
- `brand/` : icônes Kletron (porte amont `--icons`).
- `tools/budget.py [--check]` : métriques du budget (patchs, fichiers amont, lignes de contact, tests amont, assets, DEP-3).
- `tools/nous-refs.py` : inventaire classé des références `NousResearch/` du code runtime (anti-dérive).
- `tests/governance.sh` : contrôles bloquants (budget, licence, file de patchs reproductible, identité, rebrand au build,
  neutralisation Nous, déviations, version). `tests/run-upstream-subset.sh [--impacted]` + `tests/check-deviations.py` :
  tests amont comparés à `tests/expected-upstream-deviations.txt`. `tests/py/`, `tests/node/` : tests Kletron overlay.
- `scripts/apply-patches.sh` · `export-patches.sh` · `sync-upstream.sh` · `pack-desktop.sh` (raccourci vers `build/build.sh`).
- `planned/` : 0002 (doc de l'implémenté), 0003 managed lock, 0004 YOLO, 0005 validations (+ analyse fail-open).

## Rafraîchir un patch en conflit
1. `git checkout -b refresh <nouvelle-base>` ; `git am --3way kletron/patches/NNNN-x.patch` ; résoudre ; `git am --continue`.
2. Rejouer les suivants, `kletron/scripts/export-patches.sh <nouvelle-base>`, puis `kletron/tests/governance.sh`
   (le budget et les en-têtes DEP-3 sont bloquants ; mettre à jour `Last-Update`).
