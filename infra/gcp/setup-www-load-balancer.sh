#!/usr/bin/env bash
# Global external HTTPS Application Load Balancer → Cloud Run (serverless NEG).
# Use when Cloud Run domain mapping is not suitable (e.g. europe-west6).
#
# Prérequis: gcloud auth, projet kletron, service Cloud Run kletron-web déployé.
#
# Après DNS + certificat ACTIVE:
#   KLETRON_WEB_URL=https://www.kletron.com python3 infra/gcp/provision_secrets.py
#   NEXT_PUBLIC_APP_URL=https://www.kletron.com ./infra/gcp/deploy.sh
# Mettre à jour Google OAuth (origines + redirect URIs) pour https://www.kletron.com
#
# Infomaniak: ajouter uniquement les enregistrements A indiqués ; ne pas supprimer MX/SPF existants.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null)}"
EXPECTED_PROJECT="${EXPECTED_PROJECT:-kletron}"
ALLOW_NON_KLETRON_PROJECT="${ALLOW_NON_KLETRON_PROJECT:-false}"
REGION="${REGION:-europe-west6}"
RUN_SERVICE="${RUN_SERVICE:-kletron-web}"

ADDRESS_NAME="${ADDRESS_NAME:-kletron-www-lb-ip}"
NEG_NAME="${NEG_NAME:-kletron-www-neg}"
BACKEND_NAME="${BACKEND_NAME:-kletron-www-backend}"
HTTPS_MAP="${HTTPS_MAP:-kletron-https-url-map}"
HTTP_MAP="${HTTP_MAP:-kletron-http-url-map}"
SSL_CERT="${SSL_CERT:-kletron-www-ssl}"
HTTPS_PROXY="${HTTPS_PROXY:-kletron-https-proxy}"
HTTP_PROXY="${HTTP_PROXY:-kletron-http-proxy}"
HTTPS_RULE="${HTTPS_RULE:-kletron-https-forwarding-rule}"
HTTP_RULE="${HTTP_RULE:-kletron-http-forwarding-rule}"

DOMAINS="${DOMAINS:-www.kletron.com,kletron.com}"

if [[ -z "${PROJECT_ID}" || "${PROJECT_ID}" == "(unset)" ]]; then
  echo "Configure le projet: gcloud config set project kletron"
  exit 1
fi

if [[ "${PROJECT_ID}" != "${EXPECTED_PROJECT}" && "${ALLOW_NON_KLETRON_PROJECT}" != "true" ]]; then
  echo "Refusing load balancer changes on project '${PROJECT_ID}'. Expected '${EXPECTED_PROJECT}'."
  echo "Override explicitly only if intentional: ALLOW_NON_KLETRON_PROJECT=true"
  exit 1
fi

echo "Project=${PROJECT_ID} REGION=${REGION} SERVICE=${RUN_SERVICE}"

gcloud services enable compute.googleapis.com --project="${PROJECT_ID}" >/dev/null

if ! gcloud compute addresses describe "${ADDRESS_NAME}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute addresses create "${ADDRESS_NAME}" \
    --project="${PROJECT_ID}" \
    --network-tier=PREMIUM \
    --ip-version=IPV4 \
    --global
fi

LB_IP="$(gcloud compute addresses describe "${ADDRESS_NAME}" --global --project="${PROJECT_ID}" --format='get(address)')"
echo "Adresse IPv4 du load balancer (à mettre en A chez Infomaniak pour @ et www): ${LB_IP}"

if ! gcloud compute network-endpoint-groups describe "${NEG_NAME}" --region="${REGION}" --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute network-endpoint-groups create "${NEG_NAME}" \
    --project="${PROJECT_ID}" \
    --region="${REGION}" \
    --network-endpoint-type=serverless \
    --cloud-run-service="${RUN_SERVICE}"
fi

if ! gcloud compute backend-services describe "${BACKEND_NAME}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute backend-services create "${BACKEND_NAME}" \
    --project="${PROJECT_ID}" \
    --global \
    --load-balancing-scheme=EXTERNAL \
    --protocol=HTTP
fi

if ! gcloud compute backend-services describe "${BACKEND_NAME}" --global --project="${PROJECT_ID}" \
    --format='value(backends[].group)' | grep -q "networkEndpointGroups/${NEG_NAME}"; then
  gcloud compute backend-services add-backend "${BACKEND_NAME}" \
    --project="${PROJECT_ID}" \
    --global \
    --network-endpoint-group="${NEG_NAME}" \
    --network-endpoint-group-region="${REGION}"
fi

