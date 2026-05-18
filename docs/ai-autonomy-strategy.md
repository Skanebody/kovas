# KOVAS — Stratégie d'autonomisation IA progressive sur 36 mois

**Date** : 2026-05-18
**Statut** : Authority document stratégie infrastructure IA long terme
**Référencé par** : [`CLAUDE.md`](../CLAUDE.md), PRD §21, [`economics.md`](../.claude/orchestration-kovas-app/economics.md), [`features-roadmap.md`](../.claude/orchestration-kovas-app/features-roadmap.md)

---

## 1. Objectif stratégique

Réduire progressivement la dépendance aux APIs IA externes (Anthropic Claude, OpenAI Whisper) sur 36 mois, **sans jamais sacrifier la qualité du produit**.

**Cible chiffrée** :
- Passer d'une marge brute **77% (M12) à 85%+ (M36)**
- Construire un **moat technologique** grâce aux données métier accumulées

**Principe directeur** :
> *"L'indépendance 100% des IA externes est un mythe et un mauvais objectif. Le bon objectif est de remplacer 60-80% des appels IA par du compute propre, tout en gardant Claude pour les 20-40% de cas complexes où la qualité est critique."*

---

## 2. Les 4 familles d'algorithmes KOVAS

### Famille 1 — Transcription vocale (Whisper actuellement)

| Caractéristique | Valeur |
|---|---|
| Potentiel d'autonomie | **ÉLEVÉ** |
| Modèles open source matures | Whisper-large-v3, Faster-Whisper, Distil-Whisper |
| Spécialisés français | Disponibles et performants |
| Compute cost self-hosting | ~0,001€/min vs 0,006€/min API |
| **Quand basculer** | **M18+ avec 500+ utilisateurs** |

### Famille 2 — Génération de texte structuré (Claude actuellement)

| Caractéristique | Valeur |
|---|---|
| Potentiel d'autonomie | **MOYEN** |
| Open source disponibles | Llama 3.3 70B, Mistral Large, Qwen 2.5 72B |
| Qualité vs Claude Sonnet 4.6 | **15-25% inférieure** sur français spécialisé |
| Compute cost | Important (GPU H100) |
| Fine-tuning sur corpus métier | Améliore drastiquement |
| **Quand basculer** | **M24+ après 50 000+ missions de données** |

### Famille 3 — Vision IA (Claude Vision, retiré du MVP, réintégré V2)

| Caractéristique | Valeur |
|---|---|
| Potentiel d'autonomie | **ÉLEVÉ** pour cas spécialisés |
| YOLO v8/v9 fine-tuné | Surpasse Claude Vision sur cas spécifiques (30 marques chaudières FR) |
| Modèles compacts | 5-50 MB, tournent on-device (CoreML iPad) |
| Précision avec dataset | Augmente mécaniquement (boucle vertueuse) |
| **Quand basculer** | **M12+ lors réintégration Vision IA (V2)** |

### Famille 4 — Génération PDFs / mises en page / templates

| Caractéristique | Valeur |
|---|---|
| Potentiel d'autonomie | **TOTAL** |
| Bibliothèques classiques | `react-pdf`, `puppeteer`, `pdf-lib` |
| Templates Word `.docx` | `docx.js` (gratuit) |
| **Quand basculer** | **DÈS MVP V0 — ne JAMAIS payer une IA pour générer un PDF** |

---

## 3. Plan progressif sur 36 mois

### Phase 1 (M0-M12) — DÉPENDANCE TOTALE AUX APIs IA

**Stratégie** : utiliser 100% les APIs externes (Claude Sonnet 4.6 + Whisper `gpt-4o-mini-transcribe`).

**Justification** : pas de temps ni de données pour faire mieux. Anthropic investit 5-10 milliards/an en R&D, on ne rattrape pas. On paie pour la qualité.

**Coût IA estimé à 500 utilisateurs M12** :

| Poste | Coût mensuel |
|---|---|
| Whisper API | ~1 500€ |
| Claude API | ~3 000€ |
| **Total** | **~4 500€/mois (54k€/an)** |

**Marge brute Phase 1** : 77%. Soutenable.

**Action** : zéro internalisation. Focus produit et traction.

---

### Phase 2 (M12-M18) — HYBRIDATION ET OPTIMISATIONS

