# Patch 0004 — Blocage YOLO (**IMPLÉMENTÉ** 2026-11-05)

`hermes_cli/kletron_yolo.py` + crochets dans `tools/approval.py`, `hermes_cli/main.py`, `hermes_cli/oneshot.py`.
Quand Managed Scope pose `kletron.forbid_yolo: true` :
- `--yolo` / activation CLI → exit 2 + message ;
- `_yolo_active` et `is_approval_bypass_active_for_session` → False ;
- `enable_session_yolo` → no-op.

Préférer d'abord verrouiller `approvals.mode` via Managed Scope (voir `kletron/managed/linux/config.yaml`).
Tests : `tests/kletron/test_yolo_lock.py`.
