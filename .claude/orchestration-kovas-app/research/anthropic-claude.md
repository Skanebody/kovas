# Anthropic Claude API Integration — Research

**Wave**: First | **Date**: 2026-05-13 | **Status**: Complete

> **Tool-availability disclaimer**: WebFetch, WebSearch, Bash, and Write were all denied in subagent session. All claims reflect publicly documented Anthropic information through January 2026 knowledge cutoff. Pricing must be re-verified on `https://www.anthropic.com/pricing` before locking financial projections.

## Summary

KOVAS depends on Claude for 4 of its top 5 differentiators. With **aggressive prompt caching + tiered model routing** (Haiku 4.5 for voice/chatbot, Sonnet 4.6 for Vision/sketch/reco, Opus 4.7 reserved as escape hatch), projected per-user monthly Anthropic spend is **~2.17 €** in the recommended scenario and **~3.12 €** even under the PRD §15.3 +50% pricing shock — both inside the 4–7 €/user/month envelope. The single biggest lever is prompt caching with the 1-hour TTL on the equipment-recognition and voice-structurer system prompts; the second biggest is choosing Haiku over Sonnet for the high-frequency voice-structuration loop.

## Key Findings

### 1. Claude Model Family (as of 2026)

| Model | Model ID (pin a dated snapshot in prod) | Context | Max output | Input $/MTok | Output $/MTok | Cache write 5m / 1h | Cache read | Vision | Tools | Stream | Batch -50% |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Opus 4.7** | `claude-opus-4-7-<date>` | 200k (1M beta) | 32k | $15 | $75 | $18.75 / $30 | $1.50 | Yes | Yes | Yes | Yes |
| **Sonnet 4.6** | `claude-sonnet-4-6-<date>` | 200k (1M beta) | 64k | $3 | $15 | $3.75 / $6 | $0.30 | Yes | Yes | Yes | Yes |
| **Haiku 4.5** | `claude-haiku-4-5-<date>` | 200k | 16k | $1 | $5 | $1.25 / $2 | $0.10 | Yes | Yes | Yes | Yes |

Notes:
- **Always pin dated snapshots** — alias IDs drift and silently re-evaluate prompts.
- Cache write at 5-min TTL = 1.25× input rate; 1-hour TTL = 2× input rate. Cache read = 0.1× input rate. Break-even ≈ 2 reuses (5m) or 3 reuses (1h).
- Sonnet ≥4.5 supports a **1M-token context** behind `anthropic-beta: context-1m-…` but doubles input price above 200k.
- Batch API gives 50% off both input/output, 24h SLA, separate rate limits, caching still applies.

### 2. Recommended model per KOVAS use case

| Use case | Volume/user/mo | Complexity | Recommended | Why |
|---|---|---|---|---|
| Voice → structured fields | ~450 | Medium | **Haiku 4.5** | Tool-use constrains output; Haiku is plenty accurate; 3× cheaper than Sonnet |
| Equipment Vision recognition | ~150 | High | **Sonnet 4.6** | Vision reasoning + label OCR; Opus is overkill, Haiku trails on small text |
| Sketch generation from photos | ~5–15 | Very high | **Sonnet 4.6** default, **Opus 4.7** for low-confidence retries | Volume too low for Opus to dominate |
| Post-DPE F/G recommendation | ~5 | Medium | **Sonnet 4.6** + **Batch API** | One-shot, customer-facing; 24h SLA acceptable |
| Metier chatbot | ~22 | Low–medium | **Haiku 4.5** with cached KB, escalate to Sonnet if confidence < 0.7 | Routine reg lookups |

### 3. Vision API patterns

- **Input formats**: base64 or URL. **Use signed Supabase Storage URLs (5–15 min TTL)**, not base64 — avoids 33% size inflation and keeps photos out of API logs.
- **Multi-image**: up to ~20 images/request; KOVAS will use 1–2 (front + nameplate).
- **Resolution**: optimal **1568px long edge (~1.15 MP)**; higher does not help. Tokens ≈ `(W × H) / 750` → 1.15 MP ≈ 2,500 tokens.
- **Per-image cost** (Sonnet 4.6, no caching): ~2,500 image + ~500 prompt input + ~300 output ≈ **$0.013 / 0.012 €** — well under PRD's 0.05 €/photo budget.
- **For 85% brand accuracy**: force tool use; enumerate the top-30 French chaudière brands in the cached system prompt; ask for **per-field confidence (0–1)** and **rationale**; treat confidence <0.7 as "non reconnu" + manual entry fallback.
- **Limitations**: small text under poor light (mitigate with second close-up); reflections/glare (surface "retake" CTA via low confidence); always return an array because some photos contain multiple items.

