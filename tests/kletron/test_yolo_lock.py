"""Kletron patch 0004 — residual YOLO lock behind kletron.forbid_yolo."""
from __future__ import annotations

import os
import textwrap

import pytest


def _managed(tmp_path, monkeypatch, body: str):
    from hermes_cli import managed_scope

    managed = tmp_path / "managed"
    managed.mkdir(exist_ok=True)
    (managed / "config.yaml").write_text(textwrap.dedent(body), encoding="utf-8")
    monkeypatch.setenv("HERMES_MANAGED_DIR", str(managed))
    managed_scope.invalidate_managed_cache()
    return managed


def test_forbid_yolo_reads_managed_key(tmp_path, monkeypatch):
    from hermes_cli.kletron_yolo import forbid_yolo

    _managed(tmp_path, monkeypatch, """        kletron:
          forbid_yolo: true
        """)
    assert forbid_yolo() is True
    _managed(tmp_path, monkeypatch, """        kletron:
          forbid_yolo: false
        """)
    assert forbid_yolo() is False
    _managed(tmp_path, monkeypatch, """        approvals:
          mode: smart
        """)
    assert forbid_yolo() is False


def test_activate_yolo_from_cli_refuses(tmp_path, monkeypatch):
    from hermes_cli.kletron_yolo import activate_yolo_from_cli

    _managed(tmp_path, monkeypatch, """        kletron:
          forbid_yolo: true
        """)
    monkeypatch.delenv("HERMES_YOLO_MODE", raising=False)
    with pytest.raises(SystemExit) as ei:
        activate_yolo_from_cli(True)
    assert ei.value.code == 2
    assert "HERMES_YOLO_MODE" not in os.environ


def test_yolo_active_and_bypass_forced_off(tmp_path, monkeypatch):
    from tools import approval

    _managed(tmp_path, monkeypatch, """        kletron:
          forbid_yolo: true
        """)
    monkeypatch.setattr(approval, "_YOLO_MODE_FROZEN", True)
    assert approval._yolo_active() is False
    assert approval.is_approval_bypass_active_for_session("s1") is False
    approval.enable_session_yolo("s1")
    assert approval.is_session_yolo_enabled("s1") is False
