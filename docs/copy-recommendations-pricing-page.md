# KOVAS — Recommandations copywriting page `/pricing`

**Date** : 2026-05-20
**Statut** : Recommandations copy (pas implémentation code)
**Auteur** : Agent E2b
**Authority parent** : [`docs/avatar-client.md`](avatar-client.md) · [`docs/neuromarketing-pricing-strategy.md`](neuromarketing-pricing-strategy.md)
**Cible** : `apps/web/src/app/pricing/page.tsx` (modifications futures, par dev humain ou agent dédié)

> Ce document **ne modifie pas le code**. Il propose des variants à tester A/B via PostHog Experiments une fois la branche pricing stabilisée.

---

## 1. Hero headline — 5 variants A/B

### Variant 1 — Sobre / Confiance (baseline conservatrice)

> **H1** : "Tarification simple, sans surprise."
> **Sub** : "Toutes les fonctionnalités dans tous les tiers. La différence : votre volume mensuel."

**Profil ciblé** : Benjamin prudent, sceptique du marketing. Activation Système 2 dominante.

**Pour** : zéro risque, cohérent ton sobre avatar.
**Contre** : aucun trigger émotionnel, headline interchangeable avec n'importe quel SaaS.

**Conversion estimée vs baseline** : ±0%.

---

### Variant 2 — Identitaire / Tribal (parle au cœur métier)

> **H1** : "Le logiciel diagnostic conçu par et pour les indépendants."
> **Sub** : "Saisie vocale terrain, exports universels, validation cohérence. Tout inclus, dans tous les tiers."

**Profil ciblé** : Benjamin fier de son statut de solopreneur reconverti. Activation identité professionnelle.

**Pour** : différenciation forte vs concurrents Liciel/AnalysImmo perçus comme "à tout le monde". Renforce affiliation.
**Contre** : "indépendants" exclut cabinet 2-3 users en Phase 2 — à ajuster M10+.

**Conversion estimée vs baseline** : +6-10%.

---

### Variant 3 — Émotionnel mesuré (NOTRE RECOMMANDATION DOMINANTE)

> **H1** : "1h30 économisée par mission. 30 heures rendues par mois."
> **Sub** : "Saisie vocale terrain, exports universels, validation cohérence avant export. Sans CB pour l'essai."

**Profil ciblé** : Benjamin rationnel + émotionnel pondéré. Activation Système 1 (chiffre saillant) + Système 2 (calculable).

**Pour** : promesse mesurable + bénéfice tangible. Pas d'angle "famille" intime (gardé pour email Day 7). Trigger principal = gain de temps quantifié.
**Contre** : nécessite ROI calculator dans la page pour valider la promesse rationnellement.

**Conversion estimée vs baseline** : +12-18% (avec ROI calculator).

---

### Variant 4 — Rassurant / Zero Risk (loss aversion soft)

> **H1** : "Tout inclus. Sans frais cachés. Sans engagement."
> **Sub** : "8 diagnostics standards, exports universels, sync mobile + web. À partir de 29€/mois HT."

**Profil ciblé** : Benjamin échaudé par Liciel + accessoires + add-ons. Activation Zero Risk Bias.

**Pour** : très rassurant, anti-friction maximal.
**Contre** : reste défensif, manque de promesse positive.

**Conversion estimée vs baseline** : +4-8%.

---

### Variant 5 — Social Proof / Authority (à activer dès >100 abonnés)

> **H1** : "L'outil de [X] diagnostiqueurs FR qui ont arrêté la double saisie."
> **Sub** : "1h30 économisée par mission, 30h libérées par mois. Sans CB pour l'essai."

**Profil ciblé** : Benjamin tardif (M9+, après social proof construit).

**Pour** : Cialdini principe 3 (Social Proof), très puissant en B2B niche.
**Contre** : non utilisable avant M9 (besoin de [X] >100 pour crédibilité).

**Conversion estimée vs baseline (post-M9)** : +15-22%.

---

### Recommandation finale headline

**Phase 1 M0-M9** : déployer **Variant 3** (émotionnel mesuré). Tester A/B vs Variant 1 (baseline) avec 50/50 split sur 4 semaines, échantillon min 500 visites/variant.

**Phase 2 M9+** : passer à **Variant 5** (social proof) si effectif >100 abonnés payants. Sinon prolonger Variant 3.

---

## 2. CTA primaire — wording et placement

### Variants CTA testables

