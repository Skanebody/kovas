# KOVAS — Go-to-Market Plan

**Date** : 2026-05-18
**Statut** : Authority document GTM
**Référencé par** : CLAUDE.md §17 (bêta), PRD §11

---

## 1. Funnel cible M0-M12

| Étape | Volume cible M12 | Conversion |
|---|---|---|
| Impressions LinkedIn + SEO + outreach | ~500 000 | - |
| Visites kovas.fr | ~15 000 | 3% |
| **Signups essai gratuit 14j** | **800-1 000** | 5-7% des visites |
| Activation (1ère mission complète) | 500-650 | 60-65% des signups |
| **Conversion essai → payant** | **140-170** | **22-28% des signups (M0-M6) → 18-25% (M6-M12)** |

---

## 2. Canaux d'acquisition (révisés)

### Canal 1 — LinkedIn outreach automatisé (cœur stratégie M0-M9)

**Stack alternatif optimisé (60€/mo vs 99€/mo Sales Nav)** :

| Composant | Coût/mo | Rôle |
|---|---|---|
| **Annuaire ADEME ministère scrapé via Playwright** | 0€ | Source primaire — 13 000 diagnostiqueurs certifiés avec coordonnées + SIRET (données publiques officielles) |
| LinkedIn Premium Business | 50€ | Enrichissement profils + 30 InMails + stats |
| Agent Playwright custom + Claude API | 10€ (Railway) | Personnalisation + envoi automatisé |
| Supabase CRM custom (tracking leads) | inclus dans abo | Status, réponses |

**Volume cible** : 100 messages/jour × 22 jours = **2 200 contacts/mois**
**Sécurité compte LinkedIn** : chauffe préalable (500+ connexions naturelles), max 80-100 msgs/jour, délais randomisés (3-15 min entre actions), activité humaine en parallèle (likes, commentaires posts diag).

**Bascule vers Sales Navigator Core 99€/mo M6+** si :
- Volume passe à 400+ messages/semaine, OU
- Besoin Smart Links tracking, OU
- 200+ abonnés payants validés

### Canal 2 — Contenu LinkedIn perso (Build in public)

Cadence : **3 posts/semaine M0-M3, 5/semaine M3-M9**.

Sujets :
- Avancement produit transparent
- Insights métier diagnostiqueurs
- Insights pricing/business KOVAS
- Témoignages bêta-testeurs (M7+)

**Effort** : 4h/sem (rédaction Claude + relecture + interaction commentaires).

### Canal 3 — SEO + content marketing (long-terme M3+)

**Stratégie** : ranker sur ~30 requêtes métier :
- "alternative Liciel"
- "logiciel DPE iPad"
- "DPE en moins de 30 minutes"
- "saisie vocale diagnostic immobilier"
- "exporter Liciel en iPad"
- etc.

**Rythme** :
- M0-M3 : 8 articles socle (1 500-2 500 mots, Claude génération + relecture fondateur)
- M3-M9 : 2 articles/semaine
- M9+ : 4 articles/mois en régime stationnaire

**Backlinks** : posts forum diagnostic (avec discrétion sur KOVAS), fédérations, échange avec blogs tech immo.

**Trafic SEO cible** : 5 000 visites/mois M12, 15 000 visites/mois M18.

### Canal 4 — Partenariats fédérations (M2+)

**Cibles** :
- Fédération SIDIANE
- FIDI
- Autres syndicats métier régionaux

**Format** : webinaire mensuel co-organisé "Comment l'IA transforme le métier de diagnostiqueur".
**Offre** : code promo dédié -20% 1ère année pour membres.

### Canal 5 — Programme de parrainage (M3+)

**Mécanique** :
- 1 mois offert au parrain pour chaque nouvel abonné
- 1 mois offert au filleul à l'inscription

**Cible** : 5-15 conversions/mois M6+ via parrainage.

