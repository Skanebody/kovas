# KOVAS AI ECONOMICS & TOKEN OPTIMIZATION

> Document interne dev-facing. À placer dans `docs/refonte-2026-05/`.
> Ce document décrit les 15 techniques d'optimisation IA à implémenter par les agents Claude Code. Aucun élément ici n'est visible côté client : c'est de l'infrastructure invisible qui protège les marges et améliore les performances.
> Version : 1.0 — 25 mai 2026

---

## TABLE DES MATIÈRES

1. Contexte économique
2. Les 15 techniques d'optimisation
3. Trajectoire d'apprentissage utilisateur
4. Cost ceiling par tier
5. Implémentation par agent
6. Monitoring & alerting
7. Règles de garde-fou

---

## 1. CONTEXTE ÉCONOMIQUE

### 1.1 Pourquoi cette optimisation est critique

KOVAS utilise massivement l'IA dans ses 13 algorithmes. Sans optimisation, le coût IA explose mécaniquement avec l'usage utilisateur. Avec optimisation, le coût stagne ou décroît dans le temps grâce à l'apprentissage.

Cible : ratio coût IA / revenue par utilisateur reste sous 15% à tous les tiers, en cold start ET après learning.

### 1.2 Référence pricing Claude API 2026 (verified)

| Modèle | Input ($/Mtoken) | Output ($/Mtoken) |
|---|---|---|
| Claude Haiku 4.5 | $1,00 | $5,00 |
| Claude Sonnet 4.6 | $3,00 | $15,00 |
| Claude Opus 4.7 | $5,00 | $25,00 |

Modificateurs disponibles :
- **Prompt caching** : −90% sur input cached (cache hit à $0,30/Mtoken pour Sonnet)
- **Batch processing** : −50% sur input et output
- **Long context (1M tokens)** : pricing standard jusqu'à 200K tokens input

Whisper API : $0,006/min (standard) ou $0,003/min (gpt-4o-mini-transcribe).

### 1.3 Coût IA cible par mission

| Phase | Coût brut sans optimisation | Coût avec optimisations | Économie |
|---|---|---|---|
| Cold start (M1) | ~0,18€ | **0,036€** | −80% |
| Post-learning (M6+) | ~0,12€ | **0,021€** | −82% |
| Mature (M24) | ~0,10€ | **0,015€** | −85% |

Ces chiffres sont obtenus avec les 15 techniques activées. Toute mise en production d'une feature IA sans application des techniques pertinentes est un bug économique.

---

## 2. LES 15 TECHNIQUES D'OPTIMISATION

### CATÉGORIE A — INFRASTRUCTURE-LEVEL (économies platform globales)

#### Technique 1 — Prompt caching agressif sur system prompts

**Économie estimée** : 60-70% sur les analyses récurrentes
**Agent responsable** : Agent 9 (algorithmes) + Agent 3 (sales page IA)
**Fichier d'implémentation** : `lib/ai/system-prompts/` (centralisation)

**Pattern d'implémentation** :

```typescript
// lib/ai/cache-wrapper.ts
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPTS = {
  conformityCheck: { content: '...', cacheControl: { type: 'ephemeral' } },
  visionEquipment: { content: '...', cacheControl: { type: 'ephemeral' } },
  // etc.
};

export async function callWithCache(
  promptKey: keyof typeof SYSTEM_PROMPTS,
  userMessage: string,
  model = 'claude-sonnet-4-20250514'
) {
  return anthropic.messages.create({
    model,
    max_tokens: 1500,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPTS[promptKey].content,
        cache_control: { type: 'ephemeral' } // 5 min cache
      }
    ],
    messages: [{ role: 'user', content: userMessage }]
  });
}
```

**Calcul économie** : un system prompt de 5k tokens partagé par 100 users actifs/jour = 100 × $0,015 standard = $1,50/jour. Avec cache hit 90% = $0,15/jour. Soit 410€/an d'économie par system prompt.

KOVAS a ~10 system prompts critiques. Économie totale : ~4100€/an.

#### Technique 2 — Batch processing pour analyses non-temps-réel

**Économie estimée** : 50% sur les workloads asynchrones
**Agent responsable** : Agent 8 (data pipeline) + Agent 9 (algos vague 2-3)
**Fichier d'implémentation** : `supabase/functions/batch-processor/`

**Pattern d'implémentation** :

