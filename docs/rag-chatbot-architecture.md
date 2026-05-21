# KOVAS — Architecture RAG du chatbot "Pose ta question méthodo"

> **Authority** : ce document décrit l'implémentation V1 du RAG chatbot. Toute évolution doit respecter CLAUDE.md §3 (features V1) et §8 (stack IA).
> **Statut** : V1 déployé — itération V1.5 planifiée post-launch.

---

## 1. Vue d'ensemble

Le chatbot "Pose ta question méthodo" répond aux questions réglementaires des diagnostiqueurs via un pipeline RAG (Retrieval-Augmented Generation) :

```
[Question diagnostiqueur]
        │
        ▼
[1. Embed query — OpenAI text-embedding-3-small (1536d)]
        │
        ├──────────────────────────────┐
        ▼                              ▼
[2a. pgvector top-5 docs       [2b. full-text français top-3
    (cosine similarity)            cas communauté approuvés]
    seuil 0.65 minimum]
        │                              │
        └─────────────┬────────────────┘
                      ▼
       [3. Compose contexte markdown
        avec références [D1]..[D5] + [C1]..[C3]]
                      │
                      ▼
       [4. Claude Haiku 4.5 streaming
        (SSE token + citation + done)]
                      │
                      ▼
   [5. INSERT regulatory_ai_conversations
       + ai_usage_log (operation='regulatory_chat')]
```

---

## 2. Composants

### 2.1 `supabase/functions/regulatory-ai-chat/index.ts`

Edge Function Deno qui orchestre tout le pipeline. POST `/functions/v1/regulatory-ai-chat`.

- Auth user via JWT Supabase (header `Authorization: Bearer <token>`)
- INSERT message user (role='user') avant traitement
- Embedding query → 2 RPC parallèles (`match_regulatory_documents` + `match_community_cases`)
- Stream SSE Claude Haiku 4.5
- INSERT message assistant + `cited_documents` + `cited_community_cases` + `cited_sources` JSON
- INSERT `ai_usage_log` (succès ou échec)

**Format SSE émis** :
```
event: citation
data: { "ref": "D1", "document_id": "...", "title": "...", "url": "...", "kind": "regulatory" }

event: token
data: { "text": "..." }

event: done
data: { "messageId": "...", "sessionId": "...", "costEur": 0.0023 }
```

### 2.2 `apps/web/src/lib/regulatory/embeddings.ts`

Wrapper OpenAI text-embedding-3-small côté Node (Next.js routes / scripts).

- Cache LRU 24h (SHA256 du texte normalisé)
- Batch jusqu'à 2048 textes par appel
- Retry exponentiel 3 tentatives (500ms, 1500ms, 4500ms)
- `truncateForEmbedding()` cap à 8192 tokens (~32k chars FR)

### 2.3 `apps/web/src/lib/regulatory/rag-search.ts`

Helpers RAG côté Node :
- `searchRegulatoryDocuments(supabase, query, topK, threshold)` → RPC `match_regulatory_documents`
- `searchCommunityCases(supabase, query, topK)` → RPC `match_community_cases`
- `ragSearch(supabase, query, opts)` → exécute les 2 en parallèle
- `composeRagContext(docs, cases, maxChars)` → markdown structuré avec refs `[Dx]` / `[Cx]`

### 2.4 `apps/web/src/app/api/regulatory/ai-chat/route.ts`

Relay Next.js → Edge Function :
- Auth via cookie Supabase
- Rate limit **30 messages / heure / user** (in-memory map, fenêtre glissante)
- Forward du stream SSE tel quel vers le client front

### 2.5 `supabase/functions/regulatory-embed-backfill/index.ts`

Worker cron quotidien 04:00 UTC (ou one-shot manuel) :
- SELECT WHERE `embedding IS NULL AND processed_at IS NOT NULL LIMIT 100`
- Embed batch (résumé + raw_text tronqué à 32k chars)
- UPDATE `embedding` + `embedding_generated_at`
- Idempotent (relance ne réembed pas)
- Authentifié par header `x-cron-secret`

