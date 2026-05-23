#!/usr/bin/env bash
# Déploiement prod des 5 migrations du jour + Vault secrets + seed fixtures + run cron DHUP.
#
# Utilise la Supabase Management API (POST /database/query) avec PERSONAL_ACCESS_TOKEN.
# Plus simple que d'installer psql/supabase CLI proprement, et préserve le tracking
# schema_migrations existant (n'utilise pas `supabase db push` qui aurait voulu
# rejouer TOUTES les migrations historiques).
#
# Usage :
#   export SUPABASE_ACCESS_TOKEN="sbp_xxxxxxx"
#   bash scripts/deploy-prod-migrations.sh
#
# Variables optionnelles :
#   PROJECT_REF (default: jlizdkffwjdiokvmhcwg)
#   SKIP_FIXTURES=1  pour ne pas seeder les 50 diagnostiqueurs démo
#   SKIP_CRON_DHUP=1 pour ne pas déclencher la première run DHUP

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-jlizdkffwjdiokvmhcwg}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN est requis (générer sur https://supabase.com/dashboard/account/tokens)}"
API_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS=(
  "supabase/migrations/20260524100000_observatoire_press_citations.sql"
  "supabase/migrations/20260524110000_diagnosticians_unified.sql"
  "supabase/migrations/20260524120000_ai_pipelines_cron.sql"
  "supabase/migrations/20260524130000_veille_articles_seed_initial.sql"
  "supabase/migrations/20260524140000_observatoire_report_mai_2026.sql"
  "supabase/migrations/20260524150000_quote_requests_dpe_calculator.sql"
  "supabase/migrations/20260524240000_diagnosticians_verification_pipeline.sql"
  "supabase/migrations/20260524250000_verification_continuous_crons.sql"
  "supabase/migrations/20260524260000_annuaire_public_verified_only.sql"
)

run_sql_from_string() {
  local sql="$1"
  local payload
  payload=$(jq -Rn --arg q "$sql" '{query: $q}')
  curl -fsSX POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

run_sql_from_file() {
  local file="$1"
  echo "→ Applying $file"
  local sql
  sql=$(cat "$ROOT/$file")
  local payload
  payload=$(jq -Rn --arg q "$sql" '{query: $q}')
  local response
  response=$(curl -fsSX POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1 || echo "ERROR")
  if [[ "$response" == *"ERROR"* ]] || [[ "$response" == *"\"error\""* ]]; then
    echo "  ✗ FAILED. Response: $response"
    return 1
  fi
  echo "  ✓ Applied"
}

# ====================================================================
# 1/4 — Appliquer les 6 migrations du jour (24 mai 2026)
# ====================================================================
echo ""
echo "=== Étape 1/4 — Application des migrations Supabase ==="
echo ""

for migration in "${MIGRATIONS[@]}"; do
  if [[ ! -f "$ROOT/$migration" ]]; then
    echo "⚠ Migration introuvable: $migration (skip)"
    continue
  fi
  run_sql_from_file "$migration" || true
done

# ====================================================================
# 2/4 — Vault secrets pour les crons IA
# ====================================================================
echo ""
echo "=== Étape 2/4 — Vault secrets pour les crons IA ==="
echo ""

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  # Tenter de lire depuis .env.local
  if [[ -f "$ROOT/apps/web/.env.local" ]]; then
    SERVICE_KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' "$ROOT/apps/web/.env.local" | cut -d'=' -f2- | tr -d '"' || echo "")
  fi
else
  SERVICE_KEY="$SUPABASE_SERVICE_ROLE_KEY"
fi

if [[ -z "${SERVICE_KEY:-}" ]]; then
  echo "⚠ SUPABASE_SERVICE_ROLE_KEY introuvable. Vault secrets SKIP — à configurer manuellement plus tard."
else
  PROJECT_URL="https://${PROJECT_REF}.supabase.co"
  VAULT_SQL="INSERT INTO vault.secrets (name, secret) VALUES ('project_url', '${PROJECT_URL}') ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret; INSERT INTO vault.secrets (name, secret) VALUES ('service_role_token', '${SERVICE_KEY}') ON CONFLICT (name) DO UPDATE SET secret = EXCLUDED.secret;"
  echo "→ Insertion des 2 secrets dans vault.secrets"
  if run_sql_from_string "$VAULT_SQL" >/dev/null 2>&1; then
    echo "  ✓ Vault secrets posés (project_url + service_role_token)"
  else
    echo "  ⚠ Vault secrets insertion failed (vault may not be installed) — à faire manuellement via SQL Editor"
  fi
fi

# ====================================================================
# 3/4 — Seed 50 fixtures diagnostiqueurs démo
# ====================================================================
echo ""
echo "=== Étape 3/4 — Seed fixtures démo diagnostiqueurs ==="
echo ""

if [[ "${SKIP_FIXTURES:-0}" == "1" ]]; then
  echo "→ SKIP_FIXTURES=1, étape ignorée"
elif [[ -f "$ROOT/supabase/seed/diagnosticians-fixtures.sql" ]]; then
  echo "→ Applying supabase/seed/diagnosticians-fixtures.sql"
  SEED_SQL=$(cat "$ROOT/supabase/seed/diagnosticians-fixtures.sql")
  PAYLOAD=$(jq -Rn --arg q "$SEED_SQL" '{query: $q}')
  if curl -fsSX POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" >/dev/null 2>&1; then
    echo "  ✓ Seed 50 diagnostiqueurs appliqué"
  else
    echo "  ⚠ Seed fixtures failed (peut-être déjà appliqué) — vérifier manuellement"
  fi
else
  echo "⚠ Fixtures introuvables: supabase/seed/diagnosticians-fixtures.sql"
fi

# ====================================================================
# 4/4 — Première run cron DHUP (optionnel)
# ====================================================================
echo ""
echo "=== Étape 4/4 — Première run cron DHUP ==="
echo ""

if [[ "${SKIP_CRON_DHUP:-0}" == "1" ]]; then
  echo "→ SKIP_CRON_DHUP=1, étape ignorée"
else
  echo "→ Invocation Edge Function absorb-dhup-directory..."
  if [[ -z "${SERVICE_KEY:-}" ]]; then
    echo "  ⚠ SERVICE_KEY indispo — invocation skip"
  else
    RESPONSE=$(curl -sX POST "https://${PROJECT_REF}.supabase.co/functions/v1/absorb-dhup-directory" \
      -H "Authorization: Bearer $SERVICE_KEY" \
      -H "Content-Type: application/json" \
      -d '{"trigger":"manual_deploy_script"}' \
      --max-time 90 2>&1 || echo "TIMEOUT")
    if [[ "$RESPONSE" == "TIMEOUT" ]]; then
      echo "  ⚠ Timeout 90s atteint — l'import DHUP run en background"
    else
      echo "  ✓ Edge Function appelée. Response: $RESPONSE" | head -c 500
      echo ""
    fi
  fi
fi

echo ""
echo "=== Déploiement terminé ==="
echo ""
echo "Étapes suivantes :"
echo "  • Vérifier les nouvelles tables : SELECT count(*) FROM diagnosticians;"
echo "                                    SELECT count(*) FROM veille_articles_draft;"
echo "                                    SELECT count(*) FROM observatoire_reports;"
echo "                                    SELECT count(*) FROM observatoire_press_citations;"
echo "  • Vérifier les crons : SELECT * FROM cron.job WHERE jobname LIKE 'kovas-%';"
echo "  • Régénérer les types Database : npm run gen:types"