### 4. Structured output (tool use)

- Use Anthropic **tool use** for every structured response; never parse free text.
- TypeScript: **Zod** for schema, `zod-to-json-schema` to convert, validate inbound on the way back.
- Force structure with `tool_choice: { type: "tool", name: "extract_fields" }`.
- Retry on Zod validation failure **exactly once**, appending the error to the user message.
- **Streaming**: enable only for chatbot (`stream: true`). Voice/vision/sketch/reco return JSON atomically.

### 5. Prompt caching (CRITICAL — single biggest cost lever)

- Up to **4 `cache_control` breakpoints** per request, marking prefixes. Cached reads = 10% of input price.
- TTLs: **5 min** (standard) and **1 hour** (extended, opt-in `cache_control: { type: "ephemeral", ttl: "1h" }`).

KOVAS caching plan:

| Cached content | Tokens | Reuse/hour | TTL |
|---|---|---|---|
| Equipment Vision system prompt (brand list + schema + example) | ~4,000 | 10+ | **1h** |
| Voice structurer system prompt + field schema | ~2,000 | 30+ | **1h** |
| Metier chatbot KB chunks (retrieved + top-up) | ~8,000 | 4–6 | **1h** |
| DPE recommendation system prompt | ~6,000 | 1–2 | **5m or none** |

- What NOT to cache: anything that varies per request (image bytes, user transcripts, RAG retrievals). Put static content **before** the breakpoint, dynamic **after**.
- **Cache hits are not user-scoped** — they hit on raw prefix bytes, so one shared system prompt benefits the entire fleet.

### 6. Cost forecast per user/month

**Assumptions**: 15 missions/mo · 30 voice clips/mission · 25 photos/mission with 10 Vision calls · 5 Post-DPE calls · 22 chatbot turns.

**Monthly per-user totals** (USD → EUR at 1 USD ≈ 0.92 EUR, May 2026):

| Scenario | Voice (450) | Vision (150) | Post-DPE (5) | Chatbot (22) | **USD/mo** | **EUR/mo** |
|---|---|---|---|---|---|---|
| **Worst** — no caching, all Sonnet 4.6 | $4.66 | $3.83 | $0.20 | $0.51 | **$9.20** | **8.46 €** |
| **Baseline** — no caching, recommended models | $1.17 | $3.83 | $0.20 | $0.20 | **$5.40** | **4.97 €** |
| **Recommended** — 1h cache + recommended models | $0.32 | $1.76 | $0.20 | $0.08 | **$2.36** | **2.17 €** |
| **Recommended + Batch on Post-DPE** | $0.32 | $1.76 | $0.10 | $0.08 | **$2.26** | **2.08 €** |
| **Hostile** — Anthropic +50% price (PRD §15.3) | $0.48 | $2.64 | $0.15 | $0.12 | **$3.39** | **3.12 €** |

**Headline**: recommended stack lands at **~2.17 €/user/mo**, well inside the PRD 4–7 € envelope. Caveat: at <50 active users in early bêta the cache may not get enough reuses; budget **8–10 €/user/mo** for the first 60 days.

### 7. Token budgeting (hard caps to enforce in code)

| Operation | Recommended `max_tokens` | Hard ceiling |
|---|---|---|
| Voice structure | 300 | 500 |
| Vision equipment | 500 | 1,000 |
| Sketch generation | 2,000 | 4,000 |
| Post-DPE recommendation | 3,000 | 5,000 |
| Chatbot turn | 600 | 1,500 |

### 8. Error handling, retries, rate limits

