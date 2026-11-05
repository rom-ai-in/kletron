# Patch 0003 — Managed Scope macOS + Windows (**IMPLÉMENTÉ** 2026-11-05)

Fichier nouveau `hermes_cli/kletron_managed.py` + crochet dans `get_managed_dir()`.
- Linux v1 : `/etc/hermes` (inchangé) — modèles dans `kletron/managed/linux/`.
- macOS : `/Library/Application Support/Kletron/managed`
- Windows : `%ProgramData%\Kletron\managed`
- Override : `HERMES_MANAGED_DIR` (toujours prioritaire)

Tests : `tests/kletron/test_managed_platforms.py` (aucun test amont modifié).
Politique D12 : `Forwarded: not-needed`.