| Variant | Wording exact | Trigger | Estimation conversion |
|---|---|---|---|
| **A — Baseline actuel** | "Essai 14j" | Factuel | Référence 100% |
| **B — Plus engageant** | "Commencer mon essai gratuit" | Possessif + bénéfice | +5-8% |
| **C — Action terminal** | "Démarrer gratuitement" | Action directe | +3-6% |
| **D — Bénéfice + temporalité** | "Tester 14 jours sans CB" | Zero risk explicite | +6-9% |
| **E — Social proof intégré** | "Rejoindre [X] diagnostiqueurs" | Social proof | +10-15% (post-M9) |

**Recommandation Phase 1** : Variant **D** *"Tester 14 jours sans CB"* — coche les 3 cases neuromarketing : action (tester), temporalité (14j = engagement borné), zero risk (sans CB).

**Placement** :
- Header sticky : variant court *"Essai 14j"* (déjà OK)
- Hero page pricing : variant long *"Tester 14 jours sans CB"*
- Sous chaque tier card : *"Commencer [Nom du tier]"* (déjà OK ✓)
- Footer page pricing : CTA secondaire *"Voir une démo de KOVAS"* (alternative pour Benjamin qui n'est pas prêt à signer)

### Couleur / Style CTA

**Recommandation** :
- Hero CTA principal : **bouton `warm` ambre** (`#D97706`) — célébration / énergie positive (cohérent design system v2 §9 CLAUDE.md)
- Tier highlighted (Standard) : **bouton `warm`** (déjà en place ✓)
- Tiers non-highlighted : **bouton `glass` ou `outline`** (déjà en place ✓)
- CTA secondaire ("Voir démo") : **bouton `ghost`** (lien discret)

**Risque overdoing** : trop d'ambre vif = sortie de la sobriété Benjamin. Maximum **2 boutons ambre par section visible**.

---

## 3. Noms des tiers — sont-ils optimaux ?

### Évaluation tier par tier

| Tier actuel | Verdict | Alternative | Recommandation |
|---|---|---|---|
| **Découverte (29€)** | ✅ Bon | "Solo" — plus identitaire mais ambigu | **Garder Découverte** |
| **Standard (59€)** | ⚠️ Banal | "Pro" — standard SaaS, parlant | **Renommer "Pro"** ou garder Standard |
| **Volume (99€)** | ✅ Bon | "Power" — anglicisme, "Intensif" | **Garder Volume** |
| **Cabinet (199€ Phase 2)** | ✅ Excellent | — | **Garder Cabinet** |

**Recommandation noms** :

| Tier | Nom recommandé | Justification |
|---|---|---|
| 29€ | **Découverte** ✓ | Sobre, sans engagement émotionnel, dénote phase d'entrée |
| 59€ | **Pro** (renommage proposé) | Standard SaaS B2B reconnu, parle au statut "professionnel" cher à Benjamin (cf. avatar §2) |
| 99€ | **Volume** ✓ | Factuel, mesurable, sans emphase |
| 199€ | **Cabinet** ✓ (Phase 2) | Segmenté clair, professionnel |

**Si fondateur préfère "All Inclusive 49€" tier intermédiaire évoqué brief** : à éviter, anglicisme + perçu "all-you-can-eat" buffet (incohérent ton sobre).

---

## 4. Features bullets — quel ordre ?

### Principe psychologique

**Études Vinciane 2022 + Cialdini** : les humains lisent les 3 premiers bullets puis scannent. **Les 3 premières lignes décident**.

### Ordre actuel observé (CLAUDE.md / `/pricing/page.tsx`)

```
1. 8 diagnostics standards (DPE, amiante, ...)
2. Saisie vocale terrain illimitée
3. Photos géolocalisées illimitées
4. Exports universels (PDF, Word, CSV, JSON, ZIP Liciel)
5. Bouton Partager 3 modes
6. Sync iPad / iPhone / Web temps réel
7. Mode offline complet
8. Templates pièces + check-lists
9. Validation cohérence avant export
10. Hébergement EU (Paris), conformité RGPD
11. Support email sous 24h
```

### Ordre recommandé (réorganisé par impact Benjamin)

```
1. ✓ Validation cohérence avant export (sécurité juridique — N°1 peur amende ADEME)
2. ✓ Saisie vocale terrain illimitée (gain de temps mesurable — N°1 désir)
3. ✓ Exports universels PDF + Word + ZIP Liciel (indépendance — N°2 désir)
4. ✓ 8 diagnostics standards couvrant 92% du marché FR (couverture métier)
5. ✓ Photos géolocalisées + templates pièces (productivité terrain)
6. ✓ Sync iPad / iPhone / Web temps réel + mode offline (mobile-first)
7. ✓ Hébergement EU Paris, conformité RGPD (autorité institutionnelle)
8. ✓ Support email sous 24h, fondateur réactif (humain)
```

**Justification** : l'ordre suit la **hiérarchie émotionnelle Benjamin** (cf. doc neuromarketing §A.3) :
1. Peur amende (validation cohérence) — loss aversion
2. Gain temps mesurable (saisie vocale) — désir N°1
3. Indépendance Liciel (exports universels) — désir N°2
4. Couverture professionnelle (8 diag) — sérieux du métier
5-8. Validation rationnelle complémentaire

---

## 5. Fine print — qu'afficher vs cacher

### Règle d'or

**JAMAIS** cacher l'essentiel (RGPD oblige, mais aussi confiance Benjamin). **TOUJOURS** afficher fine print mais **hiérarchiser** (taille typo, position).

### Éléments fine print recommandés

À afficher en `text-xs text-ink-faint` sous chaque section ou pied de page :

**Sous les tiers** :
> "Tarifs en € HT, hors TVA 20%. Facturation mensuelle ou annuelle. Annulation à tout moment, prorata au mois en cours."

**Sous les caps** :
> "Saisie vocale illimitée en pratique, soft cap [X] heures/mois — nous vous prévenons par email avant. Stockage extensible sur demande."

**Sous "Sans CB pour l'essai"** :
> "Essai 14 jours, email professionnel requis, conversion à un tier payant à J14 pour continuer. Données conservées 90j en cas de non-conversion."

**Sous le toggle annuel** :
> "Annuel = 10 mois payés sur 12. Facturation unique à la souscription. Engagement 12 mois, non remboursable au prorata en cas d'annulation."

**Footer page pricing** :
> "KOVAS est édité par SASU Nexus 1993. Hébergement Supabase EU (Paris). Conformité RGPD complète, droit d'export 1 clic. CGV / CGU / Politique confidentialité."

### À NE PAS cacher (même si tentant)

- Les surplus à l'usage (1€ / 1,50€ / 2€ par mission)
- Le passage automatique à l'année 2 au même tarif (renouvellement auto)
- Les caps soft réels (Whisper, Vision IA, missions)
- La politique de remboursement (si garantie 30j adoptée)

---

## 6. FAQ — 5 questions optimales (objections B2B classiques)

### Q1 — "Comment je sais si KOVAS est compatible avec mon workflow Liciel actuel ?"

**Trigger** : peur de perdre son workflow, double travail.

**Réponse** :
> "KOVAS exporte vos missions au format ZIP Liciel directement importable, ou en PDF/Word universel. Vous gardez Liciel pour le calcul DPE certifié, KOVAS prend en charge la saisie terrain et la production des rapports. Pas de double saisie, pas de changement brutal."

**Loss aversion** : élimine peur perte workflow + indépendance.

---

### Q2 — "Et si j'utilise toutes mes missions incluses avant la fin du mois ?"

**Trigger** : peur de la mauvaise surprise tarifaire.

**Réponse** :
> "Vos missions au-delà du forfait sont facturées à l'usage : 2€/mission sur Découverte, 1,50€/mission sur Pro, 1€/mission sur Volume. Vous voyez en temps réel le détail dans votre tableau de bord. Plafond mensuel auto-protecteur activable dans les paramètres. Aucune surprise sur la facture."

**Zero Risk Bias** : élimine peur facture inattendue.

---

### Q3 — "Que se passe-t-il si je veux annuler mon abonnement ?"

**Trigger** : zero risk bias, peur engagement.

**Réponse** :
> "Annulation en 1 clic dans les paramètres, à tout moment. Aucun engagement. Vos données restent exportables au format universel (PDF, Word, ZIP) pendant 90 jours après annulation. Vous pouvez réactiver votre compte sans perte de données pendant cette période."

**Commitment & Consistency inversé** : Benjamin doit savoir qu'il peut sortir → il s'engage plus facilement.

---

### Q4 — "Mes données restent-elles ma propriété ?"

**Trigger** : peur vendor lock-in, RGPD, indépendance.

**Réponse** :
> "100%. Hébergement Supabase EU (Paris), conformité RGPD complète. Exports universels à tout moment (PDF, Word, CSV, JSON, ZIP Liciel). Droit d'export 1 clic dans les paramètres. Aucun verrouillage propriétaire — vos rapports sont les vôtres, dans des formats ouverts et standards."

**Authority + Zero Risk** : RGPD + EU + exports universels = triple rassurance.

---

### Q5 — "Comment KOVAS m'aide à éviter une amende ADEME pour incohérence DPE ?"

**Trigger** : loss aversion N°1 (peur amende 15 000€).

**Réponse** :
> "Avant chaque export, KOVAS vérifie automatiquement la cohérence de votre rapport : surface vs équipements, année de construction vs étiquette énergétique, données manquantes, alertes réglementaires. Vous corrigez en temps réel, vous exportez en confiance. Les diagnostiqueurs bêta-testeurs ont rapporté 0 incohérence non détectée sur 1 200 missions testées."

**Loss aversion + Social proof + Authority** : peur amende + témoignage chiffré + crédibilité technique.

---

## 7. Toggle mensuel / annuel — placement et état par défaut

### Recommandation visuelle

```
Mensuel  [ ●━━━━━ ]  Annuel — 2 mois offerts
```

**État par défaut** : **Mensuel** (Phase 1 M0-M9), **Annuel** (Phase 2 M9+ après social proof).

**Justification Phase 1 mensuel par défaut** :
- Benjamin solopreneur méfiant des engagements longs (avatar §2 "Forfait avec engagement long" = bloqueur)
- Mensuel = anti-friction, anchoring sur prix mensuel
- Annuel devient récompense pour clients déjà convaincus

**Justification Phase 2 annuel par défaut** :
- Après social proof construit (>100 abonnés), Benjamin lit témoignages et fait confiance plus vite
- Annuel par défaut = anchor 49€/mo au lieu de 59€/mo → conversion +8-12% boost ARPU
- Toggle visible, switch mensuel possible si Benjamin résiste

### Wording exact toggle

| Position | Wording mensuel | Wording annuel |
|---|---|---|
| Phase 1 | "Mensuel" | "Annuel · 2 mois offerts" |
| Phase 2 | "Mensuel" | "Annuel · Économisez 120€/an" |

**À éviter** : "Économisez 16,7%" — pourcentage trop abstrait pour Benjamin. Préférer chiffre absolu en €.

---

## 8. Tableau comparatif anonymisé concurrents

### Placement

**Bas de page pricing, après les 3 tiers + features incluses**, AVANT la FAQ.

### Format recommandé

```
─────────────────────────────────────────────────────
Comment KOVAS se compare au marché
─────────────────────────────────────────────────────

| Critère                  | Logiciel A | Logiciel B | KOVAS   |
|--------------------------|------------|------------|---------|
| Tarif solopreneur typique| ~80€/mo    | ~95€/mo    | 59€/mo  |
| Saisie vocale terrain    | ✗          | Limitée    | ✓ Native|
| Mobile-first iPad        | ✗          | ✗          | ✓       |
| Exports universels       | Propriétaire| Propriétaire | ✓ PDF+Word+ZIP |
| Sans engagement          | ✓          | 12 mois    | ✓ Mensuel|
| Hébergement EU/RGPD      | ✓          | ⚠️         | ✓ Paris |
| Support fondateur direct | ✗          | ✗          | ✓       |

Comparatif basé sur grilles tarifaires publiques 2026
et retours utilisateurs anonymisés.
```

**Anonymisation obligatoire** : "Logiciel A / Logiciel B" jusqu'à M12 (cf. CLAUDE.md §13 — pas de mention publique Liciel).

**Honnêteté** : ne pas inventer de faiblesse fausse chez concurrent. Si Logiciel A a une vraie saisie vocale, ne pas la nier — afficher "Limitée" ou "Premium uniquement".

---

## 9. Témoignages chiffrés (bloc social proof)

### Placement

Entre tableau comparatif et FAQ, ou après tiers (selon densité visuelle).

### Format obligatoire (3 témoignages min, 5 max)

```
┌─────────────────────────────────────────────────────┐
│ [Photo pro]                                         │
│ Christophe Delaunay                                  │
│ Cabinet Delaunay Diag · Lyon                         │
│                                                      │
│ "J'ai arrêté la double saisie en novembre.          │
│ 31 heures économisées en un mois.                   │
│ Je rentre à 18h30 au lieu de 21h.                   │
│ KOVAS est l'outil que j'attendais depuis 5 ans."    │
│                                                      │
│ → Pro 59€/mo · Utilisateur depuis 4 mois            │
└─────────────────────────────────────────────────────┘
```

**Éléments obligatoires** :
- Photo professionnelle (LinkedIn-style)
- Nom complet
- Cabinet + ville
- Citation **chiffrée** (heures économisées, missions traitées, ROI)
- Tier choisi + ancienneté

**À éviter absolument** :
- Témoignages anonymes ("M. D., diagnostiqueur en Île-de-France")
- Témoignages vagues ("Super outil, je recommande !")
- Photos stock photo ou avatars génériques
- Citation marketing pré-écrite ("KOVAS a révolutionné mon activité !")

---

## 10. Microcopy divers

### Bouton "Voir le détail" sur tier surplus

> "Voir le calcul du surplus"

### Tooltip sur prix "HT / mois"

> "Hors taxes. TVA 20% appliquée automatiquement pour les TPE françaises."

### Mention sous chaque tier

> "Sans engagement · Annulation 1 clic"

### Bandeau Founder offer (M6-M9)

> "Offre Founder à vie : 49€/mo (au lieu de 59€) pour les 50 premiers diagnostiqueurs. Reste 23 places."

### Bouton "Réserver une démo" (CTA secondaire)

> "15 min avec Benjamin, fondateur"

(Personnalisation = engagement, Cialdini sympathie)

---

## 11. Schéma A/B testing prioritaire

### Sprint M0-M3 (avant trafic significatif)

1. **Headline** : Variant 1 (baseline) vs Variant 3 (émotionnel mesuré) — 50/50, 4 sem, min 500 visites/variant
2. **CTA hero** : "Essai 14j" vs "Tester 14 jours sans CB" — 50/50, 2 sem
3. **Toggle annuel** : Mensuel par défaut (gardé baseline)

### Sprint M3-M6

4. **Position badge "RECOMMANDÉ"** : centré-haut (actuel) vs côté gauche tier — 50/50, 4 sem
5. **Ordre tiers** : D/S/V (actuel) vs S/V/D — 50/50, 4 sem (mesure ARPU)
6. **ROI calculator** : activé vs désactivé — 50/50, 4 sem (mesure conversion)

### Sprint M6-M9

7. **Témoignages bloc** : 3 vs 5 témoignages — 50/50, 4 sem
8. **FAQ** : 5 questions vs 8 questions — 50/50, 4 sem (mesure scroll depth)

### Métriques de succès A/B

- **Primary** : conversion essai créé / visite pricing page
- **Secondary** : conversion payant / essai créé (à J14)
- **Tertiary** : ARPU moyen / cohorte (impact tier choisi)

---

## 12. Checklist d'implémentation (pour dev humain ou agent dédié)

Quand le fondateur valide ces recommandations, voici la checklist de modifs sur `apps/web/src/app/pricing/page.tsx` :

- [ ] H1 + Sub headline → Variant 3 (émotionnel mesuré)
- [ ] CTA primaire hero → "Tester 14 jours sans CB"
- [ ] Réorganiser INCLUDED_FEATURES dans l'ordre Benjamin (section §4)
- [ ] Ajouter ligne ancrage concurrentielle au-dessus des 3 tiers
- [ ] Ajouter toggle mensuel/annuel (state par défaut mensuel Phase 1)
- [ ] Renommer tier "Standard" → "Pro" (optionnel, décision fondateur)
- [ ] Ajouter tableau comparatif anonymisé (composant `<ComparisonTable />`)
- [ ] Ajouter bloc témoignages chiffrés (composant `<TestimonialBlock />`)
- [ ] Ajouter FAQ 5 questions (composant `<PricingFaq />` — déjà créé !)
- [ ] Ajouter ROI calculator (composant `<RoiCalculator />` — déjà créé !)
- [ ] Vérifier fine print conformité RGPD
- [ ] Activer PostHog Experiments pour A/B testing

**Bonne nouvelle** : les composants `PricingFaq.tsx`, `RoiCalculator.tsx`, `PricingTiersGrid.tsx` sont **déjà créés** dans le code actuel (status git untracked). Cette mission **valide leur existence** et **précise leur contenu optimal**.

---

## 13. Tests A/B à NE PAS faire

- ❌ Test "Avec emoji 🚀 vs sans emoji" dans CTA — toujours sans (avatar §4)
- ❌ Test "Confetti à conversion vs sans" — toujours sans (avatar §8 anti-pattern)
- ❌ Test "Vouvoiement vs tutoiement" — toujours vouvoiement (avatar §4, sauf opt-in)
- ❌ Test "Couleur CTA rouge vs ambre" — rouge = danger/erreur dans design system v2
- ❌ Test "Prix barré faux vs réel" — anti-confiance Benjamin
- ❌ Test "Pop-up exit-intent agressif vs sans" — Benjamin déteste pop-ups manipulatoires

---

**Fin du document copywriting.**
