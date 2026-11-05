# STATUS box — 5 nov 2026, ~22:30 Europe/Zurich

Tout est **local à la box** jusqu'au push `dev` autorisé (Romain t10u+t11u). Aucune org créée. Pas de force-push. Mac et `~/Desktop/numezis` non touchés. Aucun secret dans git/docs. Aucun contact Nous/ELCA/clients.

## Dépôt local `kletron-agent/`
- `upstream-base` = `ea6b60274f8a` (Hermès main 5 nov)
- `kletron` = base + **4 patchs** + overlay
  - 0001 identity · 0002 nous-neutralize · **0003 managed-scope** · **0004 yolo-lock**
  - overlay : rebrand build, gouvernance, CI brouillon, **plugin Desktop `kletron-validations` (0005)**, modèles Managed Scope Linux, docs stratégie, `windows-signing.md`
- Reconstruction déterministe via `kletron/scripts/apply-patches.sh`

## Budget
| Métrique | Valeur | Seuil |
|---|---|---|
| Patchs | 4 | ≤ 5 |
| Fichiers amont modifiés | 15 | ≤ 40 |
| Lignes de contact | 106 | ≤ 400 |
| Tests amont modifiés | 0 | 0 |

## Gouvernance / tests (cette session)
- `kletron/tests/governance.sh` — voir `reports/logs4/governance-final.txt`
- pytest Kletron : `tests/kletron/` + `kletron/tests/py/` — voir `reports/logs4/pytest-final.txt`

## Builds Windows / macOS depuis Linux
- Config electron-builder : win=`msix`, mac=`dmg+zip`, linux=`AppImage`
- Publisher MSIX toujours `CN=Nous Research Inc.` — **pas de certificat Kletron** ; doc `kletron/docs/windows-signing.md`
- `wine` / `osxcross` absents sur la box → **pas de pack Windows/macOS natif prouvé ici** ; seul Linux dir pack est prouvé

## Push (plan t10u+t11u)
- Cible : `https://github.com/rom-ai-in/kletron` branche **`dev`**
- Sauvegarde non destructive de l'ancien `dev` (`archive/kletron-v1-dev-2026-11-05` ou tag équivalent)
- Remplacement du contenu de `dev` par le fork Hermès via commit enfant de l'ancien tip (pas de force)
- `main` / `prod` inchangés
