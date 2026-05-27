#!/usr/bin/env bash
# ============================================
# KOVAS — Déploiement refonte claim flow Doctolib pattern (2026-05-27)
#
# 1. Applique la migration 20260527150000_claim_kyc_doctolib_pattern.sql en prod
#    via Supabase Management API REST.
# 2. Déploie l'Edge Function verify-identity-kyc.
#
# Pré-requis :
#   - SUPABASE_ACCESS_TOKEN exporté (format sbp_xxx) — lu auto depuis .env.local
#   - npx supabase CLI dispo
#   - jq dispo
#
# Usage :
#   bash scripts/deploy-claim-kyc-doctolib.sh
# ============================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-jlizdkffwjdiokvmhcwg}"

# Token : utilise env ou lecture .env.local
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  if [[ -f "$ROOT/.env.local" ]]; then
    SUPABASE_ACCESS_TOKEN=$(grep '^SUPABASE_ACCESS_TOKEN=' "$ROOT/.env.local" | cut -d'=' -f2- | tr -d '"')
  fi
fi

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "❌ SUPABASE_ACCESS_TOKEN manquant"
  exit 1
fi

MIGRATION="$ROOT/supabase/migrations/20260527150000_claim_kyc_doctolib_pattern.sql"
API_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"

# ============================================
# 1. Apply migration
# ============================================
echo ""
echo "=== Étape 1/2 — Migration SQL ==="
echo "→ Applying $MIGRATION"

if [[ ! -f "$MIGRATION" ]]; then
  echo "❌ Migration introuvable: $MIGRATION"
  exit 1
fi

SQL=$(cat "$MIGRATION")
PAYLOAD=$(jq -Rn --arg q "$SQL" '{query: $q}')
RESPONSE=$(curl -sX POST "$API_URL" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if echo "$RESPONSE" | grep -qE '"error"|"message".*"error"'; then
  echo "  ✗ FAILED. Response: $RESPONSE"
  exit 1
fi
echo "  ✓ Migration appliquée"

# ============================================
# 2. Deploy Edge Function verify-identity-kyc
# ============================================
echo ""
echo "=== Étape 2/2 — Edge Function verify-identity-kyc ==="
cd "$ROOT"
npx supabase functions deploy verify-identity-kyc \
  --project-ref "$PROJECT_REF" \
  --no-verify-jwt

echo "  ✓ Edge Function déployée"

echo ""
echo "=== Déploiement terminé ==="
echo ""
echo "Secrets requis (à set via Dashboard ou CLI Supabase) :"
echo "  - ANTHROPIC_API_KEY (Claude Vision sonnet-4-6)"
echo "  - RESEND_API_KEY     (notification admin email)"
echo "  - KOVAS_ADMIN_EMAIL  (default contact@kovas.fr)"
echo ""
echo "Set secret :"
echo "  npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref $PROJECT_REF"
echo ""
echo "Étapes suivantes :"
echo "  • Vérifier vue admin : SELECT count(*) FROM claim_kyc_queue;"
echo "  • Tester upload : /reclamer-ma-fiche/<diag_id>"
echo "  • Page admin    : /dashboard/admin/claims"
