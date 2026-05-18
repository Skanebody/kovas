# Task 0.9 : Hiscox RC Pro + extension PI souscrite (M5)

## Objective

Souscrire la RC Pro Hiscox avec extension Propriété Intellectuelle obligatoire **avant le lancement bêta privée M6**, pour couvrir les risques pendant la cohorte de 40-50 utilisateurs externes et le lancement public M9+.

## Context

Sans assurance RC Pro avec extension PI, un bug KOVAS qui fait perdre un DPE à un utilisateur = responsabilité personnelle Benjamin Bel + Nexus 1993. Une mise en demeure Liciel = 350€/h avocat de poche. Hiscox = 900€/an pour 500k€/sinistre 1M€/an + extension PI 100k€.

## Dependencies

- Tasks 0.1-0.8 (toutes : entreprise prête à exposer un produit aux utilisateurs externes)

## Blocked By

- Tasks 0.1-0.8 (souscription Hiscox = dernière étape avant bêta M6)

## Research Findings

- De `CLAUDE.md` §15 + `kovas-defense-strategy.md` §2.7 : Hiscox direct, souscription **différée à M5 juste avant bêta**, ~900€/an Année 1
- De `CLAUDE.md` §15 : Pack RC Pro Numérique + Cyber + Protection juridique avec **extension PI obligatoire** (+200-400€)
- De `kovas-defense-strategy.md` §2.7 : Phase 2 upgrade plafonds 2M€/5M€ + sous-couverture "Responsabilité diagnostic immobilier certifié" (M10+ post-ADEME)

## Implementation Plan

### Step 1 : Devis Hiscox direct (J0-J2)

- Site : https://www.hiscox.fr/ → Devis en ligne RC Pro
- Catégorie : **Éditeur de logiciels / SaaS B2B**
- Activité : "Édition d'application iPad/iPhone/Web pour diagnostic immobilier, intégrant intelligence artificielle (vocal + photos), exports multi-format vers logiciels tiers"
- CA prévu Année 1 : 0-50k€ (conservateur)
- CA prévu Année 2 : 100-500k€
- Statut juridique : SASU Nexus 1993 (Dieppe, FR)
- Date démarrage activité : avril 2026

### Step 2 : Configuration pack cible

**Plafonds Phase 1 (M5-M18)** :

| Couverture | Plafond |
|---|---|
| Plafond global / sinistre | **500k€** |
| Plafond global / année | **1M€** |
| Franchise | 500€ |

**Sous-couvertures obligatoires** :

| Sous-couverture | Plafond | Justification |
|---|---|---|
| Cyber | 500k€ | Fuite données utilisateurs RGPD |
| **RGPD violation (amendes CNIL)** | 50k€ | Couvre amende CNIL jusqu'à 4% CA |
| Défense juridique | 100k€ | Avocat Vague 2 + référé si Liciel attaque |
| **Erreurs IA explicite inclusion** | inclus | "Logiciels d'aide à la décision" — couvre erreur Whisper/Claude |
| **Litiges IP (extension PI)** | **100k€** | **Critique** : couvre mise en demeure Liciel + procès |

**Périmètre géographique** : France + UE (en prévision Phase 4 export BE/CH/LU)

**Exigences explicites à vérifier auprès de l'agent Hiscox** :

1. Couverture des dommages causés par l'IA (Claude Vision, Whisper) inclus explicitement
2. Couverture des sous-traitants tech (Anthropic, OpenAI, Supabase) — clause de cascade de responsabilité
3. Périmètre géographique : FR + UE
4. **Extension PI confirmée** (+200-400€/an) : couvre contrefaçon + parasitisme + concurrence déloyale
5. Couverture cyber suffisante pour gérer une fuite RGPD jusqu'à 50k€ d'amende CNIL

### Step 3 : Négociation tarif

- Prime cible Année 1 : **~900€/an** (cf. CLAUDE.md §15)
- Si devis > 1 200€ : négocier (souvent possible -10 à -20%)
- Comparer 2-3 devis alternatifs : AssurUp, Wakam, courtier local (April/Generali)
- Critère décision : Hiscox direct si tarif compétitif ET extension PI claire dans la police

### Step 4 : Lecture détaillée police + validation

Avant signature, vérifier la police Hiscox sur :

- [ ] Extension PI explicitement inclus dans la police (texte précis)
- [ ] Plafonds 500k€/1M€ confirmés (pas restriction cachée)
- [ ] Sous-couvertures listées (cyber 500k€, RGPD 50k€, défense 100k€, erreurs IA, IP 100k€)
- [ ] Périmètre géographique FR + UE
- [ ] Franchise raisonnable (500€)
- [ ] Pas d'exclusion "logiciel piloté par IA" (réversion clause possible vu nouveauté IA)
- [ ] Clause sous-traitants tech : cascade responsabilité OK

Si une exclusion problématique : demander avenant ou changer d'assureur.

### Step 5 : Souscription + paiement

- Signature police via DocuSeal ou portail Hiscox (signature électronique simple suffisante)
- Paiement annuel (~900€) prélèvement Qonto Nexus 1993
- Archivage police PDF : `docs/legal/hiscox-police-rc-pro-{date}.pdf`
- Numéro de police + plafonds + dates couverture : `docs/legal/assurance-summary.md`

### Step 6 : Plan upgrade Phase 2 + 3 (planning futur)

`docs/legal/assurance-summary.md` (préparation upgrades) :

