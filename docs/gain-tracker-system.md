# KOVAS — Gain Tracker System

**Date** : 2026-05-18
**Statut** : Authority document Gain Tracker (V1.5, sprints 15-17 post-launch)
**Effort total** : 8 jours dev
**Authority avatar** : [`/docs/avatar-client.md`](avatar-client.md) — TON SOBRE et PROFESSIONNEL obligatoire

---

## 1. Objectifs business

| KPI | Baseline | Cible M6 | Cible M12 |
|---|---|---|---|
| **Churn mensuel** | 6% | < 5% | **< 4%** |
| **NPS** | 35 | > 40 | **> 55** |
| **Coefficient viral K** | 1,2 | 1,3 | **1,5** |
| **LTV** | 1 800€ | +25% | **+50% (2 700€)** |
| % users consultant page "Mon activité" hebdo | - | 40% | 60% |
| Taux ouverture email rapport mensuel | - | 60% | 75% |
| Taux partage LinkedIn | - | 15% | 30% |

---

## 2. Architecture — 7 éléments constitutifs

### Élément 1 — Compteur permanent dashboard

Position : haut à droite du dashboard mobile + web, **toujours visible**.

```
┌────────────────────────────────────────┐
│ Votre gain ce mois                     │
│                                        │
│ 23h 47min économisées                  │
│ Productivité libérée : 2 374€          │
│ 19 missions traitées                   │
│                                        │
│ [ Voir le détail ]                     │
└────────────────────────────────────────┘
```

**Calcul** :
- Temps économisé = baseline_duration_minutes − actual_duration_minutes (par mission)
- Productivité libérée = temps économisé (heures) × hourly_value_euros (défaut 100€/h, modifiable settings)
- Mise à jour **temps réel** Supabase Realtime à chaque mission terminée
- Animation discrète à chaque incrémentation (transition 300ms, **pas de confettis**)

**Vouvoiement** par défaut, **tutoiement** uniquement après opt-in explicite user (paramètres).

### Élément 2 — Page "Mon activité" détaillée

Route : `/mon-activite`

**Statistiques cumulées depuis inscription** :

```
Inscrit depuis : 8 mois
Missions traitées : 154
Temps total économisé : 231 heures (= 28,8 journées de 8h)
Productivité libérée : 23 100€
Investissement KOVAS : 640€
ROI : ×36
```

**Graphique évolution mensuelle** : histogramme 12 mois glissants, gains mensuels (Recharts, palette navy KOVAS sobre).

**Répartition par type de diagnostic** :
- DPE : 60%
- Amiante : 20%
- Plomb : 10%
- Gaz : 5%
- Autres : 5%

(Donut chart Recharts, sobre, sans légendes flashy)

### Élément 3 — Tracking comparatif "Avant / Après KOVAS"

**Setup baseline au signup** (2 questions courtes intégrées dans onboarding J0) :

1. *Missions/mois en moyenne actuellement :*
   `[ 30 ] [ 50 ] [ 75 ] [ 100 ] [ 150 ] [ Autre ]`

2. *Temps par mission actuel (terrain + bureau) :*
   `[ 2h ] [ 3h ] [ 4h ] [ 5h ] [ Plus ]`

**Sauvegarde** dans `user_baseline` table.

