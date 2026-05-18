# Task 0.6 : Recrutement advisor diagnostiqueur (M3-M5)

## Objective

Recruter 1 advisor diagnostiqueur senior selon les termes 0,5-1% BSPCE vesting 2 ans cliff 6 mois pour combler la lacune d'expertise métier interne de Benjamin (Bac+6 hors bâtiment).

## Context

Vague stratégique de gouvernance. Sans advisor diagnostiqueur, Benjamin pilote en aveugle sur 100+ décisions métier Phase 2 (validation ADEME 3CL-2021, modules amiante/plomb/gaz/élec). L'advisor est aussi un signal de crédibilité fort vis-à-vis des bêta-testeurs et investisseurs futurs.

## Dependencies

- Task 0.5 (50 entretiens découverte, 3-5 candidats advisor identifiés M3-M4)

## Blocked By

- Task 0.5 ≥ 30 entretiens réalisés (sinon pas de pool candidats)

## Research Findings

- De `team.md` §2 : profil cible = **10+ ans expérience diagnostic immobilier**, maîtrise Liciel, influence métier (LinkedIn 500+ connexions, formateur), âge 35-50 ans
- De `team.md` §2 : termes = **0,5-1% BSPCE** ou phantom equity, **vesting 2 ans cliff 6 mois**, 1 visio mensuelle obligatoire
- De `team.md` §7 : rituel mensuel — 1er du mois email récap MRR/abonnés/churn/NPS, mid-month visio 1h, retro fin de mois

## Implementation Plan

### Step 1 : Sélection finale 3-5 candidats (M3-M4)

À partir de la shortlist `docs/discovery/advisor-candidates-shortlist.md` produite Task 0.5 :

- Re-évaluer chaque candidat sur 5 critères :
  1. **Expérience** (10+ ans certifié COFRAC ?)
  2. **Maîtrise Liciel** (utilisateur quotidien ?)
  3. **Influence métier** (formateur, conférencier, LinkedIn 500+, syndicat actif ?)
  4. **Affinité tech** (early adopter iPad, IA ?)
  5. **Disponibilité** (peut-il vraiment dédier 1h/mois pendant 2 ans ?)

Note 1-5 sur chaque critère. Cible : 3-5 candidats avec score moyen ≥ 4/5.

### Step 2 : Question pivot (call dédié 30 min)

Pour chaque candidat finaliste, organiser un call 30 min séparé des entretiens découverte initiaux :

**Script** :

> "Bonjour [prénom], merci pour notre entretien précédent. Je voulais te recontacter car j'aimerais avoir ton regard métier régulier sur KOVAS pendant 2 ans.
>
> Ce serait 1h par mois, review de features critiques + validation décisions réglementaires (notamment Phase 2 ADEME 3CL-2021).
>
> En contrepartie :
> - **0,5 à 1% equity via BSPCE** (vesting 2 ans, cliff 6 mois — pour t'éviter de bloquer ton temps si on s'aperçoit après 6 mois que ça ne te convient pas)
> - **Accès gratuit à vie au tier le plus haut KOVAS** (Cabinet 200€/mo équivalent)
> - **Citation publique 'Senior Advisor KOVAS'** sur kovas.fr et LinkedIn officiel
> - **Influence directe roadmap** : tu vois les features en avant-première, tu pèses sur les priorités
>
> Ça t'intéresse de regarder le détail ?"

### Step 3 : Présentation détaillée + négociation (M4)

Pour les candidats intéressés :

- Présentation détaillée KOVAS :
  - Lecture PRD synthétisée (1h de prep envoyée 48h avant)
  - Démo prototype features cœur (vidéo 5 min)
  - Vision Phase 2 + Phase 3 + Phase 4 long terme
  - Économie projetée (ARR M24 1M€, M36 2,77M€) — valoriser l'equity
- Négociation des termes :
  - **0,5% vs 1%** : 0,5% standard, 1% si profil exceptionnel (CEO ex-éditeur diag, par exemple)
  - **Vesting** : 2 ans standard. 4 ans envisageable si advisor demande engagement plus long contre 1% (rare).
  - **Cliff** : 6 mois standard. Garantit pas de cession equity si advisor ne s'investit pas dans les 6 premiers mois.
  - **Citation publique** : non négociable (besoin de la crédibilité)
  - **Confidentialité** : NDA standard (déjà couvert par contrat advisor)

### Step 4 : Rédaction contrat advisor (M4-M5)

Génération via Claude Max (template avocat-free) :

`docs/legal/contrat-advisor-template.md` :

- **Parties** : SASU Nexus 1993 (Benjamin Bel président) + Advisor (personne physique)
- **Mission** : conseil stratégique métier diag immobilier, review features Phase 2 critiques, validation décisions réglementaires
- **Engagements Advisor** :
  - 1 visio mensuelle obligatoire (1h)
  - Disponibilité ponctuelle (~2-4h/mois max)
  - Confidentialité NDA (4 ans post-fin contrat)
  - Non-concurrence pendant durée contrat (ne pas advisor un concurrent direct simultanément)
