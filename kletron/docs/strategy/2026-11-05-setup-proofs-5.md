# Preuves setup — phase finalisation 0003–0005 — 5 nov 2026 ~22:30 Europe/Zurich

## Périmètre
Finalisation locale du fork mince dans `/workspace/kletron/kletron-agent` (box uniquement).
Autorisations Romain : finaliser local (t9u) ; push `rom-ai-in/kletron` (t10u) ; branche cible **`dev`**, conserver historique v1 (t11u).

## Patchs
| Patch | Rôle | Fichiers amont | Contact | Nouveaux |
|---|---|---|---|---|
| 0001 identity | productName, appId, alias | 7 | 33 | 2 |
| 0002 nous-neutralize | réseau / update / télémétrie | 6 | 40 | 7 |
| **0003 managed-scope** | macOS/Windows Managed Scope (+ Linux `/etc/hermes` inchangé) | 1 | 4 | 2 |
| **0004 yolo-lock** | `kletron.forbid_yolo` résiduel | 3 | 29 | 2 |
| **0005** | panneau Desktop validations | **0** (plugin overlay) | 0 | overlay |

Budget total : **4 / 15 / 106 / 0** (patchs / fichiers amont / contact / tests amont) — sous seuils 5 / 40 / 400 / 0.

## Commandes et résultats
```
kletron/scripts/apply-patches.sh upstream-base kletron
# OK: kletron = upstream-base + 4 patch(es) + overlay

kletron/tests/governance.sh
# GOVERNANCE: ALL PASS  (reports/logs4/governance-final.txt)

pytest tests/kletron/ kletron/tests/py/ -q
# 53 passed  (reports/logs4/pytest-final.txt)

kletron/tools/budget.py --check
# patches=4 upstream_files_modified=15 contact_lines=106 upstream_tests_modified=0
```

## Windows / macOS depuis Linux
- Targets configurés : win `msix`, mac `dmg+zip`, linux `AppImage`
- Publisher MSIX : `CN=Nous Research Inc., O=Nous Research Inc., L=Austin, S=Texas, C=US`
- `wine` / `osxcross` **absents** → aucun pack Windows/macOS exécuté ni présenté comme testé nativement
- Doc : `kletron/docs/windows-signing.md` (pas de signature de production inventée)

## Logo
Icônes provisoires déjà en `kletron/brand/` — **pas de nouveau logo** inventé cette session (identité existante conservée).

## Non fait / bloqueurs (décisions ouvertes inchangées)
- Passerelle MCP, LiteLLM, Console, OpenShell, VM ELCA : hors fork agent, non démarrés
- Certificat Windows réel : attend Romain / IT
- Logo définitif : attend asset
- D1–D4, D6–D11, D13–D15 : toujours proposés, non tranchés dans `03-DECISIONS.md`
- CI GitHub Actions : brouillon présent, non exécutée sur runners
