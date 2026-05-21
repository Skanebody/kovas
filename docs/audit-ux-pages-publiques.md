# Audit UI/UX — Pages publiques + parcours auth

> **Date** : 2026-05-20
> **Périmètre** : 9 pages publiques + parcours signup 3 étapes
> **Méthode** : lecture seule, audit DS v5 / frictions UX / cohérence inter-pages / responsive mobile
> **Avatar référent** : diagnostiqueur 35-55 ans, méfiant, sensible au prix mais reconnaît la valeur du temps

---

## Synthèse — Top 10 issues

| # | Page | Issue | Priorité |
|---|------|-------|----------|
| 1 | LandingHeader + signup-form + login + faq | **CTA "Essai 14j" / "Essai 14 jours" sur 4 emplacements** alors que le forfait offre 30 jours — incohérence majeure | **P0** |
| 2 | LandingFaq Q4 | **Anciens tiers "Découverte/Standard/Volume"** mentionnés au lieu de Essential/Découverte/Pro/All Inclusive/Cabinet — info périmée | **P0** |
| 3 | `/faq` | Header `glass-header` + `SiteFooter` + bouton `variant="accent"` au lieu de LandingHeader/LandingFooter — palette V5 cassée | **P0** |
| 4 | `/cgu` `/mentions-legales` `/confidentialite` `/contact` | `LegalPageShell` utilise `bg-sage` + `glass-header` + `font-display` au lieu de la grammaire sage `#F5F7F4` + LandingHeader v5 | **P0** |
| 5 | `/confidentialite` vs CLAUDE.md vs PricingFaq | **Triple incohérence rétention** : conf "30j", CLAUDE.md "6 mois", PricingFaq "90j + 30j RGPD" — risque légal | **P0** |
| 6 | `/(auth)/layout.tsx` | Layout auth utilise `bg-fluid-light` + `font-display` + `shadow-glass-sm` — palette V4 résiduelle, doit migrer V5 | **P0** |
| 7 | `/signup` | Hero "Étape 3 sur 3" affiché en texte `text-amber` (V4) au lieu de la palette V5 chartreuse/dark ; **pas de progress steps visuel** (3 étapes invisibles à l'œil) | **P1** |
| 8 | `/pricing/calculator` ligne 63-65 | CTA "Commencer mon essai 30 jours" → /signup **sans paramètre `billing`** — résultat : signup ne sait pas si user voulait mensuel/annuel | **P1** |
| 9 | `/login` | "Essai gratuit 14 jours" en lien bas — mauvaise promesse vs landing 30j | **P0** |
| 10 | `/pricing` PricingFaq Q2 surplus | "0 € sur All Inclusive et Cabinet qui sont illimités" — vérifier que la matrice de features correspond, sinon promesse cassée | **P2** |

---

## Évaluation du parcours signup 3 étapes

### Étape 1 — `/pricing` : **7/10**

**OK** :
- Grille 5 tiers homogène, CTA "Démarrer en X" visible sans scroll dans chaque carte
- href correct `/pricing/checkout?plan=X&billing=Y`
- Mention "Essai 30 jours · CB enregistrée" sous chaque CTA
- ROI calculator sorti de la carte Pro (RoiStandalone) — bonne décision
- FAQ Q4 résiliation cite explicitement le décret 2023-417

**KO** :
- L'avatar **ne sait pas qu'il y a 3 étapes** au clic — aucun indicateur "Étape 1/3" dans le header de la page
- LaunchOfferCountdown : visible mais position juste sous le hero, manque de hiérarchie
- Aucune mention "Étape 1 sur 3" dans la page

### Étape 2 — `/pricing/checkout` : **8/10**

**OK** :
- Header "Étape 2 sur 3 — Récap & options" clair (font-mono uppercase)
- ProgressSteps visuel en bas de page avec chartreuse pour étape active
- Récap sticky right avec total dynamique chartreuse (Instrument Serif italic)
- Lien retour "Changer de forfait" → /pricing
- Mention "Aucun prélèvement immédiat · Premier débit à J+30, annulable d'ici là en 3 clics"

**KO** :
- ProgressSteps en **bas de page** au lieu de en haut — l'avatar valide les add-ons avant de voir où il en est
- Mention "Aucune CB requise pour les modules" (ligne 101 CheckoutFlow) légitime mais peut prêter confusion : ambigu si "Aucune CB requise" est interprété comme "ni pour le forfait" — texte à durcir
- Pas de breadcrumb visuel en haut "Forfait > **Options** > Compte" persistant pendant le scroll
- Aside `lg:sticky lg:top-24` : en mobile la récap apparaît tout en bas — un cliquer "Créer mon compte" demande de scroller la liste add-ons + récap entière

### Étape 3 — `/signup` : **5/10**

**OK** :
- Récap forfait + add-ons visible si plan présent
- Lien retour `/pricing/checkout?plan=...` correct
- Eyebrow "Étape 3 sur 3 · Création du compte" présent

**KO MAJEUR** :
- Bouton form `Commencer l'essai 14 jours` (signup-form.tsx:88) — **devrait être 30 jours** pour cohérence avec promesse landing
- Aucun ProgressSteps visuel ici (en étape 2 il y en avait un) — rupture cohérence cross-pages
- Layout `(auth)/layout.tsx` utilise palette V4 (`bg-fluid-light`, `font-display`, `shadow-glass-sm`, `glass-opaque`) — **pas du DS v5**
- Eyebrow `text-amber font-semibold` — couleur ambre V4 ; le DS V5 utilise chartreuse pour les accents positifs
- Hero "Démarrer." en serif italic — OK V5, mais la couleur `text-ink` et le fond `bg-paper` sont des tokens V4
- Si pas de plan en query params (entrée directe `/signup`), pas de récap → l'utilisateur ne sait pas ce qu'il signe
- Texte "30 jours d'essai · CB enregistrée · résiliation en 3 clics" affiché **uniquement si pas de plan** — paradoxal (l'utilisateur qui vient du parcours ne voit plus cette mention rassurante)

### Score global parcours : **6,7/10**

**Frictions principales** :
1. Promesse "essai" oscille entre 14 et 30 jours selon les pages
2. Layout signup en palette V4 vs reste du parcours en V5 → rupture visuelle à l'étape clé
3. Progress steps incohérent (visible en /pricing/checkout, invisible ailleurs)

---

## Détail par page

### `/` (landing)

**DS v5** : Conforme. Palette `#F5F7F4` + Urbanist + Instrument Serif italic pour KPI Stats (`1h30`, `92`, `< 30`).

**Frictions UX** :
- Hero CTA "Commencer mon essai 30 jours" → bonne promesse
- LandingHeader CTA "Essai 14j" — **contradiction interne sur la même page**
- LandingFaq Q1 mention "données effacées sous 30 jours conformément RGPD" — divergence avec PricingFaq "90 jours puis 30 jours"
- LandingFaq Q4 mention anciens tiers "Découverte / Standard / Volume" + prix "2 €, 1,50 € ou 1 €" — **legacy non mis à jour post Modification 19**

**Cohérence inter-pages** : Header/Footer partagés (LandingHeader/LandingFooter) — OK.

**Responsive** : Hero `text-[48px] sm:text-[72px] md:text-[104px]` — agressif sur SM petits. À tester sur iPhone SE 375px.

---

### `/pricing`

**DS v5** : Conforme.

**Frictions UX** :
- 5 tiers homogènes en hauteur OK (PricingTiersGrid `items-stretch`)
- ROI calculator standalone OK
- AddonsSection : grille 9 modules avec `min-h-[60px]` pour la description — assure homogénéité, OK
- AnnualSection bande dark : design OK
- FAQ 5 questions accordéon OK
- LaunchOfferCountdown : "Plus que X places sur 30 · -30 % pendant 12 mois" — texte OK mais le countdown s'affiche en chartreuse plein (très saturé), peut être perçu comme pression
- Hero secondary links "Construire mon offre" + "Tableau comparatif détaillé" — bonnes alternatives mais visuellement faibles (`text-[13px]`)

**Cohérence** : OK.

**Responsive** : 5 colonnes `lg:grid-cols-5` — à 4 colonnes (md) le 5e tier passe full-width, vérifié dans la doc. OK.

---

### `/pricing/checkout`

**DS v5** : Conforme.

**Frictions UX** :
- Layout 2 colonnes lg:grid-cols-[1fr_360px] OK
- Récap sticky avec total dynamique : excellent
- Bouton "Créer mon compte" chartreuse sur fond dark : excellent contraste
- "Aucune CB requise pour les modules" : phrasing limite, mieux serait "L'essai modules ne déclenche aucune nouvelle saisie CB"
- **ProgressSteps en bas** : un avatar méfiant veut savoir où il en est avant de cocher quoi que ce soit. Le déplacer en haut

**Responsive** : `lg:sticky lg:top-24` — l'aside passe sous la colonne gauche en mobile. Le bouton "Créer mon compte" est donc TOUT EN BAS. À tester : risque scroll fatigue.

---

### `/pricing/calculator`

**DS v5** : Conforme.

**Frictions UX** :
- PlanPicker en mini-cards (5 colonnes lg) OK
- AddonPicker en grille 2 cols OK
- RecapPanel sticky right : excellent
- **BUG : ligne 63-65** : `signupHref = '/signup?plan=${planCode}${...addons}'` — **manque `billing=monthly` ou `billing=annual`** — par défaut le calculator utilise mensuel, mais `/signup` puis `/pricing/checkout` ne le sauront pas
- Page "Étape 1 / Étape 2" en eyebrow font-mono — pédagogie OK mais le user ne sait pas que CE flow construit ne lui amène pas vers les ProgressSteps des autres étapes

**Cohérence** : RoiStandalone (page /pricing) renvoie aussi vers /pricing/checkout, créant **deux chemins distincts** vers /signup. Risque de friction si user mémorise un chemin et le perd.

---

### `/pricing/compare`

**DS v5** : Conforme.

**Frictions UX** :
- Table `overflow-x-auto` correcte
- Cellules ✓ chartreuse / — gris OK
- Hero compact, retour "← Retour aux forfaits" en bas OK
- **PAS de bouton "Démarrer en X" directement depuis le tableau** — l'avatar voit le comparatif puis doit retourner sur /pricing pour cliquer. Friction.

**Cohérence** : `/pricing/compare` n'apparaît pas dans LandingHeader nav, accessible uniquement par lien depuis /pricing. OK pour SEO mais discoverability faible.

---

### `/signup`

**Voir Étape 3 ci-dessus**. Score 5/10.

**Issues additionnelles** :
- `(auth)/layout.tsx` toute la cellule en V4 (`bg-fluid-light`, `glass-opaque`, `shadow-glass-sm`)
- `signup-form.tsx` utilise composants `<Input>`, `<FormField>`, `<Button>` — non audités ici mais à vérifier qu'ils respectent V5
- Bouton submit "Commencer l'essai 14 jours" → P0 fix immédiat
- Champ SIRET avec pattern `[\d\s]{14,17}` : OK pour anti-abus 1 essai par SIRET
- Aucune mention "30 jours · CB enregistrée · annulable en 3 clics" sous le bouton submit — la rassurance se perd au moment du clic

---

### `/login`

**DS v5** : Partiel. Hero `font-serif italic` OK V5, mais hérite du layout `(auth)/layout.tsx` V4.

**Frictions UX** :
- Hero "Bienvenue." minimaliste OK
- Lien bas "Essai gratuit 14 jours" → **P0** : doit être "Essai gratuit 30 jours"
- Pas de "mot de passe oublié" visible (à vérifier dans LoginForm)

---

### `/faq`

**DS v5** : **Non conforme** — palette V4 résiduelle.

**Frictions UX** :
- Header `glass-header` + SiteFooter au lieu de LandingHeader/LandingFooter
- Hero `font-light text-display-m` (token V4) — V5 utilise `font-semibold`
- Bouton bas "Commencer mon essai 14 jours" — **P0**
- Mais le contenu (53 questions × 8 catégories) est excellent, structure TOC sticky OK

**Cohérence** : Forte rupture visuelle entre /pricing et /faq alors qu'ils sont liés dans la nav.

---

### `/cgu` `/mentions-legales` `/confidentialite` `/contact`

**DS v5** : **Non conforme** — `LegalPageShell` utilise palette V4.

**Issues communes** :
- Background `bg-sage` au lieu de `bg-[#F5F7F4]`
- Header `glass-header` au lieu de LandingHeader
- Logo carré `bg-navy` + `shadow-accent` — palette V4 sage/navy au lieu de `bg-[#0F1419]` V5
- `font-display font-semibold` — token V4
- Liens couleur `text-navy` — V4
- Bouton Contact `variant="accent"` — V4

**Issue conformité RGPD critique** (`/confidentialite`) :
> "Durée de conservation : durée du contrat + 30 jours après résiliation pour export, sauf obligation légale."

Divergence avec :
- CLAUDE.md : "6 mois rétention post-résiliation"
- PricingFaq Q4 : "données accessibles 90 jours pour export... Au-delà, suppression définitive sous 30 jours"
- LandingFaq Q1 : "données effacées sous 30 jours conformément RGPD"

**4 sources, 3 réponses différentes**. À harmoniser d'urgence. La conformité RGPD/factures 10 ans n'est mentionnée nulle part dans `/confidentialite`.

---

## Patterns systématiques détectés

1. **Promesse trial 14j vs 30j incohérente** sur 5 emplacements : LandingHeader CTA, signup-form button, login link, faq CTA, et docstring upsell-card (in-app). À uniformiser : **30 jours pour le forfait, 14 jours uniquement pour les modules add-ons**.

2. **Cohabitation V4/V5** : LandingHeader/LandingFooter sont V5 strict, mais `(auth)/layout.tsx` + `LegalPageShell` + `/faq` page sont restés en V4 (`glass-header`, `bg-fluid-light`, `bg-sage`, `font-display`, `text-amber`, `text-navy`). Refonte palette à finir.

3. **ProgressSteps inconsistant** : Présent en /pricing/checkout (étape 2), absent en /signup (étape 3) et en /pricing (étape 1). Le user ne perçoit pas la séquence "3 étapes" du parcours.

4. **Rétention données triplement contradictoire** entre LandingFaq, PricingFaq, /confidentialite et CLAUDE.md. Risque légal et perte de confiance avatar méfiant.

5. **Tier names legacy** dans LandingFaq Q4 (Découverte/Standard/Volume) — l'avatar voit "Découverte" sur landing puis "Essential/Pro/Cabinet" sur /pricing. Friction de compréhension.

6. **Aucun pricing teaser dans /pricing/compare** : l'avatar consulte le tableau mais doit revenir sur /pricing pour cliquer.

---

## Recommandations prioritaires

### P0 (urgent — incohérences messaging et palette)

1. **Uniformiser "30 jours" partout** : LandingHeader CTA → "Essai 30j" ; signup-form button → "Commencer l'essai 30 jours" ; login link → "Essai gratuit 30 jours" ; faq CTA → "Commencer mon essai 30 jours"
2. **Mettre à jour LandingFaq Q4** : remplacer "Découverte/Standard/Volume" par "Essential/Pro/Cabinet" et harmoniser les prix de surplus avec PricingFaq Q2
3. **Migrer `/faq` en LandingHeader + LandingFooter** + palette V5 (`bg-[#F5F7F4]`, `font-sans` Urbanist)
4. **Refondre `LegalPageShell`** en V5 strict : background `#F5F7F4`, LandingHeader, LandingFooter, suppression `font-display`, `bg-navy`, `text-navy`
5. **Refondre `(auth)/layout.tsx`** en V5 : suppression `bg-fluid-light`, `glass-opaque`, `shadow-glass-sm`, `font-display` ; passage à `bg-[#F5F7F4]` + card paper opaque V5
6. **Harmoniser durée rétention** sur 4 sources : décider entre 30j/90j/6mois et propager. Ajouter conservation factures 10 ans (obligation comptable) dans `/confidentialite`

### P1 (important — UX parcours)

7. **Ajouter ProgressSteps visuel en haut** de /pricing/checkout ET /signup
8. **Réorganiser /pricing/checkout** : Progress steps en haut, récap sticky toujours visible en mobile (peut-être bottom-sheet)
9. **Fix `/pricing/calculator` ligne 63-65** : ajouter `&billing=monthly` dans le signupHref
10. **Migrer `/signup` Hero eyebrow** de `text-amber` à `text-chartreuse-deep` ou équivalent V5
11. **Ajouter "Démarrer en X" buttons en sticky bottom de `/pricing/compare`** ou dans chaque colonne header

### P2 (nice-to-have)

12. Réduire saturation visuelle de LaunchOfferCountdown (chartreuse plein bordé)
13. Vérifier responsive iPhone SE 375px sur Hero `text-[104px]`
14. Améliorer la phrase "Aucune CB requise pour les modules" pour lever ambiguïté