**Stratégie** : continuer Claude/Whisper mais optimiser drastiquement via 5 leviers.

#### Levier 1 — Cache vectoriel des analyses Vision IA

- Embedding de chaque photo entrante via `voyage-3-large`
- Comparaison cosine similarity avec base d'embeddings existante
- Si match > 95%, réponse servie depuis cache (pas d'appel API)
- **Économie : 30-50% sur Claude Vision**

#### Levier 2 — Prompt caching Anthropic

- Anthropic offre 90% de réduction sur tokens input répétés (cache read = 10% du prix input)
- System prompt (3 000-5 000 tokens) facturé une fois pour 1h TTL
- **Économie : 30-40% sur Claude**

#### Levier 3 — Modèle hybride Sonnet/Haiku

- **Sonnet 4.6** pour qualité critique : Vision IA équipements, génération recos détaillées, synthèses missions
- **Haiku 4.5** pour tâches simples : structuration voice transcript, extraction de champ, chatbot routine
- **Économie : 30-40% sur Claude**

#### Levier 4 — Batch API pour asynchrone

- Recos post-DPE F/G non temps-réel via Batch API d'Anthropic (50% réduction)
- Traitement nuit ou batch d'1h
- **Économie : 40-50% sur ce type de tâche**

#### Levier 5 — Test Deepgram Nova-3 vs Whisper

- Deepgram propose ~35% réduction prix vs Whisper OpenAI
- Performance équivalente en français selon benchmarks 2025-2026
- EU-hosted (Frankfurt) — bonus RGPD vs OpenAI US
- Switch transparent si validé en A/B test
- **Économie : 35% sur transcription**

#### Bilan Phase 2

**Coût IA optimisé à 800 utilisateurs M18** :

| Poste | Coût optimisé | Vs non-optimisé |
|---|---|---|
| Whisper/Deepgram | ~1 500€/mois | vs 2 400€ |
| Claude (cache + caching + hybride + batch) | ~2 800€/mois | vs 4 800€ |
| **Total** | **~4 300€/mois (52k€/an)** | vs 7 200€ |

**Économie globale** : **35-40%** sur facture IA.
**Investissement** : 0€ (juste config et dev en interne).

---

### Phase 3 (M18-M24) — SELF-HOSTING PARTIEL CIBLÉ

**Stratégie** : internaliser ce qui rapporte le plus avec le moins de risque.

#### Étape 1 — Whisper self-hosted (M18-M20)

Déploiement **Whisper-large-v3** (ou Distil-Whisper pour latence) sur infrastructure propre.

**Options hardware** :

| Option | Coût mensuel | Avantages | Inconvénients |
|---|---|---|---|
| **GPU cloud** (Vast.ai, RunPod, Lambda Labs) — A100 0,80-1,20€/h | ~1 200€ | Scalable, pas d'invest hardware | Latence pic |
| **Achat hardware** RTX 4090 (1 800€ one-shot) | ~50€ (amortissement) | Latence très basse, ROI 3 mois | Pas scalable |
| **Achat H100** (30 000€) | Amortissement long | Production scale | Investissement lourd |

**À 1 200 utilisateurs M20** :
- Whisper API coûterait **3 600€/mois**
- Self-hosted GPU cloud (4 A100 en pic) : **1 200€/mois**
- **Économie : 2 400€/mois = 29 000€/an**

#### Étape 2 — Vision IA custom (M20-M22)

Lors de la réintégration Vision IA (V2 M12-M18), fine-tuning **YOLO v9** sur dataset spécifique :

- **50 000+ photos d'équipements** accumulées depuis lancement
- Fine-tuning sur **30 marques chaudières françaises**
- Modèle compact (**50 MB**) déployé **on-device via CoreML** iPad
- Coût marginal après entraînement : **0€/photo**

**À 1 500 utilisateurs M22** :
- Claude Vision API coûterait **1 350€/mois**
- Custom YOLO on-device : **0€/mois marginal**
- **Économie : 1 350€/mois = 16 200€/an**

**Bonus UX** : latence passe de **2-3s/photo** (Claude Vision API) à **200-500ms** (on-device). UX **10x meilleure**.

#### Bilan Phase 3

**Investissement** : 20-30k€ (GPU + dataset cleaning + dev pipeline + monitoring).
**Économies cumulées** : ~45k€/an récurrent à M22.

---

### Phase 4 (M24-M36) — MODÈLE LINGUISTIQUE FRANÇAIS PROPRIÉTAIRE

**Stratégie** : la plus ambitieuse, la plus risquée, la plus défensive long terme.

#### Concept

Fine-tuner un modèle open source (**Llama 3.3 70B** ou **Mistral Large**) sur corpus métier diagnostiqueur :
- **100 000+ missions** accumulées comme données d'entraînement
- Vocabulaire métier maîtrisé (DPE, isolation, ITE, ventilation, PAC, VMC, etc.)
- Cas d'usage spécifiques diagnostic immobilier français

#### Avantages

- **Coût marginal très faible** (~0,001€/requête vs 0,02€ Claude)
- Performance potentiellement **supérieure à Claude** sur vertical spécifique (Vertical Domain Expertise)
- **Indépendance stratégique** Anthropic
- **Moat technologique** (concurrent ne peut pas répliquer sans accès aux données)

#### Inconvénients

- Coût d'investissement initial : **30-80k€**
- Risque qualité dégradée si mal exécuté (20-30% en deçà sans fine-tune métier)
- Maintenance permanente
- Gestion latence et fiabilité

#### Conditions de déclenchement

Tous ces critères doivent être réunis :
- ✅ **1 500+ utilisateurs payants**
- ✅ **ARR 1,5 M€+**
- ✅ Ressources pour ingénieur ML (freelance ou temporaire)
- ✅ **50 000+ missions nettoyées et structurées**
- ✅ Acceptation **3-6 mois R&D** avant ROI

#### Bilan Phase 4

**Économie potentielle M36** : 50-70k€/an facture Claude + indépendance stratégique + moat tech.
**Investissement Phase 4** : 40-80k€.

---

### Phase 5 (M36+) — MAINTENANCE ET R&D CONTINUE

**Stratégie** : 80/20 entre algos propres et Claude.

| Type | Algos propres | Claude |
|---|---|---|
| 80% des cas usuels | ✅ Rapide, gratuit, fiable | - |
| 20% des cas complexes | - | ✅ Qualité maximale, edge cases, raisonnement avancé |

**Marge brute cible** : **85%+ stable**.

---

## 4. Tableau récapitulatif — Évolution coûts IA sur 36 mois

| Période | Stratégie | Coût IA (à 2 000 users) | Économie vs Phase 1 |
|---|---|---|---|
| M0-M12 | Dépendance totale Claude + Whisper | 6 000-8 000€/mois | – |
| M12-M18 | Optimisations Anthropic | 4 000-5 000€/mois | **-30%** |
| M18-M24 | Whisper self-hosted + Vision custom | 2 500-3 500€/mois | **-55%** |
| M24-M36 | Modèle français propriétaire (80% des cas) | 1 000-1 500€/mois | **-80%** |
| M36+ | Stable, R&D continue | 1 000-2 000€/mois | **-80%** |

### Investissements cumulés

| Phase | Période | Investissement |
|---|---|---|
| Phase 2 | M12-M18 | ~0€ (config + dev en interne) |
| Phase 3 | M18-M24 | 20-30k€ (GPU + dataset + dev pipeline) |
| Phase 4 | M24-M36 | 40-80k€ (ingénieur ML + compute + cleaning) |
| **Total 36 mois** | | **60-110k€** |

### ROI cumulé sur 36 mois

| Poste | Valeur |
|---|---|
| Économies IA à M36 | **150-200k€/an** récurrent |
| Moat technologique | Valorisation revente **+20-40%** |
| Indépendance stratégique | Élimine risque Anthropic |
| Performance UX | Latence **10x meilleure** sur Vision IA |

---

## 5. Auto-apprentissage perpétuel — ce qui est possible

### Auto-apprentissage 1 — Amélioration Vision IA via corrections utilisateurs

**Mécanisme** :
- Utilisateur corrige reconnaissance IA ("Cette chaudière n'est pas Saunier Duval, c'est De Dietrich")
- Correction enregistrée comme **donnée d'entraînement étiquetée** (`feedback_corrections` table Supabase)
- Re-fine-tuning du modèle YOLO tous les 3-6 mois
- Modèle s'améliore mécaniquement avec l'usage

**Coûts** :
- Collecte corrections : 0€
- Re-training session : **200-500€** (3-4h GPU)

**Boucle vertueuse** :

```
Plus d'utilisateurs
   ↓
Plus de corrections
   ↓
Meilleur modèle
   ↓
Différenciation produit
   ↓
Plus d'utilisateurs
```

### Auto-apprentissage 2 — Personnalisation par utilisateur

Maintien d'un **profil linguistique par utilisateur** :
- Termes techniques fréquents (ex : "cabinet de toilette" vs "WC")
- Corrections récurrentes
- Préférences de structuration

**Application** :
- Transcription Whisper et structuration Claude s'adaptent progressivement (via prompt cache personnalisé)
- Précision personnalisée croissante avec l'usage

**Coût** : stockage minimal Supabase. **0€ marginal.**

### Auto-apprentissage 3 — Détection de patterns métier

Avec **100 000+ missions**, détection de patterns :
- "Chaudières De Dietrich des années 90 : 80% encore en service, 60% classées F/G"
- "Biens à Marseille : 3x plus de cas amiante que Lyon"
- "Missions de janvier-février : temps moyens 20% plus longs"

**Applications** :
- Suggérer contrôles supplémentaires ("Attention, cette chaudière est probablement classée F")
- Pré-remplir champs avec valeurs probables (pré-fill predictif)
- Alerter sur anomalies potentielles (cohérence DPE)

**Coût** : ML léger sur DB Supabase via pgvector + scripts batch. **Quasi 0€.**

---

## 6. Mythes à dégonfler

### Mythe 1 — "Le SaaS devient 100% indépendant des IA externes"

**Faux.** Anthropic investit 5-10 milliards/an en R&D. On ne rattrape pas.

**Vérité** : on remplace **60-80%** des appels IA par compute propre. Les **20-40%** restants (cas complexes, raisonnement avancé) continuent Claude. Et c'est OK.

### Mythe 2 — "Le SaaS s'améliore tout seul sans intervention humaine"

**Faux.** Les boucles d'auto-apprentissage nécessitent :
- Pipeline de collecte (5-10 jours dev)
- Pipeline d'entraînement automatique (10-15 jours dev)
- Monitoring qualité (5-7 jours dev)
- **Validation humaine périodique** (2-4h/mois)

**Total** : ~30 jours dev + maintenance permanente.

### Mythe 3 — "L'auto-apprentissage rend le produit gratuit à servir"

**Faux.** Même avec self-hosting, on paie :
- GPU compute (cloud ou hardware)
- Stockage modèles et datasets
- Ingénieur ML pour maintenance
- Coûts réentraînement périodiques

À 2 000 utilisateurs, **coût IA self-hosted bien fait = 30-50% du coût Claude API, pas 0%.**

---

## 7. Les 3 pièges à éviter absolument

### Piège 1 — La "souveraineté technologique prématurée"

Beaucoup de fondateurs veulent internaliser dès le mois 1 par fierté ou peur.

**Conséquences** :
- Distraction du produit
- Qualité inférieure 6-12 mois
- Churn massif
- R&D > économies API pendant 18 mois

**Règle d'or** : **n'internaliser que quand 1 000+ utilisateurs payants ET 500 000+ requêtes accumulées.**

### Piège 2 — Sous-estimation du coût de maintenance

Self-hoster Whisper ne coûte pas que le GPU :
- Monitoring performance (latence, qualité)
- Gestion des pannes (GPU crash, certificats)
- Mises à jour modèles (Whisper v4, etc.)
- Scalabilité (pics matin)

**Coût caché** : 5-10h/semaine = 2 000-4 000€/mois en coût opportunité.

**Règle** : **ne self-hoster que si économie API > coût maintenance × 2.**

### Piège 3 — Qualité non garantie

Llama 3.3 70B est gratuit, mais **20-30% moins bon que Claude Sonnet 4.6** sur cas complexes français.

Migration prématurée = erreurs IA, plaintes, churn, réputation dégradée.

**Règle** : **toute migration passe par 3 mois d'A/B test rigoureux avec mesure satisfaction utilisateur.**

---

## 8. Pipeline auto-apprentissage Vision IA (détaillé)

### Architecture

```
Photo capturée (mobile)
   ↓
Vision IA (Claude V2 OU YOLO Phase 3)
   ↓
Résultat affiché + UX correction inline
   ↓
[Utilisateur corrige si erreur]
   ↓
Enregistrement table `vision_corrections`
   ↓
[Toutes les 12 semaines]
   ↓
Pipeline re-training automatique :
1. Dédup + validation qualité corrections
2. Train YOLO v9 sur dataset cumulé
3. A/B test 5% trafic (nouveau modèle vs ancien)
4. Si précision++ : déploiement progressif 5% → 25% → 100%
5. Si précision-- : rollback automatique
```

### Schéma data

```sql
CREATE TABLE vision_corrections (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id uuid NOT NULL,
  user_id         uuid NOT NULL,
  mission_id      uuid NOT NULL,
  photo_id        uuid NOT NULL,
  -- IA initial output
  ai_provider     text NOT NULL,
  ai_model        text NOT NULL,
  ai_brand        text,
  ai_model_eq     text,
  ai_confidence   numeric(4,3),
  -- Correction utilisateur
  user_brand      text,
  user_model_eq   text,
  user_notes      text,
  -- Métadonnées
  corrected_at    timestamptz NOT NULL DEFAULT now(),
  used_in_training boolean DEFAULT false,
  training_session_id uuid
);
CREATE INDEX idx_vision_corrections_pending ON vision_corrections (corrected_at)
  WHERE used_in_training = false;
```

### Cadence

| Trigger | Action |
|---|---|
| Toutes les **12 semaines** | Re-training automatique YOLO v9 |
| Si **>500 corrections accumulées** | Re-training anticipé déclenchable |
| **Validation humaine** sur 50 cas random pré-déploiement | 2-4h fondateur |

---

## 9. Pipeline personnalisation utilisateur (détaillé)

### Architecture

Maintien d'un objet `user_linguistic_profile` JSONB en base, mis à jour à chaque utilisation :

```json
{
  "user_id": "uuid",
  "frequent_terms": {
    "cabinet de toilette": 47,
    "WC": 12,
    "salle d'eau": 23
  },
  "preferred_vocabulary": {
    "chaudière": "chaudière à condensation",
    "isolation": "ITE polyuréthane"
  },
  "recurring_corrections": [
    {"from": "ITE", "to": "ITI", "count": 8}
  ],
  "structuration_preferences": {
    "default_room_order": ["entrée", "salon", "cuisine", "chambres", "SDB", "WC", "extérieur"]
  },
  "updated_at": "2026-05-18T14:00:00Z"
}
```

### Application

- Profile injecté dans le prompt Claude (préfixe cached 1h)
- Whisper appelé avec `prompt` paramètre contenant top-20 termes fréquents user
- iOS `SFSpeechRecognizer` reçoit profile en `contextualStrings`

### Coût

- Stockage : <100 KB/user → ~1€/an pour 10 000 users
- Lecture/écriture : transparent dans flux normal

**Bénéfice marginal** : précision personnalisée +2-4% à mesure que le profil se stabilise (3-6 mois d'usage).

---

## 10. Pipeline détection patterns métier (détaillé)

### Architecture

Job batch nocturne hebdomadaire scannant la base `missions` + `equipment_findings` :

```sql
-- Exemple : détection corrélations marque/époque/DPE
WITH chaudiere_dpe_corr AS (
  SELECT
    ef.brand,
    EXTRACT(decade FROM TO_DATE(ef.year_install::text, 'YYYY')) AS decade,
    m.dpe_letter,
    COUNT(*) AS n_missions
  FROM equipment_findings ef
  JOIN missions m ON m.id = ef.mission_id
  WHERE ef.kind = 'chaudiere'
    AND m.completed_at > now() - interval '24 months'
  GROUP BY ef.brand, decade, m.dpe_letter
)
SELECT * FROM chaudiere_dpe_corr
WHERE n_missions > 50;
```

### Applications produit

- **Suggestion contextuelle** lors de la saisie : "Cette marque + décennie + zone → DPE probable F/G dans 78% des cas similaires"
- **Pré-remplissage prédictif** des champs DPE
- **Alerte anomalies** : "Données saisies incohérentes avec patterns observés (chaudière A 2018 + DPE F = unusual)"

### Coût

- Compute batch : ~1h/semaine sur Supabase Pro (inclus)
- Stockage patterns calculés : <50 MB
- **Total** : ~5€/mois à 1000 users

---

## 11. Recommandation stratégique finale

### Phase 1-2 (M0-M18)

**Ne pas se préoccuper du self-hosting.** Focus sur :
1. Atteindre traction (1 000+ utilisateurs payants)
2. Optimiser marge brute via optimisations Anthropic (cache, hybride, batch)
3. Collecter données massivement pour préparer Phase 3-4

### Phase 3 (M18-M24)

**Commencer self-hosting Whisper.** Projet le plus simple, rentable, moins risqué. **ROI 12 mois.**

### Phase 4+ (M24+)

**Envisager modèle français propriétaire SI conditions remplies** :
- 1 500+ utilisateurs payants
- Ressources ingénieur ML (freelance/temporaire)
- 50 000+ missions nettoyées
- Acceptation 3-6 mois R&D avant ROI

### Objectif M36

- ✅ **Marge brute 85%+** (vs 77% M12)
- ✅ Économies IA **150-200k€/an**
- ✅ Boucle d'amélioration continue créant **moat avec concurrents**
- ✅ **Optionalité revente supérieure** (valorisation +20-40% grâce au moat tech)

---

## 12. Conditions de déclenchement par phase (récap)

| Transition | Conditions cumulatives |
|---|---|
| **Phase 1 → 2** (M12) | Lancement public effectif, ≥ 100 abonnés payants |
| **Phase 2 → 3** (M18-M20) | Optimisations Phase 2 déployées, ≥ 500 abonnés payants, 500 000+ requêtes API cumulées |
| **Phase 3 → 4** (M24+) | 1 500+ abonnés payants, ARR 1,5 M€+, 50 000+ missions nettoyées, ressources ingénieur ML, validation A/B 3 mois |

---

## 13. Métriques à instrumenter dans PostHog dès J0

### Coûts API

- `ai.claude.cost_eur` par mission (event par appel API)
- `ai.whisper.cost_eur` par minute audio
- `ai.cache_hit_rate` (% appels servis depuis prompt cache)
- `ai.fallback_provider_used` (Anthropic, OpenAI, Deepgram, Gemini, Mistral)

### Qualité

- `vision.user_correction_rate` (% photos corrigées par utilisateur)
- `voice.user_correction_rate` (% transcripts modifiés)
- `chat.escalation_to_human_rate`

### Performance

- `ai.{operation}.latency_p95_ms`
- `ai.{operation}.error_rate`
- `ai.{operation}.timeout_rate`

Ces métriques sont **essentielles dès Phase 1** pour piloter les transitions Phase 2-3-4 en data-driven.

---

## 14. Risques & mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Llama 3.3 70B fine-tuné qualité < Claude sur jargon | HIGH | Critical | A/B test 3 mois + rollback automatique si churn ↑ ou NPS ↓ |
| GPU cloud (Vast/RunPod) outage | MEDIUM | High | Fallback Anthropic configuré + provider secondaire (Lambda Labs) |
| Coût compute GPU augmente +50% | LOW | Medium | Renégociation contrats annuels, achat hardware H100 alternatif |
| Ingénieur ML quitte pendant Phase 4 | MEDIUM | High | Documentation pipeline + contrats freelance fragmentés |
| Données de training non-conformes RGPD | LOW (si pipeline propre) | Critical | Anonymisation systématique à l'ingestion, DPO consultation |
| Boucle apprentissage biaisée (sur-représentation marques) | MEDIUM | Medium | Stratification par marque/décennie/zone dans training set |

---

## 15. Pointeurs vers documents complémentaires

- [`CLAUDE.md`](../CLAUDE.md) — section économique + technique
- [`.claude/orchestration-kovas-app/economics.md`](../.claude/orchestration-kovas-app/economics.md) §10 — marges brutes évolutives par phase
- [`.claude/orchestration-kovas-app/features-roadmap.md`](../.claude/orchestration-kovas-app/features-roadmap.md) — section "Infrastructure IA"
- [`.claude/orchestration-kovas-app/research/anthropic-claude.md`](../.claude/orchestration-kovas-app/research/anthropic-claude.md) — bases Anthropic API + caching
- [`.claude/orchestration-kovas-app/research/whisper-transcription.md`](../.claude/orchestration-kovas-app/research/whisper-transcription.md) — bases Whisper + alternatives
- PRD §21 — référence courte
