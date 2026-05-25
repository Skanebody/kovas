# KOVAS 360 — REFONTE MAJEURE ACQUI-TARGET

**Document opérationnel complet pour Claude Code**
**Version 2.0 consolidée — 25 mai 2026**
**Auteur : Benjamin Bel + équipe stratégique**

---

## OBJECTIF STRATÉGIQUE

KOVAS 360 est repositionné comme **couche d'intelligence par-dessus Liciel / ORIS / OBBC / DS8**. Objectif sur 24 mois : devenir acqui-target Enersweet (Liciel) à 5-10 M€.

**Storytelling produit** : KOVAS 360 = front-end intelligent. Liciel / ORIS / OBBC = plomberie ADEME.

**Principe directeur** : chaque feature et algorithme doit répondre OUI à "Est-ce un moat irréplicable par Liciel en 18 mois ?". Tout ce qui répond NON est élagué.

---

## ARCHITECTURE MULTI-AGENTS

| Agent | Mission | Effort | Branche |
|---|---|---|---|
| 1 | Audit + réduction SEO (35k → 5k pages) | 40h | `refonte/agent1-seo-cleanup` |
| 2 | Élagage bucket C (~25-30 features) | 60h | `refonte/agent2-bucket-c-removal` |
| 3 | Amplification 6 game changers + algos critiques | 580h | `refonte/agent3-amplify-game-changers` |
| 4 | Import bidirectionnel Liciel/ORIS/OBBC | 200h | `refonte/agent4-import-liciel-oris-obbc` |
| 5 | API publique observatoire | 60h | `refonte/agent5-public-api` |
| 6 | Admin consolidation + DB cleanup | 70h | `refonte/agent6-admin-db` (déclenché après Agent 2) |
| 7 | Cohérence finale + validation | 30h | sync après tous |
| 8 | Pipeline ingestion data 11 sources | 200h | `refonte/agent8-data-pipeline` |
| 9 | Algorithmes vagues 2 et 3 | 240h | `refonte/agent9-algos-vague-2-3` |

**Total : 1480h. Avec 9 agents Claude Code parallèles : 4-8 semaines réalistes.**

---

## LES 6 GAME CHANGERS

1. **Pre-export AI conformity panel** (P0, 80h, algo A1.3.3)
2. **Mission capture flow + import Liciel** (P0, 120h, algos A1.3.1/A1.3.2/A1.3.6)
3. **Annuaire B2C + funnel devis** (P0, 60h, algo A1.3.5)
4. **Cross-validation + état profession publique** (P1, 50h, algo A1.3.8)
5. **Observatoire mensuel + presse automatisée** (P1, 40h)
6. **Cockpit fraude DPE diagnostiqueur-facing** (P1, 30h, algo A1.3.1)

---

## LES 13 ALGORITHMES

### Vague 1 — Critiques moat (Agent 3)
- **A1.3.4** : Profil unifié propriété (cross-source data lake) — PIERRE ANGULAIRE
- **A1.3.1** : Détection DPE shopping (12 mois historique ADEME)
- **A1.3.2** : Cohérence cadastre vs surface déclarée (IGN)
- **A1.3.3** : Score conformité multi-dimensionnel pré-export
- **A1.3.6** : Vision IA classifier équipements (Claude Vision)

### Vague 2 — Business amplificateurs (Agent 9)
- **A1.3.5** : Lead scoring + routing multi-armed bandit
- **A1.3.7** : Classifier automatique documents clients
- **A1.3.8** : Population & sync annuaire diagnostiqueurs

### Vague 3 — Optimisation interne (Agent 9)
- **A1.3.9** : Production anomaly detection
- **A1.3.10** : Certificate expiry predictor
- **A1.3.11** : Churn risk predictor
- **A1.3.12** : SEO page quality auto-scorer
- **A1.3.13** : Conformity pattern learning per diagnostician

---

## 11 SOURCES DE DONNÉES LÉGITIMES