Tout ce qui peut attendre 24h passe en batch :
- SEO page quality scoring (A1.3.12)
- Observatoire mensuel
- Document classification hebdo
- Refresh property profiles top 1000 villes
- Churn risk computation
- Production anomaly detection

```typescript
// supabase/functions/batch-processor/index.ts
import { batch } from '@anthropic-ai/sdk';

const batchRequest = await anthropic.messages.batches.create({
  requests: missionsToAnalyze.map(m => ({
    custom_id: m.id,
    params: {
      model: 'claude-haiku-4-5-20251022',
      max_tokens: 1000,
      messages: [{ role: 'user', content: m.payload }]
    }
  }))
});
// Récupération sous 24h, coût divisé par 2
```

#### Technique 3 — Model cascading Haiku 4.5 → Sonnet 4.6

**Économie estimée** : 60-80% sur l'ensemble des analyses
**Agent responsable** : Agent 9 (algorithmes)
**Fichier d'implémentation** : `lib/ai/cascading.ts`

**Pattern d'implémentation** :

First pass avec Haiku ($1/$5 par Mtoken). Si confidence > 85%, on garde le résultat. Si confidence faible, escalation vers Sonnet ($3/$15).

```typescript
// lib/ai/cascading.ts
export async function cascadingAnalysis(
  userPayload: string,
  confidenceThreshold = 0.85
) {
  // Pass 1 : Haiku 4.5
  const haikuResult = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251022',
    max_tokens: 1500,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPayload }],
    metadata: { use_case: 'cascading_pass_1' }
  });

  const parsed = JSON.parse(haikuResult.content[0].text);

  if (parsed.confidence >= confidenceThreshold) {
    return { result: parsed, model_used: 'haiku', escalated: false };
  }

  // Pass 2 : escalation Sonnet 4.6
  const sonnetResult = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: userPayload }]
  });

  return { result: JSON.parse(sonnetResult.content[0].text), model_used: 'sonnet', escalated: true };
}
```

**Calcul économie** : sur 1000 analyses, ~700 résolues par Haiku (0,30€) + 300 par Sonnet (4,50€) = 4,80€ vs 1000 × 0,015€ Sonnet direct = 15€. Économie 68%.

Tracker `escalation_rate` dans `analytics.ai_cost_metrics` pour surveiller la qualité de Haiku.

#### Technique 4 — Property unified profile cache 7 jours

**Économie estimée** : 200-500€/mois platform à scale
**Agent responsable** : Agent 9 (A1.3.4 profil propriété) + Agent 8 (pipeline data)
**Fichier d'implémentation** : `lib/cache/property-profile.ts` + Vercel KV

**Pattern d'implémentation** :

```typescript
// lib/cache/property-profile.ts
import { kv } from '@vercel/kv';

export async function getPropertyProfile(address: string) {
  const cacheKey = `property:${normalizeAddress(address)}`;
  const cached = await kv.get(cacheKey);
  if (cached) return cached; // Cache hit, 0€ IA

  // Cache miss : construire le profil
  const profile = await buildUnifiedPropertyProfile(address);
  await kv.set(cacheKey, profile, { ex: 60 * 60 * 24 * 7 }); // 7 jours TTL
  return profile;
}
```

Cas concret : 10 diagnostiqueurs travaillent sur Paris 9e. Le premier déclenche le cache miss (coût ~0,05€). Les 9 suivants accèdent au cache (coût 0€). À l'échelle de la platform, économie massive sur les zones urbaines denses.

### CATÉGORIE B — PER-MISSION OPTIMIZATIONS

#### Technique 5 — Equipment brands models cache progressif

**Économie estimée** : 80-90% sur Vision IA à terme
**Agent responsable** : Agent 9 (A1.3.6 Vision)
**Fichier d'implémentation** : `lib/cache/equipment-models.ts` + table Supabase

**Pattern d'implémentation** :

Première analyse plaque "Saunier Duval F30 Pro" coûte $0,0165 Vision. Résultat stocké dans `data.equipment_brands_models` (marque, modèle, puissance, type énergie, année). Toutes missions suivantes sur ce modèle = cache hit = 0€.

