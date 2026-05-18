# Task 0.R : Phase 0 Regression Test (M5 fin)

## Objective

Vérification finale que toute l'infrastructure non-tech est en place avant le démarrage du Sprint MVP 14j. C'est la **GATE de passage** Phase 0 → Phase 1.

## Context

Si une seule des 9 tasks Phase 0 n'est pas complétée à M5, le Sprint MVP démarre handicapé. Cette regression task est OBLIGATOIRE avant J1 Sprint MVP.

## Dependencies

- Toutes : Tasks 0.1 à 0.9 complétées

## Blocked By

- Tasks 0.1-0.9 toutes en `status: completed`

## Acceptance Criteria

### Checklist 9 tasks

- [ ] **Task 0.1 — Comptes services M0** : 12 comptes créés, `.env.example` documenté, D-U-N-S reçu et archivé
- [ ] **Task 0.2 — Apple Developer + Google Play** : enrollment validé, bundle ID `com.nexus1993.kovas` réservé
- [ ] **Task 0.3 — INPI marque KOVAS** : dépôt effectué, récépissé archivé, numéro dépôt connu
- [ ] **Task 0.4 — Documents légaux IA-first** : 7 documents générés (CGU, CGV, RGPD, cookies, mentions, DPA, charte bêta) + sections avocat Vague 2 marquées
- [ ] **Task 0.5 — 50 entretiens découverte** : 50 comptes-rendus structurés + 3-5 advisor candidates identifiés + 40-50 bêta-testeurs candidats engagés + pricing 4 tiers validé/ajusté
- [ ] **Task 0.6 — Recrutement advisor** : 1 advisor recruté avec contrat signé (BSPCE 0,5-1%, vesting 2 ans, cliff 6 mois)
- [ ] **Task 0.7 — Fixtures Liciel + journal GPG** : 25-50 exports anonymisés + repo `kovas-discovery-log` GPG signing OK + script anonymisation versionné
- [ ] **Task 0.8 — Crisis comms + runbook** : 3 assets pré-rédigés + runbook bascule + canal `juridique@kovas.fr` opérationnel
- [ ] **Task 0.9 — Hiscox RC Pro + extension PI** : police signée 500k€/1M€ + extension PI confirmée + prime ~900€/an prélevée Qonto

## Testing Protocol

### Validation Apple Developer + Google Play

- [ ] Login App Store Connect : record "KOVAS" visible, bundle ID `com.nexus1993.kovas` réservé
- [ ] Login Google Play Console : compte actif

### Validation D-U-N-S

- [ ] Email confirmation D-U-N-S archivé dans `docs/credentials-setup.md`
- [ ] D-U-N-S Number visible dans Apple Developer Account

### Validation entretiens découverte

- [ ] Notion DB "Entretiens découverte" : 50 lignes complétées
- [ ] Synthèse `docs/discovery/synthese-50-entretiens.md` produite
- [ ] Pricing 4 tiers validé (ou ajustements documentés dans DISCOVERY.md)

### Validation advisor

- [ ] Contrat advisor signé DocuSeal archivé `docs/legal/contrats-signes/advisor-*.pdf`
- [ ] Section "Équipe" kovas.fr prête à publier M6 (citation publique advisor)

### Validation corpus Liciel

- [ ] Repo `kovas-discovery-log` : `git log --show-signature` confirme tous commits GPG signés
- [ ] 25-50 exports anonymisés dans `kovas-discovery-log/fixtures-anonymized/`
- [ ] Coverage 10 variantes critiques :
  - [ ] DPE 2020 maison
  - [ ] DPE 2020 appartement
  - [ ] DPE immeuble complet
  - [ ] Amiante avant-vente
  - [ ] CREP Plomb
  - [ ] Carrez/Boutin
  - [ ] Gaz + Électricité
  - [ ] ERP
  - [ ] Termites
  - [ ] Mission combinée vente complète

### Validation crisis comms

- [ ] 3 assets pré-rédigés stockés : page Pourquoi KOVAS + FAQ technique + communiqué presse réponse
- [ ] Runbook bascule documenté `docs/runbooks/liciel-bascule-urgence.md`
- [ ] Canal `juridique@kovas.fr` reçoit emails de test (autoresponder + forwarding Benjamin)

### Validation assurance

- [ ] Police Hiscox PDF signée `docs/legal/hiscox-police-rc-pro-{date}.pdf`
- [ ] Extension PI confirmée dans police
- [ ] Plafonds 500k€/1M€ + sous-couvertures (cyber, RGPD, défense, IA, IP) tous présents

### Validation comptes services

Test API call rapide sur chaque service M0 :

```bash
# Supabase
curl "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_ANON_KEY" → 200 OK

# Anthropic
curl https://api.anthropic.com/v1/messages -H "x-api-key: $ANTHROPIC_API_KEY_DEV" \
  -H "anthropic-version: 2023-06-01" -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":10,"messages":[{"role":"user","content":"hi"}]}' \
  → 200 + response

# OpenAI
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENAI_API_KEY" → 200 OK

# Stripe
stripe customers list --limit 1 → empty list (OK, mode test)

# Resend
curl https://api.resend.com/domains -H "Authorization: Bearer $RESEND_API_KEY" → 200 + domain kovas.fr verified
```

## Phase 0 GATE Decision

Si TOUS les items ci-dessus sont validés → **GO Phase 1** (Sprint MVP J1 démarre)

Si ≥ 1 item bloquant non validé → **NO GO Phase 1**, plan de remédiation :

- Item bloquant identifié
- Délai estimé de remédiation
- Décision : décaler Sprint MVP de N jours OU continuer en parallèle si non-bloquant

## Files to Create

- `docs/checkpoints/phase-0-regression-{date}.md` (compte-rendu détaillé)

## Files to Modify

- `DISCOVERY.md` : potentiels ajustements post-50 entretiens
- `PRD.md` : potentiels ajustements
- `PHASES.md` : confirmer Phase 1 démarre à la date Y/M/D

## Skills to Read

- Aucune

## Research Files to Read

- Tous les research files si remédiation nécessaire sur item spécifique

## Git

- Branch : `regression/phase-0-{date}`
- Commit message prefix : `Task 0.R:`

## Notes anti-pattern

- ⛔ Ne PAS démarrer Phase 1 Sprint MVP si ≥ 1 item bloquant non validé
- ⛔ Ne PAS skipper la regression test (= démarrer sprint sans préparation)
- ⛔ Ne PAS faire la regression test la veille du Sprint J1 (manque de temps pour remédiation)
- ⛔ Ne PAS minimiser un item bloquant ("on verra plus tard") — sprint compressé ne tolère pas
