#!/usr/bin/env bash
# One-time (or idempotent) GCP setup for Kletron on Cloud Run.
#
# Prérequis locaux:
#   gcloud auth login <your-account@example.com>
#
# Usage (projet implicite kletron):
#   ./infra/gcp/bootstrap.sh
#
# Ensuite: créer les secrets dans Secret Manager (exemples de noms ci‑dessous),
# puis adapter infra/gcp/cloudbuild.yaml (--set-secrets sur deploy) ou
# définir les variables à la main:
#   gcloud run services update kletron-web --set-secrets=...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/kletron-project-guard.sh
source "${SCRIPT_DIR}/lib/kletron-project-guard.sh"

# Toujours kletron par défaut — ne pas dériver du projet gcloud actif (numezis-new, etc.).
PROJECT_ID="${PROJECT_ID:-kletron}"
EXPECTED_PROJECT="${EXPECTED_PROJECT:-kletron}"
ALLOW_NON_KLETRON_PROJECT="${ALLOW_NON_KLETRON_PROJECT:-false}"
REGION="${REGION:-europe-west6}"
AR_REPO="${AR_REPO:-kletron}"

if ! kletron_refuse_non_kletron_project "${PROJECT_ID}"; then
  exit $?
fi

kletron_warn_if_gcloud_project_mismatch "${EXPECTED_PROJECT}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "PROJECT_ID vide. Bootstrap Kletron: PROJECT_ID=kletron"
  exit 1
fi

if [[ "${PROJECT_ID}" != "${EXPECTED_PROJECT}" && "${ALLOW_NON_KLETRON_PROJECT}" != "true" ]]; then
  echo "Refusing bootstrap on project '${PROJECT_ID}'. Expected '${EXPECTED_PROJECT}'."
  echo "Override explicitly only if intentional: ALLOW_NON_KLETRON_PROJECT=true"
  exit 1
fi

echo "Project: ${PROJECT_ID}  Region: ${REGION}  Artifact Registry repo: ${AR_REPO}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  iamcredentials.googleapis.com \
  --project="${PROJECT_ID}"

if gcloud artifacts repositories describe "${AR_REPO}" --location="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  echo "Artifact Registry repo '${AR_REPO}' already exists."
else
  gcloud artifacts repositories create "${AR_REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Kletron containers" \
    --project="${PROJECT_ID}"
fi

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
CB_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

echo "Granting Cloud Build SA (${CB_SA}) permissions to deploy Cloud Run and push images..."

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/run.admin" \
  >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/artifactregistry.writer" \
  >/dev/null

RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "${RUNTIME_SA}" \
  --member="serviceAccount:${CB_SA}" \
  --role="roles/iam.serviceAccountUser" \
  --project="${PROJECT_ID}" \
  >/dev/null || true

echo ""
echo "Done. Next steps:"
echo "  1. Create secrets (example names — adjust to your naming):"
echo "       echo -n 'mongodb://...' | gcloud secrets create kletron-mongodb-uri --data-file=- --project=${PROJECT_ID}"
echo "       openssl rand -base64 32 | gcloud secrets create kletron-nextauth-secret --data-file=- --project=${PROJECT_ID}"
echo "       openssl rand -base64 32 | gcloud secrets create kletron-mcp-internal-token --data-file=- --project=${PROJECT_ID}"
echo "  2. Grant Cloud Run runtime SA access to secrets (console or roles/secretmanager.secretAccessor)."
echo "  3. Déployer (GCP uniquement, pas de GitHub Actions):"
echo "       NEXT_PUBLIC_APP_URL=https://kletron-web-xxxxx.${REGION}.run.app ./infra/gcp/deploy.sh"
echo ""
echo "Note: fix local npm build if packages/ui fails (required for Docker web image)."
