#!/usr/bin/env bash
# Déploiement Kletron via Cloud Build (GCP uniquement).
#
# Prérequis:
#   gcloud auth login …   # compte avec accès au projet kletron
# Le script cible toujours PROJECT_ID=kletron par défaut (pas la config gcloud active).
#   ./infra/gcp/bootstrap.sh   # une fois (APIs, Artifact Registry, IAM Cloud Build)
#
# Usage:
#   ./infra/gcp/deploy.sh
#   NEXT_PUBLIC_APP_URL=https://kletron-web-xxxxx.europe-west6.run.app ./infra/gcp/deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/kletron-project-guard.sh
source "${SCRIPT_DIR}/lib/kletron-project-guard.sh"

ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "$ROOT"

# Toujours kletron par défaut — ne jamais prendre `gcloud config get-value project` (risque numezis-*).
PROJECT_ID="${PROJECT_ID:-kletron}"
EXPECTED_PROJECT="${EXPECTED_PROJECT:-kletron}"
ALLOW_NON_KLETRON_PROJECT="${ALLOW_NON_KLETRON_PROJECT:-false}"
REGION="${REGION:-europe-west6}"
AR_REPO="${AR_REPO:-kletron}"
WEB_SERVICE="${WEB_SERVICE:-kletron-web}"
MCP_SERVICE="${MCP_SERVICE:-kletron-mcp}"

if ! kletron_refuse_non_kletron_project "${PROJECT_ID}"; then
  exit $?
fi

kletron_warn_if_gcloud_project_mismatch "${EXPECTED_PROJECT}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "PROJECT_ID vide. Déploiement Kletron: PROJECT_ID=kletron (défaut)."
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

# Do not pass URL via `gcloud --substitutions=...`: keys/values with ':' (https://) break the CLI parser.
CLOUD_BUILD_TMP="$(mktemp "${TMPDIR:-/tmp}/kletron-cloudbuild.XXXXXX.yaml")"
cleanup_cloudbuild_tmp() {
  rm -f "${CLOUD_BUILD_TMP}"
}
trap cleanup_cloudbuild_tmp EXIT

cp "${SCRIPT_DIR}/cloudbuild.yaml" "${CLOUD_BUILD_TMP}"

replace_yaml_subst() {
  local key="$1"
  local val="$2"
  local esc tmp_out
  esc="$(printf '%s\n' "${val}" | sed -e 's/[\/&]/\\&/g')"
  tmp_out="$(mktemp)"
  sed -E "s|^([[:space:]]*)${key}:.*|\\1${key}: ${esc}|" "${CLOUD_BUILD_TMP}" > "${tmp_out}"
  mv "${tmp_out}" "${CLOUD_BUILD_TMP}"
}

replace_yaml_subst "_NEXT_PUBLIC_APP_URL" "${APP_URL}"
replace_yaml_subst "_AR_REPO" "${AR_REPO}"
replace_yaml_subst "_WEB_SERVICE" "${WEB_SERVICE}"
replace_yaml_subst "_MCP_SERVICE" "${MCP_SERVICE}"
replace_yaml_subst "_EXPECTED_PROJECT" "${EXPECTED_PROJECT}"
replace_yaml_subst "_ALLOW_NON_KLETRON_PROJECT" "\"${ALLOW_NON_KLETRON_PROJECT}\""

# Vertex AI defaults — override via env: VERTEX_LOCATION=… VERTEX_MODEL=…
VERTEX_LOCATION="${VERTEX_LOCATION:-us-central1}"
VERTEX_MODEL="${VERTEX_MODEL:-gemini-2.5-pro}"
replace_yaml_subst "_VERTEX_LOCATION" "${VERTEX_LOCATION}"
replace_yaml_subst "_VERTEX_MODEL" "${VERTEX_MODEL}"

gcloud builds submit \
  --config="${CLOUD_BUILD_TMP}" \
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
