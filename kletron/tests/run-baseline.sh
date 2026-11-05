#!/usr/bin/env bash
# Kletron: re-run on pristine upstream-base (throw-away worktree, same interpreter, same host) the
# test files that failed in a Kletron run, so check-deviations.py --baseline can tell host/env
# failures (fail on upstream too) from patch-caused ones. Nothing in this checkout is touched.
# Usage: kletron/tests/run-baseline.sh <kletron-run.log> [-j N]  -> prints the baseline log path
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
RUN="${1:?usage: run-baseline.sh <kletron-run.log> [-j N]}"; J="${3:-4}"
export HERMES_PYTHON="${HERMES_PYTHON:-${KLETRON_VENV:-/workspace/kletron/.venvs/agent}/bin/python}"
mapfile -t FILES < <(grep -oE '^\s*(║\s*)?(FAILED|ERROR) tests/[^: ]+\.py|^\s+tests/\S+\.py(\s+\(|\s*$)|✗ tests/\S+\.py \(CRASHED' "$RUN" \
  | grep -oE 'tests/\S+\.py' | grep -v '^tests/kletron/' | sort -u)
[ "${#FILES[@]}" -gt 0 ] || { echo "no failing upstream file in $RUN" >&2; exit 0; }
WT="$(mktemp -d)/base"; git worktree add -q --detach "$WT" upstream-base
trap 'git worktree remove --force "$WT" 2>/dev/null || true' EXIT
[ -d node_modules ] && ln -s "$ROOT/node_modules" "$WT/node_modules"
LOG="${KLETRON_BASELINE_LOG:-${RUN%.log}.baseline.log}"
EXIST=(); for f in "${FILES[@]}"; do [ -e "$WT/$f" ] && EXIST+=("$f"); done
( cd "$WT" && scripts/run_tests.sh -j "$J" "${EXIST[@]}" ) > "$LOG" 2>&1
grep -E '^=== Summary' "$LOG" | tail -1; echo "$LOG"
