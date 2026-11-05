#!/usr/bin/env bash
# OBSOLÈTE comme chemin de release : le Desktop Kletron se package UNIQUEMENT depuis l'arbre
# transformé par le rebrand au build (kletron/build/build.sh, modèle VSCodium/Cursor).
# Ce script reste un raccourci : il délègue à build.sh (BUILD_DIR par défaut /workspace/kletron/_out).
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
exec "$ROOT/kletron/build/build.sh" "$@"
