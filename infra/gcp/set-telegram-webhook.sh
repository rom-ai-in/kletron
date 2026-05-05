#!/usr/bin/env bash
# Register Telegram Bot API webhook for Kletron production (HTTPS only).
#
# Requires:
#   CHANNEL_TELEGRAM_BOT_TOKEN — bot token (env or repo-root .env)
#   CHANNEL_TELEGRAM_WEBHOOK_SECRET — must match server env / Secret Manager (env or .env)
#
# Optional:
#   KLETRON_WEBHOOK_PUBLIC_BASE — default https://www.kletron.com (no trailing slash)
#
# GCP: use project kletron for deployments; this script only calls api.telegram.org.
# Run: ./infra/gcp/set-telegram-webhook.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
# shellcheck source=lib/kletron-project-guard.sh
source "${SCRIPT_DIR}/lib/kletron-project-guard.sh"

if [[ -n "${GCP_PROJECT_ID:-}" ]]; then
  kletron_refuse_non_kletron_project "${GCP_PROJECT_ID}" || exit 2
fi

load_dotenv() {
  local f="$ROOT/.env"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

load_dotenv

TOKEN="${CHANNEL_TELEGRAM_BOT_TOKEN:-}"
SECRET="${CHANNEL_TELEGRAM_WEBHOOK_SECRET:-}"
BASE="${KLETRON_WEBHOOK_PUBLIC_BASE:-https://www.kletron.com}"
BASE="${BASE%/}"

if [[ -z "$TOKEN" ]]; then
  echo "Missing CHANNEL_TELEGRAM_BOT_TOKEN (export or add to .env)." >&2
  exit 1
fi
if [[ -z "$SECRET" ]]; then
  echo "Missing CHANNEL_TELEGRAM_WEBHOOK_SECRET — required so Telegram sends X-Telegram-Bot-Api-Secret-Token." >&2
  exit 1
fi

URL="${BASE}/api/webhooks/channels/telegram"
echo "Setting webhook to: ${URL}"

RESP="$(curl -sS "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  --data-urlencode "url=${URL}" \
  --data-urlencode "secret_token=${SECRET}")"

echo "$RESP"
if echo "$RESP" | grep -q '"ok":true'; then
  curl -sS "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | head -c 800
  echo ""
  echo "Done. In Kletron web: link Telegram user id + workspace channel graph (Messenger channels)."
else
  exit 1
fi