```sql
-- Table data.equipment_brands_models
CREATE TABLE data.equipment_brands_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  category TEXT NOT NULL, -- 'chaudiere_gaz', 'pac', 'chauffe_eau', etc.
  power_kw NUMERIC,
  energy_type TEXT,
  year_range INT4RANGE,
  technical_specs JSONB,
  vision_extracted_at TIMESTAMPTZ DEFAULT now(),
  occurrence_count INT DEFAULT 1,
  confidence NUMERIC DEFAULT 1.0,
  UNIQUE(brand, model)
);

CREATE INDEX idx_equipment_brand_model ON data.equipment_brands_models USING gin (
  to_tsvector('french', brand || ' ' || model)
);
```

Logique : avant chaque appel Vision, recherche fuzzy dans la table. Match >85% = cache hit. Sinon, appel Vision puis insertion.

Après 6 mois et 10 000 missions, les 100 modèles top couvrent 90% du marché. Vision usage drops à 10% des cas.

#### Technique 6 — Whisper hybride local + API

**Économie estimée** : 50-100% sur transcription
**Agent responsable** : Agent 3 (sales page + mission capture)
**Fichier d'implémentation** : `lib/audio/transcription.ts`

**Pattern d'implémentation** :

Pour audios courts (<3 min), basculer sur `whisper.cpp` local navigateur (WebAssembly, gratuit). API Whisper réservée aux audios longs ou conditions bruit ambiant difficile.

```typescript
// lib/audio/transcription.ts
import { detectAudioLength, detectAmbientNoise } from './audio-utils';

export async function transcribeAudio(audioBlob: Blob) {
  const lengthSec = await detectAudioLength(audioBlob);
  const noiseLevel = await detectAmbientNoise(audioBlob);

  // Local Whisper si conditions optimales
  if (lengthSec < 180 && noiseLevel < 0.4) {
    return transcribeLocal(audioBlob); // whisper.cpp WASM
  }

  // API Whisper sinon
  return transcribeViaAPI(audioBlob, {
    model: 'gpt-4o-mini-transcribe', // $0,003/min au lieu de $0,006/min
    language: 'fr'
  });
}
```

Économie : 50% sur la moitié des missions = −25% sur coût transcription total.

#### Technique 7 — Vision IA resize + grouping

**Économie estimée** : 30-40% sur Vision
**Agent responsable** : Agent 9 (A1.3.6)
**Fichier d'implémentation** : `lib/ai/vision-processor.ts`

**Pattern d'implémentation** :

```typescript
// lib/ai/vision-processor.ts
import sharp from 'sharp';

export async function processMissionPhotos(photos: File[]) {
  // 1. Resize all photos to max 1024x1024 (suffisant pour plaques)
  const resized = await Promise.all(photos.map(p =>
    sharp(p.path)
      .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer()
  ));

  // 2. Group all photos in single Vision call
  return anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: [
        ...resized.map(buffer => ({
          type: 'image' as const,
          source: { type: 'base64', media_type: 'image/jpeg', data: buffer.toString('base64') }
        })),
        { type: 'text', text: 'Identifie tous les équipements visibles avec marque, modèle, puissance.' }
      ]
    }]
  });
}
```

Économie sur tokens (image resize divise par 4 les tokens visuels) + 1 appel au lieu de N = −30-40% sur Vision.

#### Technique 8 — Structured outputs JSON Schema

**Économie estimée** : 20-30% sur output tokens
**Agent responsable** : Tous les agents IA
**Fichier d'implémentation** : `lib/ai/schemas/` (centralisation Zod schemas)

**Pattern d'implémentation** :

Forcer toutes les sorties IA au format JSON Schema. Output 30% plus court qu'en free-form. Output tokens coûtent 5× input, chaque token compte.

```typescript
// lib/ai/schemas/conformity-result.ts
import { z } from 'zod';

export const ConformityResultSchema = z.object({
  score: z.number().min(0).max(100),
  status: z.enum(['green', 'amber', 'red']),
  anomalies: z.array(z.object({
    type: z.string(),
    severity: z.enum(['low', 'medium', 'high']),
    field: z.string(),
    suggestion: z.string()
  })).max(3), // Philosophie max 3 alertes
  proactive_suggestion: z.string().optional().nullable()
});

// Dans le prompt :
const SYSTEM_PROMPT = `Tu retournes UNIQUEMENT un JSON conforme au schema :
${JSON.stringify(zodToJsonSchema(ConformityResultSchema), null, 2)}

Aucun préfixe, aucun texte hors JSON.`;
```

#### Technique 9 — Output cap explicite via max_tokens

**Économie estimée** : 10-20% sur outputs verbeux
**Agent responsable** : Tous les agents IA
**Fichier d'implémentation** : `lib/ai/constants.ts`

