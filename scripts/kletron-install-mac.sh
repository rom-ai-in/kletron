#!/usr/bin/env bash
# Kletron — install local macOS/Linux from a source checkout or unpacked release.
# Does NOT download from Nous Research. Does NOT claim a signed Desktop build.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
INCLUDE_DESKTOP="${INCLUDE_DESKTOP:-0}"
VENV="${KLETRON_VENV:-$HOME/.kletron-venvs/agent}"

need() { command -v "$1" >/dev/null || { echo "missing: $1" >&2; exit 1; }; }
need git; need uv; need node; need npm

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then echo "Node >= 22 required (got $(node -v))" >&2; exit 1; fi

echo "==> venv: $VENV"
mkdir -p "$(dirname "$VENV")"
export UV_PROJECT_ENVIRONMENT="$VENV"
uv sync --locked --python 3.14 --inexact --extra all --group dev --group test
uv pip install --python "$VENV/bin/python" -e . --no-deps
export PATH="$VENV/bin:$PATH" HERMES_PYTHON="$VENV/bin/python"

echo "==> npm ci (workspace)"
npm ci --no-audit --no-fund

if [ "$INCLUDE_DESKTOP" = 1 ]; then
  echo "==> Desktop deps (build on THIS machine only for a real macOS artifact)"
  (cd apps/desktop && npm ci --no-audit --no-fund)
  echo "Desktop sources ready. To pack on macOS: cd apps/desktop && npm run dist:mac:dmg"
  echo "WARNING: do not treat a Linux-built macOS binary as validated."
fi

echo "==> smoke"
HERMES_HOME="${HERMES_HOME:-$(mktemp -d)}" "$VENV/bin/kletron" --version || \
  HERMES_HOME="${HERMES_HOME:-$(mktemp -d)}" "$VENV/bin/hermes" --version
echo "OK: CLI install complete. See meta/MAC-GO-CRITERIA.md before client use."
