# Veille réglementaire — Architecture KOVAS

> Module central qui maintient KOVAS en mutation permanente. Surveille 9 sources réglementaires officielles (Légifrance, ADEME, DHUP, Cerema, Quotidiag, DiagActu, Cofrac…) toutes les heures, détecte les nouveaux documents, les analyse avec Claude, et propose des auto-updates système avec approbation humaine.
>
> **Dernière mise à jour** : 2026-05-20 — Sprint veille réglementaire V1.

## 1. Schéma de flux

```
                       ┌────────────────────────────────────┐
                       │   pg_cron / GitHub Action          │
                       │   (schedule: 0 * * * * — horaire)   │
                       └──────────────┬─────────────────────┘
                                      │  POST
                                      ▼
            ┌──────────────────────────────────────────────────┐
            │  Edge Function `regulatory-watcher`              │
            │  supabase/functions/regulatory-watcher/index.ts   │
            │                                                  │
            │  1. SELECT regulatory_sources WHERE active        │
            │     AND last_check_at + interval is due           │
            │  2. Pour chaque source :                          │
            │       - scrapeOne(source) selon source_type       │
            │       - SHA-256(full_text) → full_text_hash       │
            │       - dédup (source_id, reference)              │
            │       - INSERT (nouveau) ou UPDATE (modifié)      │
            │       - POST → regulatory-analyze                 │
            │       - UPDATE last_check_at (toujours)           │
            └──────────────┬───────────────────────────────────┘
                           │  POST { documentId }
                           ▼
            ┌──────────────────────────────────────────────────┐
            │  Edge Function `regulatory-analyze`              │
            │  supabase/functions/regulatory-analyze/index.ts  │
            │                                                  │
            │  1. SELECT regulatory_documents WHERE id          │
            │  2. Claude Sonnet 4.6 (tool use forcé)            │
            │       → analysis JSON garanti valide              │
            │  3. OpenAI text-embedding-3-small (1536d) x2       │
            │       (full_text + ai_summary)                    │
            │  4. UPDATE regulatory_documents                    │
            │       (analysis + embeddings + processed=true)    │
            │  5. Si actions sensibles                           │
            │     (update_coherence_rule / update_report_template)│
            │     INSERT system_auto_updates (approved=false)   │
            │  6. notifyAffectedUsers → INSERT regulatory_notifications │
            │  7. logAiUsage → ai_usage_log                     │
            └──────────────┬───────────────────────────────────┘
                           │
                           ▼
            ┌──────────────────────────────────────────────────┐
            │  Admin /admin/veille                              │
            │  - Voir documents en attente d'approbation       │
            │  - Approuver / rollback les auto-updates         │
            │  Users : notification in-app + email digest       │
            └──────────────────────────────────────────────────┘
```

## 2. Composants livrés

| Fichier | Rôle | Runtime |
|---|---|---|
| `supabase/functions/regulatory-watcher/index.ts` | Crawler horaire + dédup + déclenchement analyse | Deno |
| `supabase/functions/regulatory-analyze/index.ts` | Claude tool use + embeddings + notifications + auto-updates | Deno |
| `apps/web/src/lib/regulatory/scrapers.ts` | Helpers réutilisables (RSS / HTML / Légifrance / Sitemap / ADEME) | Node |
| `apps/web/src/lib/regulatory/analyzer.ts` | Wrapper Claude tool use + embeddings + cost tracking | Node |

> **Note duplication** : les Edge Functions Deno ne peuvent pas importer le monorepo Node ; les helpers sont donc dupliqués (inline dans `regulatory-watcher`/`-analyze`). Toute évolution doit être propagée des deux côtés.

## 3. Configuration cron horaire

À ajouter dans une migration Supabase (extension `pg_cron` + `pg_net`, déjà disponibles dans Supabase) :

```sql
SELECT cron.schedule(
  'regulatory-watcher-hourly',
  '0 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_functions_url') || '/regulatory-watcher',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )
    );
  $$
);
```

Alternative : GitHub Action `regulatory-watcher.yml` avec `cron: '0 * * * *'`.

## 4. Sources prévues (9)

