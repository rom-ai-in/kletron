#!/usr/bin/env bash
# One-time (or idempotent) GCP setup for Kletron on Cloud Run.
#
# Prérequis locaux:
#   gcloud auth login hello@kletron.com
#   gcloud config set project YOUR_PROJECT_ID
#
# Usage:
#   PROJECT_ID=your-project REGION=europe-west9 ./infra/gcp/bootstrap.sh
#
# Ensuite: créer les secrets dans Secret Manager (exemples de noms ci‑dessous),
# puis adapter infra/gcp/cloudbuild.yaml (--set-secrets sur deploy) ou
# définir les variables à la main:
#   gcloud run services update numezis-web --set-secrets=...

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${REGION:-europe-west6}"
AR_REPO="${AR_REPO:-numezis-repo}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Set PROJECT_ID or run: gcloud config set project YOUR_PROJECT_ID"
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
echo "       NEXT_PUBLIC_APP_URL=https://numezis-web-xxxxx.${REGION}.run.app ./infra/gcp/deploy.sh"
echo ""
echo "Note: fix local npm build if packages/ui fails (required for Docker web image)."