if ! gcloud compute ssl-certificates describe "${SSL_CERT}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute ssl-certificates create "${SSL_CERT}" \
    --project="${PROJECT_ID}" \
    --domains="${DOMAINS}" \
    --global
fi

TMP_MAP="$(mktemp)"
sed "s/\${PROJECT_ID}/${PROJECT_ID}/g" "${ROOT}/infra/gcp/lb/https-url-map.yaml" >"${TMP_MAP}"

if ! gcloud compute url-maps describe "${HTTPS_MAP}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute url-maps import "${HTTPS_MAP}" \
    --project="${PROJECT_ID}" \
    --global \
    --source="${TMP_MAP}"
else
  gcloud compute url-maps import "${HTTPS_MAP}" \
    --project="${PROJECT_ID}" \
    --global \
    --source="${TMP_MAP}" \
    --quiet
fi
rm -f "${TMP_MAP}"

TMP_HTTP="$(mktemp)"
cp "${ROOT}/infra/gcp/lb/http-url-map.yaml" "${TMP_HTTP}"
if ! gcloud compute url-maps describe "${HTTP_MAP}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute url-maps import "${HTTP_MAP}" \
    --project="${PROJECT_ID}" \
    --global \
    --source="${TMP_HTTP}"
else
  gcloud compute url-maps import "${HTTP_MAP}" \
    --project="${PROJECT_ID}" \
    --global \
    --source="${TMP_HTTP}" \
    --quiet
fi
rm -f "${TMP_HTTP}"

if ! gcloud compute target-https-proxies describe "${HTTPS_PROXY}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute target-https-proxies create "${HTTPS_PROXY}" \
    --project="${PROJECT_ID}" \
    --global \
    --ssl-certificates="${SSL_CERT}" \
    --url-map="${HTTPS_MAP}"
else
  gcloud compute target-https-proxies update "${HTTPS_PROXY}" \
    --project="${PROJECT_ID}" \
    --global \
    --ssl-certificates="${SSL_CERT}" \
    --url-map="${HTTPS_MAP}"
fi

if ! gcloud compute target-http-proxies describe "${HTTP_PROXY}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute target-http-proxies create "${HTTP_PROXY}" \
    --project="${PROJECT_ID}" \
    --global \
    --url-map="${HTTP_MAP}"
fi

if ! gcloud compute forwarding-rules describe "${HTTPS_RULE}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute forwarding-rules create "${HTTPS_RULE}" \
    --project="${PROJECT_ID}" \
    --global \
    --load-balancing-scheme=EXTERNAL \
    --network-tier=PREMIUM \
    --address="${ADDRESS_NAME}" \
    --target-https-proxy="${HTTPS_PROXY}" \
    --ports=443
fi

if ! gcloud compute forwarding-rules describe "${HTTP_RULE}" --global --project="${PROJECT_ID}" &>/dev/null; then
  gcloud compute forwarding-rules create "${HTTP_RULE}" \
    --project="${PROJECT_ID}" \
    --global \
    --load-balancing-scheme=EXTERNAL \
    --network-tier=PREMIUM \
    --address="${ADDRESS_NAME}" \
    --target-http-proxy="${HTTP_PROXY}" \
    --ports=80
fi

echo ""
echo "=== DNS Infomaniak (zone kletron.com) ==="
echo "Conserve tes MX / SPF / DKIM existants. Ajoute ou mets à jour :"
echo ""
echo "  Nom / Host    Type    Cible / Valeur"
echo "  ------------  ------  ------------------"
echo "  www           A       ${LB_IP}"
echo "  @ (racine)    A       ${LB_IP}"
echo ""
echo "TTL typique 3600 (ou 300 pendant la mise en service)."
echo ""
echo "Tant que le certificat est PROVISIONING (~15–60 min après DNS correct), le navigateur peut afficher"
echo "ERR_CONNECTION_CLOSED ou une erreur TLS : c’est normal ; utilise l’URL Cloud Run *.run.app pour tester."
echo ""
echo "Certificat géré Google — état:"
gcloud compute ssl-certificates describe "${SSL_CERT}" --global --project="${PROJECT_ID}" --format='yaml(managed.status,managed.domainStatus)' || true
echo ""
echo "Quand managed.status = ACTIVE, tester: https://www.kletron.com"
echo "Puis: KLETRON_WEB_URL=https://www.kletron.com python3 infra/gcp/provision_secrets.py"
echo "     NEXT_PUBLIC_APP_URL=https://www.kletron.com ./infra/gcp/deploy.sh"
echo "Et mets à jour OAuth Google (origines + callbacks) pour https://www.kletron.com"
