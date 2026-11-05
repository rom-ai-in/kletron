"""Kletron governance — patch 0002: Nous Research is unreachable, at the source first.

Source neutralization (asserted here): telemetry off by default + consent-gated (upstream
config, no patch), `hermes update` cannot reach the Nous release CDN, no fail-open
fallback. Defense in depth: the resolver guard (hermes_cli/kletron_netguard.py).
"""
from __future__ import annotations

import re
import socket
import subprocess
import sys
from pathlib import Path

import pytest

from hermes_cli import kletron_netguard as ng

ROOT = Path(__file__).resolve().parents[2]
RUNTIME_DIRS = ("agent", "tools", "hermes_cli", "gateway", "tui_gateway", "cron", "acp_adapter", "plugins")
HOST_RE = re.compile(r"(?i)\b((?:[a-z0-9-]+\.)*nousresearch\.(?:com|github\.io))\b")
ENTRY_MODULES = ("hermes_cli.main", "agent.legacy_cli", "acp_adapter.entry", "tui_gateway.entry",
                 "tui_gateway.server", "gateway.run", "cron")


def _runtime_hosts() -> set[str]:
    hosts: set[str] = set()
    for path in [p for d in RUNTIME_DIRS for p in (ROOT / d).rglob("*.py")] + list(ROOT.glob("*.py")):
        if "tests" in path.parts:
            continue
        try:
            hosts.update(h.lower() for h in HOST_RE.findall(path.read_text(encoding="utf-8")))
        except (UnicodeDecodeError, OSError):
            continue
    return hosts


def test_inventory_is_not_empty():
    assert len(_runtime_hosts()) >= 5  # sanity: the scan does find upstream hosts


@pytest.mark.parametrize("host", sorted(_runtime_hosts()))
def test_every_runtime_nous_host_is_unresolvable(host):
    assert ng.is_blocked(host), host
    with pytest.raises(socket.gaierror):
        socket.getaddrinfo(host, 443)


def test_other_hosts_unaffected():
    for host in ("localhost", "127.0.0.1", "example.com", "github.com", "api.openai.com", "notnousresearch.com"):
        assert not ng.is_blocked(host), host


def test_clients_see_the_ordinary_offline_error():
    """No client is patched: they map the resolver failure to their own native error."""
    import httpx
    import requests
    import urllib.error
    import urllib.request

    with pytest.raises(httpx.ConnectError):
        httpx.get("https://portal.nousresearch.com/api", timeout=2)
    with pytest.raises(requests.ConnectionError):
        requests.get("https://inference-api.nousresearch.com/v1/models", timeout=2)
    with pytest.raises(urllib.error.URLError):
        urllib.request.urlopen("https://hermes-assets.nousresearch.com/x", timeout=2)
    assert not hasattr(httpx.Client.send, "_kletron_netguard")  # rule 6: no client method replaced


@pytest.mark.parametrize("module", ENTRY_MODULES)
def test_every_entry_point_installs_the_guard(module):
    code = (f"import {module}, socket\n"
            "try:\n socket.getaddrinfo('portal.nousresearch.com', 443)\n"
            "except socket.gaierror as e:\n print('BLOCKED', e)\n"
            "else:\n print('RESOLVED')\n")
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True, timeout=120, check=False)
    both = out.stdout + out.stderr  # tui_gateway routes print() to stderr (stdout is JSON-RPC)
    assert "BLOCKED [Errno" in both and "RESOLVED" not in both and "Kletron netguard" in both, both[-800:]


def test_telemetry_off_by_default_and_consent_gated():
    """Upstream default (no patch): collection and sending are off; we lock that in governance."""
    from hermes_cli.config_defaults import DEFAULT_CONFIG
    from hermes_cli.observability import shared_metrics_send_config as sm

    shared = DEFAULT_CONFIG["telemetry"]["shared_metrics"]
    assert (shared["enabled"], shared["send"]) == (False, False)
    cfg = sm.resolve_send_config({"telemetry": {"shared_metrics": dict(shared)}})
    assert (cfg.enabled, cfg.send) == (False, False)


def test_update_cannot_reach_the_nous_release_cdn():
    """`hermes update` / `kletron update` resolve channels on _PUBLIC_BASE (Nous R2): unresolvable."""
    from hermes_cli import source_releases

    host = re.sub(r"^https://([^/]+).*$", r"\1", source_releases._PUBLIC_BASE)
    assert ng.is_blocked(host), host
    with pytest.raises(socket.gaierror):
        socket.getaddrinfo(host, 443)


def test_update_check_fails_closed_without_contacting_nous(tmp_path):
    """End to end: `kletron update --check` in a fresh home neither resolves a Nous host nor hangs."""
    code = ("import socket, runpy, sys\n"
            "import hermes_cli\n"
            "seen = []\n"
            "orig = socket.getaddrinfo\n"
            "def spy(host, *a, **k):\n seen.append(str(host))\n return orig(host, *a, **k)\n"
            "socket.getaddrinfo = spy\n"
            "sys.argv = ['kletron', 'update', '--check']\n"
            "try:\n runpy.run_module('hermes_cli.main', run_name='__main__')\n"
            "except SystemExit:\n pass\n"
            "print('LOOKUPS', sorted(set(seen)))\n")
    out = subprocess.run([sys.executable, "-c", code], cwd=ROOT, capture_output=True, text=True, timeout=180,
                         check=False, env={"HERMES_HOME": str(tmp_path), "PATH": "/usr/bin:/bin"})
    tail = out.stdout + out.stderr
    assert "LOOKUPS" in out.stdout, tail[-1500:]
    lookups = out.stdout.rsplit("LOOKUPS", 1)[1]
    # Any Nous lookup that was attempted was refused by the guard (never resolved).
    for host in re.findall(r"'([^']+)'", lookups):
        if ng.is_blocked(host):
            assert "blocked by Kletron netguard" in tail or "not resolved" in tail, tail[-1500:]


def test_automatic_github_content_fetches_are_disabled():
    """model catalog fallback + local-runtime catalog refresh pulled NousResearch/hermes-agent@main."""
    from hermes_cli import model_catalog
    from hermes_cli.local_runtime import catalog

    assert model_catalog.DEFAULT_CATALOG_FALLBACK_URLS == ()
    assert catalog._CATALOG_URL == ""
    before = catalog.CATALOG
    assert catalog.refresh_catalog(force=True) is False  # best-effort path: packaged copy kept
    assert catalog.CATALOG == before


def test_nous_github_reference_inventory_has_not_drifted():
    """New `NousResearch/...` reference upstream => re-classify (kletron/tools/nous-refs.py)."""
    out = subprocess.run([sys.executable, str(ROOT / "kletron/tools/nous-refs.py")], capture_output=True,
                         text=True, check=False)
    assert out.returncode == 0, out.stdout
