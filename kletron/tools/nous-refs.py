#!/usr/bin/env python3
"""Inventory of `NousResearch/...` references in Kletron runtime code (anti-drift lock).

Each file is classified once by a human. On every upstream sync, `--check` fails when a file
appears, disappears or changes its count: someone must look and re-classify (new network call?).
Categories: comment | text (help/link shown to the user) | ua (User-Agent/Referer string) |
neutralized (patched to kletron_sources) | user-action (fetch only on an explicit user command) |
update (update/fork plumbing, see planned/0002) | docker (container image name) | model-name.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LOCK = ROOT / "tests" / "kletron" / "nous_github_refs.json"
DIRS = ("agent", "tools", "hermes_cli", "gateway", "tui_gateway", "cron", "acp_adapter", "plugins")
RX = re.compile(r"(?i)nousresearch/")


def scan() -> dict[str, int]:
    out: dict[str, int] = {}
    for d in DIRS:
        for p in sorted((ROOT / d).rglob("*.py")):
            rel = p.relative_to(ROOT).as_posix()
            if re.search(r"(^|/)tests?/", rel):
                continue
            n = len(RX.findall(p.read_text(encoding="utf-8", errors="replace")))
            if n:
                out[rel] = n
    return out


def main() -> int:
    current = scan()
    lock = json.loads(LOCK.read_text()) if LOCK.exists() else {}
    if "--write" in sys.argv:
        merged = {f: {"count": n, "category": lock.get(f, {}).get("category", "UNCLASSIFIED")} for f, n in current.items()}
        LOCK.write_text(json.dumps(merged, indent=1, sort_keys=True) + "\n")
        return 0
    bad = [f"{f}: lock={lock.get(f, {}).get('count')} now={current.get(f)}"
           for f in sorted(set(lock) | set(current)) if lock.get(f, {}).get("count") != current.get(f)]
    bad += [f"{f}: UNCLASSIFIED" for f, v in lock.items() if v.get("category") == "UNCLASSIFIED"]
    for b in bad:
        print("DRIFT", b)
    print(f"nous-refs: {len(current)} files, {sum(current.values())} refs, {len(bad)} drift")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
