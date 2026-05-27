# regulatory-watcher — Edge Function

Scraping automatique des sources réglementaires publiques (JORF Légifrance, ADEME, Cofrac, DGCCRF, MTE, CSTB, AFNOR) pour alimenter `regulatory_documents` → page `/dashboard/veille`.

## Architecture

```
┌─────────────────────────┐         ┌──────────────────────────┐
│ regulatory-watcher      │  cron   │ batch-results-poller     │
│ (cette Edge Function)   │  01:00  │ (déjà déployé)           │
│ ──────────────────      │ ──────► │ ──────────────────       │
│ • Scrape RSS/HTML       │  UTC    │ • Lit rows processed=NULL│
│ • Parse + dedupe hash   │ L→V     │ • Claude → ai_summary    │
│ • INSERT processed=NULL │         │ • Génère embedding RAG   │
└─────────────────────────┘         └──────────────────────────┘
                                              │
                                              ▼
                                /dashboard/veille (visible)
```

## Invocation

### Cron automatique (production)
```sql
-- Voir migration 20260527180000_cron_regulatory_watcher.sql
SELECT * FROM cron.job WHERE jobname = 'regulatory-watcher-daily';
```

### Manuel (debug admin)
```bash
curl -X POST https://jlizdkffwjdiokvmhcwg.supabase.co/functions/v1/regulatory-watcher \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'

# Cible une seule source pour debug
curl -X POST https://jlizdkffwjdiokvmhcwg.supabase.co/functions/v1/regulatory-watcher \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"sourceSlug":"ademe-actualites"}'

# Dry-run (parse + filter SANS insertion en BDD)
curl -X POST https://jlizdkffwjdiokvmhcwg.supabase.co/functions/v1/regulatory-watcher \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'
```

## Limitations V1 (à connaître)

**Le scraping public est fragile par nature.** Au premier déploiement (2026-05-27), 7 sources sur 9 retournent des erreurs HTTP :

| Source | Erreur | Cause probable |
|---|---|---|
| `legifrance-jo` (JORF RSS) | 403 Forbidden | WAF Cloudflare bloque les non-navigateurs |
| `legifrance-cch` | 404 Not Found | URL CCH n'a pas de flux RSS |
| `ademe-observatoire-dpe` | 403 Forbidden | Site protégé, scraping refusé |
| `cofrac-accreditation` (RSS) | 404 Not Found | URL RSS `/actualites/rss` obsolète |
| `cstb-actualites` (RSS) | 404 Not Found | CSTB a retiré son flux RSS |
| `dgccrf-actualites` (RSS) | 403 Forbidden | WAF gouvernemental |
| `mte-logement` (RSS) | 404 Not Found | URL `/rss.xml` obsolète |

Sources qui passent l'HTTP mais ne ramènent rien :
- `ademe-actualites` (RSS) — 200 OK, mais articles non pertinents pour le filtre diagnostic
- `afnor-normes` (HTML scrape) — 200 OK, structure HTML ne matche pas notre parser

**Conclusion** : ce scraping V1 best-effort ne ramène quasiment aucun document en production. Les 8 documents visibles sur `/dashboard/veille` aujourd'hui proviennent du seed manuel `20260526180000_seed_regulatory_documents.sql`.

## Roadmap V2 (post-launch)

Pour une vraie veille automatique, basculer sur des sources fiables :

1. **API Légifrance PISTE** (gratuite, OAuth2 — DILA officiel)
   - Endpoint : `https://api.piste.gouv.fr/dila/legifrance/lf-engine-app/consult/jorf`
   - Avantages : structuration JORF native, ID stables, pas de WAF
   - Effort : ~1 jour (OAuth2 + parsing JSON natif)

2. **NewsAPI.org** (payant 449$/mois, déjà câblé pour `seo-ingest-newsapi`)
   - Filtrage par keywords métier : `DPE`, `diagnostic immobilier`, `amiante`, `plomb CREP`, etc.
   - Couverture : ~80 sources françaises majeures dont Le Monde, Les Échos, Capital
   - Effort : ~½ journée (réutiliser le client existant)

3. **Backup éditorial humain**
   - Tâche admin hebdomadaire 30 min : monitoring manuel + INSERT via interface `/admin/regulatory/new`
   - Garantit un minimum de fraîcheur même si les ingesters auto échouent

## Heuristiques métier

### Filtre pertinence diagnostic
Avant insertion, le titre + raw_text doivent matcher au moins un des `DIAGNOSTIC_KEYWORDS` :
- `dpe`, `diagnostic`, `diagnostiqueur`, `amiante`, `plomb`, `crep`, `termites`, `gaz`, `électricité`, `carrez`, `boutin`, `erp`, `audit énergétique`, `cofrac`, `ademe`, `3cl`, `logement`, `habitation`, `bâtiment`

### Inférence doc_type
- `arrêté` → `arrete`
- `décret` → `decret`
- `loi` → `loi`
- `ordonnance` → `ordonnance`
- `circulaire` → `circulaire`
- `FAQ` → `faq_cofrac`
- Authority `cofrac` → `documentation_cofrac`
- Authority `ademe` → `guide_ademe`
- Authority `afnor` → `norme_afnor`
- Sinon → `autre`

### Inférence importance
- `critical` si match : `sanction`, `amende`, `retrait`, `suspension`
- `high` si match : `obligation`, `obligatoire`, `arrêté`, `décret`, `interdiction`, `certification`
- `medium` par défaut

### Dedupe
UNIQUE constraint `(source_id, content_hash)` sur `regulatory_documents`. Si un document du même contenu (même `raw_text` SHA-256) existe déjà pour cette source, l'INSERT est silencieusement ignoré (`ON CONFLICT DO NOTHING`).

## Sécurité

- `verify_jwt: false` côté déploiement (cron pg_cron appelle sans token user)
- Auth via `SUPABASE_SERVICE_ROLE_KEY` côté pg_cron helper (cf. migration)
- User-Agent Chrome stable + 20s timeout par fetch (anti-DoS involontaire)
- Max 30 documents extraits par source par run (anti-flood au premier appel)
- Tronqué à 50 000 caractères par `raw_text` (anti-document monstrueux)

## Monitoring

```sql
-- Dernières exécutions par source
SELECT slug, last_fetched_at, last_success_at, consecutive_failures, last_error
FROM public.regulatory_sources
WHERE is_active = true
ORDER BY last_fetched_at DESC NULLS LAST;

-- Documents récemment ingérés
SELECT title, published_at, processed_at, importance, source_id
FROM public.regulatory_documents
WHERE metadata->>'ingested_by' = 'regulatory-watcher'
ORDER BY created_at DESC
LIMIT 20;

-- Jobs cron status
SELECT jobname, schedule, active, last_failure_message
FROM cron.job WHERE jobname = 'regulatory-watcher-daily';

SELECT * FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'regulatory-watcher-daily')
ORDER BY start_time DESC LIMIT 5;
```
