#!/usr/bin/env bash
# Kletron-only GCP guard: never target Numezis or other accidental projects.
# shellcheck shell=bash
#
# Usage (after PROJECT_ID is set):
#   # shellcheck source=kletron-project-guard.sh
#   source "$(dirname "${BASH_SOURCE[0]}")/kletron-project-guard.sh"
#   kletron_refuse_non_kletron_project "$PROJECT_ID"

kletron_refuse_non_kletron_project() {
    local pid="${1:-}"
    local lc
    if [[ -z "${pid}" || "${pid}" == "(unset)" ]]; then
        echo "kletron-project-guard: PROJECT_ID is empty." >&2
        return 1
    fi
    lc="$(printf '%s' "${pid}" | tr '[:upper:]' '[:lower:]')"
    if [[ "${lc}" == *numezis* ]]; then
        echo "Refus sécurité: le projet GCP '${pid}' est refusé (mot-clé numezis). Kletron uniquement — utilisez PROJECT_ID=kletron." >&2
        return 2
    fi
    return 0
}

kletron_warn_if_gcloud_project_mismatch() {
    local expected="${1:-kletron}"
    local active
    active="$(gcloud config get-value project 2>/dev/null || true)"
    if [[ -z "${active}" || "${active}" == "(unset)" ]]; then
        return 0
    fi
    if [[ "${active}" != "${expected}" ]]; then
        echo "Attention: gcloud est sur le projet '${active}', pas '${expected}'. Ce script n’utilise pas cette valeur pour déployer si PROJECT_ID est fixé à kletron." >&2
    fi
}
