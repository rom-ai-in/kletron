#!/usr/bin/env bash
# Vertex AI bootstrap for Kletron on Cloud Run.
#
# What this does (idempotent):
#   1. Enables aiplatform.googleapis.com on project kletron.
#   2. Grants the Cloud Run web service account `roles/aiplatform.user`.
#   3. (Optional) Provisions a `kletron-gemini-api-key` Secret Manager entry
#      when GEMINI_API_KEY is set in the environment — for the direct
#      Gemini API path. The Vertex AI provider does not need this.
#
# Run this once per project, then run `./infra/gcp/deploy.sh`.
#
# Prereqs:
#   gcloud auth login <kletron-owning-account>
#   gcloud config set project kletron

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/kletron-project-guard.sh
source "${SCRIPT_DIR}/lib/kletron-project-guard.sh"

PROJECT_ID="${PROJECT_ID:-kletron}"
EXPECTED_PROJECT="${EXPECTED_PROJECT:-kletron}"
WEB_SERVICE_ACCOUNT="${WEB_SERVICE_ACCOUNT:-}"

if ! kletron_refuse_non_kletron_project "${PROJECT_ID}"; then
  exit $?
fi
kletron_warn_if_gcloud_project_mismatch "${EXPECTED_PROJECT}"

echo "==> Enabling Vertex AI API on ${PROJECT_ID}…"
gcloud services enable aiplatform.googleapis.com --project="${PROJECT_ID}"

# Default Cloud Run service account is <project-number>-compute@developer.gserviceaccount.com
if [[ -z "${WEB_SERVICE_ACCOUNT}" ]]; then
  PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  WEB_SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
fi

echo "==> Granting roles/aiplatform.user to ${WEB_SERVICE_ACCOUNT}…"
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${WEB_SERVICE_ACCOUNT}" \
  --role="roles/aiplatform.user" \
  --condition=None \
  >/dev/null

if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  echo "==> Provisioning kletron-gemini-api-key in Secret Manager…"
  if gcloud secrets describe kletron-gemini-api-key --project="${PROJECT_ID}" &>/dev/null; then
    printf '%s' "${GEMINI_API_KEY}" | gcloud secrets versions add kletron-gemini-api-key \
      --project="${PROJECT_ID}" --data-file=- >/dev/null
  else
    printf '%s' "${GEMINI_API_KEY}" | gcloud secrets create kletron-gemini-api-key \
      --project="${PROJECT_ID}" --replication-policy=automatic --data-file=- >/dev/null
  fi
  gcloud secrets add-iam-policy-binding kletron-gemini-api-key \
    --project="${PROJECT_ID}" \
    --member="serviceAccount:${WEB_SERVICE_ACCOUNT}" \
    --role="roles/secretmanager.secretAccessor" \
    --condition=None \
    >/dev/null
  echo "    To wire it into Cloud Run, add to cloudbuild.yaml RUN_SECRETS:"
  echo "      GEMINI_API_KEY=kletron-gemini-api-key:latest"
fi

echo ""
echo "Done. Next: NEXT_PUBLIC_APP_URL=https://www.kletron.com ./infra/gcp/deploy.sh"
echo ""
echo "After deploy, verify with:"
echo "  gcloud run services describe kletron-web --project=${PROJECT_ID} --region=europe-west6 \\"
echo "    --format='value(spec.template.spec.containers[0].env)' | grep -E 'GOOGLE_CLOUD|VERTEX'"
