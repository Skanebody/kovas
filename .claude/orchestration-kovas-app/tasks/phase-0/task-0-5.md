# Task 0.5 : 50 entretiens découverte LinkedIn + ADEME (M0-M5)

## Objective

Conduire 50 entretiens découverte (30 min chacun, semi-structurés) avec diagnostiqueurs immobiliers FR pour valider le pitch, le pricing, les features et identifier 3-5 candidats advisor diagnostiqueur senior. Construire la base initiale de leads (1ère cohorte bêta-testeurs M6).

## Context

Cette task tourne **en parallèle** des tasks de setup tech (0.1-0.4, 0.7-0.9) pendant M0-M5. C'est le pilier customer discovery sans lequel le sprint MVP risque de partir à côté. Stack outreach optimisée par fondateur (Sales Nav remplacé par annuaire ADEME public).

## Dependencies

- Task 0.1 (LinkedIn Premium Business + Google Workspace + Supabase Free)

## Blocked By

- Task 0.1 (compte LinkedIn Premium pour InMails + Supabase pour CRM custom)

## Research Findings

- De `CLAUDE.md` §2 : ~13 000 diagnostiqueurs immobiliers indépendants FR (annuaire ADEME public scrapable)
- De `gtm.md` §2 Canal 1 : stack outreach ~60€/mo (LinkedIn Premium + Playwright + Claude API + Supabase CRM) vs 99€/mo Sales Nav
- De `team.md` §2 : profil advisor cible = 10+ ans, maîtrise Liciel, influence métier, 35-50 ans, équité 0,5-1% BSPCE
- De `gtm.md` §2 sécurité LinkedIn : chauffe préalable (500+ connexions), max 80-100 msgs/jour, délais randomisés
- De `pricing-strategy.md` §11 + CLAUDE.md §6 : essai 14j sans CB, tier Découverte 29€ d'entrée + Standard 59€ recommandé + Volume 99€

## Implementation Plan

### Step 1 : Scrape annuaire ADEME ministère via Playwright (J0-J5)

L'annuaire des diagnostiqueurs certifiés ADEME est public.

- URL annuaire : à identifier précisément M0 (vérifier ADEME observatoire DPE ou registre COFRAC)
- Playwright agent custom :
  - Navigation systématique par département (01-95 + DOM)
  - Extraction : nom, prénom, certifications actives, email pro, téléphone, raison sociale, SIRET, adresse cabinet
  - Stockage Supabase table `leads_diagnostiqueurs`
  - **RGPD compliance** : données publiques + base légale "intérêt légitime" pour prospection B2B, mais opt-out facile dans 1er message
- Volume cible : 5 000+ diagnostiqueurs ciblables sur les 13 000 total (filtrer < 40 ans probable + zones géo non-saturées Liciel)

Schéma table Supabase :

```sql
CREATE TABLE leads_diagnostiqueurs (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  source          text NOT NULL DEFAULT 'ademe',  -- 'ademe', 'linkedin', 'referral'
  first_name      text,
  last_name       text,
  email           text,
  phone           text,
  company         text,
  siret           text,
  address         text,
  city            text,
  postal_code     text,
  department      text,
  certifications  text[],
  linkedin_url    text,
  status          text DEFAULT 'new',  -- new, contacted, replied, interviewed, beta_invited, declined, opted_out
  contacted_at    timestamptz,
  replied_at      timestamptz,
  interview_at    timestamptz,
  interview_notes text,
  is_advisor_candidate boolean DEFAULT false,
  is_beta_candidate boolean DEFAULT false,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_leads_status ON leads_diagnostiqueurs (status);
CREATE INDEX idx_leads_advisor ON leads_diagnostiqueurs (is_advisor_candidate) WHERE is_advisor_candidate;
```

### Step 2 : Enrichissement LinkedIn (J5-J15)

Pour les 1 000 leads prioritaires (filtrage : < 40 ans probable, géo non-Dieppe pour éviter conflit local Benjamin) :

- Lookup LinkedIn URL via Playwright (recherche par nom + ville)
- Stockage URL profil dans `leads_diagnostiqueurs.linkedin_url`
- Optionnel : screenshot profil (résumé bio + connexions) stocké Supabase Storage

### Step 3 : Préparation message outreach personnalisé par Claude API

Template message LinkedIn (~250 caractères max) :

```
Bonjour {first_name},

J'ai vu sur l'annuaire ADEME que tu fais du diagnostic immobilier dans la région {city}.

Je construis KOVAS, une app iPad qui ajoute saisie vocale + photos IA à ton logiciel actuel (1h30 économisée/mission).

Tu as 15 min pour me dire ce qui te frustre le plus dans Liciel ? Je t'invite en bêta gratuite.

Benjamin
```

