# Gestion des risques techniques — KOVAS V1

> **Périmètre** : risques techniques liés à l'export ZIP Liciel et au flow KOVAS terrain → bureau.
> **À jour** : 2026-05-18

---

## 1. Risque 1 — Variation classification DPE entre logiciels

### Constat

Documenté dans le milieu diagnostiqueurs : la classification DPE peut varier de **±1 lettre** entre deux logiciels avec exactement les mêmes données saisies. Sources : forums diagnostic-immo, retours utilisateurs Liciel/Analys'Immo.

### Impact

🔴 **Élevé** — responsabilité juridique du diagnostiqueur engagée. Un DPE classé F dans Liciel mais E dans KOVAS (avant Phase 2 cert) pourrait être contesté par le propriétaire.

### Mitigation

| # | Action | Sprint |
|---|---|---|
| 1 | **Tests croisés sur 50+ cas** — KOVAS export → Liciel vs saisie native Liciel | J12 (cf. [testing-protocol.md](./testing-protocol.md)) |
| 2 | **Documentation des écarts résiduels** — rapport public avec taux conformité | Pré-launch |
| 3 | **Avertissement utilisateur** si cas limite (F/E ou G/F) — modal "Vérifier le calcul DPE dans Liciel après import" | V1 |
| 4 | **Recommandation systématique** : "Le calcul officiel reste Liciel, KOVAS est un compagnon terrain" | Marketing |
| 5 | **Phase 2 — Calcul DPE certifié ADEME 3CL-2021 intégré** → zéro écart | M10-M18 |

### Indicateur de suivi

- % de missions avec écart > 0 lettre DPE entre KOVAS et Liciel (cible **< 1%**)
- Tableau de bord interne `/admin/qa/dpe-classification-drift`

---

## 2. Risque 2 — Liciel pourrait blacklist XML "non validés"

### Constat

Support Liciel attribue automatiquement les bugs aux "logiciels non validés". KOVAS peut être classé "non validé" même si tout est correct.

### Impact

🔴 **Élevé** — utilisateurs pourraient avoir des problèmes d'import attribués à KOVAS, dégradant la réputation.

### Mitigation

| # | Action | Sprint |
|---|---|---|
| 1 | **Tests intensifs avant lancement** (25-50 cas réels) | J12 |
| 2 | **Documentation publique** des résultats (taux réussite > 99%) | Pré-launch |
| 3 | **Support utilisateur ultra-réactif** (< 2h en heures ouvrées) si problème import | V1 |
| 4 | **Communication transparente** : page `/import-liciel/status` avec dashboard public temps réel | Post-launch |
| 5 | **Bouton "Signaler un problème d'import"** in-app → ticket support auto | V1 |
| 6 | **Backup mode** : si import Liciel échoue, fallback automatique sur PDF/Word | V1 |

### Indicateur de suivi

- Taux import Liciel réussi (cible **> 99%**)
- Temps moyen résolution ticket import (cible **< 4h**)

---

## 3. Risque 3 — Mises à jour quotidiennes Liciel

### Constat

Liciel fait des mises à jour quotidiennes du logiciel. Le format ZIP peut changer du jour au lendemain (champs ajoutés, renommés, structure modifiée).

### Impact

🟡 **Moyen** — peut casser le parser KOVAS sans préavis. Détection rapide essentielle.

### Mitigation

| # | Action | Sprint |
|---|---|---|
| 1 | **Monitoring quotidien** release notes Liciel (RSS / scraping page changelog) | J14 |
| 2 | **Tests automatisés** parser KOVAS sur cas tests (suite Vitest, lancée 1×/jour via GitHub Actions) | V1 |
| 3 | **Alertes Sentry + Resend** si taux import < 99% sur 1h glissante | V1 |
| 4 | **Mise à jour parser KOVAS en 24-48h max** après changement détecté | SLA interne |
| 5 | **Notifications utilisateurs** si problème détecté (banner in-app + email) | V1 |
| 6 | **Versionning parser** : `parser_version: 'v2026.05.18'` dans chaque export, traçabilité | V1 |

### Indicateur de suivi

- Délai détection changement Liciel (cible **< 24h**)
- Délai correction parser KOVAS (cible **< 48h**)

---

## 4. Risque 4 — Champs custom donneur d'ordre

### Constat

Liciel permet **26 champs custom paramétrables** par mission. Notaires, syndics, grandes agences ont leurs exigences spécifiques. Sans ces champs, l'export KOVAS perd des données critiques pour certains clients.

### Impact

🟡 **Moyen** — utilisateurs B2B avec gros donneurs d'ordre ne pourront pas utiliser KOVAS efficacement.

