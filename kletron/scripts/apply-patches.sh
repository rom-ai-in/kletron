#!/usr/bin/env bash
# Rebuild branch `kletron` = <base> + patches/series + overlay commit (kletron/ dir).
# Usage: kletron/scripts/apply-patches.sh [BASE_REF=upstream-base] [TARGET_BRANCH=kletron]
# Exit codes: 0 ok · 1 usage/dirty tree · 2 patch conflict (nothing changed on TARGET)
set -euo pipefail
BASE="${1:-upstream-base}"
TARGET="${2:-kletron}"
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
OVERLAY=(kletron .github/workflows/kletron-ci.yml apps/desktop/src/plugins/kletron-validations)

git rev-parse --verify -q "$BASE^{commit}" >/dev/null || { echo "ERROR: base '$BASE' not found" >&2; exit 1; }
if [ -n "$(git status --porcelain --untracked-files=no -- . ':(exclude)kletron' ':(exclude).github/workflows/kletron-ci.yml')" ]; then
  echo "ERROR: working tree has changes outside the overlay; commit or stash first" >&2; exit 1
fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
for p in "${OVERLAY[@]}"; do [ -e "$p" ] && { mkdir -p "$TMP/$(dirname "$p")"; cp -a "$p" "$TMP/$p"; }; done
find "$TMP" -name __pycache__ -prune -exec rm -rf {} + ; find "$TMP" -name '*.pyc' -delete   # never commit bytecode
[ -f "$TMP/kletron/patches/series" ] || { echo "ERROR: kletron/patches/series missing" >&2; exit 1; }

# 1) Trial run in a throw-away worktree: TARGET is untouched if anything conflicts.
WT="$TMP/wt"; git worktree add -q --detach "$WT" "$BASE"
cleanup_wt() { git worktree remove --force "$WT" 2>/dev/null || true; }
n=0
while read -r patch; do
  case "$patch" in ''|\#*) continue;; esac
  n=$((n+1))
  if ! git -C "$WT" -c user.name="${GIT_AUTHOR_NAME:-Kletron}" -c user.email="${GIT_AUTHOR_EMAIL:-kletron@invalid}" \
        am --3way --quiet --committer-date-is-author-date "$TMP/kletron/patches/$patch"; then
    echo "CONFLICT: $patch does not apply on $BASE ($(git rev-parse --short "$BASE"))" >&2
    git -C "$WT" diff --name-only --diff-filter=U | sed 's/^/  conflicted: /' >&2 || true
    git -C "$WT" am --abort 2>/dev/null || true
    cleanup_wt; exit 2
  fi
  echo "applied: $patch"
done < "$TMP/kletron/patches/series"
[ "$n" -le 5 ] || { echo "ERROR: $n code patches in series (max 5, 00-STRATEGIE §4)" >&2; cleanup_wt; exit 1; }

# 2) Overlay commit (patch queue, scripts, governance tests, CI draft).
for p in "${OVERLAY[@]}"; do [ -e "$TMP/$p" ] && { mkdir -p "$WT/$(dirname "$p")"; rm -rf "$WT/$p"; cp -a "$TMP/$p" "$WT/$p"; git -C "$WT" add -f -- "$p"; }; done
# Deterministic overlay SHA: reuse the last patch's date (same inputs -> same commit).
D="$(git -C "$WT" log -1 --format=%aI)"
GIT_AUTHOR_DATE="$D" GIT_COMMITTER_DATE="$D" git -C "$WT" -c user.name="${GIT_AUTHOR_NAME:-Kletron}" -c user.email="${GIT_AUTHOR_EMAIL:-kletron@invalid}" \
  commit -q --no-verify -m "kletron: overlay (patch queue, scripts, governance tests, CI draft)"
NEW="$(git -C "$WT" rev-parse HEAD)"; cleanup_wt

# 3) Move TARGET to the result.
if [ "$(git symbolic-ref -q --short HEAD || true)" = "$TARGET" ]; then git reset -q --hard "$NEW"; else git branch -f "$TARGET" "$NEW"; fi
echo "OK: $TARGET = $BASE + $n patch(es) + overlay -> $(git rev-parse --short "$NEW")"
