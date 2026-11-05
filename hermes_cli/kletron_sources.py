"""Kletron: targets of the *automatic* content fetches that upstream points at NousResearch/hermes-agent
on GitHub (not covered by the resolver guard, which only knows Nous-owned hosts).

Empty = disabled: both callers are best-effort (any failure keeps the packaged/cached copy), so an
empty URL simply means "never refresh from the network". A Kletron-hosted mirror can be set later
(decision D10, docs/03-DECISIONS-PROPOSITIONS-FORK.md) without touching upstream code again.
"""
from __future__ import annotations

import os

#: hermes_cli/model_catalog.py — fallback after the (Nous, unresolvable) primary URL.
MODEL_CATALOG_FALLBACK_URLS: tuple[str, ...] = tuple(
    u for u in (os.environ.get("KLETRON_MODEL_CATALOG_FALLBACK_URL", "").strip(),) if u)
#: hermes_cli/local_runtime/catalog.py — TTL background refresh of the local-runtime catalog.
LOCAL_RUNTIME_CATALOG_URL: str = os.environ.get("KLETRON_LOCAL_RUNTIME_CATALOG_URL", "").strip()