---

## 3. RPC SQL requises (à créer dans une migration ultérieure)

```sql
-- Recherche top-K par similarité cosine
create or replace function public.match_regulatory_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  ai_summary text,
  url text,
  similarity float,
  published_at date,
  importance text
)
language sql stable as $$
  select
    rd.id,
    rd.title,
    rd.ai_summary,
    rd.url,
    1 - (rd.embedding <=> query_embedding) as similarity,
    rd.published_at,
    rd.importance
  from regulatory_documents rd
  where rd.processed_at is not null
    and rd.is_superseded = false
    and rd.embedding is not null
    and 1 - (rd.embedding <=> query_embedding) > match_threshold
  order by rd.embedding <=> query_embedding
  limit match_count;
$$;

-- Recherche full-text français top-K (cas communauté approuvés)
create or replace function public.match_community_cases(
  query_text text,
  match_count int
)
returns table (
  id uuid,
  title text,
  question text,
  decision_made text,
  justification text,
  rank float
)
language sql stable as $$
  select
    cc.id,
    cc.title,
    cc.question,
    cc.decision_made,
    cc.justification,
    ts_rank(
      to_tsvector('french', coalesce(cc.title,'') || ' ' || coalesce(cc.question,'') || ' ' || coalesce(cc.decision_made,'') || ' ' || coalesce(cc.justification,'')),
      plainto_tsquery('french', query_text)
    ) as rank
  from community_cases cc
  where cc.status = 'approved'
    and to_tsvector('french', coalesce(cc.title,'') || ' ' || coalesce(cc.question,'') || ' ' || coalesce(cc.decision_made,'') || ' ' || coalesce(cc.justification,''))
        @@ plainto_tsquery('french', query_text)
  order by rank desc
  limit match_count;
$$;
```

> **À ajouter par l'agent migrations** dans `supabase/migrations/20260525190000_rag_rpc.sql`. Le code applicatif est prêt à les consommer.

---

## 4. Sécurité

| Vecteur | Contre-mesure |
|---|---|
| Leak doc non publié | Filtre RPC `processed_at IS NOT NULL AND is_superseded = false AND embedding IS NOT NULL` |
| Leak cas communauté non modéré | Filtre RPC `status = 'approved'` |
| Injection prompt → exfiltration | System prompt verrouille le ton + RAG context cloisonné en bloc markdown |
| Coût API runaway | Rate limit 30 msg/h/user + plafond 1024 tokens output Claude + cap 4000 chars input |
| IDs fabriqués dans cited_sources | Le tableau `cited_documents` est dérivé directement des résultats RPC, pas de l'output Claude |
| Edge Function publique | Auth JWT Supabase obligatoire + (pour backfill) `x-cron-secret` header |

---

## 5. Coût

| Composant | Tarif | Estimation |
|---|---|---|
| Embedding query (text-embedding-3-small) | $0.02 / 1M tokens | ~50-200 tokens / query → < 0,000004 EUR |
| Claude Haiku 4.5 input | $0.80 / 1M tokens | ~3 000 tokens contexte → 0,0024 USD ≈ 0,0022 EUR |
| Claude Haiku 4.5 output | $4.00 / 1M tokens | ~500 tokens réponse → 0,002 USD ≈ 0,0019 EUR |
| **Total / message** | | **≈ 0,002 EUR** |
| **Conversation 10 messages** | | **≈ 0,02 EUR** |

> Avec **prompt caching ephemeral** sur le system prompt (1h TTL), les messages suivants dans la session bénéficient d'une input cachée à 10% du tarif normal. Économie réelle estimée ~30% sur les conversations longues.

---

## 6. Choix du modèle : Claude Haiku 4.5

| Critère | Justification |
|---|---|
| Coût | 5× moins cher que Sonnet 4.6 |
| Latence | Premier token < 500ms — UX réactive critique pour chatbot |
| Qualité | Suffisante pour Q&A factuelle ancrée dans un contexte RAG fourni (pas de raisonnement complexe) |
| Streaming | Support SSE natif via SDK Anthropic |
| Prompt caching | Supporté → optimisation coût session longue |

