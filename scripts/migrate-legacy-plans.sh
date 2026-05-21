#!/usr/bin/env bash
#
# KOVAS — Wrapper Edge Function migrate-legacy-plans-v3
#
# Usage :
#   ./scripts/migrate-legacy-plans.sh --dry-run    # lecture seule (défaut)
#   ./scripts/migrate-legacy-plans.sh --run        # exécution réelle
#
# Variables d'environnement requises :
#   SUPABASE_FUNCTIONS_BASE_URL  ex: https://<project-ref>.supabase.co/functions/v1
#   SUPABASE_SERVICE_ROLE_KEY    JWT service_role (Supabase Dashboard → Settings → API)
#
# Documentation : docs/deployment/PHASE_H_GO_LIVE.md §8

set -euo pipefail

# Mode par défaut : dry-run (sécurité)
MODE="${1:---dry-run}"

# Vérification env vars
if [[ -z "${SUPABASE_FUNCTIONS_BASE_URL:-}" ]]; then
  echo "ERROR: SUPABASE_FUNCTIONS_BASE_URL not set" >&2
  echo "  Expected format: https://<project-ref>.supabase.co/functions/v1" >&2
  exit 1
fi

if [[ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set" >&2
  echo "  Get it from Supabase Dashboard → Project Settings → API → service_role key" >&2
  exit 1
fi

# Construction payload selon mode
case "$MODE" in
  --dry-run)
    PAYLOAD='{"dryRun": true}'
    echo "→ Mode: DRY RUN (lecture seule, aucune modification BDD)"
    ;;
  --run)
    PAYLOAD='{"dryRun": false}'
    echo "→ Mode: RUN RÉEL (modifications BDD effectives)"
    echo ""
    read -rp "Êtes-vous sûr de vouloir exécuter la migration ? [yes/N] " confirm
    if [[ "$confirm" != "yes" ]]; then
      echo "Aborted."
      exit 0
    fi
    ;;
  -h|--help)
    cat <<EOF
Usage: $0 [--dry-run|--run]

  --dry-run   Lecture seule, retourne les stats de migration sans modifier la BDD (défaut)
  --run       Exécute la migration réelle (demande confirmation interactive)
  -h, --help  Affiche cette aide

Documentation : docs/deployment/PHASE_H_GO_LIVE.md
EOF
    exit 0
    ;;
  *)
    echo "ERROR: Unknown mode '$MODE'" >&2
    echo "Usage: $0 [--dry-run|--run]" >&2
    exit 1
    ;;
esac

ENDPOINT="${SUPABASE_FUNCTIONS_BASE_URL%/}/migrate-legacy-plans-v3"

echo "→ Endpoint: $ENDPOINT"
echo "→ Payload: $PAYLOAD"
echo ""

# Appel Edge Function avec jq pour pretty-print si disponible
if command -v jq >/dev/null 2>&1; then
  curl -fsS -X POST \
    "$ENDPOINT" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" | jq .
else
  curl -fsS -X POST \
    "$ENDPOINT" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD"
  echo ""
fi

echo ""
echo "✓ Done."