- **Engagements KOVAS** :
  - Émission **BSPCE 0,5% (ou 1%)** capital social Nexus 1993
  - **Vesting 2 ans linéaire mensuel**, **cliff 6 mois** (libération 25% à M6, puis ~3,125% / mois jusqu'à M24)
  - Accès gratuit à vie tier Cabinet (200€/mo équivalent)
  - Citation publique "Senior Advisor KOVAS"
  - Email récap mensuel MRR/abonnés/churn/NPS (1er du mois)
- **Acceleration clauses** :
  - Acquisition KOVAS : 100% vesting accéléré (single trigger)
  - Mort/invalidité advisor : 100% acquis (humaniste + protection famille)
- **Durée** : 2 ans renouvelable
- **Sortie** : résiliation possible par chacune des parties avec préavis 30j (pas de cession des BSPCE acquis)
- **Droit applicable** : français, juridiction Rouen
- **Section validation avocat Vague 2** : marquer `<!-- AVOCAT VAGUE 2 -->` sur la mécanique BSPCE (formalisme INPI requis ?)

Cross-check : template inspiré de Galion Project (template advisor agreement startup FR) + France Digitale Term Sheet Standard.

### Step 5 : Signature contrat via DocuSeal (M5)

- Génération PDF du contrat finalisé
- Envoi via DocuSeal pour signature simple (SES, suffisant pour ce type d'acte)
- Signature simultanée Benjamin (Nexus 1993) + Advisor
- Archivage PDF signé dans `docs/legal/contrats-signes/advisor-{prenom-nom}-{date}.pdf`

### Step 6 : Onboarding advisor (M5-M6)

- **Lecture PRD synthétisée** envoyée + lecture détaillée par advisor
- **Démo bêta préparée** : accès anticipé à la cohorte bêta privée M6
- **Email récap M0-M4** : ce qui a été décidé, ce qui est ouvert, ce qui se passe sur M5-M9
- **Planning visio mensuelle** : créneau récurrent calé dans Google Calendar
- **Publication officielle** : annonce LinkedIn Benjamin "J'ai le plaisir d'accueillir [Prénom Nom] comme Senior Advisor KOVAS..." (1er post LinkedIn build-in-public mentionant l'advisor)
- **Mise à jour kovas.fr** : ajout section "Équipe" avec Benjamin + Advisor (M6, après signature)

### Step 7 : Émission BSPCE Nexus 1993 (M5-M6)

Formalisme légal SAS pour émission BSPCE :

- AG extraordinaire SAS Nexus 1993 (Benjamin associé unique → décision unilatérale possible)
- Modification statuts si nécessaire (capital autorisé BSPCE)
- Déclaration INPI / greffe (procédure standard SASU)
- **À valider avec expert-comptable** (cf. `team.md` §6 : "Comptable : Expert-comptable Dieppe, ~80-150€/mo")
- Coût formalisme : ~300-500€ frais notaire/greffe

⚠️ **Important** : section nécessite validation avocat Vague 2 (M9-M18) pour confirmer formalisme BSPCE correct. Phase 1 = signer contrat + procédure standard, formalisation BSPCE finalisée Vague 2.

## Files to Create

- `docs/legal/contrat-advisor-template.md` (template générique)
- `docs/legal/contrats-signes/advisor-{prenom-nom}-{date}.pdf` (signature DocuSeal archivée)
- `docs/team/advisor-onboarding.md` (checklist onboarding)
- `docs/team/advisor-monthly-template.md` (template email récap mensuel)

## Files to Modify

- `apps/web/src/app/equipe/page.tsx` : ajouter section advisor (Task ultérieure Sprint MVP J14 ou M6)
- `docs/legal/relecture-checklist.md` : ajouter "BSPCE formalisme" à la checklist avocat Vague 2

## Contracts

### Provides (for downstream tasks)

- **Advisor onboardé** : visibilité publique kovas.fr (Task 5.1 ou M6)
- **Validation features Phase 2** : input critique avant lancement DPE ADEME (Phase 9 produit)
- **Influence roadmap** : check-points mensuels modifient priorités si nécessaire

## Acceptance Criteria

- [ ] 3-5 candidats finalistes shortlistés (post-Task 0.5)
- [ ] 3-5 calls "question pivot" effectués (M4)
- [ ] 1 advisor recruté avec contrat signé (BSPCE 0,5-1%, vesting 2 ans, cliff 6 mois)
- [ ] Citation publique "Senior Advisor KOVAS" planifiée pour M6 launch bêta privée
- [ ] Email récap mensuel template prêt + planning visio mensuelle calé
- [ ] Section "BSPCE formalisme" marquée pour validation avocat Vague 2

## Testing Protocol

### Validation candidat

- 5 critères notés ≥ 4/5 (cf. Step 1)
- Tour de table 1h démo + Q&A : advisor comprend Phase 2 ADEME complexité
- Test cohérence personnalité : compatible avec Benjamin's working style (intensité sprints, IA-first, etc.)

### Validation contrat

- Relecture critique vs template Galion Project (standard FR)
- Cross-check formalisme BSPCE : appel expert-comptable Dieppe
- Section avocat Vague 2 : marquée `<!-- AVOCAT VAGUE 2 -->` clairement

## Skills to Read

- Aucune skill formelle. Lire `team.md` §2-9 complet.

## Research Files to Read

- Aucune (purement governance/équipe)

## Git

- Branch : `feature/0-6-recrutement-advisor`
- Commit message prefix : `Task 0.6:`

## Notes anti-pattern

- ⛔ Ne PAS recruter advisor < 10 ans expérience (manque crédibilité métier)
- ⛔ Ne PAS donner > 1% equity sauf profil exceptionnel (= dilution excessive solo founder)
- ⛔ Ne PAS skipper le cliff 6 mois (protection contre advisor qui se désintéresse)
- ⛔ Ne PAS embaucher en CDI ou freelance — strictement advisor (cf. team.md §9 : pas de salariat pré-revenu)
- ⛔ Ne PAS choisir un advisor concurrent direct (ex: dirigeant d'un concurrent Liciel/Enersweet)
- ⛔ Ne PAS skipper la non-concurrence (advisor ne doit pas advisor un concurrent direct simultanément)
- ⛔ Ne PAS oublier le cas mort/invalidité (acceleration humaniste indispensable)
