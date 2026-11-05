#!/usr/bin/env bash
# Move upstream-base to a new upstream ref (stable tag, or a security-fix commit on main)
# and rebuild `kletron` by re-applying the patch queue. Fails explicitly on conflict.
# Usage: kletron/scripts/sync-upstream.sh <tag|sha> [--no-fetch]
#   weekly  : kletron/scripts/sync-upstream.sh v0.22.8
#   sécurité: kletron/scripts/sync-upstream.sh <sha-du-correctif-sur-main>
# Exit codes: 0 ok · 1 usage · 2 conflict (upstream-base and kletron untouched)
# Never pushes. Remote `upstream` must have no push URL.
set -euo pipefail
REF="${1:?usage: sync-upstream.sh <tag|sha> [--no-fetch]}"; FETCH=1; [ "${2:-}" = "--no-fetch" ] && FETCH=0
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
[ "$(git remote get-url --push upstream 2>/dev/null)" = "DISABLED-no-push" ] || echo "WARN: upstream push URL is not disabled" >&2
if [ "$FETCH" = 1 ]; then
  if [[ "$REF" =~ ^[0-9a-f]{7,40}$ ]]; then git fetch -q --no-tags upstream main
  else git fetch -q --no-tags upstream "refs/tags/$REF:refs/tags/$REF"; fi
fi
SHA="$(git rev-parse --verify "$REF^{commit}")"
OLD="$(git rev-parse --verify upstream-base)"
echo "upstream-base: $(git rev-parse --short "$OLD") -> $(git rev-parse --short "$SHA") ($REF)"
git merge-base --is-ancestor "$OLD" "$SHA" || echo "WARN: new ref is not a descendant of the current base" >&2

# Trial apply first (apply-patches works in a throw-away worktree and exits 2 on conflict).
git branch -f kletron-sync-trial "$SHA"
set +e; kletron/scripts/apply-patches.sh kletron-sync-trial kletron-sync-result; rc=$?; set -e
git branch -D -q kletron-sync-trial
if [ $rc -ne 0 ]; then
  git branch -D -q kletron-sync-result 2>/dev/null || true
  echo "SYNC FAILED (rc=$rc): refresh the conflicting patch (see kletron/README.md §Rafraîchir un patch). Nothing changed." >&2
  exit 2
fi
git branch -D -q kletron-sync-result
# Success: record the pin, move upstream-base, rebuild kletron.
sed -i "s|^UPSTREAM_REF=.*|UPSTREAM_REF=$REF|; s|^UPSTREAM_SHA=.*|UPSTREAM_SHA=$SHA|" kletron/UPSTREAM_REF
git branch -f upstream-base "$SHA"
kletron/scripts/apply-patches.sh upstream-base kletron
echo "SYNC OK: kletron rebuilt on $REF ($SHA). Run kletron/tests/governance.sh, then the upstream tests."