### Mitigation

| # | Action | Sprint |
|---|---|---|
| 1 | **Permettre 26 champs custom** dans KOVAS (parité Liciel) | V1.5 (post-launch S3) |
| 2 | **Templates par donneur d'ordre** (notaires, syndics) — pré-saisie | V1.5 |
| 3 | **Sync paramétrages custom** entre KOVAS et Liciel (mapping configurable) | V1.5 |
| 4 | **Onboarding cabinet** : Benjamin configure les 26 champs avec l'utilisateur | M9+ |

### Schéma SQL (à créer V1.5)

```sql
CREATE TABLE client_custom_fields (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  field_label text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text','number','date','boolean')),
  display_order int NOT NULL,
  required boolean DEFAULT false,
  UNIQUE (client_id, field_key)
);

CREATE TABLE mission_custom_values (
  mission_id uuid REFERENCES missions(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  value text,
  PRIMARY KEY (mission_id, field_key)
);
```

### Indicateur de suivi

- % d'utilisateurs B2B activant les champs custom (cible **> 60%** à M12)

---

## 5. Risque 5 — Photos non liées aux pièces

### Constat

Une photo orpheline (non taggée à une pièce) est **inutile** dans le rapport Liciel. Le format ZIP exige le mapping `Photos/PIECE_001/photo_xxx.jpg`.

### Impact

🟡 **Moyen** — perte de qualité du rapport généré, retours utilisateurs négatifs.

### Mitigation

| # | Action | Sprint |
|---|---|---|
| 1 | **Tagging automatique** à la prise de photo : le user sélectionne une pièce active avant de photographier | J4 |
| 2 | **Validation pré-export** : KOVAS bloque l'export si photos orphelines détectées (check-list cf. feature 5) | J10 |
| 3 | **Page de tri** post-mission : drag-and-drop photos → pièces | J4 |
| 4 | **Export structuré ZIP** avec métadonnées (`piece_id` dans EXIF custom) | J12 |
| 5 | **Vérification visuelle** dans Liciel après import + alerte utilisateur si discrepancy | V1 |

### Indicateur de suivi

- Taux de photos taggées correctement (cible **> 95%**)
- % de missions avec photos orphelines à l'export (cible **< 5%**)

---

## 6. Risques transverses (non bloquants V1)

### Disponibilité Whisper API OpenAI

**Risque** : panne OpenAI > 1h → impossibilité de transcription.
**Mitigation** : fallback automatique Deepgram Nova-3 (EU Frankfurt) — cf. [`packages/ai/src/whisper.ts`](../packages/ai/src/whisper.ts).

### Coût Whisper qui explose

**Risque** : Whisper passe de 0,006$/min à 0,02$/min.
**Mitigation** : stratégie autonomisation IA cf. [`ai-autonomy-strategy.md`](./ai-autonomy-strategy.md) — Whisper self-hosted M18-M24.

### Rate-limit BAN API

**Risque** : `api-adresse.data.gouv.fr` rate-limit ~50 req/s.
**Mitigation** : debounce 250ms côté client + cache Supabase pour adresses récentes.

### Supabase region down (eu-west-3 Paris)

**Risque** : panne datacenter Paris > 30 min.
**Mitigation** :
- PITR (Point-in-Time Recovery) activé dès M2 (Pro tier)
- Service Worker permet mode offline pour les missions en cours
- Backup quotidien vers Cloudflare R2 (à activer M6)

---

## 7. Tableau de synthèse

| # | Risque | Impact | Probabilité | Score | Mitigation principale |
|---|---|---|---|---|---|
| 1 | Variation classification DPE | 🔴 | 🟡 | 6 | Tests croisés 50+ cas + Phase 2 cert ADEME |
| 2 | Liciel blacklist XML | 🔴 | 🟡 | 6 | Tests intensifs + support réactif |
| 3 | MAJ quotidiennes Liciel | 🟡 | 🟢 forte | 6 | Monitoring + SLA 48h |
| 4 | Champs custom donneur d'ordre | 🟡 | 🟡 | 4 | 26 champs custom V1.5 |
| 5 | Photos orphelines | 🟡 | 🟢 forte | 6 | Tagging auto + validation pré-export |

(Score = impact × probabilité, 1-9)

---

## 8. Revue trimestrielle

Tous les 3 mois post-launch :
- Mettre à jour les indicateurs de suivi (sections 1-5)
- Réévaluer les scores impact × probabilité
- Décider escalade mitigation si score ≥ 6 et indicateur dégradé
- Communiquer transparence aux Founders (newsletter trimestrielle)
