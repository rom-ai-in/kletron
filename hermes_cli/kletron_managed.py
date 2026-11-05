"""Platform-native Managed Scope directories for Kletron (patch 0003).

Upstream documents ``get_managed_dir()`` as the single seam for adding macOS /
Windows locations later. Linux keeps the POSIX default ``/etc/hermes`` (v1).
Paths are product-named Kletron; the ``HERMES_MANAGED_DIR`` override still wins.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path


def resolve_default_managed_dir(posix_default: Path) -> Path:
    """Return the IT-managed directory for this platform (may not exist yet)."""
    if sys.platform == "darwin":
        return Path("/Library/Application Support/Kletron/managed")
    if sys.platform == "win32":
        base = os.environ.get("PROGRAMDATA") or r"C:\ProgramData"
        return Path(base) / "Kletron" / "managed"
    return posix_default
