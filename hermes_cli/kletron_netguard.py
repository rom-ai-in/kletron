"""Kletron: Nous Research hosts do not resolve inside Kletron processes (defense in depth).

Scope (docs/06-STRATEGIE-FORK-AMONT.md §3.3 rule 6): this guard does NOT patch any Hermes code
nor any HTTP client. It only wraps the stdlib resolver (``socket.getaddrinfo`` /
``gethostbyname`` / ``gethostbyname_ex``) so a blocked host behaves exactly like an
unknown host (``socket.gaierror`` EAI_NONAME) — the offline path every client and every
Hermes call site already handles (httpx.ConnectError, requests.ConnectionError, URLError).

The real neutralization is at the source (patch 0002 + config): no update feed, no remote
installer, telemetry off by default and consent-gated. Known limits, documented in
kletron/planned/0002-nous-domains.md: an explicit HTTP(S) proxy resolves names itself, and
subprocesses (git, curl) are outside the process — managed deployments add an OS/DNS rule.

Blocklist = ``DEFAULT_BLOCKED`` + ``KLETRON_NETGUARD_BLOCK`` (comma-separated, extend only).
"""
from __future__ import annotations

import logging
import os
import socket
import threading

DEFAULT_BLOCKED = ("nousresearch.com", "nousresearch.github.io", "nous.dev")
_MARK = "_kletron_netguard"
_lock = threading.Lock()
_reported: set[str] = set()
logger = logging.getLogger(__name__)


def blocked_domains() -> tuple[str, ...]:
    extra = os.environ.get("KLETRON_NETGUARD_BLOCK") or ""
    return DEFAULT_BLOCKED + tuple(d.strip().lower().lstrip(".") for d in extra.split(",") if d.strip())


def is_blocked(host) -> bool:
    if isinstance(host, bytes):
        host = host.decode("idna", "ignore")
    if not isinstance(host, str) or not host:
        return False
    h = host.strip().lower().rstrip(".")
    return any(h == d or h.endswith("." + d) for d in blocked_domains())


def _refuse(host):
    name = host.decode("idna", "ignore") if isinstance(host, bytes) else str(host)
    if name not in _reported:
        _reported.add(name)
        logger.warning("Kletron netguard: %s is an upstream (Nous Research) host — not resolved", name)
    return socket.gaierror(socket.EAI_NONAME, f"Name or service not known ({name}: blocked by Kletron netguard)")


def _guard(func):
    if getattr(func, _MARK, False):
        return func

    def guarded(host, *args, **kwargs):
        if is_blocked(host):
            raise _refuse(host)
        return func(host, *args, **kwargs)

    setattr(guarded, _MARK, True)
    guarded.__wrapped__ = func
    guarded.__name__ = getattr(func, "__name__", "guarded")
    guarded.__doc__ = getattr(func, "__doc__", None)
    return guarded


def install() -> None:
    """Idempotent; called from ``hermes_cli/__init__.py`` (every entry point imports it first)."""
    with _lock:
        for name in ("getaddrinfo", "gethostbyname", "gethostbyname_ex"):
            setattr(socket, name, _guard(getattr(socket, name)))