| # | Source | Licence | Fréquence MaJ |
|---|---|---|---|
| 1 | BAN (Base Adresse Nationale) | ODbL | Quotidien |
| 2 | Cadastre IGN | Licence Ouverte | Quotidien |
| 3 | ADEME Observatoire DPE | Licence Ouverte | Quotidien |
| 4 | DVF (Demande Valeurs Foncières) | Licence Ouverte | Trimestriel |
| 5 | DHUP annuaire diagnostiqueurs | Open data | Hebdo |
| 6 | SIRENE (entreprises) | Open data | Quotidien |
| 7 | INPI data marques | Open data | Quotidien |
| 8 | COFRAC accréditations | Public registry | Quotidien |
| 9 | Géorisques (ERP) | Open data | Mensuel |
| 10 | Google Search Console | Propriétaire | Quotidien |
| 11 | France Renov RGE artisans | Open data | Mensuel |

**100% publiques. 0% scraping. 0% zone grise juridique.**

---

## ÉLAGAGE — BUCKET C

### Dashboard à supprimer (~15 features)
- `/dashboard/coach`, `/dashboard/veille/*`, `/dashboard/communaute`, `/dashboard/gain`, `/dashboard/account/progression`, `/dashboard/annuaire`, `/dashboard/prescripteurs`, calculatrice standalone, vCard QR + Apple Wallet, branding cabinet custom, cancellation 5 steps → 2 steps

### Connecteurs comptables
- **Conserver** : Qonto, Pennylane
- **Supprimer** : Indy, Tiime

### Admin (vers consolidation Agent 6)
- 10+ vues admin → 3 vues : `/admin/sante-tech`, `/admin/sante-business`, `/admin/sante-utilisateurs`
- Supprimer `/admin/ab-testing` (premature optimization pre-PMF)

### Edge Functions / Ingesters SEO
- **Conserver** : `gsc`, `dvf`, `ademe-signals`, `insee` (minimal)
- **Supprimer** : `autocomplete`, `paa`, `newsapi`, `reddit`, `trends`

### Tooling secondaire
- Supprimer : Telegram user commands, FranceConnect login, DocuSeal, `/signaler-un-diagnostiqueur`
- Conserver : Telegram bot admin read-only, Yousign signature

### SEO programmatique
- 5 templates × 5000 villes = 30 000 pages → **supprimer**
- `/diagnostic/[type]/[ville]` (~5000) → **enrichir** avec 5 data points uniques

---

## RÈGLES TRANSVERSES

### Brand V5 stricte
- **Public** (`/`, `/pros`, `/trouver-un-diagnostiqueur/*`, `/blog/*`) : navy `#0B1D33` + cream + Instrument Serif italic
- **App** (`/dashboard/*`, `/mission/*`) : sage `#F5F7F4` + navy bleuté `#0F1419` + chartreuse `#D4F542` accent unique
- Aucun gradient, ombre, effet
- Bordures 1px max
- Typo : Urbanist body, Instrument Serif italic KPI hero, JetBrains Mono labels uppercase tracking-0.15em

### Responsive 100%
Mobile-first, touch targets ≥ 48px. Test sur 4 breakpoints : 320, 390, 768, 1440px.

### Philosophie alertes
**Jamais sapin de Noël. Jamais bloquant. Ton aidant, jamais accusateur.**
- Max 3 alertes par mission
- Max 1 suggestion proactive par jour
- Toujours "tu peux" jamais "tu dois"
- Système apprend des actions ignorées

### KOVAS rôle absolu
KOVAS = capture terrain + structuration IA + pré-vérification avant export vers logiciel métier.
**JAMAIS d'envoi direct ADEME.** Le panneau pré-export reste informatif, jamais bloquant.

### Prix verrouillés
Aucun changement. Logiciel 29/59/149/299€/mois. Annuaire 19/39/79€/mois. Bundles 39/65/79/159/319€/mois.

### Essai gratuit
30 jours avec débit auto (modèle Qonto).

### Dogfooding intégré
Storytelling assume que KOVAS 360 est construit par un diagnostiqueur actif (Benjamin) pour des diagnostiqueurs.

