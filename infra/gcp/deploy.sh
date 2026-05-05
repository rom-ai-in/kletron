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
EXPECTED_PROJECT="${EXPECTED_PROJECT:-kletron}"
ALLOW_NON_KLETRON_PROJECT="${ALLOW_NON_KLETRON_PROJECT:-false}"
REGION="${REGION:-europe-west6}"
AR_REPO="${AR_REPO:-kletron}"
WEB_SERVICE="${WEB_SERVICE:-kletron-web}"
MCP_SERVICE="${MCP_SERVICE:-kletron-mcp}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Définis le projet: gcloud config set project kletron"
  exit 1
fi

if [[ "${PROJECT_ID}" != "${EXPECTED_PROJECT}" && "${ALLOW_NON_KLETRON_PROJECT}" != "true" ]]; then
  echo "Refus de déployer vers le projet '${PROJECT_ID}'. Projet attendu: '${EXPECTED_PROJECT}'."
  echo "Override explicite uniquement si intentionnel: ALLOW_NON_KLETRON_PROJECT=true"
  exit 1
fi

APP_URL="${NEXT_PUBLIC_APP_URL:-}"
if [[ -z "${APP_URL}" ]]; then
  echo "Pass NEXT_PUBLIC_APP_URL (origine HTTPS publique du site), ex.:"
  echo "  NEXT_PUBLIC_APP_URL=https://www.kletron.com ./infra/gcp/deploy.sh"
  echo "ou l’URL Cloud Run directe tant que le certificat managé du LB est en PROVISIONING:"
  echo "  NEXT_PUBLIC_APP_URL=https://kletron-web-xxxx.europe-west6.run.app ./infra/gcp/deploy.sh"
  APP_URL="https://placeholder.invalid"
fi

echo "Project=${PROJECT_ID}  REGION=${REGION}  AR_REPO=${AR_REPO}  WEB_SERVICE=${WEB_SERVICE}  MCP_SERVICE=${MCP_SERVICE}"
echo "NEXT_PUBLIC_APP_URL=${APP_URL}"

gcloud builds submit \
  --config=infra/gcp/cloudbuild.yaml \
  --substitutions="_NEXT_PUBLIC_APP_URL=${APP_URL},_AR_REPO=${AR_REPO},_WEB_SERVICE=${WEB_SERVICE},_MCP_SERVICE=${MCP_SERVICE},_EXPECTED_PROJECT=${EXPECTED_PROJECT},_ALLOW_NON_KLETRON_PROJECT=${ALLOW_NON_KLETRON_PROJECT}" \
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
  echo "    ${WEB_RUN_URL}/api/auth/connect/google-calendar/callback"
else
  echo "  (Impossible de lire l’URL — vérifie les droits IAM ou attends la fin du déploiement.)"
fi
if [[ -n "${MCP_RUN_URL}" ]]; then
  echo "  MCP:  ${MCP_RUN_URL}  (SSE: ${MCP_RUN_URL}/sse)"
fi
echo ""
echo "Lister les services:"
echo "  gcloud run services list --project=${PROJECT_ID} --platform=managed --region=${REGION}"
echo ""
echo "Après un déploiement, réappliquer Secret Manager + variables runtime (Azure, Mongo, CORS, …) depuis .env:"
echo "  python3 infra/gcp/provision_secrets.py"
echo "Secret client Google OAuth seul (collé depuis la console Google):"
echo "  GOOGLE_OAUTH_CLIENT_SECRET='…' python3 infra/gcp/provision_secrets.py --google-secret-only"
