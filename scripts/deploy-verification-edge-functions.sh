#!/usr/bin/env bash
# ============================================
# KOVAS — Déploiement des 4 Edge Functions VAL-3
# (verify-cofrac, verify-rcpro, verify-sirene, verify-identity)
#
# Pré-requis :
#   - npx + supabase CLI dispo
#   - SUPABASE_ACCESS_TOKEN exporté (format sbp_xxx)
#   - project_ref correct
#
# Usage :
#   export SUPABASE_ACCESS_TOKEN=sbp_xxx
#   bash scripts/deploy-verification-edge-functions.sh
#
# Variante CI :
#   SUPABASE_ACCESS_TOKEN=$SUPABASE_TOKEN bash scripts/deploy-verification-edge-functions.sh
# ============================================
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-jlizdkffwjdiokvmhcwg}"
FUNCTIONS=(verify-cofrac verify-rcpro verify-sirene verify-identity)

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "❌ SUPABASE_ACCESS_TOKEN manquant (export SUPABASE_ACCESS_TOKEN=sbp_xxx)"
  exit 1
fi

echo "▶ Déploiement sur project_ref=${PROJECT_REF}"
echo "▶ Functions : ${FUNCTIONS[*]}"
echo

for fn in "${FUNCTIONS[@]}"; do
  echo "──────────────────────────────────────────────"
  echo "▶ Deploy $fn"
  echo "──────────────────────────────────────────────"
  npx supabase functions deploy "$fn" \
    --project-ref "$PROJECT_REF" \
    --no-verify-jwt \
    || { echo "❌ Échec déploiement $fn — continuons les suivants"; continue; }
  echo "✅ $fn déployée"
  echo
done

echo "──────────────────────────────────────────────"
echo "🎉 Déploiement terminé"
echo "──────────────────────────────────────────────"
echo
echo "Secrets Supabase requis (à set via Dashboard ou CLI) :"
echo "  - ANTHROPIC_API_KEY       (Claude Vision OCR)"
echo "  - INSEE_CLIENT_ID         (OAuth2 client_credentials)"
echo "  - INSEE_CLIENT_SECRET"
echo "  - COFRAC_API_URL          (placeholder, défaut https://www.cofrac.fr/recherche/json)"
echo "  - VERIFF_API_KEY          (optionnel, stub OK en V1)"
echo "  - YOUSIGN_API_KEY         (optionnel pour path yousign_qualified)"
echo
echo "Commande set secret :"
echo "  npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref $PROJECT_REF"
