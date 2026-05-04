#!/usr/bin/env bash
# Déploiement Kletron via Cloud Build (GCP uniquement).
#
# Prérequis:
#   gcloud auth login …   # compte avec accès au projet kletron
#   gcloud config set project kletron
#   ./infra/gcp/bootstrap.sh   # une fois (APIs, Artifact Registry, IAM Cloud Build)
#
# Usage:
#   ./infra/gcp/deploy.sh
#   NEXT_PUBLIC_APP_URL=https://kletron-web-xxxxx.europe-west6.run.app ./infra/gcp/deploy.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-europe-west6}"
WEB_SERVICE="${WEB_SERVICE:-kletron-web}"
MCP_SERVICE="${MCP_SERVICE:-kletron-mcp}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Définis le projet: gcloud config set project kletron"
  exit 1
fi

APP_URL="${NEXT_PUBLIC_APP_URL:-}"
if [[ -z "${APP_URL}" ]]; then
  echo "Pass NEXT_PUBLIC_APP_URL (URL publique du service web Cloud Run), ex.:"
  echo "  NEXT_PUBLIC_APP_URL=https://kletron-web-xxxx.europe-west6.run.app ./infra/gcp/deploy.sh"
  echo "(Pour un premier jet, mets une URL provisoire puis rebuild après la première création du service.)"
  APP_URL="https://placeholder.invalid"
fi

echo "Project=${PROJECT_ID}  REGION=${REGION}  NEXT_PUBLIC_APP_URL=${APP_URL}"

gcloud builds submit \
  --config=infra/gcp/cloudbuild.yaml \
  --substitutions="_NEXT_PUBLIC_APP_URL=${APP_URL}" \
  --project="${PROJECT_ID}" \
  .

echo ""
echo "Services Cloud Run (${REGION}):"
WEB_RUN_URL="$(gcloud run services describe "${WEB_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"
MCP_RUN_URL="$(gcloud run services describe "${MCP_SERVICE}" --project="${PROJECT_ID}" --region="${REGION}" --format='value(status.url)' 2>/dev/null || true)"
if [[ -n "${WEB_RUN_URL}" ]]; then
  echo "  Web:  ${WEB_RUN_URL}"
  echo "  OAuth Google — Authorized JavaScript origins:"
  echo "    ${WEB_RUN_URL}"
  echo "  OAuth Google — Authorized redirect URIs:"
  echo "    ${WEB_RUN_URL}/api/auth/connect/google-drive/callback"
  echo "    ${WEB_RUN_URL}/api/auth/connect/gmail/callback"
else
  echo "  (Impossible de lire l’URL — vérifie les droits IAM ou attends la fin du déploiement.)"
fi
if [[ -n "${MCP_RUN_URL}" ]]; then
  echo "  MCP:  ${MCP_RUN_URL}  (SSE: ${MCP_RUN_URL}/sse)"
fi
echo ""
echo "Lister les services:"
echo "  gcloud run services list --project=${PROJECT_ID} --platform=managed --region=${REGION}"
