#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose up -d mongo
npm install
npm run seed:demo
exec npm run dev
