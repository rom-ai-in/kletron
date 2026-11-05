#!/usr/bin/env bash
# Kletron: run the upstream tests closest to the patches (no network, no LLM keys), then compare the
# failures with kletron/tests/expected-upstream-deviations.txt (upstream tests are never edited).
# Usage: kletron/tests/run-upstream-subset.sh [-j N] [--impacted]   (--impacted: every test file that
# mentions a patched module; full suite: scripts/run_tests.sh, then check-deviations.py --pytest-log)
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
J=6; MODE=subset
while [ $# -gt 0 ]; do case "$1" in -j) J="$2"; shift 2;; --impacted) MODE=impacted; shift;; *) shift;; esac; done
# The interpreter MUST live outside the checkout: with an in-tree .venv/venv, upstream
# hermes_cli/update_owning_install.py re-runs `update` tests against THIS checkout (real
# updater, real git). Create it with: UV_PROJECT_ENVIRONMENT=/workspace/kletron/.venvs/agent uv sync ...
export HERMES_PYTHON="${HERMES_PYTHON:-${KLETRON_VENV:-/workspace/kletron/.venvs/agent}/bin/python}"
case "$(cd "$(dirname "$HERMES_PYTHON")/.." && pwd -P)" in "$(pwd -P)"/*)
  echo "ERROR: HERMES_PYTHON is inside the checkout ($HERMES_PYTHON); use an out-of-tree venv" >&2; exit 1;; esac
[ -x "$HERMES_PYTHON" ] || { echo "ERROR: $HERMES_PYTHON not found (see SETUP-LOCAL §3)" >&2; exit 1; }
BEFORE="$(git status --porcelain --untracked-files=no)"
shopt -s nullglob globstar
if [ "$MODE" = impacted ]; then
  mapfile -t EXIST < <(rg -l -e 'model_catalog|local_runtime|_parser|hermes_cli\.banner|_startup_fast|source_releases|source_check|update_cmd|getaddrinfo|--version|Hermes Agent v' tests --glob '*.py' | sort)
else
  FILES=(tests/acp_adapter tests/agent/test_legacy_cli.py tests/hermes_cli/test_startup_fast_guards.py
         tests/plugins/config_backends tests/security tests/tools/test_approval*.py
         tests/**/test_managed_scope*.py tests/**/test_banner*.py tests/kletron
         tests/hermes_cli/test_shared_metrics*.py tests/hermes_cli/test_relay_shared_metrics*.py
         tests/**/test_i18n*.py tests/agent/test_i18n*.py tests/hermes_cli/test_model_catalog*.py
         tests/hermes_cli/test_local_runtime*.py tests/hermes_cli/test_source_*.py tests/hermes_cli/test_parser*.py)
  EXIST=(); for f in "${FILES[@]}"; do [ -e "$f" ] && EXIST+=("$f"); done
fi
LOG="${KLETRON_TEST_LOG:-$(mktemp -t kletron-subset.XXXX.log)}"
scripts/run_tests.sh -j "$J" "${EXIST[@]}" > "$LOG" 2>&1; rc=$?
AFTER="$(git status --porcelain --untracked-files=no)"
if [ "$BEFORE" != "$AFTER" ]; then
  echo "ERROR: the test run modified tracked files of this checkout:" >&2
  diff <(echo "$BEFORE") <(echo "$AFTER") >&2; rc=97
fi
grep -E '^=== Summary' "$LOG" | tail -1
echo "log: $LOG (run_tests rc=$rc)"
"$HERMES_PYTHON" kletron/tests/check-deviations.py --pytest-log "$LOG" || exit 1
[ "$rc" -ne 97 ] || exit 97
