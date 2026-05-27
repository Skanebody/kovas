# purge-old-data — Edge Function

Purge automatique des données obsolètes (RGPD article 5.1.c minimisation + nettoyage tables intermédiaires).

## Architecture

```
┌─────────────────────────┐
│ purge-old-data          │  cron pg_cron 03:00 UTC quotidien
│ (Edge Function)         │  ◄── invoke_purge_old_data() via pg_net
│ ──────────────────      │
│ 1. quote_requests       │  → UPDATE anonymize > 12 mois
│ 2. otp_codes            │  → DELETE expirés > 24h
│ 3. bandit_events        │  → DELETE > 6 mois
│ 4. admin_2fa_attempts   │  → DELETE > 90 jours
│ 5. csp_violations       │  → DELETE > 30 jours (si table existe)
└─────────────────────────┘
```

## Tables purgées + critères

| Table | Action | Critère | Rétention |
|---|---|---|---|
| `quote_requests` | UPDATE (anonymize PII) | `created_at < NOW() - 12 mois` AND `anonymized_at IS NULL` | 12 mois |
| `otp_codes` | DELETE | `expires_at < NOW() - 24h` | 24h post-expiration |
| `bandit_events` | DELETE | `occurred_at < NOW() - 6 mois` | 6 mois |
| `admin_2fa_attempts` | DELETE | `created_at < NOW() - 90 jours` | 90 jours |
| `csp_violations` | DELETE (si table) | `created_at < NOW() - 30 jours` | 30 jours |

**Pour `quote_requests` : UPDATE et pas DELETE** — on garde les lignes pour les agrégats statistiques (intent_score, conversion funnel, geo) mais on efface toutes les PII (email, phone, nom, adresse, IP, UA, message).

## Invocation

### Cron automatique (production)
```sql
-- Voir migration 20260527240000_cron_purge_old_data.sql
SELECT * FROM cron.job WHERE jobname = 'purge-old-data-daily';
```

### Manuel (debug admin)
```bash
# Récupérer le secret depuis Vault
PURGE_SECRET=$(supabase secrets get INTERNAL_PURGE_SECRET)

curl -X POST https://jlizdkffwjdiokvmhcwg.supabase.co/functions/v1/purge-old-data \
  -H "Authorization: Bearer $PURGE_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Sécurité

- Auth Bearer via `INTERNAL_PURGE_SECRET` — secret distinct de la `service_role_key` (limite blast radius)
- `service_role_key` utilisée côté Supabase pour bypass RLS (UPDATE/DELETE tables sensibles)
- Auth fail → 401 + log warning
- Erreur fatale → 500 + résumé partiel des purges déjà effectuées

## Monitoring SQL

```sql
-- Combien de quote_requests ont déjà été anonymisés ?
SELECT
  COUNT(*) FILTER (WHERE anonymized_at IS NOT NULL) AS anonymized,
  COUNT(*) FILTER (WHERE anonymized_at IS NULL) AS in_clear,
  COUNT(*) AS total
FROM public.quote_requests;

-- Combien sont éligibles à anonymisation au prochain run ?
SELECT COUNT(*)
FROM public.quote_requests
WHERE created_at < NOW() - INTERVAL '12 months'
  AND anonymized_at IS NULL;

-- Dernière exécution cron + statut
SELECT jobname, schedule, active, last_failure_message
FROM cron.job WHERE jobname = 'purge-old-data-daily';

SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'purge-old-data-daily')
ORDER BY start_time DESC LIMIT 5;
```