Personnalisation par Claude Haiku 4.5 :
- Si LinkedIn profile mentionne {expérience>10ans, formateur, etc.} → adapter ton
- Si zone {urbaine, rurale} → adapter angle (gain de temps déplacements rural)
- Si {a déjà critiqué Liciel publiquement} → adapter intensité

Coût Claude : ~0,002€/personnalisation × 1 000 = ~2€ total.

### Step 4 : Envoi outreach LinkedIn (J15-M3, étalé sur 6 semaines)

- **Sécurité LinkedIn** (cf. gtm.md §2 Canal 1) :
  - Chauffe préalable : Benjamin doit avoir 500+ connexions naturelles avant démarrage outreach
  - Max **80-100 messages/jour** (sinon ban LinkedIn possible)
  - Délais randomisés entre actions : 3-15 min
  - Activité humaine en parallèle (likes, commentaires posts diag, partages)
- **Cadence** :
  - 80 messages/jour × 22 jours/mois × 1,5 mois = **2 640 messages envoyés sur 6 semaines**
  - Taux réponse cible : 5% → **~130 réponses**
  - Conversion réponse → entretien planifié : 50% → **~65 entretiens planifiés**
  - Réalisation : ~80% → **~50 entretiens effectifs** ✅ cible atteinte

### Step 5 : Guide d'entretien semi-structuré (30 min)

`docs/discovery/guide-entretien.md` :

**Intro (3 min)** :
- Présentation Benjamin + KOVAS (90s pitch)
- Demander : profil métier, ancienneté, volume missions/mois, logiciel actuel

**Découverte douleurs (10 min)** :
- "Décris-moi ta dernière mission DPE en détail — étape par étape"
- "Qu'est-ce qui te fait perdre le plus de temps ?"
- "Qu'est-ce qui te frustre le plus dans Liciel/AnalysImmo/OBBC ?"
- "Si tu pouvais changer une seule chose dans ton métier demain, ce serait quoi ?"

**Validation pricing (5 min)** :
- "Combien tu paies aujourd'hui pour ton logiciel principal ?"
- "Si une app iPad te faisait gagner 1h30/mission, tu paierais combien EN PLUS de Liciel ?"
- Test 29€ (Découverte) / 59€ (Standard) / 99€ (Volume) — lequel correspond à ton volume ?
- Test 14j essai sans CB — friction OK ?

**Validation features (10 min)** :
- Démo vidéo 60s prototype features cœur (vocal + photos + croquis + exports)
- "Quelle feature tu utiliserais le plus ?"
- "Qu'est-ce qui te manquerait pour passer à KOVAS ?"
- Vision IA (Phase 2 V2) — intérêt ? Doit-elle être P0 ou OK reporter V2 ?

**Closing (2 min)** :
- "Tu veux faire partie des 40 bêta-testeurs gratuits M6 ?" → si oui, ajouter beta_invited = true
- Pour 3-5 candidats avec profil advisor (10+ ans, influence, etc.) : question pivot advisor (cf. team.md §2)
- Remerciement + planning suivi

### Step 6 : Compte-rendu structuré dans Supabase + Notion

Pour chaque entretien :

- Mise à jour `leads_diagnostiqueurs` :
  - `status = 'interviewed'`
  - `interview_at` = timestamp
  - `interview_notes` = compte-rendu structuré (sections : douleurs, pricing, features, advisor potential)
  - `is_advisor_candidate` = true/false
  - `is_beta_candidate` = true/false

- Notion DB structurée pour analyse cross-entretiens :
  - Themes douleurs récurrentes (top 5)
  - Distribution willingness-to-pay par tier
  - Features les plus demandées vs moins
  - Profils advisor candidates (3-5)

### Step 7 : Synthèse Discovery + ajustements PRD/pricing (M4-M5)

Après 30 entretiens minimum (~M3) :

- Synthèse Claude Max sur 30 comptes-rendus
- Validation/ajustement assumptions :
  - Pricing : 29€/59€/99€ confirmé ou à revoir ?
  - Conversion essai cible 22-28% : valider
  - Top 3 features = vocal + exports + croquis ?
  - Vision IA repoussée V2 : OK pour les diagnostiqueurs ?
- Si ajustements nécessaires : update PRD + DISCOVERY.md avant Sprint MVP J1

## Files to Create

