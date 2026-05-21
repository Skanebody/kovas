# Cockpit ADEME — Architecture (Module 1)

> Module **anti-surveillance ADEME** (1 sur 9 d'une refonte majeure).
> Authority : ce document + migrations `20260525100000-104000`.
> Status V1 : daily sync + prevalidate live, UI dans une vague séparée.

---

## 1. Vue d'ensemble

Deux modes de fonctionnement :

| Mode | Trigger | Output |
|---|---|---|
| **Sync quotidienne** | Cron `0 2 * * *` UTC (pg_cron → Edge Function) | KPI snapshot par user dans `ademe_kpi_snapshots` + cache local `ademe_dpe_cache` + alertes `ademe_alerts` |
| **Pré-validation** | POST `/ademe-prevalidate` depuis l'UI mission (au save, au pre-export, manuel) | `RiskAssessment` JSON + ligne audit `ademe_prevalidations` |

Le moteur de risk calculator est **identique** dans les deux modes : il consomme `ademe_coherence_rules` (règles JSONB exécutables) + le dernier snapshot KPI + le dernier DPE local (cache).

---

## 2. Flow daily sync

```
┌──────────────────┐
│ pg_cron 02:00 UTC│ ──── HTTP POST /functions/v1/ademe-daily-sync
└──────────────────┘            │  Authorization: Bearer SERVICE_ROLE
                                ▼
┌─────────────────────────────────────────────────────────────┐
│  supabase/functions/ademe-daily-sync/index.ts (Deno)        │
│                                                             │
│  1. SELECT profiles WHERE default_org_id IS NOT NULL        │
│  2. POUR CHAQUE profile :                                   │
│     a. Lit certificat = profile.linguistic_profile          │
│                                  .certificat_rge            │
│     b. SI absent → skip (TODO Phase 2 : fallback fuzzy)     │
│     c. fetchAllDpeByCertificat(cert)                        │
│        ↳ data.ademe.fr datasets/dpe-v2-logements-existants  │
│        ↳ rate limit 8 req/s + retry exponentiel 429/5xx     │
│        ↳ pagination `after` data-fair                       │
│     d. UPSERT batch 500 → ademe_dpe_cache                   │
│     e. INSERT row → ademe_kpi_snapshots (UNIQUE org+date)   │
│     f. emitVolumeAlerts() → ademe_alerts                    │
│  3. Retourne metrics agrégés (JSON)                         │
│                                                             │
│  Garde-fou : erreur par user → log + continue, jamais fail  │
│  global.                                                    │
└─────────────────────────────────────────────────────────────┘
```

**Ordonnancement** : traitement **séquentiel** user par user pour respecter le rate limit ADEME global (8 req/s partagé). Un parallélisme aurait causé des 429 systématiques. Volume estimé à 1000 users : ~2 minutes (1 req/user en moyenne, 80-150 DPE/an chacun = 1 page de 10 000).

---

## 3. Schema risk calculator

Architecture en **5 axes scorés indépendamment** puis agrégés par pondération :

| Axe | Source données | Poids global | Sortie |
|---|---|---|---|
| **Volume** | `ademe_kpi_snapshots.metadata.{dpe_count_12m, dpe_count_today}` | **30%** | Score 0/50/100 selon seuils |
| **Distance** | Haversine entre `data.lat/lng` saisi et dernier `ademe_dpe_cache.lat/lng` | **20%** | Score 0/50/100 |
| **Coherence** | Itère `ademe_coherence_rules.rule_logic` (JSONB) via `evaluateRule()` | **30%** | Score 0-100 (60 pts/erreur + 20 pts/warning) |
| **Statistical** | Ratio F+G saisi vs national médiane (27%) + frontière E/F (320 kWh/m²/an) + bâti ancien étiquette A/B | **20%** | Score 0/35/60/100 |
| **History** (bonus) | Agrégat utilisateur 12 mois : ratio F/G historique + surface moyenne | **0% (V1)** | Diagnostic seulement |

```
RiskAssessment = {
  verdict: 'green' | 'yellow' | 'red',   // 0-39 / 40-69 / 70-100
  global_score: 0..100,
  axis_scores: { volume, distance, coherence, statistical, history },
  warnings: RiskWarning[],
  axis_details: { ... },
  computed_at: ISO timestamp
}
```

### Format `rule_logic` (JSONB)

```json
{
  "operator": "AND",
  "conditions": [
    { "field": "type_chauffage", "op": "eq", "value": "PAC air/air" },
    { "field": "type_climatisation", "op": "is_null" }
  ]
}
```

Opérateurs supportés : `eq`, `neq`/`ne`, `gt`, `gte`, `lt`, `lte`, `is_null`, `is_not_null`, `in`, `matches` (regex), `between`. Évaluateur pur TS sans dépendance, dot-notation case-insensitive sur les champs (compatibilité avec `Type_climatisation` ADEME et `type_climatisation` form).

---

## 4. Limites V1 et TODOs

### Matching diagnostiqueur

**V1** : filtre exact sur `NUM_CERTIFICAT_RGE` (champ data-fair stable). Le certificat est stocké dans `profiles.linguistic_profile.certificat_rge` (JSONB libre, en attendant une migration `ALTER TABLE profiles ADD COLUMN certificat_rge text` Phase 2).

**Limite** : si l'utilisateur n'a **pas** renseigné son RGE → on saute le sync (log `error: 'no_certificat_rge'`). Cas réaliste : diagnostiqueurs débutants en cours de certification.

**Fallback documenté (TODO Phase 2)** : query par `NOM_DIAGNOSTIQUEUR` (full-text `q=`) puis filtrage Levenshtein ≤ 3 côté client. Implémentation existe déjà dans `apps/web/src/lib/ademe/ademe-api.ts::fetchDpeByNameFuzzy` mais **n'est pas câblée dans le daily sync** — l'UI devra afficher un disclaimer "résultats non garantis — homonymes possibles" avant activation.

### Coût API ADEME

- **Gratuit**, sans clé API, open data.
- Soft rate limit observé empiriquement : **~10 req/s**. On cap à 8 pour garder une marge sur 429.
- Volume cible : 1000 users × 1 req/user/jour = 1000 req/jour ≈ **0,01 req/s en moyenne**. Marge énorme.

### Seuils proposés (à valider)

| Seuil | Valeur V1 | Source | TODO |
|---|---|---|---|
| Volume critique annuel | 950 DPE/an | Observation Liciel + presse spécialisée | Valider avec l'advisor diag (Sprint 14j J3) |
| Volume warning annuel | 800 DPE/an | idem | idem |
| Volume warning journalier | 6 DPE/jour | Hypothèse interne | idem |
| Distance critique | 40 km du dernier DPE | Hypothèse métier (mobilité géographique typique) | idem |
| Distance warning | 25 km | idem | idem |
| Ratio F/G national | 27% | ADEME open data 2023 (logements existants) | Re-vérifier annuellement |
| Tolérance ratio F/G | ±15 pts | Heuristique | À ajuster post-bêta |

**Aucune source officielle ADEME publique** ne documente les seuils déclencheurs de contrôle. Les valeurs ci-dessus sont des **hypothèses de défense**, à raffiner après 3-6 mois de production et retours bêta-testeurs.

---

## 5. Fichiers créés

### Edge Functions (Deno)

- `supabase/functions/ademe-daily-sync/index.ts` — cron daily 02:00 UTC, sync API ADEME + snapshots + alertes
- `supabase/functions/ademe-prevalidate/index.ts` — POST endpoint pré-validation, retourne `RiskAssessment` + persiste `ademe_prevalidations`

### Helpers TypeScript (Node / Edge runtime Next.js)

- `apps/web/src/lib/ademe/haversine.ts` — distance géodésique 2 points
- `apps/web/src/lib/ademe/ademe-api.ts` — wrapper API ADEME (rate limiter, LRU cache 1h, retry exponentiel, fallback fuzzy Levenshtein)
- `apps/web/src/lib/ademe/rule-evaluator.ts` — évaluateur JSONB générique (12 opérateurs)
- `apps/web/src/lib/ademe/risk-calculator.ts` — orchestrateur 5 axes (volume/distance/coherence/statistical/history) + `RiskContextLoader` (DI pour tests)
- `apps/web/src/lib/ademe/snapshot-calculator.ts` — calcul `ademe_kpi_snapshots` complet (distribution + volumes + ratios + score)

### Duplication code Edge / Node

La logique métier (risk-calculator + rule-evaluator) est **dupliquée inline** dans l'Edge Function `ademe-prevalidate`. Deno Edge Runtime n'a pas accès au monorepo Node (pattern identique à `regulatory-watcher`). La version Node reste la **source de vérité** — toute évolution doit être propagée manuellement.

**TODO V2** : publier `packages/ademe-shared` sur npm + import via esm.sh (déduplique).

---

## 6. Tests à prévoir (sprint suivant)

- [ ] Mock API ADEME (record/replay quelques JSON réels)
- [ ] Unit tests `rule-evaluator` (12 opérateurs × edge cases null/undefined)
- [ ] Unit tests `haversine` (Paris-Marseille = ~660 km, Paris-Paris = 0)
- [ ] Unit tests `snapshot-calculator` avec fixtures synthétiques
- [ ] Integration test `ademe-prevalidate` (mock supabase via DI)
- [ ] E2E daily-sync sur 1 user de test avec RGE fixture
