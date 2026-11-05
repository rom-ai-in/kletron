#!/usr/bin/env bash
# Kletron — BUILD with rebrand (VSCodium/Cursor model): repository sources are never modified.
#   1. export REF into a throw-away tree and rewrite displayed strings (rebrand/apply.py --check)
#   2. idempotence (2nd pass = 0 change) and determinism (2nd export = same manifest)
#   3. CLI: install stamp + venv (uv, offline cache) on the TRANSFORMED tree, --help of every sub-command, scan
#   4. Desktop (Linux dir): pack from the transformed tree (Kletron icons via --icons), asar scan, no app-update.yml
# Usage: kletron/build/build.sh [REF=refs/heads/kletron]   env: BUILD_DIR (default /workspace/kletron/_out),
#        KLETRON_SKIP_DESKTOP=1, HERMES_PYTHON (python with ruamel.yaml, for the build scripts)
# Exit 0 = every check passed. Summary: $BUILD_DIR/build-summary.txt
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
REF="${1:-refs/heads/kletron}"
B="${BUILD_DIR:-/workspace/kletron/_out}"; T="$B/tree"
PY="${HERMES_PYTHON:-${KLETRON_VENV:-/workspace/kletron/.venvs/agent}/bin/python}"
mkdir -p "$B"; LOG="$B/logs"; rm -rf "$LOG"; mkdir -p "$LOG"
SUM="$B/build-summary.txt"; : > "$SUM"
say() { echo "$*" | tee -a "$SUM"; }
fail() { say "FAIL  $*"; exit 1; }
say "kletron build: ref $REF = $(git rev-parse --short "$REF") -> $B"

# 1. rebrand
"$PY" kletron/build/rebrand/apply.py --ref "$REF" --out "$T" --check | tee "$LOG/rebrand.txt" || fail "rebrand --check (littéral de données non revu ou décision périmée)"
say "PASS  rebrand: $(head -1 "$LOG/rebrand.txt" | sed 's/^rebrand: //')"
cp "$B/rebrand-manifest.sha256" "$LOG/manifest-1.sha256"

# 2. idempotence + determinism
"$PY" kletron/build/rebrand/apply.py --in-place "$T" --check | tee "$LOG/idempotence.txt"
grep -q '^rebrand: 0 replaced in 0 files' "$LOG/idempotence.txt" && say "PASS  idempotence: 2e passe = 0 remplacement" || fail "idempotence: $(head -1 "$LOG/idempotence.txt")"
rm -rf "$B/det"; "$PY" kletron/build/rebrand/apply.py --ref "$REF" --out "$B/det/tree" >/dev/null
cmp -s "$B/det/rebrand-manifest.sha256" "$LOG/manifest-1.sha256" \
  && say "PASS  déterminisme: 2e export identique ($(wc -l < "$LOG/manifest-1.sha256") fichiers, manifeste $(sha256sum "$LOG/manifest-1.sha256" | cut -c1-12))" \
  || fail "déterminisme: manifestes différents"
rm -rf "$B/det"
"$PY" kletron/build/scan.py --label locales --dir "$T/locales" --report "$LOG/scan-locales.json" | tee -a "$SUM" || fail "locales"

# 3. CLI on the transformed tree
C="$(git rev-parse "$REF")"
"$PY" scripts/write_install_stamp.py --output "$T/install-stamp.json" --commit "$C" --branch "${REF#refs/heads/}" \
  --base-version "$(cut -d- -f1 kletron/VERSION)" --display-version "$(node kletron/tools/version.mjs)" \
  --commit-date "$(git log -1 --format=%ct "$C")" --update-mechanism external --source local > "$LOG/stamp.txt" 2>&1
(cd "$T" && UV_PROJECT_ENVIRONMENT="$B/venv" uv sync --locked --offline --python 3.14 --extra all > "$LOG/uv-sync.txt" 2>&1) \
  || (cd "$T" && UV_PROJECT_ENVIRONMENT="$B/venv" uv sync --locked --python 3.14 --extra all >> "$LOG/uv-sync.txt" 2>&1) || fail "uv sync (voir $LOG/uv-sync.txt)"