**Pattern d'implémentation** :

```typescript
// lib/ai/constants.ts
export const MAX_TOKENS_BY_TASK = {
  PRE_EXPORT_CONFORMITY: 1500,
  DOCUMENT_CLASSIFICATION: 200,
  VISION_EQUIPMENT: 300,
  MISSION_PROCESSING_BACKGROUND: 1000,
  LEAD_SCORING: 500,
  SEO_QUALITY_SCORE: 400,
  CHURN_PREDICTION: 200,
  PROPERTY_PROFILE: 2000 // exception, construction initiale
} as const;
```

Chaque appel IA précise explicitement `max_tokens` au plus juste pour sa tâche. Empêche les outputs verbeux qui gonflent inutilement la facture.

### CATÉGORIE C — PER-USER LEARNING (économies progressives)

#### Technique 10 — User mission profile knowledge graph

**Économie estimée** : 60-70% après M6 par utilisateur actif
**Agent responsable** : Agent 9 (A1.3.13 pattern learning)
**Fichier d'implémentation** : `lib/learning/user-knowledge-graph.ts` + `data.user_mission_patterns`

**Pattern d'implémentation** :

Chaque utilisateur a un knowledge graph dynamique stocké en JSONB : équipements typiques, zones géographiques typiques, types de biens, patterns d'erreurs récurrentes, ratios DPE habituels.

Après 30-50 missions, le système peut **prédire 70% des données** de la mission suivante. Claude ne reçoit que le **delta** à valider/compléter.

```typescript
// lib/learning/user-knowledge-graph.ts
export async function processWithKnowledgeGraph(userId: string, missionData: MissionInput) {
  const graph = await getUserKnowledgeGraph(userId);

  // 1. Prédire les défauts probables
  const predictions = predictFromGraph(graph, missionData);

  // 2. Calculer le delta
  const delta = computeDelta(predictions, missionData);

  // 3. Si delta < 10% (mission très similaire aux précédentes)
  if (delta.changeRatio < 0.10) {
    return reusePreviousAnalysis(predictions); // Coût IA : 0€
  }

  // 4. Si delta < 30% (mission semi-similaire)
  if (delta.changeRatio < 0.30) {
    return runIncrementalAnalysis(predictions, delta); // Coût IA : ~30%
  }

  // 5. Mission complexe, analyse complète
  return runFullAnalysis(missionData); // Coût IA : 100%
}
```

Trajectoire coût IA par mission selon ancienneté utilisateur :
- Mission 1 : 0,18€ (cold start, full analysis)
- Mission 11 : 0,10€ (user prefs intégrés)
- Mission 51 : 0,06€ (knowledge graph mature)
- Mission 101 : 0,04€ (delta-only analysis)
- Mission 200+ : 0,025€ (steady state)

#### Technique 11 — Embedding-based mission similarity

**Économie estimée** : 40% sur missions répétitives
**Agent responsable** : Agent 9 (intégré dans A1.3.13)
**Fichier d'implémentation** : `lib/learning/embeddings.ts` + pgvector Supabase

**Pattern d'implémentation** :

Chaque mission vectorisée (Voyage 2 ou OpenAI embeddings, $0,0001€ négligeable). Nouvelle mission comparée aux 1000 dernières du user. Si similarité cosine > 0,9 → réutiliser l'analyse précédente avec micro-delta.

```typescript
// lib/learning/embeddings.ts
import { createClient } from '@supabase/supabase-js';

export async function findSimilarMissions(userId: string, missionEmbedding: number[]) {
  const { data } = await supabase.rpc('match_user_missions', {
    user_id: userId,
    query_embedding: missionEmbedding,
    match_threshold: 0.9,
    match_count: 5
  });
  return data; // Si non vide, on peut réutiliser
}
```

```sql
-- Function SQL pgvector
CREATE FUNCTION match_user_missions(
  user_id UUID,
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INT
) RETURNS TABLE (mission_id UUID, similarity FLOAT) AS $$
  SELECT id, 1 - (embedding <=> query_embedding) AS similarity
  FROM missions
  WHERE missions.user_id = match_user_missions.user_id
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$ LANGUAGE SQL;
```

#### Technique 12 — Local rule engine pour patterns évidents

**Économie estimée** : 30% des appels IA évités
**Agent responsable** : Agent 9 (A1.3.3 score conformité)
**Fichier d'implémentation** : `lib/rules/conformity-rules.ts`