**Cohérent avec marché niche très connecté** (les diagnostiqueurs se connaissent en région).

### Canal 6 — Salons métier (M9+)

- **SIDIANE annuel** (octobre)
- FIDI events
- Salons régionaux

**Démo iPad + offre salon -30% 6 mois**.

### Canal 7 — ⚠️ PAS de programme ambassadeurs formel

**Décision** : pas de programme ambassadeurs formalisé.

**Rationale** : positioning "bouche-à-oreille via produit qui résout une vraie douleur". Le tier Founder à vie (49€ Standard) + le programme de parrainage suffisent comme leviers d'avocacy.

---

## 3. CAC réaliste par canal

| Canal | Coût/mois | Volume signups | CAC effectif (essai) |
|---|---|---|---|
| LinkedIn outreach | 800€ (60€ infra + ~5h temps × 4 sem × 100€/h) | 40-60 | **~85€** |
| Contenu LinkedIn perso | 400€ (4h/sem × 100€/h) | 10-20 | **~30€** |
| SEO/content (M6+ régime) | 1 200€ (5h/sem × 100€/h) | 5-30 | **~50€** |
| Partenariats fédérations | 0€ (échange visibilité) | 10-20 | **~0€** |
| Parrainage | 30-60€/conv | Variable | **~30-60€** |
| Ads (Google + Meta, test M9+) | 500€/mo test | 20-30 | **~200-250€** |

**CAC essai blended** : **~80€**
**CAC payant blended** : **~400€** (conversion 22-28%)

---

## 4. Roadmap content marketing