HH="$(mktemp -d)"; rm -rf "$B/help"
HERMES_HOME="$HH" "$B/venv/bin/kletron" --version > "$LOG/kletron-version.txt" 2>&1
HERMES_HOME="$HH" "$B/venv/bin/kletron" --help > "$LOG/kletron-help.txt" 2>&1
HERMES_HOME="$HH" "$B/venv/bin/python" kletron/build/help-dump.py "$B/help" > "$LOG/help-dump.txt" 2>&1 || fail "help-dump"
rm -rf "$HH"
grep -q '^Kletron Agent v' "$LOG/kletron-version.txt" && say "PASS  kletron --version: $(head -1 "$LOG/kletron-version.txt")" || fail "--version: $(head -1 "$LOG/kletron-version.txt")"
(cd / && "$B/venv/bin/python" -c "import sys, hermes_cli; assert hermes_cli.__file__.startswith('$T/'), hermes_cli.__file__") || fail "venv n'importe pas l'arbre transformé"
say "PASS  CLI importée depuis l'arbre transformé ($(cat "$LOG/help-dump.txt"))"
"$PY" kletron/build/scan.py --label cli-help --text "$B"/help/*.txt "$LOG/kletron-help.txt" "$LOG/kletron-version.txt" --report "$LOG/scan-cli.json" | tee -a "$SUM" || fail "aide CLI"

# 4. Desktop
if [ "${KLETRON_SKIP_DESKTOP:-0}" = 1 ]; then say "SKIP  Desktop (KLETRON_SKIP_DESKTOP=1)"; say "BUILD: ALL PASS"; exit 0; fi
for d in . apps/desktop ui-tui web; do [ -d "$ROOT/$d/node_modules" ] || fail "$d/node_modules absent (npm ci d'abord)"
  rm -rf "$T/$d/node_modules"; cp -a "$ROOT/$d/node_modules" "$T/$d/node_modules"; done   # real copy: lock-pinned checks use realpath
[ -d "$ROOT/apps/desktop/build/packager" ] && { mkdir -p "$T/apps/desktop/build"; cp -a "$ROOT/apps/desktop/build/packager" "$T/apps/desktop/build/"; }  # electron zip cache
# Kletron DMG background: replace Nous artwork in the throwaway tree only (filename kept for upstream config path).
if [ -f "$T/kletron/build/rebrand/assets/kletron-dmg-2b.tiff" ]; then
  mkdir -p "$T/apps/desktop/packaging"
  cp -f "$T/kletron/build/rebrand/assets/kletron-dmg-2b.tiff" "$T/apps/desktop/packaging/nous-dmg-2b.tiff"
  say "PASS  DMG background: Kletron placeholder tiff staged (throwaway tree)"
fi
(cd "$T/apps/desktop" && node scripts/build.mjs --icons "$T/kletron/brand" && npm run builder -- --dir --publish never) > "$LOG/pack.txt" 2>&1 || fail "pack Desktop (voir $LOG/pack.txt)"
APP="$T/apps/desktop/release/linux-unpacked"; [ -x "$APP/Kletron" ] || fail "exécutable Kletron absent"
au="$(find "$T/apps/desktop/release" -name app-update.yml)"; [ -z "$au" ] && say "PASS  Desktop: aucun app-update.yml (pas de feed)" || { grep -qiE 'nousresearch|provider: *github' $au && fail "app-update.yml -> NousResearch"; say "PASS  app-update.yml sans NousResearch"; }
rm -rf "$B/asar"; node -e "require('@electron/asar').extractAll(process.argv[1], process.argv[2])" "$APP/resources/app.asar" "$B/asar"
"$PY" kletron/build/scan.py --label desktop-asar --dir "$B/asar" --report "$LOG/scan-asar.json" | tee -a "$SUM" || fail "asar Desktop"
say "PASS  Desktop packé: $APP/Kletron"
say "BUILD: ALL PASS"
