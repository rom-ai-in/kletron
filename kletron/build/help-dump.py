#!/usr/bin/env python3
"""Dump the --help text of EVERY CLI (sub)command of the tree it runs from, in-process (fast, complete).

Hooks argparse: the first parse of the real `hermes` / `kletron` entry point hands us the fully built parser
tree; every parser reachable through sub-command actions is rendered with format_help() into OUT/<path>.txt.
Usage: <venv>/bin/python kletron/build/help-dump.py OUT_DIR   (HERMES_HOME should point to a fresh dir)
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
os.environ.setdefault("COLUMNS", "100")
_orig = argparse.ArgumentParser.parse_known_args
_done = []


def _walk(parser: argparse.ArgumentParser, path: list[str], seen: set[int]) -> int:
    if id(parser) in seen:
        return 0
    seen.add(id(parser))
    (OUT / ("_".join(path) or "_root")).with_suffix(".txt").write_text(parser.format_help(), encoding="utf-8")
    n = 1
    for action in parser._actions:
        if isinstance(action, argparse._SubParsersAction):
            for name, sub in sorted(action.choices.items()):
                n += _walk(sub, path + [name], seen)
    return n


def _hook(self, args=None, namespace=None):
    if not _done and any(isinstance(a, argparse._SubParsersAction) for a in self._actions):
        _done.append(_walk(self, [], set()))
        print(f"help-dump: {_done[0]} parsers -> {OUT}")
        raise SystemExit(0)
    return _orig(self, args, namespace)


argparse.ArgumentParser.parse_known_args = _hook
sys.argv = ["kletron", "--help"]
from hermes_cli.main import main

main()