Le chatbot **ne fait pas** :
- raisonnement juridique élaboré → renvoie à un avocat / cabinet
- génération de code → réservé à Sonnet
- analyse d'images → réservé à Sonnet vision (Phase 2)

Si la qualité s'avère insuffisante en bêta (M6-M9), bascule vers Sonnet 4.6 via env var `ANTHROPIC_MODEL_REG_CHAT` sans changement de code.

---

## 7. Limites V1

| Limite | Impact | Roadmap V1.5 |
|---|---|---|
| **Pas de re-ranking cross-encoder** | top-5 brut peut contenir des faux positifs sur queries ambiguës | Ajout Cohere Rerank (5€/100k requêtes) ou Voyage AI rerank si NPS chatbot < 7/10 |
| **Pas d'historique conversation dans le RAG** | chaque message est traité indépendamment — pas de suivi "tu m'as dit ça avant" | Sliding window 3-5 derniers messages dans le prompt user + résumé conversationnel auto |
| **Cap full_text embedding à 8192 tokens** | risque de perdre du contexte sur arrêtés 100+ pages | Chunking 1000-2000 tokens + multi-vector embeddings (1 doc → N chunks) + dédup par parent_id |
| **Cache embedding LRU in-memory** | sur Vercel, chaque instance serverless a son propre cache → pas de partage | Migration vers Upstash Redis ou Vercel KV pour cache global |
| **Pas de feedback loop** | l'utilisateur ne peut pas dire "réponse pas pertinente" | Ajout boutons 👍/👎 + table `regulatory_ai_feedback` pour fine-tuning prompt |
| **Pas de tools / function calling** | Claude ne peut pas requêter de DB additionnelle (ex: ADEME live) | Phase 2 — tool `lookup_ademe_dpe` quand DPE certifié actif |
| **Rate limit in-memory Vercel** | bypass possible si client tape sur plusieurs instances | Migration vers Redis avec INCR + EXPIRE |

---

## 8. Métriques à tracker

| Métrique | Source | Cible |
|---|---|---|
| Latence end-to-end (premier token) | `ai_usage_log.duration_ms` | < 1500ms p95 |
| Coût moyen / message | `ai_usage_log.cost_eur` | < 0,003 EUR |
| Taux retrieval > 0 docs | RPC return count | > 85% |
| Taux conversation > 3 messages | `regulatory_ai_conversations` GROUP BY session_id | > 40% (engagement) |
| Cache hit rate embeddings | helper `getEmbeddingCacheSize()` + counter | > 25% |
| NPS chatbot | feedback in-app post-réponse (V1.5) | > 7/10 |

---

## 9. Variables d'environnement

| Var | Usage | Obligatoire |
|---|---|---|
| `OPENAI_API_KEY` | Embeddings query + backfill | Oui |
| `ANTHROPIC_API_KEY` | Claude Haiku 4.5 streaming | Oui |
| `ANTHROPIC_MODEL_REG_CHAT` | Override modèle (défaut: claude-haiku-4-5) | Non |
| `OPENAI_MODEL_EMBED` | Override modèle embedding (défaut: text-embedding-3-small) | Non |
| `SUPABASE_URL` | Edge Function | Oui |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function (bypass RLS pour inserts) | Oui |
| `SUPABASE_ANON_KEY` | Edge Function (auth user via JWT) | Oui |
| `CRON_SECRET` | Backfill cron (sinon endpoint accessible) | Recommandé |
| `NEXT_PUBLIC_SUPABASE_URL` | Relay Next.js → Edge Function | Oui |

---

## 10. Tests à prévoir (V1.5)

- Unit : `composeRagContext()` avec 0 / 5 docs / 3 cas
- Unit : `truncateForEmbedding()` sur texte > 32k chars
- Integration : `searchRegulatoryDocuments()` avec mock RPC
- E2E Playwright : conversation complète depuis le chat UI (post-implémentation UI)
- Load : 100 utilisateurs concurrents → vérifier rate limit + latence
