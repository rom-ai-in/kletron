"""Kletron residual YOLO / approval-bypass lock (patch 0004).

When Managed Scope sets ``kletron.forbid_yolo: true``, every bypass source is
forced off: process ``HERMES_YOLO_MODE`` / ``--yolo``, session ``/yolo``, and
``approvals.mode: off``. Prefer locking ``approvals.mode`` via Managed Scope
first; this module covers what config alone cannot.
"""
from __future__ import annotations

import logging
import os
import sys

logger = logging.getLogger(__name__)

REFUSAL = (
    "Kletron managed policy forbids YOLO "
    "(--yolo / HERMES_YOLO_MODE / /yolo / approvals.mode=off). "
    "Unset kletron.forbid_yolo in the Managed Scope config to allow bypass."
)


def forbid_yolo() -> bool:
    """True when managed config pins ``kletron.forbid_yolo``."""
    try:
        from hermes_cli.managed_scope import load_managed_config

        cfg = load_managed_config()
    except Exception:
        return False
    if not isinstance(cfg, dict):
        return False
    block = cfg.get("kletron")
    if not isinstance(block, dict):
        return False
    return bool(block.get("forbid_yolo"))


def activate_yolo_from_cli(enabled: bool) -> None:
    """Set ``HERMES_YOLO_MODE`` from ``--yolo``, or exit 2 when forbidden."""
    if not enabled:
        return
    if forbid_yolo():
        print(REFUSAL, file=sys.stderr)
        raise SystemExit(2)
    os.environ["HERMES_YOLO_MODE"] = "1"
