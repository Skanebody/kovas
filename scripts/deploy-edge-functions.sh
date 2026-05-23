#!/usr/bin/env bash
# ============================================
# KOVAS — Déploiement des Edge Functions Supabase prod (annuaire pipeline)
#
# Usage :
#   export SUPABASE_ACCESS_TOKEN="sbp_xxxxxxx"
#   ./scripts/deploy-edge-functions.sh                  # déploie tout
#   ./scripts/deploy-edge-functions.sh absorb-dhup      # déploie une seule
#   ./scripts/deploy-edge-functions.sh --list           # liste fonctions ciblées
#
# Project : jlizdkffwjdiokvmhcwg (kovas-prod).
#
# Note Docker : `--no-verify-jwt` permet le déploiement sans Docker local
# (l'auth Edge Function est gérée manuellement via Bearer service_role).
# ============================================

set -euo pipefail

PROJECT_REF="jlizdkffwjdiokvmhcwg"

# Liste canonique des fonctions du pipeline annuaire (ordre logique)
ANNUAIRE_FUNCTIONS=(
  "absorb-dhup-directory"
  "cross-validate-sirene"
  "cross-validate-inpi"
  "geocode-with-ban"
  "compute-diagnostician-activity-score"
  "verify-diagnosticians-daily"
)

if [[ "${SUPABASE_ACCESS_TOKEN:-}" == "" ]]; then
  echo "ERR : SUPABASE_ACCESS_TOKEN non défini. Export-le d'abord :"
  echo "  export SUPABASE_ACCESS_TOKEN=\"sbp_xxxxx\""
  exit 1
fi

if [[ "${1:-}" == "--list" ]]; then
  echo "Fonctions du pipeline annuaire :"
  for fn in "${ANNUAIRE_FUNCTIONS[@]}"; do
    echo "  - $fn"
  done
  exit 0
fi

deploy_one() {
  local fn="$1"
  echo ""
  echo "=== Deploy: $fn ==="
  npx supabase functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt 2>&1 | tail -5
}

if [[ "${1:-}" != "" ]]; then
  # Déploiement ciblé d'une seule fonction
  deploy_one "$1"
else
  # Déploiement de tout le pipeline annuaire
  for fn in "${ANNUAIRE_FUNCTIONS[@]}"; do
    deploy_one "$fn"
  done
fi

echo ""
echo "=== TERMINÉ ==="
echo "Inspecter dans le dashboard : https://supabase.com/dashboard/project/$PROJECT_REF/functions"