**Pattern d'implémentation** :

Beaucoup de checks ne nécessitent pas Claude. Codifier 50-80 règles métier déterministes :

```typescript
// lib/rules/conformity-rules.ts
const CONFORMITY_RULES = [
  {
    name: 'studio_electric_low_class',
    condition: (m: Mission) => m.surface < 20 && m.energyType === 'electric' && m.year < 1975,
    expectedDpe: 'F-G',
    severity: 'info',
    suggestion: 'Vérifier classe DPE F ou G probable'
  },
  {
    name: 'cohérence_chauffage_dpe',
    condition: (m: Mission) => m.chauffageMain === 'gaz' && m.dpeClass < 'C',
    suggestion: 'Chauffage gaz et DPE A-B est rare, vérifier les paramètres isolation'
  },
  // 80+ rules...
];

export function runLocalRules(mission: Mission) {
  const triggered = CONFORMITY_RULES.filter(r => r.condition(mission));
  if (triggered.length > 0) {
    return { handled: true, alerts: triggered }; // Pas besoin de Claude
  }
  return { handled: false }; // Escalation vers Claude
}
```

### CATÉGORIE D — ARCHITECTURE-LEVEL

#### Technique 13 — Tool use restriction dynamique

**Économie estimée** : 5-10% par appel
**Agent responsable** : Agent 9 (tous algos avec tool use)
**Fichier d'implémentation** : `lib/ai/tools-filter.ts`

**Pattern d'implémentation** :

Chaque tool dans la liste exposée ajoute ~150 tokens à chaque appel (description + JSON schema). Filtrer dynamiquement quels tools sont exposés selon le type de mission.

```typescript
// lib/ai/tools-filter.ts
const TOOLS_PER_MISSION_TYPE = {
  'DPE': ['search_dpe_history', 'check_cadastre', 'get_dvf_data', 'predict_class'],
  'AMIANTE': ['search_amiante_history', 'check_year_built', 'list_materials'],
  'AUDIT_ENERGETIQUE': ['search_dpe', 'check_cadastre', 'get_dvf', 'estimate_gains', 'list_aids', 'check_marprimerenov']
};

export function getToolsForMission(missionType: string) {
  return TOOLS_PER_MISSION_TYPE[missionType] || [];
}
```

Économie : 200-500 tokens par appel × millions d'appels = significatif sur la durée.

#### Technique 14 — Cold/Hot features model selection

**Économie estimée** : ratio 1,67× sur features bien classifiées
**Agent responsable** : Architectes du système (Agent 9 + Agent 3)
**Fichier d'implémentation** : `lib/ai/model-router.ts`

**Pattern d'implémentation** :

Opus 4.7 ($5/$25) vs Sonnet 4.6 ($3/$15) = 1,67× plus cher. Restreindre Opus uniquement aux features où la qualité fait la différence acqui-target :

```typescript
// lib/ai/model-router.ts
const MODEL_BY_FEATURE = {
  // Opus 4.7 — premium quality
  'pre_export_conformity_high_stakes': 'claude-opus-4-7-20260416', // Cabinet+ seulement
  'defense_litigation_panel': 'claude-opus-4-7-20260416',

  // Sonnet 4.6 — default
  'pre_export_conformity_standard': 'claude-sonnet-4-20250514',
  'vision_equipment': 'claude-sonnet-4-20250514',
  'lead_scoring': 'claude-sonnet-4-20250514',

  // Haiku 4.5 — speed/cost optimized
  'mission_processing_background': 'claude-haiku-4-5-20251022',
  'document_classification': 'claude-haiku-4-5-20251022',
  'seo_quality_score': 'claude-haiku-4-5-20251022',
  'churn_prediction': 'claude-haiku-4-5-20251022'
} as const;
```

Opus 4.7 réservé aux 2-3 features ultra-stratégiques. Reste sur Sonnet ou Haiku.

#### Technique 15 — Cache invalidation intelligente

**Économie estimée** : 20-30% sur recomputes
**Agent responsable** : Agent 9 (A1.3.3 + autres analyses)
**Fichier d'implémentation** : `lib/ai/incremental-recompute.ts`

**Pattern d'implémentation** :

Quand l'utilisateur édite une mission, ne pas recalculer tout depuis zéro. Détecter les champs changés, recalculer uniquement les sections dépendantes.