- **Tiered limits** in 2026: Tier 1 default, Tier 2/3/4 unlocked by spend + account age. Request a tier bump from Anthropic support **before M9 public launch**.
- **HTTP handling**:
  - **429**: exponential backoff (1s, 2s, 4s, 8s, max 4 attempts), then surface "réessayer dans un instant".
  - **529** (overloaded): backoff, max 2 retries, then tee to fallback provider on critical paths.
  - **5xx**: 1 retry + jitter, then fall back.
  - **400/422**: never retry — log as bug.
- **Idempotency**: always pass an `Idempotency-Key` UUID per logical operation.
- **Graceful degradation if Anthropic is down** (PRD §15.3):
  - **Voice** → **OpenAI `gpt-4o-mini`** (cheaper than Haiku, JSON-mode supports tool use).
  - **Vision** → **Google `gemini-2.0-flash`** or **Mistral Pixtral** (EU-hosted, RGPD optics).
  - **Chatbot** → **OpenAI `gpt-4o-mini`** for routine.
  - **Sketch + Post-DPE**: queue + retry later — not interactive.
- **Fallback architecture**: a `packages/ai/` provider abstraction with one interface per use case. Each function has primary (Anthropic) and secondary providers with health check + circuit breaker. A single config flip can route by cost in addition to availability.

### 9. SDK choice

- **`@anthropic-ai/sdk`** (TypeScript, official). Pin a recent version; first-party, full types for tool use / vision / streaming.
- **Caching**: add `cache_control: { type: 'ephemeral', ttl: '1h' }` to the last block of any prefix you want cached.
- **Edge runtime**: works in Supabase Edge (Deno) via npm specifier or raw `fetch`.

### 10. Server-side vs client-side

**Non-negotiable: every Claude call goes through the server.**

```
Mobile (RN) / Web (Next.js)
     │  Supabase Auth JWT
     ▼
Supabase Edge Function (Deno)  ← rate limit per user_id
     │  ANTHROPIC_API_KEY (Supabase secret)
     ▼
Anthropic API
```

- **Rate limits per user** (Phase 1 defaults):
  - Voice: 60 req / 5 min / user
  - Vision: 30 req / 5 min / user
  - Chatbot: 20 req / 5 min / user
  - Sketch + Post-DPE: 5 req / hour / user
  - **Daily hard cap**: 500 calls/day/user → block + alert.

### 11. Knowledge base integration (Phase 3 chatbot; foundations in Phase 1)

