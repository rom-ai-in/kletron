#!/usr/bin/env bash
# Regenerate kletron/patches/*.patch + series from commits titled "kletron-patch: NNNN <slug> …"
# between upstream-base and HEAD (the overlay commit is ignored).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
BASE="${1:-upstream-base}"; OUT=kletron/patches
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
{ echo "# Kletron patch queue — applied in order with \`git am --3way\` on top of upstream-base."
  echo "# Max 5 code patches (00-STRATEGIE §4). Planned patches live in ../planned/ until implemented."; } > "$TMP/series"
for c in $(git rev-list --reverse "$BASE"..HEAD); do
  subj="$(git log -1 --format=%s "$c")"
  [[ "$subj" =~ ^kletron-patch:\ ([0-9]{4})\ ([a-z0-9-]+) ]] || continue
  name="${BASH_REMATCH[1]}-${BASH_REMATCH[2]}.patch"
  git format-patch -1 --stdout --binary --no-signature --zero-commit "$c" -- . ':(exclude)kletron' > "$TMP/$name"
  echo "$name" >> "$TMP/series"; echo "exported: $name"
done
rm -f "$OUT"/*.patch; cp "$TMP"/*.patch "$OUT"/ 2>/dev/null || true; cp "$TMP/series" "$OUT/series"