**Affichage post-mission** (toast sobre, 5s d'affichage) :

```
✓ Mission terminée

Durée KOVAS : 47 min
Durée moyenne sans KOVAS : 3h 15min
Temps économisé : 2h 28min

Cumul du mois : 47 heures économisées
```

### Élément 4 — Statuts professionnels (7 niveaux, ZÉRO gaming)

| Statut | Critère | Récompense |
|---|---|---|
| **Utilisateur Pro** | 1ère mission | Badge sobre dans profil |
| **Diagnostiqueur Confirmé** | 50 missions | Carte de visite numérique (PDF téléchargeable) |
| **Diagnostiqueur Sénior** | 200 missions | Statut visible profil + page "Mes Statuts" |
| **Membre Premium** | 500 missions | Statut + 1 mois offert |
| **Ambassadeur** | 3 parrainages réussis | Statut + 3 mois offerts |
| **Fidèle KOVAS** | 1 an d'utilisation | Statut + sollicitation témoignage public (opt-in) |
| **Diagnostiqueur Expert** | 1000 missions | Statut + accès anticipé features V2/V3 |

### Principes visuels strictes

✅ **À FAIRE** :
- Présentation type "diplôme professionnel"
- Couleur navy KOVAS + accents discrets
- Format certificat chambre professionnelle
- Vocabulaire sobre ("statut", "diplôme", "certificat de compétence")

❌ **NE JAMAIS UTILISER** :
- "Pionnier", "Légende", "Marathonien", "Hero", "Champion", "Master"
- Émojis 🏆🚀⭐🎯🎉🎊 dans noms de statuts
- Animations festives type confettis
- Vocabulaire gaming/casual

### Élément 5 — Rapport mensuel (email + page web)

**Email automatique le 1er du mois** (8h CET), envoyé via Resend.

Format texte sobre, lisible Outlook/Gmail/Apple Mail. **Vouvoiement par défaut.**

```
═══════════════════════════════════
RAPPORT MENSUEL D'ACTIVITÉ
Novembre 2026
═══════════════════════════════════

Bonjour Pierre,

Votre activité sur KOVAS en novembre :

VOLUME
- Missions traitées : 19
  • DPE : 14
  • Amiante : 3
  • Plomb CREP : 2

EFFICACITÉ
- Durée moyenne par mission : 1h 12min
- Temps économisé total : 23h 47min
- Soit l'équivalent de 2,97 journées de travail

VALORISATION ÉCONOMIQUE
- Productivité libérée : 2 374€
- Investissement KOVAS du mois : 81,50€
- Ratio coût/bénéfice : 1/29

ÉVOLUTION
- Comparé à octobre : +4 missions, +2h économisées
- Progression positive

CUMUL DEPUIS VOTRE INSCRIPTION (8 mois)
- Missions traitées : 154
- Temps total économisé : 231 heures (28,8 jours)
- Productivité totale libérée : 23 100€
- ROI cumulé : ×36

[ Voir le rapport détaillé en ligne ]
[ Partager mon rapport sur LinkedIn ]

Cordialement,
Benjamin Bel
Fondateur KOVAS
```

**Principes format** :

- Pas de fioritures graphiques
- Chiffres en gras, le reste en texte standard
- Couleurs : navy KOVAS (#0A0A0A foncé) + blanc UNIQUEMENT (pas d'accents délavés)
- Ressemble à un **rapport comptable mensuel**
- 1 page maximum
- Signature personnelle de Benjamin (humain, pas marketing automatisé)

### Élément 6 — Image partage LinkedIn (sobre, business)

Bouton "Partager sur LinkedIn" dans la page rapport mensuel.

**Image 1080×1080 générée à la demande** (Edge Function `generate-linkedin-image` via Satori/Resvg) :

```
┌──────────────────────────────────────┐
│                                      │
│      [Logo KOVAS sobre]              │
│                                      │
│      Mon mois avec KOVAS             │
│      Novembre 2026                   │
│                                      │
│      ━━━━━━━━━━━━━━━━━               │
│                                      │
│      23 heures économisées           │
│      19 missions traitées            │
│      28 jours libérés cumulés        │
│                                      │
│      ━━━━━━━━━━━━━━━━━               │
│                                      │
│      @pierre_diagnostics             │
│      kovas.fr                        │
│                                      │
└──────────────────────────────────────┘
```

**Texte LinkedIn pré-rédigé (modifiable par user)** :

```
Bilan de mon mois avec KOVAS App :
- 19 missions diagnostiques traitées
- 23 heures économisées sur la saisie terrain
- Soit près de 3 jours de travail libérés ce mois

Au total depuis 8 mois : 231 heures économisées,
équivalent à 28 jours de travail libérés.

Pour ceux qui ne connaissent pas, KOVAS est une app
moderne pour diagnostiqueurs immobiliers qui élimine
la double saisie terrain/bureau.

#diagnostic #immobilier #DPE #productivité
```

**Principes** :

- **LinkedIn UNIQUEMENT** (pas Instagram/TikTok/Twitter/Facebook)
- Format sobre, business
- Texte pré-rédigé professionnel
- Hashtags métier
- Image neutre, **pas de design "flashy"**

### Élément 7 — Statistiques anonymisées comparatives

Page `/communaute`, accessible depuis dashboard.

**Format strictement statistique** :

```
═══════════════════════════════════
VOTRE POSITION
═══════════════════════════════════

Votre activité ce mois :
- 23h économisées
- 19 missions traitées

Comparaison anonymisée avec les autres utilisateurs KOVAS :
- Moyenne des diagnostiqueurs : 18h économisées
- Top 25% : 28h+ économisées
- Top 10% : 35h+ économisées

VOTRE POSITION : top 30% des plus efficaces
```

**Principes anti-vexation** :

- ✅ AUCUN classement nominatif (anti-confraternité métier)
- ✅ AUCUNE liste "1er Pierre, 2ème Marie..."
- ✅ Statistiques anonymisées uniquement
- ✅ Positionnement par tranches (top 10%, 25%, 50%, "proche de la moyenne")
- ✅ Toujours valorisant — utilisateurs en bas voient "vous êtes proche de la moyenne", JAMAIS "vous êtes dans les derniers"
- ✅ **Opt-out** possible (paramètres → "Ne pas voir ma position")
- ✅ Comparaisons par cohorte similaire (taille cabinet) si possible

---

## 3. Notifications — règles strictes

**MAX 1 notification push par jour**.

### Notification quotidienne (en fin de journée, optionnelle)

Déclenchée à 19h CET si missions traitées dans la journée :

```
Bilan du jour :
4h 12min économisées avec KOVAS
soit l'équivalent d'une demi-journée libérée
```

**Principes** :

- 1 fois par jour MAX
- Désactivable à tout moment dans paramètres
- Ton professionnel, sobre
- **PAS d'émojis flashy**
- **PAS de gamification** ("Bravo !", "Continuez !", "Super !")
- **Vouvoiement** par défaut

### Notifications événementielles (occasionnelles)

| Trigger | Fréquence max | Contenu |
|---|---|---|
| Nouveau statut professionnel débloqué | 3-4 fois/an | "Vous avez atteint le statut Diagnostiqueur Sénior." |
| Anniversaire d'inscription | 1 fois/an | "Cela fait 1 an que vous utilisez KOVAS. Récap disponible." |
| Rapport mensuel disponible | 12 fois/an (1er du mois) | "Votre rapport mensuel d'activité de [mois] est disponible." |

---

## 4. Architecture technique

### Nouvelles tables Supabase

```sql
-- Baseline avant KOVAS (réponses signup)
CREATE TABLE user_baseline (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  avg_missions_per_month INT NOT NULL,
  avg_time_per_mission_minutes INT NOT NULL,
  hourly_value_euros DECIMAL(10,2) DEFAULT 100,
  baseline_set_at TIMESTAMPTZ DEFAULT NOW()
);

-- Métriques par mission (calculées automatiquement)
CREATE TABLE mission_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  organization_id UUID REFERENCES organizations(id),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  actual_duration_minutes INT NOT NULL,
  baseline_duration_minutes INT NOT NULL,
  time_saved_minutes INT GENERATED ALWAYS AS
    (baseline_duration_minutes - actual_duration_minutes) STORED,
  value_saved_euros DECIMAL(10,2) NOT NULL,
  mission_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_mission_metrics_user_completed
  ON mission_metrics (user_id, completed_at DESC);

-- Statuts professionnels débloqués
CREATE TABLE user_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status_type TEXT NOT NULL CHECK (status_type IN (
    'utilisateur_pro', 'diag_confirme', 'diag_senior',
    'membre_premium', 'ambassadeur', 'fidele_kovas', 'diag_expert'
  )),
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  notified BOOLEAN DEFAULT FALSE,
  UNIQUE (user_id, status_type)
);
CREATE INDEX idx_user_statuses_user ON user_statuses (user_id);

-- Vue matérialisée pour stats mensuelles (perf)
CREATE MATERIALIZED VIEW user_monthly_stats AS
SELECT
  user_id,
  organization_id,
  DATE_TRUNC('month', completed_at) AS month,
  COUNT(*) AS missions_count,
  SUM(time_saved_minutes) AS total_time_saved_minutes,
  SUM(value_saved_euros) AS total_value_saved,
  ARRAY_AGG(DISTINCT mission_type) AS mission_types
FROM mission_metrics
GROUP BY user_id, organization_id, DATE_TRUNC('month', completed_at);

CREATE UNIQUE INDEX idx_user_monthly_stats_unique
  ON user_monthly_stats (user_id, month);

-- Refresh via pg_cron toutes les heures
SELECT cron.schedule(
  'refresh-user-monthly-stats',
  '0 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY user_monthly_stats;$$
);
```

### Edge Functions

| Function | Trigger | Rôle |
|---|---|---|
| `calculate-mission-metrics` | Mission `status` → `done` | Calcule `time_saved_minutes` + `value_saved_euros`, insert dans `mission_metrics` |
| `check-status-unlock` | Post-INSERT `mission_metrics` | Vérifie si un statut professionnel est débloqué (≥ 50/200/500/1000 missions) |
| `generate-monthly-report` | pg_cron 1er du mois 8h CET | Pour tous users actifs : calcule rapport + envoie email Resend |
| `generate-linkedin-image` | À la demande (bouton "Partager") | Génère image 1080×1080 PNG via Satori/Resvg |
| `refresh-user-monthly-stats` | pg_cron hourly | REFRESH MATERIALIZED VIEW CONCURRENTLY |

### Intégration Realtime

- Compteur permanent dashboard : `supabase.channel('user-monthly-stats')` filtré sur `user_id`
- Animation incrémentation à chaque mission terminée (300ms transition, **pas de confettis**)
- Statut professionnel débloqué : notification temps réel + modal sobre

---

## 5. Wireframes UI/UX

### Dashboard mobile (iPad)

```
┌─────────────────────────────────────────────────────────────────┐
│ KOVAS                                       ┌─────────────────┐ │
│                                             │ Votre gain ce   │ │
│ Tableau de bord                             │ mois            │ │
│                                             │                 │ │
│ Bonjour Pierre.                             │ 23h 47min       │ │
│ Vous avez 2 missions planifiées             │ économisées     │ │
│ aujourd'hui.                                │                 │ │
│                                             │ 2 374€ libérés  │ │
│ [ Missions planifiées ]                     │ 19 missions     │ │
│                                             │                 │ │
│ ...                                         │ [Voir détail →] │ │
│                                             └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Page "Mon activité"

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Dashboard                                                     │
│                                                                 │
│ Mon activité                                                    │
│                                                                 │
│ ── Statistiques cumulées ─────────────────────────────────────  │
│                                                                 │
│ Inscrit depuis        | 8 mois                                  │
│ Missions traitées     | 154                                     │
│ Temps économisé       | 231 heures (28,8 jours)                 │
│ Productivité libérée  | 23 100€                                 │
│ Investissement KOVAS  | 640€                                    │
│ ROI                   | ×36                                     │
│                                                                 │
│ ── Évolution mensuelle ──────────────────────────────────────── │
│                                                                 │
│ [Histogramme 12 mois glissants — Recharts navy]                 │
│                                                                 │
│ ── Répartition par type ─────────────────────────────────────── │
│                                                                 │
│ [Donut chart sobre]                                             │
│                                                                 │
│ ── Statuts professionnels ───────────────────────────────────── │
│                                                                 │
│ ✓ Utilisateur Pro (débloqué 15 mars 2026)                       │
│ ✓ Diagnostiqueur Confirmé (débloqué 22 avril 2026)              │
│ ✓ Diagnostiqueur Sénior (débloqué 8 octobre 2026)               │
│ → Prochain : Membre Premium (500 missions, 154/500)             │
│                                                                 │
│ [ Partager mon rapport sur LinkedIn ]                           │
└─────────────────────────────────────────────────────────────────┘
```

### Toast post-mission

```
┌─────────────────────────────────────────────┐
│ ✓ Mission terminée                          │
│                                             │
│ Durée KOVAS : 47 min                        │
│ Sans KOVAS : 3h 15min                       │
│ Temps économisé : 2h 28min                  │
│                                             │
│ Cumul du mois : 47h économisées             │
└─────────────────────────────────────────────┘
```

(5s d'affichage, fade out, animation 300ms — **pas de confetti**)

---

## 6. Effort dev — 8 jours

### Sprint 15 (semaine 3 post-launch, M9 fin / M10 début)

| Jour | Livrable |
|---|---|
| **J1** | Tables DB (`user_baseline`, `mission_metrics`, `user_statuses`) + migration + RLS policies + tracking automatique mission status `done` → Edge Function `calculate-mission-metrics` |
| **J2** | Compteur permanent dashboard mobile + web (compo `<GainCounter />`) + animation 300ms incrémentation + Supabase Realtime subscription |
| **J3** | Page `/mon-activite` détaillée (stats cumulées + graphique évolution mensuelle Recharts + donut répartition par type) |

### Sprint 16 (semaine 4)

| Jour | Livrable |
|---|---|
| **J4** | Système statuts professionnels (7 niveaux) + Edge Function `check-status-unlock` + UI affichage statuts + modal sobre déblocage |
| **J5** | Génération rapport mensuel email (Edge Function `generate-monthly-report` + template Resend + cron pg_cron 1er du mois 8h CET) |
| **J6** | Génération image partage LinkedIn (Edge Function `generate-linkedin-image` via Satori/Resvg) + texte pré-rédigé modifiable + intent partage navigateur |

### Sprint 17 (semaine 5)

| Jour | Livrable |
|---|---|
| **J7** | Page `/communaute` statistiques anonymisées comparatives + opt-out paramètres + vue matérialisée `user_monthly_stats` + refresh hourly |
| **J8** | Notifications push quotidiennes (PWA via Web Push API + Service Worker) + paramètres notifications + tests + polish |

---

## 7. Tests d'acceptation

### Élément 1 — Compteur permanent

- [ ] Visible top-right dashboard mobile + web
- [ ] Update temps réel après mission terminée (≤ 2s)
- [ ] Animation 300ms incrément (CSS transition, pas Framer Motion lourde)
- [ ] Affichage cohérent light/dark mode (palette navy KOVAS)
- [ ] **Pas de confettis, pas de son** post-incrément

### Élément 2 — Page "Mon activité"

- [ ] Stats cumulées calculées correctement (validation manuelle 3 cas)
- [ ] Graphique évolution mensuelle Recharts (12 mois max, palette sobre)
- [ ] Donut répartition types missions (cohérent avec mission_type)
- [ ] Mobile responsive (iPad portrait + landscape)

### Élément 3 — Baseline avant/après

- [ ] 2 questions intégrées dans onboarding J0 (pas d'écran séparé)
- [ ] Sauvegarde `user_baseline`
- [ ] Toast post-mission avec calcul correct
- [ ] Fallback si baseline absente : utilise moyenne globale (180 min/mission)

### Élément 4 — Statuts professionnels

- [ ] 7 statuts correctement implémentés
- [ ] Edge Function `check-status-unlock` déclenchée post-mission
- [ ] Modal sobre déblocage (pas de confettis)
- [ ] Carte de visite numérique (PDF téléchargeable) pour "Diagnostiqueur Confirmé"
- [ ] Vocabulaire vérifié vs `/docs/avatar-client.md` §4 (zéro gaming)

### Élément 5 — Rapport mensuel

- [ ] Email envoyé le 1er du mois 8h CET via Resend
- [ ] Format texte sobre, lisible Outlook/Gmail/Apple Mail
- [ ] Chiffres en gras, reste en texte standard
- [ ] Signature Benjamin Bel humaine
- [ ] Lien vers rapport web fonctionnel
- [ ] Bouton "Partager LinkedIn" fonctionnel

### Élément 6 — Image LinkedIn

- [ ] Image 1080×1080 PNG générée
- [ ] Design sobre cohérent palette navy KOVAS
- [ ] Texte pré-rédigé professionnel
- [ ] Intent partage navigateur (LinkedIn share dialog)
- [ ] **Pas d'options Instagram/TikTok/Twitter**

### Élément 7 — Statistiques anonymisées

- [ ] Comparaisons par tranches (top 10/25/50%, "proche moyenne")
- [ ] **Aucun classement nominatif**
- [ ] Opt-out dans paramètres
- [ ] Toujours valorisant (jamais "vous êtes dans les derniers")
- [ ] Cohortes par taille cabinet si possible

### Notifications push

- [ ] MAX 1 push/jour
- [ ] Désactivable paramètres
- [ ] Vouvoiement par défaut
- [ ] **Pas d'émojis flashy**
- [ ] **Pas de gamification** "Bravo !", "Continuez !"

---

## 8. Métriques de monitoring

À tracker PostHog post-déploiement V1.5 :

- `gain_tracker.dashboard_counter_viewed` (mesure utilisation compteur)
- `gain_tracker.activity_page_viewed` (hebdomadaire, cible 40%/60%)
- `gain_tracker.monthly_report_email_opened` (cible 60%/75%)
- `gain_tracker.monthly_report_email_link_clicked`
- `gain_tracker.linkedin_share_button_clicked` (cible 15%/30%)
- `gain_tracker.linkedin_share_image_generated`
- `gain_tracker.community_page_viewed`
- `gain_tracker.community_optout_enabled`
- `gain_tracker.status_unlocked` (par status_type)
- `gain_tracker.notification_received`
- `gain_tracker.notification_disabled`

---

## 9. Risques et mitigations

| Risque | Mitigation |
|---|---|
| **Manipulation perçue** | Chiffres réels, calculs transparents (formules visibles dans tooltip "Comment c'est calculé ?"), pas d'exagération |
| **Vexation users lents** | Stats toujours valorisantes (top 30%, "proche moyenne"), jamais "vous êtes dans les derniers". Opt-out possible. |
| **Surcharge cognitive** | 1 notif/jour max, désactivable, animations sobres 300ms |
| **Effet pervers qualité** | Validation cohérence avant export (déjà MVP V1 feature #7) + statuts liés au volume ET qualité (photos prises, check-lists complétées) |
| **Friction signup** (2 questions baseline) | Intégrées dans onboarding J0 existant, pas d'écran séparé. Skip possible (utilise moyenne globale) |
| **Email rapport considéré comme spam** | Resend domain authenticated (SPF/DKIM/DMARC), signature Benjamin humaine, lien désabonnement clair |

---

## 10. Conformité avatar client

**Test final** avant déploiement V1.5 : passer **chaque élément** au test du diagnostiqueur Pierre 43 ans.

> *"Est-ce que Pierre, ex-cadre reconverti, prendrait ce compteur / cette page / ce rapport / cette notification au sérieux ?"*

Si une seule réponse est NON → refondre l'élément.

Cf. [`/docs/avatar-client.md`](avatar-client.md) §7 pour la checklist complète.
