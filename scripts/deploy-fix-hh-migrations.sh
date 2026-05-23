#!/usr/bin/env bash
# Déploiement prod des 2 migrations FIX-HH :
#   - coach_conversations + coach_messages + coach_recommendations
#   - diagnostician_public_profile + diagnostician_profile_views
#
# Usage :
#   export SUPABASE_ACCESS_TOKEN="sbp_xxxxx"
#   bash scripts/deploy-fix-hh-migrations.sh

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-jlizdkffwjdiokvmhcwg}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN requis}"
API_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIGRATIONS=(
  "supabase/migrations/20260524280000_coach_conversations.sql"
  "supabase/migrations/20260524290000_diagnostician_public_profile.sql"
)

apply_file() {
  local f="$1"
  echo "→ Applying $f"
  local sql
  sql="$(cat "$ROOT/$f")"
  local payload
  payload=$(jq -Rn --arg q "$sql" '{query: $q}')
  local resp
  if ! resp=$(curl -fsSX POST "$API_URL" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$payload" 2>&1); then
    echo "FAIL  $f"
    echo "$resp"
    exit 1
  fi
  echo "  ok"
}

for m in "${MIGRATIONS[@]}"; do
  apply_file "$m"
done

echo ""
echo "Migrations FIX-HH appliquées."
