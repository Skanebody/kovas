# KOVAS — Features Roadmap

**Date** : 2026-05-18
**Statut** : Authority document features
**Référencé par** : CLAUDE.md §3, PRD §6-7

> **Philosophie** : *Faire 6 choses extrêmement bien plutôt que 15 choses moyennement.*

---

## Légende priorités

| Priorité | Sens |
|---|---|
| **MVP V0.5** | Inclus dans le sprint 14 jours, lancement public M9 |
| **V1** | Polish post-MVP, M9-M12 |
| **V2** | M12-M18, sprint mini 2-3 semaines/feature |
| **V3** | M18-M30, optionalité |
| **Phase 2** | M10-M18, après certification ADEME |
| **Phase 3** | M19-M30, augmenté + marketplace |
| **Phase 4+** | M30+, Field Compliance OS |

---

## MVP V0.5 — 6 features cœur (sprint 14j)

### F1 — Saisie vocale terrain structurée par pièce ⭐ DIFFÉRENCIATEUR

- **Stack** : OpenAI Whisper `gpt-4o-mini-transcribe` (FR) + Claude Haiku 4.5 structuration tool use
- **Mode dictée continue** avec détection automatique des transitions entre pièces
- **Diag glossary FR 200 termes** en system prompt cached 1h
- **Latence p95** : < 5s (capture → texte structuré dans le bon champ)
- **Précision pipeline complet** : ≥ 93% sur jargon métier
- **Mode offline** : iOS SFSpeechRecognizer fallback + re-transcription cloud à reconnect
- **Effort dev** : 5 j (Sprint J5-J6)

### F2 — Photos géolocalisées par pièce avec annotations

- **Stack** : `react-native-vision-camera 4` + HEIF + EXIF GPS auto + watermark mission_id/timestamp
- **Annotations Apple Pencil** : cercle, flèche, texte (via Skia)
- **Stockage** : Supabase Storage avec naming convention `photos/{org_id}/{mission_id}/{photo_id}.jpg`
- **Préview JPEG 1024px** générée à la capture (~100KB) + sync préview first cellular, original Wi-Fi
- **Effort dev** : 3 j (Sprint J4)

### F3 — Croquis 2D manuel rapide ⭐ DIFFÉRENCIATEUR

- **Stack** : @shopify/react-native-skia + strokes JSON
- **Symboles pré-définis** : porte, fenêtre, prise, radiateur, chaudière
- **Calcul automatique** : surface Carrez (vente) + surface Boutin (location)
- **Précision dimensions** : ± 10 cm sur pièces standards 10-30 m²
- **⛔ PAS DE CROQUIS IA depuis photo** (reporté V3)
- **⛔ PAS DE LIDAR 3D** (reporté V3+ ou jamais)
- **Effort dev** : 4 j (Sprint J8)

### F4 — Auto-complétion adresse + cadastre

- **APIs gouv FR gratuites** :
  - **API BAN** (Base Adresse Nationale) : `api-adresse.data.gouv.fr` — auto-complétion
  - **API IGN/Cadastre** : parcelle, surface, année construction
  - **API Géorisques** : ERP (États des Risques) automatique
- **Effort dev** : 2 j (Sprint J3)

### F5 — Export multi-format universel ⭐ DIFFÉRENCIATEUR (PLAN B SANS LICIEL)

| Format | Usage | Effort |
|---|---|---|
| **ZIP au format Liciel natif** | Import direct dans Liciel V4 | 4 j |
| **PDF dossier mission complet** | Archivage + envoi client | 1 j |
| **Word .docx structuré** | Copier-coller dans tout logiciel concurrent | 1 j |
| **CSV structuré** | Excel, AnalysImmo, OBBC, ORIS, Immo-Diag | 0,5 j |
| **JSON brut** | Intégrations API Phase 2 | 0,5 j |

**JUSTIFICATION** : si Liciel verrouille techniquement l'import ZIP, KOVAS reste utile via PDF/Word/CSV. **Plan B obligatoire**.

**Mode "Affichage côté"** : panel latéral avec données en gros pour copy-paste manuel (cas marginal).

