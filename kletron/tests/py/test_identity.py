"""Kletron identity (patch 0001): app id parity Python/Desktop, `kletron` alias, NOTICE."""
from __future__ import annotations

import json
import subprocess
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]


def test_app_id_parity():
    from hermes_cli.kletron_identity import APP_ID

    out = subprocess.run(["node", "-e", "console.log(JSON.stringify(require('./product-identity.cjs')))"],
                         cwd=ROOT / "apps/desktop", capture_output=True, text=True, check=True,
                         env={"PATH": "/usr/local/bin:/usr/bin:/bin", "HERMES_DESKTOP_VARIANT": ""}).stdout
    ident = json.loads(out)
    assert ident["appId"] == APP_ID == "ch.numezis.kletron"
    assert ident["displayName"] == "Kletron"


def test_kletron_alias_console_script():
    scripts = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))["project"]["scripts"]
    assert scripts["kletron"] == scripts["hermes"]


def test_notice_attribution():
    notice = (ROOT / "NOTICE").read_text(encoding="utf-8")
    assert "Nous Research" in notice and "MIT" in notice and "not affiliated" in notice.lower()