- `agents/linkedin-outreach/scrape-ademe.ts` (Playwright + scrape annuaire ADEME)
- `agents/linkedin-outreach/personalize-message.ts` (Claude API + template)
- `agents/linkedin-outreach/send-linkedin.ts` (Playwright LinkedIn automation, throttled)
- `docs/discovery/guide-entretien.md` (template semi-structuré 30 min)
- `docs/discovery/entretiens-decouverte.md` (compte-rendus consolidés Notion mirror)
- `docs/discovery/synthese-30-entretiens.md` (analyse cross-cas M3)
- `docs/discovery/synthese-50-entretiens.md` (analyse finale M5)
- `docs/discovery/advisor-candidates-shortlist.md` (3-5 candidats détaillés)

## Files to Modify

- `supabase/migrations/<timestamp>_add_leads_diagnostiqueurs.sql` (création table)
- `DISCOVERY.md` : ajouter section "Validation 50 entretiens" + ajustements potentiels (post-M5)
- `PRD.md` : ajustements si nécessaires post-discovery

## Contracts

### Provides (for downstream tasks)

- **Liste 40-50 bêta-testeurs invités** (Task 6.1 Onboarding bêta)
- **3-5 advisor candidates** (Task 0.6 Recrutement advisor)
- **Validation/ajustement pricing 4 tiers** (Sprint MVP J13 Stripe products)
- **Top 5 features confirmées P0 MVP** (Sprint MVP J3-J14)

## Acceptance Criteria

- [ ] Annuaire ADEME scrapé : 5 000+ leads dans `leads_diagnostiqueurs`
- [ ] 1 000 leads prioritaires enrichis LinkedIn URL
- [ ] 2 640 messages outreach LinkedIn envoyés sur 6 semaines (~80/jour)
- [ ] Taux réponse ≥ 5% (~130 réponses)
- [ ] **50 entretiens réalisés** avec compte-rendus structurés
- [ ] 3-5 candidats advisor identifiés (`is_advisor_candidate = true`)
- [ ] 40-50 bêta-testeurs candidats engagés (`is_beta_candidate = true`)
- [ ] Synthèse M3 (30 entretiens) + M5 (50 entretiens) produites
- [ ] Pricing 4 tiers validé ou ajusté
- [ ] LinkedIn compte Benjamin pas banni (sécurité respectée)

## Testing Protocol

### Métriques de pilotage (PostHog ou Notion)

- Taux réponse outreach : ≥ 5%
- Taux complétion entretien (réponse → entretien réalisé) : ≥ 80%
- NPS interne du pitch (estimé à partir des entretiens) : ≥ 50
- Distribution willingness-to-pay : ≥ 30% acceptent 59€/mo (Standard)

### Sécurité LinkedIn

- Vérifier hebdomadairement : compte LinkedIn pas restreint
- Si avertissement LinkedIn : pause immédiate 7 jours
- Délais randomisés entre actions : `Math.random() * (15-3) + 3` minutes

### RGPD

- Confirmer base légale "intérêt légitime" documentée
- Opt-out facile dans 1er message : "Tu peux me dire stop, je n'écris plus."
- Si opt-out : `status = 'opted_out'`, suppression de la liste

## Skills to Read

- Aucune skill formelle, mais lire `gtm.md` §2 Canal 1 + `team.md` §2 (recrutement advisor)

## Research Files to Read

- `gtm.md` Canal 1 (stack outreach optimisé)
- `team.md` (profil advisor)

## Git

- Branch : `feature/0-5-discovery-50-interviews`
- Commit message prefix : `Task 0.5:`
- Note : agents/ scripts dans repo principal, comptes-rendus dans docs/discovery/

## Notes anti-pattern

- ⛔ Ne PAS envoyer > 100 messages/jour LinkedIn (ban quasi-certain)
- ⛔ Ne PAS skipper la chauffe préalable (500+ connexions) — déclenche détection automation
- ⛔ Ne PAS biaiser les entretiens (questions fermées, leading questions) — découverte authentique requise
- ⛔ Ne PAS oublier la base légale RGPD prospection B2B (intérêt légitime + opt-out facile)
- ⛔ Ne PAS pitcher KOVAS comme "remplaçant Liciel" — strictement "compagnon" Phase 1 (defense strategy)
- ⛔ Ne PAS skipper la question advisor à 3-5 candidats potentiels M3-M4 (sinon recrutement décalé)
- ⛔ Ne PAS oublier de scraper l'annuaire ADEME (pas LinkedIn seul — 13 000 leads complets vs ~2 000 sur LinkedIn)