```typescript
// lib/ai/incremental-recompute.ts
const FIELD_DEPENDENCIES = {
  'year_built': ['conformity_score', 'risk_ademe', 'cadastre_check'],
  'surface_carrez': ['conformity_score', 'cadastre_check'],
  'heating_type': ['conformity_score', 'dpe_class_prediction', 'risk_ademe'],
  'photos': ['vision_equipment', 'conformity_score']
};

export async function incrementalRecompute(missionId: string, changedFields: string[]) {
  const affectedAnalyses = new Set<string>();
  changedFields.forEach(field => {
    (FIELD_DEPENDENCIES[field] || []).forEach(a => affectedAnalyses.add(a));
  });

  // Ne recalcule que les analyses affectées
  for (const analysisType of affectedAnalyses) {
    await runAnalysis(missionId, analysisType);
  }
}
```

Cas concret : utilisateur corrige l'année de construction d'une mission. Au lieu de relancer 5 analyses, on ne relance que les 3 qui dépendent de ce champ. Économie 40%.

---

## 3. TRAJECTOIRE D'APPRENTISSAGE UTILISATEUR

Voici la courbe attendue par utilisateur actif avec les 15 techniques activées. À mémoriser pour calibrer les marges projetées :

| Mois | Coût IA moyen / mission | Coût IA mensuel (50 missions) | Marge brute tier 29€ |
|---|---|---|---|
| M1 (cold start) | 0,036€ | 1,80€ | **80%** |
| M3 | 0,028€ | 1,40€ | **81%** |
| M6 (knowledge graph mature) | 0,021€ | 1,05€ | **83%** |
| M12 | 0,018€ | 0,90€ | **84%** |
| M24 (steady state) | 0,015€ | 0,75€ | **85%** |

L'utilisateur devient mécaniquement plus rentable avec le temps. Cette propriété est exceptionnelle (la majorité des SaaS IA voient leurs coûts variables exploser avec l'usage). C'est un signal de qualité business majeur pour Liciel/Enersweet au moment du rachat.

---

## 4. COST CEILING PAR TIER

Garde-fous économiques : si le coût IA d'un utilisateur dépasse ces seuils, alerte automatique pour investigation.

| Tier | Prix mensuel | Cost IA ceiling absolu | % revenue |
|---|---|---|---|
| Solo 29€ | 29€ | 5€/mo (17%) | Au-delà = investigation |
| Pro 79€ | 79€ | 12€/mo (15%) | Au-delà = investigation |
| Cabinet 199€ | 199€ | 28€/mo (14%) | Au-delà = investigation |
| Cabinet+ 499€ | 499€ | 65€/mo (13%) | Au-delà = investigation |

Si un utilisateur dépasse régulièrement son ceiling :
1. Analyser son usage patterns
2. Identifier si une feature est mal cachée ou mal cascadée
3. Ajuster le routing modèle pour son cas
4. Ou facturer un overage exceptionnel via Stripe (cas extrême)

---

## 5. IMPLÉMENTATION PAR AGENT

Récap synthétique : quelle technique implémente quel agent.

| Agent | Techniques principales | Techniques secondaires |
|---|---|---|
| Agent 3 (sales page + features client) | 6, 7 | 1, 8, 9 |
| Agent 8 (data pipeline) | 2, 4 | — |
| Agent 9 (algorithmes 13) | 1, 3, 5, 10, 11, 12, 14, 15 | 8, 9, 13 |

Aucune feature IA ne doit être commitée sans appliquer au minimum les techniques 1, 3, 8, 9, et 14 (les 5 obligatoires).

---

## 6. MONITORING & ALERTING

### 6.1 Schema analytics

```sql
-- analytics.ai_cost_metrics
CREATE TABLE analytics.ai_cost_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  mission_id UUID REFERENCES missions(id),
  feature_name TEXT NOT NULL,
  model_used TEXT NOT NULL,
  input_tokens INT,
  output_tokens INT,
  cached_input_tokens INT,
  cost_usd NUMERIC(10, 6),
  cost_eur NUMERIC(10, 6),
  cascading_pass INT, -- 1 = Haiku, 2 = escalation Sonnet
  cache_hit BOOLEAN,
  batch_processed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_cost_user_date ON analytics.ai_cost_metrics(user_id, created_at);
CREATE INDEX idx_ai_cost_feature ON analytics.ai_cost_metrics(feature_name, created_at);
```

### 6.2 Vues matérialisées clés

