#!/usr/bin/env bash
# ============================================
# KOVAS — Première run de l'import DHUP officiel (annuaire ~13k diagnostiqueurs)
#
# Pré-requis (à configurer côté Supabase Dashboard / Functions / Secrets) :
#   • DHUP_DATASET_RESOURCE_URL = URL exacte du CSV data.gouv.fr
#       (voir https://www.data.gouv.fr/fr/datasets/annuaire-des-diagnostiqueurs-immobiliers-certifies/
#        → onglet "Ressources" → copier l'URL du CSV)
#   • SUPABASE_SERVICE_ROLE_KEY (auto-injecté)
#
# Optionnels (cross-validation Sirene + GMB) :
#   • INSEE_CLIENT_ID + INSEE_CLIENT_SECRET → enable Sirene
#       (Inscription : https://api.insee.fr/catalogue/)
#   • GOOGLE_PLACES_API_KEY → enable GMB enrichment
#       (Console Cloud : https://console.cloud.google.com/apis/credentials)
#
# Usage :
#   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx ./scripts/run-first-dhup-import.sh
#   # OU si tu as déjà l'env :
#   export SUPABASE_SERVICE_ROLE_KEY="sb_secret_xxx"
#   ./scripts/run-first-dhup-import.sh
#
# Durée estimée : 5-15 min sur ~13k records (UPSERT batché Supabase REST).
# ============================================
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-jlizdkffwjdiokvmhcwg}"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY:?Variable SUPABASE_SERVICE_ROLE_KEY requise}"
EDGE_URL="https://${PROJECT_REF}.supabase.co/functions/v1/absorb-dhup-directory"

echo "=== Première run DHUP — KOVAS Annuaire ==="
echo "Project : $PROJECT_REF"
echo "Endpoint: $EDGE_URL"
echo ""
echo "Avant de lancer, vérifie que DHUP_DATASET_RESOURCE_URL est configurée dans"
echo "  Supabase Dashboard → Functions → absorb-dhup-directory → Secrets."
echo ""
read -p "Continuer ? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Annulé."
  exit 0
fi

echo ""
echo "→ Déclenchement de l'import..."
RESPONSE=$(curl -s -X POST "$EDGE_URL" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source":"first_import_script"}' \
  --max-time 900)

echo "Réponse :"
echo "$RESPONSE" | python3 -m json.tool

OK=$(echo "$RESPONSE" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok'))")
TOTAL=$(echo "$RESPONSE" | python3 -c "import json,sys; r=json.load(sys.stdin); print(r.get('imported',0)+r.get('updated',0))")

echo ""
if [[ "$OK" == "True" ]]; then
  echo "✓ Import OK — $TOTAL diagnostiqueurs traités."
else
  echo "✗ Import échec — voir réponse ci-dessus pour diagnostic."
  exit 1
fi

echo ""
echo "=== Vérif côté DB ==="
PROD_COUNT=$(curl -s "https://${PROJECT_REF}.supabase.co/rest/v1/diagnosticians?select=id&dhup_source_id=not.like.fix_%25" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Prefer: count=exact" \
  -H "Range: 0-0" \
  -I 2>/dev/null | grep -i content-range | tr -d '\r' || echo "?")
echo "diagnosticians WHERE NOT fixtures : $PROD_COUNT"

echo ""
echo "=== Prochaines étapes ==="
echo "1. Lancer une vérif manuelle via /admin/diagnostiqueurs/audit"
echo "   ou bien :"
echo "   curl -X POST '$EDGE_URL%/../verify-diagnosticians-daily' \\"
echo "        -H 'Authorization: Bearer \$SERVICE_KEY' \\"
echo "        -d '{\"mode\":\"batch\",\"limit\":500}'"
echo ""
echo "2. Le cron pg_cron 'kovas-verify-diagnosticians-daily' tournera automatiquement"
echo "   à 03:00 UTC chaque jour si Vault secrets configurés."