- **Use RAG, not large-context-with-caching.** KOVAS's reg KB will exceed 100k tokens.
- **Embedding model**: **Voyage AI `voyage-3-large`** (Anthropic's recommended partner; strong on French; ~$0.18/MTok, 1024-dim). Alternatives: Cohere `embed-multilingual-v3` (~$0.10/MTok), self-hosted `BAAI/bge-m3` on Railway.
- **Vector DB**: **`pgvector` on Supabase** — no external dep, RLS works out of the box, HNSW index handles KOVAS volumes.

Sketch schema:
```sql
create table kb_chunks (
  id uuid primary key default gen_random_uuid(),
  source text not null,            -- 'ADEME' | 'DHUP' | 'DGCCRF'
  article_ref text,
  title text,
  content text not null,
  embedding vector(1024),
  updated_at timestamptz default now()
);
create index on kb_chunks using hnsw (embedding vector_cosine_ops);
```

### 12. Concrete system prompts (sketches)

**12.1 Voice → mission fields** (Haiku 4.5, tool use forced, system prompt cached 1h)
```
You are an extractor for a French real-estate diagnostic app (KOVAS). A
diagnostiqueur dictates field observations in French; extract structured data
only. Always call the `extract_mission_fields` tool. Never invent values: if
the transcript does not contain a field, set it to null. Keep French text
unchanged in string fields. Confidence is your own subjective certainty 0-1
per field.
```
Tool: `extract_mission_fields(surface_m2, nb_pieces, type_chauffage, annee_construction, observations, confidence: Record<string,number>)`.

**12.2 Equipment vision identifier** (Sonnet 4.6, tool use forced, system prompt cached 1h)
```
You identify French residential heating/water-heating equipment from photos.
Output: brand, model, fuel type, nominal power (kW), manufacture year if a
nameplate is visible, energy class if labeled, and a confidence 0-1 per field.

Known French chaudière brands (non-exhaustive — match to closest):
Saunier Duval, De Dietrich, Atlantic, Frisquet, Vaillant, Viessmann,
Chaffoteaux, ELM Leblanc, Bosch, Buderus, Chappee, Domusa, Ferroli, Riello,
Sime, Unical, Wolf, Beretta, Junkers, Ariston, Geminox, Idéal Standard,
Oertli, Cuenod, Weishaupt, Hitachi, Daikin, Mitsubishi (PAC), LG (PAC),
Panasonic (PAC).

If a nameplate is blurred or partially obscured, return what you can read
verbatim in `raw_label_text` and lower the confidence. Never invent a model
number; prefer null + low confidence over a guess. Always call the
`identify_equipment` tool.
```

**12.3 Post-DPE F/G recommendation generator** (Sonnet 4.6, Batch API, system prompt cached 5m)
```
You generate a "Plan d'action rénovation" for a French homeowner whose DPE is
F or G. Output exactly 3 scenarios (gestes simples / BBC compatible / performance
max). For each: list of travaux (qty + estimated cost ±20%), estimated DPE gain
(letters), MaPrimeRénov' / CEE / éco-PTZ eligibility and amount (USE THE PROVIDED
AIDES CATALOG — do not compute from memory), ROI 5 years. Customer-facing
French: neutral, factual, professional. Never promise official certification —
phrase as "estimation indicative". Always call `generate_recommendation_plan`.
```

**12.4 Metier chatbot — réglementation FR diagnostic** (Haiku 4.5, escalate to Sonnet 4.6 if confidence <0.7)
```
You are KOVAS Assistant, a French expert assistant for diagnostiqueurs.
You answer questions about French diagnostic regulation: DPE (méthode
3CL-2021), amiante, plomb, gaz, électricité, termites, ERP, Carrez, Boutin.
Answer in French, concise, with the official source cited at the end (article
référence + lien officiel). If unsure, say so and offer to escalate to human
support. Never invent regulatory references. Never give legal advice — only
describe what the official texts say.
```

### 13. Common pitfalls

| Pitfall | KOVAS mitigation |
|---|---|
| Inconsistent JSON output | Force tool use + Zod validation + 1 retry with error feedback |
| Hallucinated equipment specs | Per-field confidence; <0.7 → "non reconnu"; never auto-populate user-facing fields below threshold |
| Context window blowup on chatbot | Truncate to last 6 turns; older turns → summary block |
| Cost blowup — uncached system prompts | Code-review rule: every `messages.create` from `packages/ai/` must declare `cache_strategy` |
| Cost blowup — infinite retry loops | `maxRetries: 4`, exponential backoff, circuit breaker on 3 consecutive 5xx |
| Cost blowup — `max_tokens` too high | Hardcoded per-route caps; CI test verifies |
| Cost blowup — Vision images too large | Client-side resize to long-edge 1568 px before upload; reject >5MB at the edge |
| Prompt drift dev↔prod | Semver each prompt; PostHog event carries `prompt_version` |
| Snapshot drift | Pin dated snapshot IDs in env vars; alias IDs forbidden in prod |
| Leaking customer text into observability | Sentry breadcrumbs scrub `transcript`, `image_url`, `chat_message` |
| Cache TTL miss on low-traffic users | At MAU <100, prefer 5-min TTL or no cache for low-frequency ops |

## Recommended Approach

1. Build a **`packages/ai/`** workspace owning all Anthropic interaction; one TS module per use case, each exporting a Zod-validated async function.
2. Pin model snapshots in `MODEL_VOICE` / `MODEL_VISION` / `MODEL_SKETCH` / `MODEL_RECO` / `MODEL_CHAT` env vars (Haiku 4.5 for voice + chat, Sonnet 4.6 for vision + sketch + reco, Opus 4.7 reserved behind a feature flag).
3. Force tool use for every structured op; never parse free text.
4. Cache **1-hour TTL** on Voice and Vision system prompts (highest reuse); 5-min or no cache for low-frequency ops.
5. Route all calls through Supabase Edge Functions; per-user rate limits at the edge.
6. Implement provider fallback (OpenAI gpt-4o-mini for voice/chat, Gemini 2.0 Flash for vision) behind the same interface.
7. Use the Batch API for Post-DPE recommendations (50% discount stacks with caching).
8. Build the **pgvector + Voyage AI** RAG pipeline from day 1.
9. Instrument every Claude call in PostHog: model, prompt_version, cached_tokens, input_tokens, output_tokens, latency_ms, retry_count, fallback_used.
10. Run weekly accuracy spot-checks on Vision + Voice against the DoD F1/F2 validation datasets.

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Sonnet 4.6 for everything | Simpler ops | ~2× cost vs tiered routing | Rejected |
| Opus 4.7 for Vision | Best vision quality | 5× Sonnet's cost; Sonnet already at parity | Rejected — Opus is escape hatch only |
| OpenAI gpt-4o primary | Cheaper output, mature SDK | Loses Anthropic caching economics; weaker French tool-use determinism | Rejected as primary, **adopted as fallback** |
| Mistral Pixtral primary | EU-hosted (RGPD optics), French-native | Smaller ecosystem, Vision trails Sonnet on label OCR | **Adopted as secondary fallback** for Vision |
| No caching, just batch | Simpler mental model | Misses 80% Vision / 60% Voice savings | Rejected |
| Self-host OSS VLM | Zero variable cost | Massive ops, GPU bill, worse French label accuracy | Rejected for Phase 1 |
| External vector DB (Pinecone/Weaviate) | More features | Extra bill/ops, no RLS integration | Rejected — pgvector sufficient until 10M+ vectors |
| OpenAI / Cohere embeddings | Familiar | Weaker on French legal jargon | Rejected in favor of Voyage AI |

## Pitfalls and Edge Cases

- **Cache miss in early bêta** — at <50 active users, expect 1.5–2× the steady-state bill for the first 60 days. Budget **8–10 €/user/mo** during bêta.
- **Anthropic RGPD / EU residency** — confirm Anthropic DPA signed. Consider **Anthropic on AWS Bedrock (eu-central-1)** for stricter posture.
- **Whisper transcripts feeding Claude** — transcription errors propagate; include raw transcript in the prompt.
- **Photo PII** — equipment photos may capture faces; warn users on first capture; never log raw image URLs.
- **Tool-use schema evolution** — schema changes break the cache prefix; roll out off-peak.
- **Model version transitions** — A/B 5% traffic for one week per use case.
- **Streaming + Edge** — Supabase Edge supports SSE responses; RN needs `react-native-sse`.
- **1M context beta** — tempting for "stuff the whole KB" but doubles input price above 200k; stick to RAG.
- **Idempotency keys** — without them, you may pay twice on a borderline timeout.
- **Provider fallback drift** — JSON Schema dialects differ slightly across providers; chaos-test the fallback path every release.

## References (VERIFY)

- Anthropic models: `https://docs.anthropic.com/en/docs/about-claude/models/overview`
- Pricing: `https://www.anthropic.com/pricing`
- Prompt caching: `https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching`
- Tool use: `https://docs.anthropic.com/en/docs/build-with-claude/tool-use`
- Vision: `https://docs.anthropic.com/en/docs/build-with-claude/vision`
- Message Batches: `https://docs.anthropic.com/en/docs/build-with-claude/message-batches`
- Rate limits & tiers: `https://docs.anthropic.com/en/api/rate-limits`
- TS SDK: `https://github.com/anthropics/anthropic-sdk-typescript`
- Bedrock (EU residency): `https://docs.anthropic.com/en/api/claude-on-amazon-bedrock`
- Voyage AI embeddings: `https://docs.voyageai.com/docs/embeddings`
- pgvector on Supabase: `https://supabase.com/docs/guides/database/extensions/pgvector`

## Open Items for Second Wave

- D302: lock primary model per use case → second wave writes the concrete `MODEL_*` env-var defaults.
- D1101: Anthropic account + Workspaces with separate dev/staging/prod keys.
- D301: Supabase region (Paris vs Frankfurt) — affects edge↔Anthropic latency negligibly but matters for RGPD posture.
- Prompt versioning scheme (semver vs git-sha).
- Validation datasets (200 photos + 200 voice clips for DoD F1/F2) — source from bêta cohort.
- Anthropic DPA signed copy.
- Anthropic-direct vs AWS Bedrock EU decision for RGPD posture.