**Effort total** : 7 j (Sprint J11-J12)

### F6 — Sync mobile/web + offline complet

- **Stack** : Supabase Realtime + op-sqlite + Drizzle ORM + outbox + tombstones
- **Conflict resolution** : Last-Write-Wins par défaut (LWW simple suffit Phase 1)
- **Sync queue** : exponential backoff (1s/2s/4s/8s/16s/60s/5min/30min/1h)
- **Réessais infinis** sur connection failures
- **Latence sync à reconnect** : < 30s pour 5 missions queued
- **Effort dev** : 4 j (Sprint J9-J10)

---

## V1 — Polish post-MVP (M9-M12)

| Feature | Priorité | Effort |
|---|---|---|
| Onboarding tour interactif amélioré + tooltips | High | 3 j |
| Empty states design propre | High | 2 j |
| KB 30 articles bonus (4 semaines, calibrés sur tickets bêta) | High | 1j/semaine pendant 4 sem |
| Streaks + benchmark anonyme stats valorisées | Medium | 4 j |
| Plafond mensuel auto-protecteur paiement | High | 2 j |
| Email "Tu paies trop" auto | Medium | 1 j |
| Status page custom Supabase | Medium | 1 j |
| Bandeau cookies custom React | High | 0,5 j |

---

## V2 — Features reportées (M12-M18, sprint 2-3 semaines/feature)

### Croquis 2D Apple Pencil + symboles (NOUVEAU V2 post-Modification 18)

> Initialement prévu V1, **retiré du sprint MVP** (utile pour amiante avancé, audit Phase 3 mais pas indispensable Phase 1).
- Konva.js + PointerEvents API (PWA) ou Skia si retour native V2
- Symboles pré-définis : porte, fenêtre, prise, radiateur, chaudière
- Calcul Carrez/Boutin auto
- **Effort dev** : 4-5 j

### Vision IA reconnaissance équipement ⭐ DIFFÉRENCIATEUR Phase 2

- **Stack** : Claude Sonnet 4.6 Vision + diag brand list cached 1h
- **Précision** :
  - Étiquettes énergétiques ≥ 95%
  - Plaques chaudières post-2015 ≥ 88%
  - Plaques pré-2015 ≥ 70% (mode "à confirmer")
  - Autres équipements ≥ 80%
  - Global pondéré ≥ 85%
- **Dataset validation** : 200 photos terrain réelles couvrant 30+ marques
- **Effort dev** : 15-20 j

### Génération recommandations post-DPE F/G