| Mois | Articles SEO | Webinars | Posts LinkedIn fondateur |
|---|---|---|---|
| M0-M3 | 8 articles socle (alternatives Liciel, audit énergétique, DPE, etc.) | - | 3/sem (build in public) |
| M3-M6 | +8 articles (cas d'usage, comparatifs, tutos) | 1 webinar test | 3/sem |
| M6-M9 | +16 articles (longue traîne, ranking) | 2 webinars co-organisés | 5/sem |
| M9-M12 | Régime de croisière 4/mois | 1/mois | 5/sem |

---

## 5. Plan de lancement public M9

### T-30 jours (M8)

- Campagne teasing LinkedIn fondateur
- Emails listes acquises ("vous étiez en bêta, on lance officiellement")
- Préparation Product Hunt (texte + visuel + démo vidéo)
- Préparation presse spécialisée (Le Mag de l'Immo, Quotidiag, etc.)

### J0 (lancement M9)

- Annonce LinkedIn + Product Hunt
- Communiqué presse spécialisée
- Email aux 500-1 000 leads accumulés depuis M3 (essai 14j ouvert)

### T+30 jours

- Campagne paid LinkedIn (1 500€ budget test)
- Campagne paid Google Ads test (500€ budget test)
- Premier webinar grand public

### T+60 jours

- 2ème webinar
- Bilan métriques + ajustement canaux

---

## 6. Mode bêta privée fermée (M6-M9)

### Phase A — M6 à M7 (1 mois) : GRATUITE

- Tests fonctionnels intensifs
- Identification bugs critiques
- 1 visio mensuelle obligatoire avec Benjamin
- Charte bêta-testeurs signée à l'entrée

### Phase B — M7 à M9 (2 mois) : tier Découverte 29€/mo

- Validation économique willingness-to-pay
- Filtre sérieux vs opportunistes
- Premiers revenus cash-flow positif dès M7

### À M9+ (lancement public)

- Founders passent au tarif Founder à vie : Standard 49€/mo (70 missions, surplus 1€)
- Cabinet Phase 2 Founder : 169€/mo à vie
- Nouveaux clients au tarif public (Découverte / Standard / Volume)

---

## 7. Onboarding 14 jours essai gratuit

### Étape 1 — Signup (J0, 0-3 min)

1. Landing kovas.fr → CTA "Essayer 14 jours gratuit"
2. Email pro + SIRET vérifié API INSEE (anti-abus essai)
3. Confirmation email + premier login
4. Questionnaire 3 questions :
   - "Quel logiciel utilises-tu aujourd'hui ?" (Liciel / AnalysImmo / OBBC / ORIS / Autre)
   - "Combien de missions par mois en moyenne ?" → suggestion tier (Découverte/Standard/Volume)
   - "Quel iPad utilises-tu ?" (modèle pour optimiser UI)

### Étape 2 — Tour produit guidé (J0, 3-10 min)

- Vidéo bienvenue 90s "Comment KOVAS te fait gagner 1h30 par mission"
- Tour interactif sur 5 écrans clés :
  1. Création mission (auto-complétion adresse BAN)
  2. Saisie vocale terrain
  3. Photos géolocalisées + croquis 2D
  4. Synthèse + export multi-format
  5. Tableau de bord

### Étape 3 — Première mission test (J0, 10-15 min)

- Données fictives pré-remplies : adresse Paris, type DPE vente, surface 65m²
- Tooltips contextuels
- À la fin : génération exports test (PDF + ZIP Liciel + Word) + email confirmation

### Étape 4 — Première mission réelle (J0-J3)

- Si user crée une vraie mission < 48h → activation réussie
- Sinon → email auto J+2 "Besoin d'aide ?"

### Séquence emails (J+1 / J+4 / J+8 / J+11 / J+13)

| Jour | Type | Sujet |
|---|---|---|
| J+1 | Auto | Tutoriel "Première mission réussie" |
| J+4 | **Humain (Benjamin)** | Check personnel |
| J+8 | Auto | "Comment ça se passe ?" + tips |
| J+11 | Auto | "Plus que 3 jours, voici votre offre" |
| J+13 | Auto | "Demain dernier jour" |

### Conversion à J14

- Choix : Découverte 29€ / Standard 59€ (recommandé) / Volume 99€
- Sans conversion : compte gelé 90j, données conservées

---

## 7bis. Gain Tracker — Levier d'engagement et viralité (V1.5)

> **Document détaillé** : [`/docs/gain-tracker-system.md`](../../docs/gain-tracker-system.md)

Le système Gain Tracker (déployé sprints 15-17 post-launch) devient un canal d'acquisition organique majeur via partages LinkedIn.

### Viralité par partages LinkedIn

**Mécanique** :

1. Utilisateur consulte son rapport mensuel (taux ouverture email cible 60-75%)
2. Bouton "Partager mon rapport sur LinkedIn" génère image 1080×1080 sobre
3. Texte LinkedIn pré-rédigé professionnel (modifiable) inclut `kovas.fr` + hashtags métier
4. Diagnostiqueur poste sur son réseau LinkedIn (pair-à-pair, B2B vertical FR)

**Taux cible partage** :
- M6 : 15% des utilisateurs partagent au moins 1 rapport mensuel sur LinkedIn
- M12 : 30%

**Audience touchée** :
- Diagnostiqueurs ont en moyenne 200-500 connexions LinkedIn pro
- 30% des connexions sont elles-mêmes diagnostiqueurs (réseau métier)
- Taux clic vers kovas.fr cible : 0,5-1% des vues = 1-2 nouveaux leads par partage

**Calcul coefficient viral K** :

| Hypothèse | Valeur |
|---|---|
| Taux partage mensuel | 30% (M12) |
| Connexions diag dans réseau LinkedIn | ~100 (30% de 333 connexions moyennes) |
| Taux vue post LinkedIn | 25% (algorithme) |
| Vues par post = 100 × 25% = | 25 vues diag |
| Taux clic → signup essai | 4% |
| Conversion essai → payant | 22% |
| **Nouveau payant par partage** | **25 × 4% × 22% = 0,22** |
| **Partages par mois (par user) | 0,3 (30% × 1 fois)** |
| **Nouveau payant / mois / user** | **0,07** |
| K-factor lifetime (24 mois LTV) | **K = 0,07 × 24 ≈ 1,68** |

**Cible K = 1,5 atteignable** avec adoption rapport mensuel.

### Stratégie de viralité complémentaire

- **Témoignages publics** sollicités auprès du statut "Fidèle KOVAS" (1 an utilisation) — opt-in
- **Programme parrainage** intégré (statut "Ambassadeur" après 3 parrainages réussis) — cohérent avec gtm.md §2 Canal 5
- **Co-contenu LinkedIn** avec utilisateurs power (vidéos témoignages, études de cas chiffrées)

### Story marketing autour du gain de temps mesurable

**Angle narratif** :

> *"Pierre, 47 ans, ex-cadre reconverti diagnostiqueur depuis 4 ans. Avant KOVAS : 21h le soir au bureau. Avec KOVAS : 18h30 à la maison. **2h30 récupérées chaque jour.** 231h économisées depuis 8 mois = 28 jours de travail libérés."*

**À utiliser dans** :
- Page d'accueil kovas.fr (témoignages chiffrés)
- Posts LinkedIn fondateur (build in public)
- Webinaires mensuels (cas concrets)
- Articles SEO "ROI diagnostiqueur"

**À ÉVITER** (cf. `/docs/avatar-client.md`) :
- Ton "lifestyle" / "you deserve it"
- Marketing manipulatoire émotionnel
- Promesses non démontrables ("révolutionnez votre business")

## 8. Cibles conversion essai → payant (glissante)

| Période | Cible conversion | Pilotage |
|---|---|---|
| **M0-M6** | **22-28%** | Audience préqualifiée via outreach LinkedIn + ADEME |
| **M6-M12** | **18-25%** | Phase d'élargissement audience (SEO + ads) |
| **M12+** | **20-25%** | Remontée par maturité produit + social proof + parrainage |

**Alertes PostHog** : déclenchement si conversion descend sous **15% (M0-M6), 12% (M6-M12), 15% (M12+) pendant 2 mois consécutifs** → review acquisition + onboarding.

---

## 9. Métriques GTM à instrumenter (PostHog J0)

### Acquisition

- Visites kovas.fr (par canal)
- Signups essai (par canal)
- Coût par signup (par canal)
- Funnel landing page → signup → activation → payant

### Activation

- Time-to-first-value (TTFV) : < 15 min
- Activation rate 7j : ≥ 60%
- Activation rate 30j : ≥ 80%

### Conversion

- Taux conversion essai → payant (par canal, par cohorte mensuelle)
- Choix de tier à la conversion (% Découverte / Standard / Volume)
- Délai moyen de conversion (J0 → conversion)

### Retention

- Churn mensuel cible :
  - < 7% M1-M6
  - < 5% M7-M12
  - < 3% M13+
- Rétention cohorte M6 : > 75%
- DAU/MAU : > 35%

### Satisfaction

- NPS : ≥ 50 M6, ≥ 60 M12
- CSAT chat support IA : ≥ 4,5/5

---

## 10. Risques GTM & mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| LinkedIn ban compte automation | MEDIUM | Sales Nav officiel (M6+), chauffe préalable, jamais compte fondateur direct sur outreach |
| SEO lent (< 1 000 visites M6) | HIGH | Doubler budget content + backlink building manuel, pivoter sur newsletter LinkedIn |
| Pas de partenariats fédérations | MEDIUM | Aller direct via groupes Facebook/Discord métier |
| Conversion essai < 15% (signal alarm) | MEDIUM | Review onboarding + ajout tour vidéo + amélioration tooltips |
| Cannibalisation Standard 59€ par Découverte 29€ | LOW | Quota Découverte 20 missions = friction naturelle, suggestion upgrade auto à 80% quota |
| Liciel/Enersweet contre-attaque tarifaire | LOW | KOVAS différencié sur IA + UX, pas sur prix |