```sql
-- analytics.ai_cost_per_user_monthly
CREATE MATERIALIZED VIEW analytics.ai_cost_per_user_monthly AS
SELECT
  user_id,
  date_trunc('month', created_at) AS month,
  SUM(cost_eur) AS total_cost_eur,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE cache_hit) AS cache_hits,
  AVG(CASE WHEN cascading_pass = 1 THEN 1 ELSE 0 END) AS haiku_resolution_rate
FROM analytics.ai_cost_metrics
GROUP BY user_id, date_trunc('month', created_at);

-- Refresh hebdo
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.ai_cost_per_user_monthly;
```

### 6.3 Dashboard `/admin/sante-tech` section AI

Sections obligatoires :

1. **Cost vs Revenue per tier** : graphique stacked area sur 90 jours
2. **Haiku resolution rate** : % d'analyses résolues sans escalation Sonnet (cible >70%)
3. **Cache hit rate** : par feature et par utilisateur (cible >60% sur features cachables)
4. **Cost ceiling violations** : utilisateurs au-delà du seuil ceiling (intervention)
5. **Cost per mission evolution** : courbe M1 → M24 par cohorte (validation de la trajectoire)

### 6.4 Alertes Telegram (bot read-only)

Seuils critiques avec alerte Telegram automatique :

```typescript
// supabase/functions/data-quality-monitor/ai-cost-alerts.ts
const ALERT_THRESHOLDS = {
  user_monthly_cost_above_ceiling: { tier: 'Solo', threshold_eur: 5 },
  haiku_resolution_rate_drop: { threshold_pct: 60 }, // si tombe sous 60%
  cache_hit_rate_drop: { threshold_pct: 50 },
  total_platform_cost_spike: { multiplier: 1.5 }, // 1,5× la moyenne 7j
  opus_usage_unexpected: { threshold_pct: 5 } // Opus ne devrait JAMAIS dépasser 5% des appels
};
```

---

## 7. RÈGLES DE GARDE-FOU

### 7.1 Règles obligatoires (jamais déroger)

1. Aucun appel IA en production sans `max_tokens` explicite.
2. Aucun system prompt >2k tokens sans `cache_control: ephemeral`.
3. Aucune feature batchable (>24h délai acceptable) en synchrone.
4. Aucun appel direct à Opus 4.7 sans approbation explicite (dans `MODEL_BY_FEATURE`).
5. Aucun appel sans tracking dans `analytics.ai_cost_metrics`.
6. Vision IA toujours précédée d'un check du cache `equipment_brands_models`.
7. Property profile toujours via `getPropertyProfile()` (jamais en raw).
8. Analyses utilisateur >M3 doivent passer par `processWithKnowledgeGraph()`.

### 7.2 Code review checklist IA

Avant tout merge d'une feature avec appels Claude API :

- [ ] `max_tokens` explicite et calibré
- [ ] `cache_control` sur le system prompt si réutilisable
- [ ] Choix de modèle justifié (Haiku/Sonnet/Opus) dans le code review
- [ ] Cascading implémenté si pertinent
- [ ] Output JSON Schema avec Zod
- [ ] Logging dans `analytics.ai_cost_metrics`
- [ ] Cost ceiling vérifié pour le tier cible
- [ ] Test E2E couvrant le cas batch + le cas temps réel

### 7.3 KPI mensuels à suivre

| KPI | Cible | Seuil alerte |
|---|---|---|
| Coût IA / mission moyen (platform) | < 0,03€ M6+ | > 0,05€ |
| Haiku resolution rate | > 70% | < 60% |
| Cache hit rate global | > 60% | < 50% |
| Marge brute tier 29€ moyenne | > 80% | < 75% |
| Ratio Opus / total calls | < 3% | > 5% |
| Users dépassant ceiling | < 5% | > 10% |

Toute déviation déclenche investigation immédiate.

---

## CONCLUSION

Les 15 techniques d'optimisation tokens ne sont pas optionnelles. Elles sont la condition pour atteindre 80-95% de marge brute sur tous les tiers, en cold start ET en steady state. Sans elles, KOVAS devient mécaniquement déficitaire au-delà d'un certain volume utilisateurs.

Implémentation correcte = 90% de marge soutenable et croissante avec le temps utilisateur. C'est l'argument économique n°1 face à Liciel/Enersweet au moment du rachat.

Au boulot.

---

**Fin du document — version 1.0 — 25 mai 2026**