- **Stack** : Claude Sonnet 4.6 Batch API + AIDES catalog cached
- **3 scénarios** : gestes simples / BBC compatibles / performance max
- **Chiffrage travaux** :
  - Standards (isolation, fenêtres, chaudière) ± 15%
  - Complexes (rénovation globale) ± 25%
  - Aides officielles (MaPrimeRénov', CEE) ± 10%
- **Validation diagnostiqueur manuelle obligatoire** avant remise client
- **Effort dev** : 10-15 j

### Multi-utilisateurs cabinet

- Invitation par email
- Rôles : owner / admin / member / viewer
- Partage missions selon rôle
- Facturation unique au cabinet
- Dashboard consolidé
- **Effort dev** : 10-15 j

### Espace pro B2B (notaires, agences, syndics)

- Comptes multi-dossiers
- Partage rapport sécurisé lien expirant
- **Effort dev** : 7-10 j

### Télémètres BLE (Leica DISTO X3/X4)

- `react-native-ble-plx` 3.x
- Pairing UX + auto-reconnect
- **Effort dev** : 5-7 j

### Import carnet clients depuis Liciel

- Parse `.mdb` côté server via mdbtools
- **Effort dev** : 3-5 j

### API publique

- REST documentée
- Webhooks événements
- OAuth pour partenaires
- **Effort dev** : 15-20 j

---

## V3 — Features long terme (M18-M30, optionalité)

### Croquis IA depuis photo panoramique

- Photo panoramique pièce → plan 2D dimensionné en < 10s
- Stack : Claude Vision + algo géométrique custom + Skia
- **Effort dev** : 15-20 j

### Scan LiDAR iPad Pro 3D

- RoomPlan API native iOS via custom Swift Turbo Module
- Précision ± 2-5 cm
- ⚠️ **Effort 2-3 semaines** + Swift bridge
- Reporté V3+ ou jamais selon ROI

### Drones / IoT

- Import photos drone (DJI Mavic, Autel)
- Analyse thermographie aérienne (ponts thermiques)
- Capteurs IoT Bluetooth (humidimètre, thermomètre)
- **Effort dev** : 20-30 j

---

## Phase 2 — KOVAS Complet (M10-M18)

### Moteur DPE 3CL-2021 certifié ADEME ⭐ CRITIQUE

- **Démarche validation ADEME** lancée M4
- Aboutissement M14-M18
- Calcul automatique classes A-G
- Transmission ADEME directe (n° à 13 chiffres délivré)

### Modules diagnostics étendus

- **Amiante** : avant travaux, avant démolition, DTA, DAPP, vente, location
- **Plomb (CREP)** : avant travaux, plomb dans l'eau, contrôles
- **Gaz** : installation intérieure, contrôles, fiches d'anomalies
- **Électricité** : installation intérieure, anomalies, contrôles
- **Termites** : états parasitaires, mérule, autres champignons
- **Mesurage Carrez/Boutin** : génération attestation officielle
- **DPE collectif copropriété + tertiaire**

### Génération PDF native (sans Word)

- Mise en page parfaite
- Templates personnalisables (logo, couleurs)
- Rédaction IA des observations (validée par diagnostiqueur)
- Versioning rapports
- Multi-format : PDF, PDF/A pour archivage, Excel
- Multilingue FR + EN

---

## Phase 3 — KOVAS Augmenté (M19+) — Recentrée Modification 18

### Assistant IA conversationnel métier ⭐ DIFFÉRENCIATEUR Phase 3

- Chatbot Claude Haiku 4.5 + RAG sur KB ADEME/DHUP/DGCCRF
- Recherche réglementaire avec sourcing officiel
- Détection anomalies dans rapports
- Coach pré-certification COFRAC

### Productivité avancée diagnostics standards

- Reporting analytics fines (cabinet, par diagnostiqueur, par zone)
- Dashboard prédictif (charge de travail, saisonnalité)
- Benchmarks anonymes inter-cabinets
- Vision IA avancée (déjà arrivée V2, étendue Phase 3)

### ⛔ SUPPRIMÉS DÉFINITIVEMENT (Modification 18)

- ❌ **Audit énergétique réglementaire** : marché 3-5× plus petit, certification spécifique, moteur de simulation thermique dynamique 6-12 mois R&D, concurrence Pleiades/ClimaWin/Comfie matures. **Décision : KOVAS n'attaque pas l'audit énergétique.**
- ❌ **Marketplace MAR (Mon Accompagnateur Rénov') / artisans RGE / commissions mise en relation** : modèle économique trop complexe, distraction du cœur métier diag. **Décision : KOVAS reste un SaaS pur, pas une marketplace.**
- ❌ **DTG (Diagnostic Technique Global)** : marché niche ~30k/an, complexité énorme.
- ❌ **Modules métier avancés** (DPE collectif copro batch, RE2020, bilan carbone, accessibilité PMR) : sortent du focus 8 diagnostics standards.

---

## Phase 4+ — Recentrée Modification 18 (M30+)

**Plus de Field Compliance OS élargi.** Les 5 verticales précédentes (audit RGE, EDL, contrôle technique, expertise assurance, conformité ERP) sont **abandonnées**.

### Option A — Expansion géographique

| Pays | Marché diagnostiqueurs | Spécificités |
|---|---|---|
| Belgique | ~5 000 | Équivalents DPE/amiante FR |
| Luxembourg | ~500 | Cadre proche FR |
| Suisse romande | ~10 000 multi-canton | Plus complexe (réglementation cantonale) |
| **Total** | **~15 000 diagnostiqueurs additionnels** | |

### Option B — Productivité avancée diagnostics standards

Si marché FR saturé (50%+ part KOVAS) :

- IA conversationnelle métier 24/7
- Reporting analytics avancés cabinet
- **Marketplace sous-traitance entre diagnostiqueurs** (PAS MAR/RGE)

**Décision M30** selon traction.

---

## Anti-patterns roadmap

- ⛔ Ajouter une feature parce qu'un utilisateur la demande sans valider le pattern
- ⛔ Faire 50% d'une feature complexe et la marketer comme finie
- ⛔ Lancer Vision IA avant d'avoir le dataset validation 200 photos
- ⛔ Lancer Croquis IA avant d'avoir validé l'UX croquis manuel
- ⛔ Démarrer Phase 4 avant que Phase 2 + 3 soient stables
- ⛔ Mix MVP avec features V2/V3 dans le sprint 14j

---

## Métriques de validation pour passer à V2/V3/Phase 2

| Étape | Critères de passage |
|---|---|
| MVP V0.5 → V1 | M9 launch public : 30+ abonnés payants + NPS ≥ 40 + crash-free > 99% |
| V1 → V2 | M12 : 100+ abonnés payants + churn < 5%/mo + NPS ≥ 50 |
| V2 → Phase 2 | Validation ADEME 3CL-2021 obtenue + 300+ abonnés payants + NPS ≥ 55 |
| Phase 2 → Phase 3 | M18 : ARR > 500k€ + 600+ abonnés + NPS ≥ 60 + tous modules diag livrés |
| Phase 3 → Phase 4 | M24 : ARR > 1M€ + 800+ abonnés + traction sur 1er vertical adjacent |

---

## Infrastructure IA — Transitions techniques à prévoir

> **Document détaillé** : [`/docs/ai-autonomy-strategy.md`](../../docs/ai-autonomy-strategy.md)

La stack IA évolue progressivement sur 36 mois pour réduire la dépendance Claude/Whisper et augmenter la marge brute (77% M12 → 85%+ M36).

### Phase 1 — M0-M12 (lancement public)

**Stack** : APIs externes 100% — Anthropic Claude Sonnet 4.6/Haiku 4.5 + OpenAI Whisper `gpt-4o-mini-transcribe` (+ Deepgram Frankfurt en fallback).

**Action infrastructure** : aucune internalisation. Focus produit et traction.

### Phase 2 — M12-M18 (optimisations Anthropic)

**Transitions à prévoir** :

| Transition | Effort | Économie |
|---|---|---|
| **Cache vectoriel Vision IA** (embeddings + cosine similarity match > 95%) | 5-7 j dev | -30 à -50% Claude Vision |
| **Prompt caching 1h TTL agressif** sur tous les system prompts répétés | 2 j dev | -30 à -40% Claude |
| **Routing hybride Sonnet/Haiku** (Sonnet = critique, Haiku = simple) | 3 j dev | -30 à -40% Claude |
| **Batch API pour asynchrone** (recos post-DPE F/G, traitement nuit) | 2 j dev | -40 à -50% Claude sur batch |
| **A/B test Deepgram Nova-3 EU vs Whisper** | 5 j dev + 4 sem mesure | -35% transcription si validé |

**Effort total Phase 2** : ~15-20 j dev étalés sur 6 mois.
**Investissement** : ~0€ infra (config + dev interne).
**Économie cible** : -30% facture IA globale.

### Phase 3 — M18-M24 (self-hosting partiel ciblé)

#### Étape 1 — Whisper self-hosted (M18-M20)

**Stack** : Whisper-large-v3 (ou Distil-Whisper pour latence) sur GPU cloud (Vast.ai, RunPod, Lambda Labs).

**Hardware** :
- Démarrage : 2 A100 cloud à ~600€/mois
- Scale : 4 A100 en pic à ~1 200€/mois pour 1 200 users

**Migration** :
- A/B test 5 → 25 → 100% trafic sur 6 semaines
- Fallback Whisper API maintenu en cas de problème qualité/disponibilité
- Métriques : `whisper.self_hosted.latency_p95_ms`, `whisper.self_hosted.wer_fr`

**Économie** : 2 400€/mois récurrent à 1 200 users (~29k€/an).

#### Étape 2 — Vision IA custom YOLO (M20-M22)

**Stack** : YOLO v9 fine-tuné sur dataset 50 000+ photos d'équipements accumulées Phase 2.

**Architecture** :
- Fine-tuning sur GPU H100 cloud (~500€ par session de 4h)
- Modèle compact 50 MB déployé **on-device via CoreML iPad** + fallback Claude Vision serveur
- Pipeline re-training automatique tous les 3 mois sur dataset cumulé

**Migration** :
- A/B test précision YOLO vs Claude Vision sur 30 marques chaudières
- Bascule progressive 5 → 25 → 100% sur 8 semaines
- Latence passe de 2-3s/photo (Claude Vision API) à 200-500ms (on-device) — **UX 10x meilleure**

**Économie** : 1 350€/mois récurrent à 1 500 users (~16k€/an).

### Phase 4 — M24-M36 (modèle français propriétaire, conditionnel)

**Stack potentielle** : fine-tuning **Llama 3.3 70B** ou **Mistral Large** sur 100 000+ missions accumulées.

**Conditions de déclenchement (TOUTES requises)** :
- ✅ 1 500+ utilisateurs payants
- ✅ ARR 1,5 M€+
- ✅ 50 000+ missions nettoyées et structurées
- ✅ Ressources ingénieur ML (freelance ou temporaire)
- ✅ Acceptation 3-6 mois R&D avant ROI

**Architecture** :
- Compute fine-tuning : 4× H100 sur 5-7 jours (~10-15k€ par session)
- Inférence production : 2-4× A100 ou H100 selon trafic (~3-5k€/mois compute)
- Pipeline MLOps : monitoring qualité + re-training trimestriel + A/B test continu

**Migration** :
- Routing 80/20 : 80% cas usuels via modèle propriétaire, 20% cas complexes via Claude
- Garde-fous : fallback Claude automatique si confidence < 0,7 ou détection drift
- Monitoring NPS et churn pour rollback rapide si dégradation

**Économie cible** : 50-70k€/an récurrent à M36 + indépendance stratégique + moat technologique.

**Investissement** : 40-80k€ (ingénieur ML + compute + cleaning données).

### Phase 5 — M36+ (régime 80/20 stable)

**Stack mature** :
- 80% des cas usuels via algos propres (Whisper self-hosted + YOLO custom + LLM français propriétaire)
- 20% des cas complexes/edge cases via Claude Sonnet 4.6+
- Re-training trimestriel automatique sur dataset cumulé

**Marge brute** : **85%+ stable**.
**Maintenance** : ~10-20% temps ingénieur ML (freelance ou employé) + ~3-5k€/mois compute.

---

## Auto-apprentissage continu (3 pipelines)

### Pipeline 1 — Vision IA corrections utilisateurs (Phase 3+)

- Utilisateur corrige reconnaissance → enregistrement table `vision_corrections` (Supabase)
- Re-fine-tuning YOLO tous les **12 semaines** (ou si > 500 corrections accumulées)
- A/B test 5% trafic pré-déploiement, rollback automatique si précision--
- Coût : 200-500€/session (3-4h GPU)

### Pipeline 2 — Personnalisation par utilisateur (Phase 1+)

- Profil linguistique JSONB par utilisateur (termes fréquents, corrections récurrentes)
- Injecté dans Claude prompts (cached 1h) + Whisper `prompt` param + iOS `contextualStrings`
- Stockage <100 KB/user, coût quasi 0€
- Précision personnalisée +2-4% à 3-6 mois d'usage

### Pipeline 3 — Détection patterns métier (Phase 3+)

- Job batch hebdo sur Supabase scannant 100 000+ missions
- Détection corrélations marque/époque/DPE/zone
- Applications : suggestions contextuelles, pré-fill prédictif, alertes cohérence
- Coût : ~5€/mois à 1000 users (Supabase Pro inclus)
