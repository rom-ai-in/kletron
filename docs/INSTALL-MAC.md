# Installer Kletron sur macOS (depuis cette archive source)

**État :** archive source uniquement. Aucun `.dmg` / `.app` signé n’est fourni ici.
Un build Desktop macOS produit sur Linux **n’est pas** une validation native macOS.

## Prérequis Mac
- macOS 13+ (Ventura ou plus récent recommandé)
- Xcode Command Line Tools : `xcode-select --install`
- Homebrew (recommandé)
- Git, Node.js ≥ 22, `uv` ≥ 0.13, Python 3.14 via uv

```bash
brew install git node uv
node -v   # >= 22
uv --version
```

## Installation CLI (reproductible)

```bash
# 1. Vérifier l’intégrité
shasum -a 256 -c SHA256SUMS.txt

# 2. Décompresser
tar -xJf kletron-0.22.7-k.1-src.tar.xz
cd kletron-0.22.7-k.1

# 3. Script local (venv hors arbre)
./scripts/kletron-install-mac.sh
```

Le script :
- crée `~/.kletron-venvs/agent` (hors checkout)
- `uv sync --locked` + editable install
- `npm ci` à la racine (Desktop optionnel, désactivé par défaut)

## Desktop (optionnel, non validé depuis Linux)

```bash
INCLUDE_DESKTOP=1 ./scripts/kletron-install-mac.sh
# puis, sur le Mac uniquement :
cd apps/desktop && npm run dist:mac:dmg
```

Critères avant de dire « OK pour le Mac » : voir `meta/MAC-GO-CRITERIA.md`.

## Mise à jour depuis GitHub (après push `dev`)

```bash
git clone -b dev https://github.com/rom-ai-in/kletron.git
cd kletron
./scripts/kletron-install-mac.sh
```

Ancien tip v1 : `git fetch origin archive/kletron-v1-dev-2026-11-05`
