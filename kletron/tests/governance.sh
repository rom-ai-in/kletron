#!/usr/bin/env bash
# Kletron governance — blocking checks of the fork contract (docs/06-STRATEGIE-FORK-AMONT.md).
# Run from anywhere inside the repo. Exit 0 = ALL PASS. Needs: git, python3 (.venv), node.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel)"; cd "$ROOT"
BASE="${BASE:-upstream-base}"
PY="${HERMES_PYTHON:-${KLETRON_VENV:-/workspace/kletron/.venvs/agent}/bin/python}"; [ -x "$PY" ] || PY="$ROOT/.venv/bin/python"; [ -x "$PY" ] || PY=python3
fail=0; pass() { echo "PASS  $*"; }; ko() { echo "FAIL  $*"; fail=1; }; info() { echo "INFO  $*"; }

# 1. Budget (blocking thresholds) + DEP-3 headers + 0 upstream test + 0 binary asset modified in place
if out="$("$PY" kletron/tools/budget.py --base "$BASE" --check 2>&1)"; then
  pass "budget: $(echo "$out" | awk '/^(patches|upstream_files_modified|contact_lines|upstream_tests_modified) /{printf "%s=%s ", $1, $2}')"
else ko "budget hors seuils / DEP-3:"; echo "$out" | sed 's/^/      /'; fi

# 2. Licence: LICENSE byte-identical to upstream, NOTICE present (origin, MIT, non-affiliation)
git diff --quiet "$BASE" -- LICENSE && pass "LICENSE identique à $BASE" || ko "LICENSE modifié"
if [ -f NOTICE ] && grep -q 'Nous Research' NOTICE && grep -q 'MIT' NOTICE && grep -qi 'not affiliated' NOTICE; then
  pass "NOTICE présent (origine, MIT, non-affiliation)"; else ko "NOTICE absent ou incomplet"; fi

# 3. Patch queue: applies on BASE with git am --3way and reproduces HEAD (outside the overlay)
TMP="$(mktemp -d)"; WT="$TMP/wt"; git worktree add -q --detach "$WT" "$BASE"; ok=1
while read -r p; do case "$p" in ''|\#*) continue;; esac
  git -C "$WT" -c user.name=gov -c user.email=gov@invalid am --3way --quiet "$ROOT/kletron/patches/$p" >/dev/null 2>&1 \
    || { ko "patch $p ne s'applique pas sur $BASE"; git -C "$WT" am --abort >/dev/null 2>&1; ok=0; break; }
done < kletron/patches/series
if [ $ok = 1 ]; then
  d="$(git diff --stat "$(git -C "$WT" rev-parse HEAD)" HEAD -- . ':(exclude)kletron' ':(exclude).github/workflows/kletron-ci.yml' ':(exclude)apps/desktop/src/plugins/kletron-validations' | tail -1)"
  [ -z "$d" ] && pass "base + series == HEAD hors overlay ($(grep -cv -E '^\s*(#|$)' kletron/patches/series) patchs)" || ko "HEAD diverge de base+series: $d"
fi
git worktree remove --force "$WT" >/dev/null 2>&1; rm -rf "$TMP"
for c in $(git rev-list "$BASE"..HEAD); do s="$(git log -1 --format=%s "$c")"
  [[ "$s" =~ ^kletron-patch:\ [0-9]{4}\ |^kletron:\ overlay ]] || ko "commit hors convention entre $BASE et HEAD: $s"; done

# 4. Push remotes: only DISABLED-no-push or https://github.com/rom-ai-in/kletron.git (Romain t10u/t11u)
bad="$(git remote -v | awk '''$3=="(push)" && $2!="DISABLED-no-push" && $2!="https://github.com/rom-ai-in/kletron.git" && $2!="git@github.com:rom-ai-in/kletron.git"{print $1" "$2}''')"
[ -z "$bad" ] && pass "push remotes OK (disabled ou rom-ai-in/kletron)" || ko "remote(s) push non autorisé: $bad"

# 5. Identity (patch 0001)
idn="$(cd apps/desktop && HERMES_DESKTOP_VARIANT= node -e "const i=require('./product-identity.cjs');console.log(i.displayName+'|'+i.appId)" 2>&1)"
[ "$idn" = "Kletron|ch.numezis.kletron" ] && pass "Desktop: displayName/appId = $idn" || ko "Desktop identity: $idn"
grep -q '"productName": "Kletron"' apps/desktop/package.json && grep -q '"productName": "Kletron"' apps/bootstrap-installer/src-tauri/tauri.conf.json \
  && pass "productName Kletron (desktop + installer)" || ko "productName != Kletron"
grep -q 'kletron = "hermes_cli.main:main"' pyproject.toml && pass "alias console kletron" || ko "alias kletron absent de pyproject.toml"

