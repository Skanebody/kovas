# KOVAS — Optimisation des coûts IA (Vague 2026-05)

> **Authority** : CLAUDE.md §7bis (stratégie d'autonomisation IA) + §8 (stack IA).
> Source de vérité technique : [`apps/web/src/lib/ai/anthropic-config.ts`](../apps/web/src/lib/ai/anthropic-config.ts).
> Objectif : marge brute **> 60% sur tous les forfaits**, viser **77% (M12) → 85%+ (M36)**.

## 1. Objectifs business

| Forfait | ARPU/mo | Cible coût IA max/mo/user | Marge brute cible |
|---|---|---|---|
| Découverte 29€ | 49€ (incl. surplus 20×2€) | < 4€ | **> 90%** |
| Standard 59€ | 81,50€ (incl. surplus 15×1,50€) | < 8€ | **> 90%** |
| Volume 99€ | 99€ | < 13€ | **> 85%** |
| Cabinet 199€ (Phase 2, 2 users) | 199€ | < 25€ | **> 85%** |

## 2. Trois leviers stratégiques

### Levier 1 — Prompt caching ephemeral 5 min

Anthropic supporte `cache_control: { type: 'ephemeral' }` sur les blocs `system` ET `user/content`.
- Cache READ : **10% du prix input** → -90% sur tokens cachés.
- Cache WRITE : 125% du prix input (+25% overhead). Break-even : ~3-4 hits dans la fenêtre 5 min.

**Cibles V1** :
- `regulatory-ai-chat` : system prompt (~1k tokens) + RAG context (~3-5k tokens) → 2 blocs cachés. Sur une conversation de 10 messages, ~9 hits → **-85% input cost**.
- `regulatory-analyze` : system prompt caché ; sur 50 docs/jour analysés dans la même fenêtre 5 min (rare) → léger gain (-15% sur le system prompt seul).

**Implémentation actuelle** : voir [`regulatory-ai-chat/index.ts`](../supabase/functions/regulatory-ai-chat/index.ts) → fonction `buildUserContent(ragContext, userQuery, dossierLine)`.

### Levier 2 — Batch API Anthropic (50% discount)

Pour les analyses **non urgentes** (veille réglementaire nocturne), on bascule vers `/v1/messages/batches` (anthropic-beta: `message-batches-2024-09-24`).

**Architecture** :
1. **regulatory-watcher** (cron horaire) : INSERT regulatory_documents (processed=false).
2. **regulatory-batch-analyze** (cron `0 1 * * *`) : SELECT 1000 docs pending → submit 1 batch → UPDATE batch_job_id.
3. **batch-results-poller** (cron `0 * * * *`) : pour chaque batch_id `ended` → itère NDJSON results → UPDATE doc + `ai_usage_log` (operation='regulatory_batch_analyze').

**Migration SQL** : [`20260526170000_alter_regulatory_documents_batch.sql`](../supabase/migrations/20260526170000_alter_regulatory_documents_batch.sql).

**Économie** : analyse Opus 4.7 standard = 0,02€/doc → batch = **0,01€/doc** soit **-50%**.

### Levier 3 — Routing modèles centralisé

`MODEL_FOR_FEATURE` ([`anthropic-config.ts`](../apps/web/src/lib/ai/anthropic-config.ts)) :

| Feature | Modèle assigné | Tarif USD/Mtok in/out | Justification |
|---|---|---|---|
| chatbot_methodo | Sonnet 4.6 | 3 / 15 | Qualité RAG citation, raisonnement multi-doc |
| parameter_suggestion | Haiku 4.5 | 1 / 5 | Phase 2 si appel IA — V1 = statistiques pures |
| defense_dossier | Sonnet 4.6 | 3 / 15 | Synthèse narrative Phase 2 |
| auto_quote_extraction | Haiku 4.5 | 1 / 5 | Extraction structurée tool use |
| regulatory_analysis | Opus 4.7 | 15 / 75 | Précision juridique critique — compensé par Batch -50% |
| vision_photo | Haiku 4.5 | 1 / 5 | Vision V2, prompts courts |
| consolidation | Sonnet 4.6 | 3 / 15 | Synthèse multi-photos / multi-pièces |
| document_extraction | Sonnet 4.6 | 3 / 15 | OCR + structuration complexe |
| community_anonymize | Haiku 4.5 | 1 / 5 | NER post-regex, contexte court |
| litigation_response | Sonnet 4.6 | 3 / 15 | Réponse juridique structurée |

## 3. Tableau de coûts AVANT / APRÈS

Hypothèses : **100 utilisateurs actifs / mois**, profil Standard (75 missions/mo, ARPU 81,50€).

### Profil Essential (forfait Découverte 29€, 20 missions/mo)

| Poste | AVANT (synchrone full price) | APRÈS (cache + batch + routing) | Δ |
|---|---|---|---|
| Chatbot méthodo (10 msg/mo/user) | 0,12€ | **0,02€** (-83%) | -0,10€ |
| Vision IA photos (V2) | n/a | n/a | – |
| Extraction email devis (5/mo) | 0,03€ | 0,03€ | 0 |
| Anonymisation cas communauté (1/mo) | 0,01€ | 0,01€ | 0 |
| Embeddings RAG (~50k tokens/mo) | 0,001€ | 0,001€ | 0 |
| **Total IA / user / mo** | **~0,16€** | **~0,06€** (-63%) | -0,10€ |
| **Marge brute Découverte** (49€ ARPU) | **99,7%** | **99,9%** | – |

### Profil Standard (59€, 75 missions/mo)

| Poste | AVANT | APRÈS | Δ |
|---|---|---|---|
| Chatbot méthodo (30 msg/mo/user) | 0,36€ | **0,05€** (-86%) | -0,31€ |
| Extraction email devis (15/mo) | 0,09€ | 0,09€ | 0 |
| Anonymisation cas communauté (2/mo) | 0,02€ | 0,02€ | 0 |
| Embeddings (~150k tokens/mo) | 0,003€ | 0,003€ | 0 |
| **Total IA / user / mo** | **~0,47€** | **~0,17€** (-64%) | -0,30€ |
| **Marge brute Standard** (81,50€ ARPU) | **99,4%** | **99,8%** | – |

### Profil All Inclusive (Volume 99€, 110 missions/mo + features Phase 2 actives)

| Poste | AVANT | APRÈS | Δ |
|---|---|---|---|
| Chatbot méthodo (50 msg/mo) | 0,60€ | **0,08€** (-87%) | -0,52€ |
| Vision IA photos (220 photos × 0,01€ Haiku) | 2,20€ | 2,20€ | 0 |
| Consolidation Sonnet | 1,10€ | 1,10€ | 0 |
| Document extraction Sonnet | 0,80€ | 0,80€ | 0 |
| Extraction email devis (30/mo) | 0,18€ | 0,18€ | 0 |
| **Total IA / user / mo** | **~4,88€** | **~4,36€** (-11%) | -0,52€ |
| **Marge brute Volume** (99€ ARPU) | **95,1%** | **95,6%** | – |

### Veille réglementaire (système, ~50 docs/mois)

| Poste | AVANT (Opus synchrone) | APRÈS (Opus + Batch) | Δ |
|---|---|---|---|
| Analyse Opus 4.7 (50 docs × 5k tok in + 1k out) | 1,00€ | **0,50€** (-50%) | -0,50€ |
| Embeddings doc + summary | 0,01€ | 0,01€ | 0 |
| **Total système / mois** | **~1,01€** | **~0,51€** | -0,50€ |

### Synthèse 100 users actifs / mois

| Scénario | AVANT total IA/mois | APRÈS total IA/mois | Économie |
|---|---|---|---|
| Mix typique (60 Standard + 30 Découverte + 10 Volume) | **~62€** | **~25€** | **-37€ (-60%)** |
| + veille réglementaire système | **63€** | **26€** | -37€ |

## 4. Limites & non-objectifs V1

- Le **heartbeat cache** (refresh forcé toutes les 4 min sur conversations actives) n'est PAS implémenté V1. On accepte la dégradation naturelle : une conv > 5 min sans message paie cache_creation au message suivant. Implémentation V2 dans `regulatory_ai_conversations.session_metadata` JSONB.
- Le **batch API** ne supporte PAS `cache_control` (les caches ne se partagent pas entre batches). Compensé par le -50% structurel.
- Le **fallback synchrone** (`regulatory-analyze`) est conservé pour les docs critical/high déclenchés manuellement par admin (délai batch 1-24h inacceptable).
- Le **cost-tracker centralisé** (`ai-usage-tracker` Edge Function) est appelé en best-effort (fetch silencieux si 404) — créé par une autre vague.

## 5. Métriques à tracker (post-déploiement)

| Métrique | Cible M+3 | Source |
|---|---|---|
| `ai.cache_hit_rate` (regulatory-ai-chat) | > 70% | usage.cache_read_input_tokens / input_tokens |
| `ai.claude.cost_eur` (mensuel total) | < 50€ pour 100 users | ai_usage_log sum |
| Batch latency P95 (`batch_submitted_at` → `batch_completed_at`) | < 6h | regulatory_documents |
| `regulatory_batch_analyze` cost ratio (vs synchrone théorique) | 0.50 ± 0.05 | comparaison ai_usage_log operations |
| Marge brute mensuelle blended (Phase 1) | > 85% | (MRR - coûts IA) / MRR |

## 6. Roadmap suite

- **V2 (M6-M9)** : heartbeat cache + batch routing dynamique (selon urgence doc) + Whisper self-hosted (cf. §7bis).
- **V3 (M12+)** : Llama 3.3 70B fine-tuné sur corpus KOVAS pour les extractions structurées simples (community_anonymize, auto_quote_extraction).
- **V4 (M18+)** : YOLO on-device pour Vision IA → 100% offline + 0€/photo.
