#!/usr/bin/env python3
"""Kletron fork budget (docs/06-STRATEGIE-FORK-AMONT.md §3.2) — measured, never estimated.

Usage: budget.py [--base upstream-base] [--head HEAD] [--check] [--json]

A *patch* is a commit between base and head whose subject starts with ``kletron-patch:``.
Everything under ``kletron/`` and the Kletron CI workflow is overlay, not counted.
With ``--check`` the exit status is 1 if any blocking threshold is exceeded.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys

OVERLAY = ("kletron/", ".github/workflows/kletron-ci.yml", "apps/desktop/src/plugins/kletron-validations/")
TEST_RE = re.compile(r"(^|/)(tests?/|test_[^/]*\.py$|[^/]*_test\.py$|conftest\.py$)|\.test\.[cm]?[jt]sx?$|\.spec\.[cm]?[jt]sx?$|(^|/)__tests__/")
DEP3 = ("Owner", "Test", "Forwarded", "Upstreamable", "Budget", "Last-Update")
LIMITS = {  # blocking thresholds (06 §3.2); "green" is informative only
    "patches": 5, "upstream_files_modified": 40, "contact_lines": 400, "contact_lines_per_patch": 150,
    "new_file_lines": 1500, "upstream_tests_modified": 0, "upstream_binary_assets_modified": 0,
}
GREEN = {"patches": 3, "upstream_files_modified": 25, "contact_lines": 250}


def git(*args: str) -> str:
    return subprocess.run(["git", *args], check=True, capture_output=True, text=True).stdout


def exists(ref: str, path: str) -> bool:
    return subprocess.run(["git", "cat-file", "-e", f"{ref}:{path}"], capture_output=True, check=False).returncode == 0


def numstat(a: str, b: str) -> list[tuple[str, int | None, int | None]]:
    rows = []
    for line in git("diff", "--numstat", "--no-renames", a, b).splitlines():
        add, dele, path = line.split("\t", 2)
        if path.startswith(OVERLAY):
            continue
        rows.append((path, None if add == "-" else int(add), None if dele == "-" else int(dele)))
    return rows


def classify(base: str, rows):
    out = {"modified": [], "new": [], "tests": [], "binary": [], "contact": 0, "new_lines": 0}
    for path, add, dele in rows:
        if exists(base, path):
            out["modified"].append(path)
            if TEST_RE.search(path):
                out["tests"].append(path)
            if add is None:
                out["binary"].append(path)
            else:
                out["contact"] += add + dele
        else:
            out["new"].append(path)
            out["new_lines"] += add or 0
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="upstream-base")
    ap.add_argument("--head", default="HEAD")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    base = git("rev-parse", a.base).strip()
    total = classify(base, numstat(base, a.head))
    patches = []
    for sha in git("rev-list", "--reverse", f"{base}..{a.head}").split():
        subject, body = git("log", "-1", "--format=%s%x00%b", sha).split("\x00", 1)
        if not subject.startswith("kletron-patch:"):
            continue
        c = classify(base, numstat(f"{sha}~1", sha))
        missing = [k for k in DEP3 if not re.search(rf"^{k}:\s*\S", body, re.MULTILINE)]
        patches.append({"subject": subject, "files_modified": len(c["modified"]), "files_new": len(c["new"]),
                        "contact_lines": c["contact"], "new_lines": c["new_lines"], "tests": c["tests"],
                        "binary": c["binary"], "dep3_missing": missing})
    m = {"patches": len(patches), "upstream_files_modified": len(total["modified"]),
         "contact_lines": total["contact"], "new_files": len(total["new"]), "new_file_lines": total["new_lines"],
         "upstream_tests_modified": len(total["tests"]), "upstream_binary_assets_modified": len(total["binary"]),
         "contact_lines_per_patch": max((p["contact_lines"] for p in patches), default=0)}
    fails = [f"{k}={m[k]} > {v}" for k, v in LIMITS.items() if m[k] > v]
    fails += [f"DEP-3 manquant dans « {p['subject'][:50]} »: {', '.join(p['dep3_missing'])}" for p in patches if p["dep3_missing"]]
    if a.json:
        print(json.dumps({"metrics": m, "patches": patches, "tests": total["tests"], "binary": total["binary"],
                          "fails": fails}, indent=2, ensure_ascii=False))
    else:
        for k, v in m.items():
            lim = LIMITS.get(k)
            tag = "" if lim is None else (" FAIL" if v > lim else (" (vert)" if k in GREEN and v <= GREEN[k] else ""))
            print(f"{k:34} {v:>6}" + (f"   seuil ≤ {lim}{tag}" if lim is not None else ""))
        for p in patches:
            print(f"  · {p['subject'][:60]:60} fichiers amont {p['files_modified']:>2}, contact {p['contact_lines']:>3}, "
                  f"nouveaux {p['files_new']:>2} (+{p['new_lines']}), DEP-3 {'OK' if not p['dep3_missing'] else 'manquant'}")
        for t in total["tests"]:
            print(f"  ! test amont modifié : {t}")
        for t in total["binary"]:
            print(f"  ! asset amont modifié sur place : {t}")
        for f in fails:
            print(f"BUDGET FAIL  {f}")
    return 1 if (a.check and fails) else 0


if __name__ == "__main__":
    sys.exit(main())
