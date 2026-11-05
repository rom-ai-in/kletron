"""Governance smoke for Managed Scope Linux templates + modules."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_linux_managed_example_has_forbid_yolo():
    cfg = (ROOT / "managed" / "linux" / "config.yaml").read_text(encoding="utf-8")
    assert "forbid_yolo: true" in cfg
    assert "approvals:" in cfg


def test_kletron_managed_module_importable():
    from hermes_cli.kletron_managed import resolve_default_managed_dir
    from hermes_cli.kletron_yolo import forbid_yolo, activate_yolo_from_cli

    assert callable(resolve_default_managed_dir)
    assert callable(forbid_yolo)
    assert callable(activate_yolo_from_cli)
