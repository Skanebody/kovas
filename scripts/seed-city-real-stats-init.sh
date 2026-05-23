#!/usr/bin/env bash
# Seed initial des 1000 plus grandes villes FR dans city_real_stats.
#
# Lit la liste depuis apps/web/src/lib/cities/registry.ts + top-5000.ts et
# insère les 1000 premières lignes avec refresh_status='pending' et
# next_refresh_due=now() pour que la cron quotidienne démarre dès la
# prochaine fenêtre 02:00 UTC.
#
# Usage :
#   export SUPABASE_ACCESS_TOKEN="sbp_xxxxxxx"
#   bash scripts/seed-city-real-stats-init.sh [LIMIT]
#
# LIMIT (default 1000) : nombre de villes à insérer.

set -euo pipefail

PROJECT_REF="${PROJECT_REF:-jlizdkffwjdiokvmhcwg}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN requis}"
API_URL="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"
LIMIT="${1:-1000}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="${NODE_BIN:-node}"

# Génère un fichier JSON [{slug, name, dept, insee}] depuis le registry
TMP_JSON=$(mktemp -t city-seed.XXXX.json)
trap 'rm -f "$TMP_JSON"' EXIT

cat > "${TMP_JSON}.script.mjs" <<'EOF'
import { CITIES } from '../apps/web/src/lib/cities/registry.ts'
import { EXTRA_CITIES_TOP_5000 } from '../apps/web/src/lib/cities/top-5000.ts'

const limit = parseInt(process.argv[2] ?? '1000', 10)
const merged = [
  ...CITIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    dept: c.dept,
    insee: c.inseeCode,
    population: c.population,
  })),
  ...EXTRA_CITIES_TOP_5000.map((c) => ({
    slug: c.slug,
    name: c.name,
    dept: c.dept,
    insee: null,
    population: c.population,
  })),
]
  .sort((a, b) => b.population - a.population)
  .slice(0, limit)

process.stdout.write(JSON.stringify(merged))
EOF

# On utilise tsx via npx pour exécuter le ts directement
echo "→ Extracting ${LIMIT} villes from registry..."
(cd "$ROOT" && npx -y tsx "${TMP_JSON}.script.mjs" "$LIMIT") > "$TMP_JSON"

COUNT=$(jq 'length' "$TMP_JSON")
echo "  Extracted: $COUNT villes"

# Génère le SQL INSERT batch (insert by chunks de 500)
echo "→ Generating SQL inserts in chunks of 500..."

TMP_SQL=$(mktemp -t city-seed.XXXX.sql)
trap 'rm -f "$TMP_JSON" "$TMP_SQL"' EXIT

jq -r '
  to_entries | group_by(.key / 500 | floor) |
  map(
    "INSERT INTO public.city_real_stats (city_slug, city_name, dept_code, insee_code, population, refresh_status, next_refresh_due) VALUES " +
    (map(.value | "(" +
      (.slug | tojson) + "," +
      (.name | tojson) + "," +
      (.dept | tojson) + "," +
      (if .insee == null then "NULL" else (.insee | tojson) end) + "," +
      (.population | tostring) + "," +
      "''pending'', now())"
    ) | join(",")) +
    " ON CONFLICT (city_slug) DO NOTHING;"
  ) | join("\n")
' "$TMP_JSON" > "$TMP_SQL"

CHUNKS=$(wc -l < "$TMP_SQL" | tr -d ' ')
echo "  Generated: $CHUNKS chunk(s)"

# Exécute chaque chunk via Management API
i=0
while IFS= read -r sql; do
  i=$((i + 1))
  echo "→ Executing chunk $i..."
  payload=$(jq -Rn --arg q "$sql" '{query: $q}')
  response=$(curl -fsSX POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>&1 || echo "ERROR")
  if [[ "$response" == *"ERROR"* ]] || [[ "$response" == *"\"error\""* ]]; then
    echo "  ✗ FAILED chunk $i. Response: $response"
    exit 1
  fi
done < "$TMP_SQL"

echo
echo "✅ Seed complete: $COUNT villes inserted in city_real_stats (status=pending)."
echo "   Next cron run (02:00 UTC) will start refreshing them by batches of 200."