# 6. Rebrand au BUILD (kletron/build/rebrand, modèle VSCodium/Cursor) : sources intactes, arbre jetable conforme
GB="$(mktemp -d)"
if out="$("$PY" kletron/build/rebrand/apply.py --ref HEAD --out "$GB/tree" --check 2>&1)"; then pass "rebrand --check: ${out%%$'\n'*}"
else ko "rebrand --check (littéral de données non revu / décision périmée):"; echo "$out" | sed 's/^/      /' | head -20; fi
o2="$("$PY" kletron/build/rebrand/apply.py --in-place "$GB/tree" 2>&1 | head -1)"
[[ "$o2" == "rebrand: 0 replaced in 0 files"* ]] && pass "rebrand idempotent (2e passe = 0)" || ko "rebrand non idempotent: $o2"
grep -q '<title>Kletron</title>' "$GB/tree/apps/desktop/index.html" && pass "build: titre de fenêtre Kletron" || ko "build: <title> != Kletron"
v="$(cd "$GB/tree" && HERMES_HOME="$GB/home" "$PY" -c "import sys; sys.argv=['kletron','--version']; from hermes_cli.main import main; main()" 2>/dev/null | head -1)"
[[ "$v" == "Kletron Agent v"* ]] && pass "build: --version = ${v%% (*}" || ko "build: --version '$v'"
git diff --quiet "$BASE" HEAD -- hermes_cli/_parser.py hermes_cli/banner.py apps/desktop/index.html locales \
  && pass "chaînes affichées non patchées (aucun diff vs $BASE : _parser, banner, index.html, locales)" || ko "chaîne affichée patchée dans le source (doit passer au build)"
rm -rf "$GB"
[ -d kletron/brand/apps/desktop/assets ] && pass "icônes Kletron en overlay (build --icons kletron/brand)" || ko "kletron/brand/apps/desktop/assets absent"

# 7. Nous neutralization (patch 0002)
grep -q 'kletron_netguard' hermes_cli/__init__.py && pass "garde DNS Python accrochée dans hermes_cli/__init__.py" || ko "hook netguard absent"
head -1 apps/desktop/electron/main.ts | grep -q "^import './kletron-netguard'" && pass "garde Electron importée en premier" || ko "main.ts: kletron-netguard pas en premier"
pub="$(cd apps/desktop && env -u KLETRON_UPDATE_URL -u CLOUDFLARE_R2_PUBLIC_URL -u _HERMES_CHANNEL_REQUEST_JSON GITHUB_REPOSITORY=NousResearch/hermes-agent \
  node -e "const c=require('./electron-builder.config.cjs');console.log(JSON.stringify([c.publish,c.mac.publish]))" 2>&1)"
[ "$pub" = '[null,null]' ] && pass "auto-update Desktop: aucun feed par défaut (publish null)" || ko "electron-builder publish: $pub"
grep -q 'NousResearch/hermes-agent/\${ref}' apps/desktop/electron/bootstrap-runner.ts && ko "installateur distant vers NousResearch" \
  || pass "installateur distant: KLETRON_INSTALL_SOURCE (vide = refusé)"
tel="$("$PY" -c "from hermes_cli.config_defaults import DEFAULT_CONFIG as C;s=C['telemetry']['shared_metrics'];print(s['enabled'],s['send'])" 2>&1)"
[ "$tel" = "False False" ] && pass "télémétrie amont: off par défaut (non patchée)" || ko "défauts télémétrie amont changés: $tel"
if out="$("$PY" kletron/tools/nous-refs.py 2>&1)"; then pass "inventaire NousResearch/ : $(echo "$out" | tail -1)"; else ko "inventaire NousResearch/ a dérivé:"; echo "$out" | sed 's/^/      /'; fi
for au in $(find apps/desktop/release -name app-update.yml 2>/dev/null); do
  grep -qiE 'nousresearch|provider: *github' "$au" && ko "$au pointe vers NousResearch/GitHub" || pass "$au sans NousResearch"; done

# 8. Upstream test deviations: every entry names a patch of the series
while IFS='|' read -r _ patch _; do patch="$(echo "$patch" | tr -d ' ')"; [ -z "$patch" ] && continue
  [ "$patch" = env ] && continue   # environment-only deviation (box/CI host), reason mandatory in the entry
  grep -q "^$patch-" kletron/patches/series || ko "déviation attribuée à un patch inconnu: $patch"; done < <(grep -v -E '^\s*(#|$)' kletron/tests/expected-upstream-deviations.txt)
pass "déviations attendues: $(grep -cv -E '^\s*(#|$)' kletron/tests/expected-upstream-deviations.txt) (rattachées à un patch de la series ou marquées env)"

# 9. Version scheme
vv="$(node kletron/tools/version.mjs 2>&1)" && pass "kletron/VERSION = $vv (X.Y.Z-k.N)" || ko "kletron/VERSION invalide: $vv"

# 10. Overlay hygiene: no bytecode committed, overlay Python lint-clean (hooks are skipped by apply-patches)
n="$(git ls-files kletron | grep -c -E '__pycache__|\.pyc$' || true)"; [ "$n" = 0 ] && pass "overlay sans bytecode" || ko "overlay: $n fichier(s) .pyc suivis"
RUFF="$(dirname "$PY")/ruff"; if [ -x "$RUFF" ]; then
  if "$RUFF" check -q kletron tests/kletron hermes_cli/kletron_*.py >/dev/null 2>&1; then pass "ruff: overlay + modules Kletron propres"; else ko "ruff: erreurs (ruff check kletron tests/kletron hermes_cli/kletron_*.py)"; fi
else info "ruff absent: lint overlay non vérifié"; fi

info "occurrences 'nousresearch.com' dans le dépôt (code+tests+docs, neutralisées à l'exécution): $(git grep -i -o -I 'nousresearch\.com' -- . ':(exclude)kletron' | wc -l)"
[ $fail = 0 ] && echo "GOVERNANCE: ALL PASS" || echo "GOVERNANCE: FAILED"
exit $fail
