"""Kletron patch 0003 — platform Managed Scope directories (no upstream test edits)."""
from __future__ import annotations

from pathlib import Path

from hermes_cli.kletron_managed import resolve_default_managed_dir


def test_linux_keeps_posix_default(monkeypatch):
    monkeypatch.setattr("hermes_cli.kletron_managed.sys.platform", "linux")
    assert resolve_default_managed_dir(Path("/etc/hermes")) == Path("/etc/hermes")


def test_darwin_kletron_path(monkeypatch):
    monkeypatch.setattr("hermes_cli.kletron_managed.sys.platform", "darwin")
    assert resolve_default_managed_dir(Path("/etc/hermes")) == Path(
        "/Library/Application Support/Kletron/managed"
    )


def test_win32_programdata(monkeypatch):
    monkeypatch.setattr("hermes_cli.kletron_managed.sys.platform", "win32")
    monkeypatch.setenv("PROGRAMDATA", r"D:\ProgramData")
    got = resolve_default_managed_dir(Path("/etc/hermes"))
    # On a POSIX test host Path joins with /; compare logical parts only.
    assert got.parts[-2:] == ("Kletron", "managed")
    assert "ProgramData" in got.parts or str(got).replace("\\", "/").endswith("ProgramData/Kletron/managed") or "ProgramData" in str(got)