### Sources de données
100% APIs publiques officielles ou dumps open data. Zéro scraping. Zéro zone grise juridique.

### TypeScript strict
`pnpm typecheck` doit passer à 0 erreur après chaque agent.

### Pas de phasage
Aucune feature ne sort en "MVP" puis "V2". Livrée à son meilleur niveau directement.

---

## ARCHITECTURE DATA AUTONOME 5 NIVEAUX

```
Niveau 1 — INGESTION (Edge Functions cron : 11 sources)
   ↓
Niveau 2 — NORMALISATION (validation schema, dedup, quality scoring)
   ↓
Niveau 3 — STOCKAGE (Supabase schemas data.*, analytics.*, internal.*)
   ↓
Niveau 4 — DÉRIVATION (vues matérialisées, agrégations)
   ↓
Niveau 5 — CACHE / EXPOSITION (ISR Next.js, Vercel KV, API publique)
```

---

## CHECKLIST VALIDATION FINALE (Agent 7)

### Technique
- [ ] `pnpm typecheck` 0 erreur
- [ ] `pnpm lint` 0 warning critique
- [ ] `pnpm build` réussit prod
- [ ] `pnpm test` passe (unit + E2E Playwright)
- [ ] Aucun import cassé
- [ ] Bundle JS analyzer : 0 feature supprimée présente

### Routing
- [ ] Routes supprimées redirigent via middleware
- [ ] Sitemap.xml ~5000 URLs
- [ ] Routes des 6 game changers accessibles

### Database
- [ ] Migration DROP appliquée
- [ ] Schemas `data.*`, `analytics.*`, `internal.*` créés
- [ ] Tables `data.*` algos créées avec index appropriés
- [ ] PostGIS activé

### Produit
- [ ] Sidebar dashboard nettoyée
- [ ] Onboarding 4 étapes fonctionnel
- [ ] Mission capture flow testé DPE réelle
- [ ] Pre-export panel : score + ≤5 anomalies + ≤3 opportunités
- [ ] Annuaire B2C 3 villes test
- [ ] Calculateur DPE 6 étapes
- [ ] API publique 8 endpoints opérationnels
- [ ] Import Liciel ZIP fonctionnel

### Algorithmes
- [ ] A1.3.4 : 10 adresses test < 3s (cache miss)
- [ ] A1.3.1 : détection testée sur 10 biens historique connu
- [ ] A1.3.2 : testé sur 10 missions
- [ ] A1.3.3 : testé sur 10 missions complètes
- [ ] A1.3.6 : testé sur 20 photos plaques signalétiques
- [ ] A1.3.5 : simulation 50 leads
- [ ] A1.3.8 : 1 cycle complet DHUP + SIRENE + COFRAC

### Business
- [ ] Prix conservés exactement
- [ ] Essai 30j débit auto OK
- [ ] Qonto + Pennylane fonctionnels
- [ ] Indy + Tiime supprimés
- [ ] Yousign opérationnel, DocuSeal supprimé
- [ ] Factur-X export conforme

### Pipeline data
- [ ] 11 ingesters opérationnels
- [ ] Tables data.* peuplées
- [ ] 3 vues matérialisées fonctionnelles
- [ ] Data quality monitor alertes test

### Brand
- [ ] 0 chartreuse sur public
- [ ] 0 Instrument Serif sur app
- [ ] Bordures 1px partout
- [ ] 0 gradient/ombre
- [ ] Touch ≥ 48px mobile
- [ ] Test 4 breakpoints

---

## NOTE DE PROVENANCE

Document ingéré le 2026-05-25 dans la branche `refonte-acqui-target-2026-05`.

Ce fichier est la **version condensée** du document complet. Le document original (~3000 lignes) est conservé dans `REFONTE-ACQUI-TARGET-V2-FULL.md` pour référence détaillée.

Sont également produits :
- `agent2-tables-to-drop.json` (par Agent 2 à la fin de son travail)
- `refonte-validation-report.md` (par Agent 7 à la fin)

**Au boulot.**
