#!/usr/bin/env python3
"""Compare upstream test failures with kletron/tests/expected-upstream-deviations.txt.

  check-deviations.py --pytest-log run.log      (scripts/run_tests.sh output: "FAILED <nodeid>" lines)
  check-deviations.py --vitest-json out.json    (vitest --reporter=json; id = <relative file>::<full name>)
  ... --baseline <log|json>                     same run on pristine upstream-base, same host
  ... --rerun <log>                             pytest re-run (-j 1) of some files: supersedes them
Exit 1 on an unexpected failure. Listed-but-passing entries of the files that ran are reported STALE.
A file whose interpreter CRASHED (e.g. SIGKILL by the OOM killer) or where no test ran is NOT a pass:
it is reported INCOMPLETE (exit 1) and never makes an entry STALE; re-run it with -j 1.
A failure that ALSO fails on upstream-base (--baseline) is the host's, not Kletron's: reported
BASELINE, never listed in the deviations file (that file holds patch-caused failures only).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LIST = ROOT / "kletron" / "tests" / "expected-upstream-deviations.txt"


def expected(runner: str) -> dict[str, str]:
    out = {}
    for line in LIST.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        head, _, why = line.partition("|")
        kind, _, tid = head.strip().partition(" ")
        if kind == runner:
            out[tid.strip()] = why.strip(" |")
    return out


def pytest_incomplete(text: str) -> set[str]:
    crashed = set(re.findall(r"[✗x] (tests/\S+?\.py) \(CRASHED", text))
    tail = text.split("files where no tests ran", 1)
    if len(tail) == 2:
        crashed |= set(re.findall(r"^\s+(tests/\S+\.py)\s*$", tail[1].split("\n", 1)[-1].split("===", 1)[0], re.MULTILINE))
    return crashed


def pytest_failures(text: str) -> tuple[set[str], set[str]]:
    failed = set(re.findall(r"^\s*(?:║\s*)?FAILED (\S+::\S+)", text, re.MULTILINE))
    failed |= set(re.findall(r"^\s*(?:║\s*)?ERROR (\S+::\S+)", text, re.MULTILINE))
    ran = set(re.findall(r"(tests/\S+?\.py)", text))
    for f in re.findall(r"^\s+(tests/\S+\.py)\s+\(", text.split("files with test failures", 1)[-1], re.MULTILINE):
        if not any(t.startswith(f + "::") for t in failed):
            failed.add(f"{f}::<file>")
    return failed, ran


def vitest_failures(data: dict, root: Path = ROOT) -> tuple[set[str], set[str]]:
    failed, ran = set(), set()
    for f in data.get("testResults", []):
        try:
            rel = str(Path(f["name"]).resolve().relative_to(root))
        except ValueError:  # baseline produced in another worktree: keep the path after apps/
            rel = f["name"][f["name"].find("apps/"):]
        ran.add(rel)
        for t in f.get("assertionResults", []):
            if t.get("status") == "failed":
                failed.add(f"{rel}::{t.get('fullName') or t.get('title')}")
        if f.get("status") == "failed" and not any(t.get("status") == "failed" for t in f.get("assertionResults", [])):
            failed.add(f"{rel}::<file>")
    return failed, ran


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pytest-log")
    ap.add_argument("--vitest-json")
    ap.add_argument("--baseline", action="append", default=[], help="same runner output, produced on upstream-base on this host (repeatable: union)")
    ap.add_argument("--rerun", action="append", default=[], help="pytest re-run log (e.g. -j 1 after an OOM): its files supersede the main run")
    a = ap.parse_args()
    base: set[str] = set()
    incomplete: set[str] = set()
    base_files: set[str] = set()
    if a.pytest_log:
        runner, text = "pytest", Path(a.pytest_log).read_text(errors="replace")
        btexts = [Path(b).read_text(errors="replace") for b in a.baseline]
        for bt in btexts:
            base |= pytest_failures(bt)[0]
        failed, ran = pytest_failures(text)
        incomplete = pytest_incomplete(text)
        ran -= incomplete
        for rerun in a.rerun:
            rtext = Path(rerun).read_text(errors="replace")
            rfailed, rran = pytest_failures(rtext)
            rinc = pytest_incomplete(rtext)
            redone = rran | rinc
            failed = {t for t in failed if t.split("::")[0] not in redone} | rfailed
            incomplete = (incomplete - redone) | rinc
            ran = (ran | rran) - rinc
        failed = {t for t in failed if not (t.endswith("::<file>") and t.split("::")[0] in incomplete)}
        base_files = {t.split("::")[0] for t in base}
        for bt in btexts:
            base_files |= pytest_incomplete(bt)
    elif a.vitest_json:
        runner = "vitest"
        failed, ran = vitest_failures(json.loads(Path(a.vitest_json).read_text()))
        for b in a.baseline:
            base |= vitest_failures(json.loads(Path(b).read_text()))[0]
    else:
        ap.error("--pytest-log or --vitest-json")
    exp = expected(runner)
    host = sorted((failed & base) - set(exp))
    failed -= set(host)
    unexpected = sorted(failed - set(exp))
    deviated = sorted(failed & set(exp))
    stale = sorted(t for t in exp if t not in failed and t.split("::")[0] in ran)
    for t in deviated:
        print(f"EXPECTED  {t}  ({exp[t]})")
    for t in stale:
        print(f"STALE     {t}  (passes now: remove it from the list)")
    for t in host:
        print(f"BASELINE  {t}  (fails on upstream-base too: host/env, not Kletron)")
    for t in unexpected:
        print(f"UNEXPECTED {t}")
    for f in sorted(incomplete):
        note = "; also fails on upstream-base (host)" if f in base_files else ""
        print(f"INCOMPLETE {f}  (crashed or no test ran: not a pass, re-run with -j 1{note})")
    print(f"{runner}: {len(failed) + len(host)} failed = {len(deviated)} expected + {len(host)} baseline + "
          f"{len(unexpected)} unexpected; {len(stale)} stale; {len(incomplete)} incomplete files")
    return 1 if unexpected or incomplete else 0


if __name__ == "__main__":
    sys.exit(main())
