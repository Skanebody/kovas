# Plan régénération `packages/database/src/types.ts` (DEPLOY-4)

> **Date** : 2026-05-23
> **Statut** : différé — régénération possible mais introduit 228 erreurs typecheck
> **Tâche** : DEPLOY-4 #180
> **Auteur** : agent AUDIT-E

## Contexte

La tâche DEPLOY-4 vise à régénérer `packages/database/src/types.ts` depuis la prod Supabase (`jlizdkffwjdiokvmhcwg`) pour refléter le schéma réel et supprimer les `biome-ignore noExplicitAny` qui couvrent les colonnes absentes des types.

### Tentative de régénération

```bash
export SUPABASE_ACCESS_TOKEN="sbp_***"
npx supabase gen types typescript \
  --project-id jlizdkffwjdiokvmhcwg \
  --schema public \
  > packages/database/src/types.ts.new
```

Résultat :

| Métrique | Ancien `types.ts` | Nouveau régénéré | Delta |
|---|---|---|---|
| **Lignes** | 2 053 | 14 187 | +12 134 (+591%) |
| **Taille** | ~63 KB | 451 KB | +388 KB |
| **Tables + fonctions exposées** | 29 | 410 | +381 |

Le nouveau fichier est conservé en référence sous **`packages/database/src/types.new.ts`** (non utilisé par l'app).

### Tables ajoutées (échantillon — 50+ tables critiques manquantes)

`diagnosticians`, `quote_requests`, `quote_request_unlocks`, `otp_codes`, `leads`, `lead_assignments`,
`referral_codes`, `referral_clicks`, `referrals`, `bandit_diagnostician_stats`, `bandit_events`,
`claim_requests`, `community_cases`, `coach_conversations`, `coach_messages`, `coach_recommendations`,
`ademe_alerts`, `ademe_benchmarks`, `ademe_dpe_cache`, `ademe_kpi_snapshots`, `ademe_prevalidations`,
`ai_usage_log`, `ai_usage_logs`, `ai_usage_monthly`, `dpe_imports`, `dpe_historical_cache`, `dpe_quota_alerts`,
`dossier_activity_log`, `dossier_exports`, `dossier_historical_documents`, `email_events`, `email_queue`,
`email_templates`, `import_jobs`, `import_staging_clients`, `import_staging_coproprietes`,
`import_staging_lots`, `import_staging_properties`, `import_dedupe_matches`, `mission_chat_messages`,
`mission_duration_history`, `mission_pricing_snapshots`, `mission_session_captures`, `mission_sessions`,
`observatoire_*` (5 tables), `user_credits`, `user_preferences`, `user_progression`, `user_scan_quotas`,
`veille_*` (3 tables), `verification_*` (4 tables), `connector_api_access_requests`, etc.

Plus toutes les fonctions PostGIS (`st_*`, `_st_*`, `geometry_*`, …) et helpers SQL nommés (`is_admin`,
`is_diagnostician_publicly_visible`, `expire_old_claim_codes`, `generate_referral_code`, etc.).

### Tables supprimées (présentes ancien, absentes nouveau)

- `is_member_of` (fonction) — renommée / signature changée
- `subscriptions_set_updated_at` (trigger) — non exposé en SQL public

## Impact typecheck (test du swap)

Avec types régénérés en place dans le main repo :

| Métrique | Valeur |
|---|---|
| **Erreurs TS introduites** | **228** |
| Catégories d'erreurs | TS2339 (43), TS2769 (28), TS2322 (11), TS2345 (6), TS2353 (4), TS2352 (2) |

### Concentration des erreurs

**46 erreurs (20%) sur tables manquantes en prod** :
- `alert_events` (28 erreurs)
- `alert_rules` (18 erreurs)
- Migration locale : `supabase/migrations/20260521190000_admin_alerts.sql` — **NON APPLIQUÉE EN PROD**

**8 erreurs sur table `dossier_field_values`, `vision_status`, `mission_text_notes`** :
- Tables référencées dans le code (mission consolidate, photo analyze) mais absentes du schéma prod
- Migrations à appliquer pour aligner

**Reste (174 erreurs)** : principalement
- `accounting_connectors` : colonne `config` (jsonb) absente prod, mais utilisée par sync Tiime/Indy/Qonto
- `connectors` (Tiime configure) : workspace_id excess property
- Variations mineures de schéma sur 10-15 tables

### Fichiers les plus impactés (top 10)

| Fichier | Erreurs |
|---|---|
| `src/app/api/missions/photos/[id]/analyze/route.ts` | 12 |
| `src/app/api/missions/[id]/consolidate/route.ts` | 11 |
| `src/app/api/missions/photos/[id]/vision-status/route.ts` | 8 |
| `src/app/dashboard/account/integrations/tiime/page.tsx` | 6 |
| `src/lib/admin/product-analytics.ts` | 5 |
| `src/app/dashboard/dossiers/[id]/mission/actions.ts` | 5 |
| `src/lib/admin/alert-engine.ts` | 4 |
| `src/components/billing/TrialBannerLoader.tsx` | 4 |
| `src/app/api/billing/webhook/route.ts` | 4 |
| `src/app/api/admin/alerts/rules/[id]/route.ts` | 4 |

## Décision : régénération différée

Le swap introduit **228 erreurs** > seuil 50 défini par la consigne, donc on garde l'ancien `types.ts` et on documente le plan ici.

### Plan en 3 étapes (à exécuter dans une session dédiée)

#### Étape 1 — Aligner la prod sur les migrations locales (DEPLOY-1 bis)

Migrations identifiées comme **non appliquées en prod** (à `supabase db push`) :
- `20260521190000_admin_alerts.sql` — tables `alert_rules`, `alert_events`, `alert_dismissals`, `alert_preferences`, etc.
- Migrations mission/photo récentes contenant `dossier_field_values`, `vision_status`, `mission_text_notes`
- Migration `accounting_connectors` ajoutant la colonne `config jsonb`

Commandes :
```bash
export SUPABASE_DB_PASSWORD="***"
supabase db push --linked
# Vérifier idempotence : aucune migration ne doit échouer
```

#### Étape 2 — Régénérer les types

```bash
export SUPABASE_ACCESS_TOKEN="sbp_***"
pnpm db:gen-types  # alias pour : supabase gen types typescript --linked > packages/database/src/types.ts
```

#### Étape 3 — Fixer les erreurs résiduelles

Après les 2 premières étapes, les 46 erreurs `alert_*` + 8 erreurs `dossier_field_values` disparaîtront automatiquement.

Pour les 174 erreurs restantes (sync connecteurs / billing webhook / mission consolidate) :
- Beaucoup viennent de SELECT explicites incomplets (`{ error: "column 'config' does not exist on accounting_connectors" }`) qui se résorbent quand les colonnes sont présentes en DB
- Quelques excess-properties sur INSERT (Tiime workspace_id) à supprimer ou typer en `Database["public"]["Tables"]["..."]["Insert"]`
- Webhook billing : colonnes `current_period_start/end` retournent `string | null` (correct) au lieu de `never` (ancien type incorrect)

Estimation : **2-3 h** pour Étapes 2+3 réunies, avec migrations en prod préalables.

### Risques

- **Régression sur PROD** : aucune si étape 1 effectuée d'abord
- **Perdre les `biome-ignore`** : positif — révèle des bugs cachés (display_name vs full_name sur diagnosticians, déjà fixé dans cette session)
- **CI Lighthouse / Playwright** : à relancer en post-merge

## Liens

- Fichier sauvegarde nouveau : `packages/database/src/types.new.ts`
- Script de comparaison : `/tmp/typecheck_after_swap2.txt` (228 lignes erreurs)
- Migration référentielle : `supabase/migrations/20260524180000_consolidate_schema_reconciliation.sql`
- Audits parallèles : AUDIT-A/B/C/D (#206-209) — sweeps progressifs des colonnes legacy