| Source | source_type | URL pivot |
|---|---|---|
| Légifrance — JORF DPE | `legifrance` | https://www.legifrance.gouv.fr/jorf/... |
| ADEME Open Data | `api` (CKAN) | https://data.ademe.fr/api/3/action/recently_changed_packages_activity_list |
| ADEME — actualité DPE | `rss` | https://www.ecologie.gouv.fr/actualites.rss |
| DHUP (Min. logement) | `html_scraping` | https://www.ecologie.gouv.fr/diagnostics-immobiliers |
| Cerema | `rss` | https://www.cerema.fr/fr/rss.xml |
| Quotidiag | `rss` | https://www.quotidiag.fr/rss |
| DiagActu | `rss` | https://www.diagactu.com/feed |
| Cofrac | `sitemap` | https://www.cofrac.fr/sitemap.xml |
| (rés. évolutif) | — | — |

## 5. Limites V1 et TODO V1.5

| Limite | Impact | Plan V1.5 |
|---|---|---|
| **Légifrance scraping fragile** (regex sur HTML) | Faux positifs / hash bruité sur changement cosmétique | Brancher **API PISTE OAuth2** (https://piste.gouv.fr) endpoints `/consult/jorf`, `/search`. Token gratuit Dila |
| **HTML générique** — regex sur `<a>` | Captures larges et bruit | Whitelist explicite par source via `scraping_config.selector` puis migration vers `linkedom` (Edge Functions) |
| **ADEME Open Data CKAN** non confirmé | Si datasets retournent autre format → fallback hash global | Tester sur prod + ajuster |
| **Notification "tous les users d'une org"** | Bombardement possible si org grande | Sprint 2 : agrégat email digest 24h + opt-out par catégorie |
| **Pas de retry async sur analyse** | Si Claude down, document reste en `processing_status='failed'` | Cron de re-tentative `processing_status='failed' AND retry_count<3` |
| **Pas de prompt-cache hit measure côté DB** | Coût optimisable mais invisible | Sprint 3 : log `cache_read_input_tokens` séparé |

## 6. Coût estimé

**Par document analysé** (claude-sonnet-4-6 + 2 embeddings) :

| Composant | Tokens typiques | Coût USD | Coût EUR |
|---|---|---|---|
| Claude input | 8 000 | $0,024 | 0,022 € |
| Claude output | 800 | $0,012 | 0,011 € |
| OpenAI embedding x2 | 6 000 | $0,00012 | 0,0001 € |
| **Total / doc** | — | **~$0,036** | **~0,033 €** |

À volume modéré (~50 docs/mois) :

| Volume mensuel | Coût mensuel | Coût annuel |
|---|---|---|
| 50 docs (V1 réaliste) | ~1,60 € | ~20 € |
| 200 docs (pic actualité) | ~6,60 € | ~80 € |
| 1 000 docs (worst case) | ~33 € | ~400 € |

**Optimisations à activer dès V1.5** : prompt caching 1h sur le system prompt (déjà branché) → ~30 % de réduction sur input tokens à volume stable.

## 7. Sécurité — auto-updates sensibles

**Toute action `update_coherence_rule` ou `update_report_template` est mise en attente** dans `system_auto_updates` avec `approved_by_admin=false`.

- **Admin** (Benjamin) reçoit notification in-app + email
- **Validation** via /admin/veille → endpoint d'approbation (à implémenter sprint suivant) qui copie `rollback_data` puis applique `changes_applied`
- **Rollback** : 1 clic dans /admin/veille restaure `rollback_data`

Aucune mutation directe automatique sur tables métier (coherence_rules, report_templates) — **principe humain-dans-la-boucle obligatoire**.

## 8. Choix techniques notables

### Tool use Claude vs JSON mode

**Choix : tool use forcé via `tool_choice: { type: 'tool', name: '...' }`.**

Raison : tool use garantit un JSON conforme au `input_schema` (validation côté Anthropic) — l'alternative "JSON mode" (instruction texte) reste sensible aux hallucinations sur les enums (action_type, urgency, affected_modules). Le coût en tokens est identique. Pour un module dont la chaîne aval (notifications, auto-updates) dépend de la structure, c'est non-négociable.

### Claude Sonnet 4.6 vs Haiku 4.5

**Choix : Sonnet 4.6.**

Coût ~6x Haiku mais : compréhension juridique FR + extraction d'enums fiables + capacité à distinguer "modification" vs "nouveau texte" est critique. Volume faible (50 docs/mois) → surcoût négligeable (~1,6 €/mois). Opus rejeté (4x Sonnet sans gain mesurable sur ce cas).

### Embeddings text-embedding-3-small vs large

**Choix : small (1536d).**

Coût 6x moindre, qualité suffisante pour RAG sur 50-1000 documents. Migration possible vers `large` (3072d) au sprint RAG si rappel/précision insuffisants — pgvector supporte le re-embed.
