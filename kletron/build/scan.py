#!/usr/bin/env python3
"""Kletron — scan of BUILD outputs for a visible « Hermes » (product word) outside the whitelist.

Same word rule and KEEP list as rules.yaml (attribution, model names, identifiers are not visible brand).
Inputs: text files (CLI help dumps, logs) and directories (extracted app.asar, build tree subsets).
Whitelist: scan-allow.txt (<regex>  # why), matched against the line around the hit.
Exit 1 on any hit not whitelisted. Report: sorted, no timestamps (diffable between upstream versions).

    scan.py --report OUT.json --text help/*.txt --dir asar/ [--ext .js .html .json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "rebrand"))


def load(path: Path):
    from ruamel.yaml import YAML

    rules = YAML(typ="safe", pure=True).load(path.read_text(encoding="utf-8"))
    word = re.compile("|".join(f"(?:{r['pattern']})" for r in rules["rules"] if r["id"] in ("product-word", "log-prefix")))
    keep = [re.compile(k, re.IGNORECASE) for k in rules["keep"]]
    return word, keep


def allow_list(path: Path) -> list[tuple[re.Pattern, str]]:
    out = []
    if path.exists():
        for ln in path.read_text(encoding="utf-8").splitlines():
            if ln.strip() and not ln.lstrip().startswith("#"):
                rx, _, why = ln.partition("  # ")
                out.append((re.compile(rx.strip()), why.strip()))
    return out


def _context(text: str, a: int, b: int) -> str:
    """The unit a reader sees: the line, or for minified code the enclosing quoted literal (best effort)."""
    ls, le = text.rfind("\n", 0, a) + 1, text.find("\n", b)
    le = len(text) if le < 0 else le
    if le - ls <= 400:
        return text[ls:le]
    q = max(text.rfind(c, max(ls, a - 400), a) for c in "'\"`")
    if q >= 0:
        e = text.find(text[q], b)
        if 0 <= e - q <= 800:
            return text[q:e + 1]
    return text[max(ls, a - 120):min(le, b + 120)]


COMMENT = re.compile(r"^\s*(#|//|\*|/\*)")


def scan_text(name: str, text: str, word, keep, allow, hits, allowed):
    for m in word.finditer(text):
        ctx = _context(text, m.start(), m.end())
        window = text[max(0, m.start() - 120):m.end() + 120]
        if COMMENT.match(ctx) or any(k.search(ctx) or k.search(window) for k in keep):
            continue
        rule = next((why for rx, why in allow if rx.search(ctx)), None)
        (allowed if rule else hits).append({"file": name, "context": ctx[:300], **({"allow": rule} if rule else {})})


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--text", nargs="*", default=[], type=Path)
    ap.add_argument("--dir", nargs="*", default=[], type=Path)
    ap.add_argument("--ext", nargs="*", default=[".js", ".mjs", ".cjs", ".html", ".json", ".txt", ".yaml", ".py"])
    ap.add_argument("--rules", type=Path, default=HERE / "rebrand/rules.yaml")
    ap.add_argument("--allow", type=Path, default=HERE / "scan-allow.txt")
    ap.add_argument("--report", type=Path)
    ap.add_argument("--label", default="scan")
    a = ap.parse_args()
    word, keep = load(a.rules)
    allow = allow_list(a.allow)
    hits: list[dict] = []
    allowed: list[dict] = []
    n = 0
    for f in sorted(a.text):
        n += 1
        scan_text(f.name, f.read_text(encoding="utf-8", errors="replace"), word, keep, allow, hits, allowed)
    for d in a.dir:
        for f in sorted(p for p in d.rglob("*") if p.is_file() and p.suffix in a.ext and "node_modules" not in p.parts):
            n += 1
            scan_text(f.relative_to(d).as_posix(), f.read_text(encoding="utf-8", errors="replace"), word, keep, allow,
                      hits, allowed)
    rep = {"label": a.label, "files": n, "visible_hermes": len(hits), "whitelisted": len(allowed),
           "hits": hits, "whitelisted_hits": allowed}
    if a.report:
        a.report.write_text(json.dumps(rep, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{a.label}: {n} fichiers, {len(hits)} « Hermes » visible(s) hors liste blanche, {len(allowed)} en liste blanche")
    for h in hits[:30]:
        print(f"  HIT {h['file']}: …{h['context'][:150]}…")
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