```markdown
# Assurance RC Pro KOVAS — Planning évolutif

## Phase 1 (M5-M18)
- Plafonds : 500k€/sinistre, 1M€/an
- Pack : RC Pro Numérique + Cyber + Protection juridique + extension PI
- Prime : ~900€/an
- Renouvellement annuel

## Phase 2 (M10+ post-validation ADEME)
- Trigger : validation ADEME 3CL-2021 obtenue (~M14-M18)
- Upgrade plafonds : 2M€/sinistre, 5M€/an
- Sous-couverture ajoutée : **"Responsabilité diagnostic immobilier certifié"** 1M€
- Prime estimée : 2 500-3 500€/an
- Action : contacter Hiscox 30j avant validation ADEME pour planifier upgrade

## Phase 3 (M19+ marketplace MAR/RGE)
- Trigger : lancement marketplace (M19+)
- Upgrade plafonds : 3M€/sinistre, 10M€/an
- Sous-couverture ajoutée : **"Plateforme mise en relation"** 2M€
- Prime estimée : 4 000-6 000€/an

## Renouvellement annuel — checklist
- [ ] Comparer 2-3 devis alternatifs (concurrence Hiscox)
- [ ] Vérifier que tous les sous-traitants tech sont à jour dans la police
- [ ] Vérifier que les nouvelles features (Phase 2 / Phase 3) sont couvertes
- [ ] Ajuster CA déclaré (Hiscox = prime indexée sur CA réalisé)
```

## Files to Create

- `docs/legal/hiscox-police-rc-pro-{date}.pdf` (police signée archivée)
- `docs/legal/assurance-summary.md` (résumé + planning upgrades)
- `docs/legal/devis-comparatifs-2026.pdf` (devis Hiscox + AssurUp + Wakam si comparaison)

## Files to Modify

- `docs/credentials-setup.md` : ajouter section "Assurance RC Pro" avec numéro de police
- `docs/legal/relecture-checklist.md` : marquer "Police Hiscox validée" cohérence avec CGU/CGV

## Contracts

### Provides (for downstream tasks)

- **Couverture active à partir de M5** : prérequis pour lancement bêta privée M6 (Task 6.1)
- **Extension PI** : prérequis pour exposition à Liciel/Enersweet potential attack (defense strategy)
- **Référence dans CGU** : section "Responsabilité" peut citer "Nexus 1993 est assurée RC Pro à hauteur de 500k€/sinistre 1M€/an"

## Acceptance Criteria

- [ ] Pack Hiscox RC Pro Numérique + Cyber souscrit sous Nexus 1993
- [ ] **Extension PI obligatoire confirmée dans la police** (+200-400€/an inclus dans prime ~900€/an)
- [ ] Plafonds : 500k€/sinistre, 1M€/an
- [ ] Sous-couvertures vérifiées : cyber 500k€, RGPD 50k€, défense juridique 100k€, erreurs IA explicite, litiges IP 100k€
- [ ] Prime totale ~900€/an, prélèvement Qonto Nexus 1993 effectif
- [ ] Police PDF archivée + résumé documenté
- [ ] Planning upgrades Phase 2 + 3 documenté

## Testing Protocol

### Validation police

- Lecture détaillée 100% du texte police (1-2h)
- Vérifier présence des 5 sous-couvertures listées
- Vérifier absence d'exclusion "IA" ou "logiciel automatisé" problématique
- Vérifier clause de cascade responsabilité sous-traitants tech
- Si doute : appeler agent Hiscox pour clarification avant signature

### Vérification facturation

- Confirmer prélèvement Qonto effectif (~900€/an, soit ~75€/mo amorti)
- Recevoir attestation d'assurance par email (utilisable dans com B2B clients pro qui demandent preuve)

### Simulation sinistre (à blanc)

Scénario hypothétique : "Un bug KOVAS a fait perdre un DPE à un utilisateur, qui réclame 5 000€ de préjudice."

- Quel est le processus de déclaration sinistre Hiscox ?
- Combien de temps avant remboursement utilisateur ?
- Documenter dans `docs/runbooks/sinistre-rc-pro-procedure.md`

## Skills to Read

- `kovas-defense-strategy` (extension PI critique)

## Research Files to Read

- `research/liciel-format.md` §3.5 (risque procès Liciel — RC Pro défense juridique)

## Git

- Branch : `feature/0-9-hiscox-rc-pro-extension-pi`
- Commit message prefix : `Task 0.9:`

## Notes anti-pattern

- ⛔ Ne PAS souscrire police standard RC Pro sans extension PI (= défense Liciel à 350€/h de poche)
- ⛔ Ne PAS souscrire police "individuelle" (Benjamin) — toujours sous Nexus 1993
- ⛔ Ne PAS reporter souscription après M5 (= risque non couvert pendant bêta M6+)
- ⛔ Ne PAS skipper la lecture détaillée police (clauses cachées d'exclusion possible)
- ⛔ Ne PAS oublier d'augmenter plafonds Phase 2 + 3 (sous-assurance = nullité partielle en cas de sinistre)
- ⛔ Ne PAS sous-déclarer le CA (Hiscox = clause de réduction proportionnelle si CA réel >> CA déclaré)
- ⛔ Ne PAS souscrire sans extension PI sur la promesse "ça arrive jamais" — Liciel/Enersweet attaque potentielle = LE risque structurel KOVAS
