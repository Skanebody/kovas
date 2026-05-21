# KOVAS — Funnel de conversion onboarding (signup → activation → payment)

**Date** : 2026-05-20
**Statut** : Recommandations stratégiques funnel (pas implémentation)
**Auteur** : Agent E2b
**Authority parent** : [`docs/avatar-client.md`](avatar-client.md) · [`docs/neuromarketing-pricing-strategy.md`](neuromarketing-pricing-strategy.md) · [`CLAUDE.md`](../CLAUDE.md) §6 + §17

> Document de spécification du funnel optimal pour Benjamin (43 ans, ex-cadre, sobre, calculateur). Chaque étape activée par un trigger psychologique précis et mesurable.

---

## 0. Architecture du funnel — vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│ Top-of-funnel (acquisition)                                     │
│   ↓ Page pricing                                                │
│   ↓ CTA "Tester 14 jours sans CB"                               │
├─────────────────────────────────────────────────────────────────┤
│ Signup (J0)                                                     │
│   ↓ Inscription 3 étapes (email pro → mdp → baseline)           │
│   ↓ Email J0 confirmation                                       │
├─────────────────────────────────────────────────────────────────┤
│ Activation (J0-J3)                                              │
│   ↓ Welcome screen + checklist                                  │
│   ↓ 1re mission test (J1-J3)                                    │
│   ↓ Email J+1 tutoriel                                          │
├─────────────────────────────────────────────────────────────────┤
│ Engagement (J3-J11)                                             │
│   ↓ Email humain J+4 (Benjamin fondateur)                       │
│   ↓ Pop-up in-app J+7 (gain réalisé)                            │
│   ↓ Email J+8 ("Comment ça se passe ?")                         │
│   ↓ Email J+11 ("Plus que 3 jours")                             │
├─────────────────────────────────────────────────────────────────┤
│ Conversion (J11-J14)                                            │
│   ↓ Email J+13 ("Demain dernier jour")                          │
│   ↓ Écran conversion J14 (3 tiers + Pro highlighted)            │
│   ↓ Saisie CB Stripe (1 seule fois)                             │
├─────────────────────────────────────────────────────────────────┤
│ Post-paiement (J14-J30)                                         │
│   ↓ Email confirmation paiement                                 │
│   ↓ Premier rapport mensuel projeté (J+30)                      │
│   ↓ NPS survey J+30                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Cibles conversion globales** (cf. CLAUDE.md §6) :
- M0-M6 : **22-28%** essai → payant
- M6-M12 : **18-25%**
- M12+ : **20-25%**

---

## 1. Top-of-funnel — page d'atterrissage et pricing

### Trigger psychologique principal

Activation **Système 1 d'abord** (perception "c'est sérieux, c'est pour moi en 5 secondes"), puis **Système 2** (validation ROI calculator + comparatif).

### Métriques d'entrée

- Trafic LinkedIn (outreach Benjamin) : 60-70% du trafic Phase 1
- Trafic SEO (mots-clés métier) : 15-20%
- Trafic referral (parrainage advisor) : 10-15%
- Trafic direct (presse, podcast) : 5-10%

### Conversion attendue page d'atterrissage → page pricing

- **Cible** : 35-45% des visiteurs page d'accueil cliquent vers `/pricing` ou `/signup`
- **Métrique tracking** : PostHog event `pricing_page_viewed` après `homepage_viewed`

### Conversion page pricing → signup

- **Cible** : 8-12% des visiteurs page pricing cliquent CTA "Essai 14j"
- **Levier neuromarketing principal** : ROI calculator interactif + témoignages chiffrés
- **Métrique tracking** : PostHog event `signup_intent_clicked` from `pricing_page`

---

## 2. Signup (J0) — étapes minimales

### Architecture recommandée : 3 étapes max

#### Étape 1 — Email professionnel + mot de passe (30s)

```
┌──────────────────────────────────────────────────────┐
│ Créer votre compte KOVAS                             │
│                                                       │
│ Email professionnel*                                  │
│ [pierre.dupont@cabinet-diag.fr               ]       │
│                                                       │
│ Mot de passe* (min 12 caractères)                    │
│ [••••••••••••                                ]       │
│                                                       │
│ □ J'accepte les CGU et la politique RGPD             │
│                                                       │
│ [ Continuer → ]                                       │
│                                                       │
│ Déjà un compte ? Se connecter                        │
└──────────────────────────────────────────────────────┘
```

**Triggers psychologiques** :
- **Email pro requis** (pas gmail/yahoo) : filtrage qualitatif, signal de sérieux
- **Pas de CB demandée** : Zero Risk Bias activé
- **3 champs seulement** : friction minimale (Commitment & Consistency — premier engagement micro)
- **Validation domaine pro** côté serveur (API INSEE Sirene + check MX records)

**Anti-frictions critiques** :
- Pas de captcha (sauf détection abus IP)
- Pas de "Confirmez votre email" exigé avant continuer (envoyé en arrière-plan)
- Pas de 2FA obligatoire dès signup (proposé en paramètres post-onboarding)

**Métriques** :
- **Conversion étape 1 → étape 2** : >85% cible
- **Drop-off principal** : email gmail/yahoo bloqué → message clair *"Email professionnel requis. Utilisez l'email de votre cabinet (ex: contact@votrecabinet.fr)."*

#### Étape 2 — Identité cabinet (1 min)

```
┌──────────────────────────────────────────────────────┐
│ Présentez-vous                                       │
│                                                       │
│ Prénom*                                               │
│ [Pierre                                       ]       │
│                                                       │
│ Nom*                                                  │
│ [Dupont                                       ]       │
│                                                       │
│ Nom du cabinet                                        │
│ [Cabinet Dupont Diagnostics                   ]       │
│                                                       │
│ SIRET (facultatif, vérifié si fourni)                │
│ [12345678901234                              ]       │
│                                                       │
│ [ Continuer → ]                                       │
└──────────────────────────────────────────────────────┘
```

**Triggers psychologiques** :
- **Vouvoiement par défaut** : "Présentez-vous" (avatar §4)
- **SIRET facultatif mais valorisé** : si fourni, vérification INSEE Sirene → badge "Vérifié" → trust signal
- **Pas de questionnaire de personnalité** (anti-pattern avatar §2 "Onboarding complexe")

**Métriques** :
- **Conversion étape 2 → étape 3** : >90% cible
- **SIRET fourni** : >60% cible (boost si valorisé par badge)

#### Étape 3 — Baseline (2 questions, 30s — pour Gain Tracker post-launch)

```
┌──────────────────────────────────────────────────────┐
│ Pour personnaliser votre tableau de bord             │
│                                                       │
│ En moyenne, combien de missions par mois ?           │
│ ○ 10-30   ○ 30-50   ○ 50-75                          │
│ ○ 75-100  ○ 100-150 ○ Plus de 150                    │
│                                                       │
│ Temps actuel par mission (terrain + bureau) ?        │
│ ○ 2h     ○ 3h     ○ 4h     ○ 5h+                     │
│                                                       │
│ Ces 2 questions nous servent à calculer votre        │
│ gain de temps personnalisé. Modifiable ensuite.      │
│                                                       │
│ [ Terminer mon inscription → ] [ Passer (utilise   │
│                                  moyenne globale) ]   │
└──────────────────────────────────────────────────────┘
```

**Triggers psychologiques** :
- **2 questions max** (avatar §2 anti-pattern : "Onboarding complexe = 4 questions")
- **Choix radio** (pas de saisie libre) — réduit la charge cognitive
- **"Passer" possible** : Zero Risk Bias + autonomie respectée
- **Justification visible** : *"Pour calculer votre gain"* → engagement Système 2

**Métriques** :
- **Conversion étape 3 → activation** : >95% (étape facile)
- **Complétion baseline (pas "Passer")** : >70% cible

---

## 3. Activation (J0-J3) — premier "wow moment"

### Trigger psychologique

**Commitment & Consistency** (Cialdini principe 2) : Benjamin a investi du temps d'inscription, il doit voir une **valeur immédiate** sinon abandon (perte 40-60% des essais qui ne convertissent jamais en utilisateurs actifs).

### Welcome screen (J0, post-signup)

```
┌──────────────────────────────────────────────────────────┐
│ Bienvenue Pierre.                                        │
│                                                          │
│ Voici votre tableau de bord KOVAS.                       │
│ Vous avez 14 jours pour découvrir l'outil sans CB.      │
│                                                          │
│ Pour commencer :                                          │
│                                                          │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ✓ Créer mon premier dossier diagnostic             │  │
│ │   (recommandé — 5 min pour découvrir l'essentiel)  │  │
│ │                                                     │  │
│ │ [ Démarrer mon 1er dossier → ]                     │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Ou explorer :                                            │
│ • Importer une mission existante depuis Liciel ZIP       │
│ • Personnaliser le branding de mes rapports              │
│ • Voir la démo guidée (5 min vidéo)                      │
│                                                          │
│ Une question ? benjamin@kovas.fr (fondateur)            │
└──────────────────────────────────────────────────────────┘
```

**Triggers psychologiques** :
- **Une action principale claire** (pas paralysie de choix)
- **3 actions secondaires optionnelles** (autonomie)
- **Email fondateur visible** (Authority + Sympathie Cialdini)
- **"5 min"** : temporalité bornée rassurante

**Métriques** :
- **Activation J0 (clic "Démarrer mon 1er dossier")** : >65% cible
- **Drop-off welcome → activation** : <35%

### 1re mission test (J0-J3)

**Cible** : Benjamin doit créer **au moins 1 mission** pendant les 3 premiers jours. Sinon, conversion essai→payant chute de 70-85% (benchmarks SaaS B2B).

**Guide pas-à-pas in-app** (pas tutoriel vidéo, pas "tour" intrusif — avatar §2 anti-pattern) :

```
Étape 1/5 — Adresse du bien
[Champ auto-complétion BAN]
✓ Bien situé à Dieppe (76200) — 124 m²

Étape 2/5 — Type de diagnostic
○ DPE   ○ Amiante   ○ Plomb CREP   ○ ...

Étape 3/5 — Saisie vocale terrain (mode démo)
[Bouton micro] "Cliquez pour commencer la dictée"

Étape 4/5 — Photos (mode démo, optionnel)
[Upload de photos d'exemple ou skip]

Étape 5/5 — Génération du rapport
[Bouton "Générer mon rapport"]
✓ PDF généré · ✓ ZIP Liciel exporté

→ Badge "1er dossier complété ✓" affiché sobrement dans profil
```

**Triggers psychologiques** :
- **5 étapes courtes** (pas 1 formulaire long de 30 champs)
- **Auto-complétion adresse** : démo immédiate de la valeur "saisie réduite"
- **Saisie vocale en démo** : Benjamin teste **la** feature différenciante N°1
- **Badge sobre** : IKEA Effect (premier investissement) + Commitment

**À éviter absolument** :
- Confettis post-mission ✗
- "Bravo Pierre ! 🎉 Tu as déverrouillé le badge LÉGENDE !" ✗
- Notification festive sonore ✗
- Animations excessives ✗

**Wording badge correct** (avatar §7) :
> *"Vous avez complété votre premier dossier. Bienvenue parmi les utilisateurs actifs."*

### Email J+1 — Tutoriel (auto)

**Objet** : *"Comment réussir votre prochain dossier en 30 min — guide pratique"*

**Format** :
- HTML simple, signature Benjamin manuscrite
- 5 tips concrets et chiffrés
- 1 CTA principal : *"Voir la démo de la saisie vocale"* (2 min vidéo)
- Pas d'animation, pas d'émoji flashy

**Triggers** :
- Reciprocity (Benjamin offre un guide gratuit)
- Authority (fondateur, expert métier)

---

## 4. Engagement (J3-J11) — construction du commitment

### Email J+4 — Touche humaine Benjamin

**Type** : Email texte simple, **PAS HTML**, signature manuscrite.

**Format exact recommandé** :

```
Objet : Pierre, comment vous trouvez KOVAS ?

Bonjour Pierre,

C'est Benjamin, fondateur de KOVAS.

Vous avez démarré votre essai il y a 4 jours.
J'aimerais savoir comment ça se passe pour vous.

Avez-vous pu tester la saisie vocale sur une vraie mission ?
Y a-t-il quelque chose qui vous bloque ou qui n'est pas clair ?

Je lis personnellement chaque réponse et je peux faire
un appel de 15 min cette semaine si besoin.

Répondez simplement à cet email, je vous lis.

Bonne fin de semaine,

Benjamin Bel
Fondateur — KOVAS
benjamin@kovas.fr
+33 X XX XX XX XX (réponse sous 24h)
```

**Triggers psychologiques** :
- **Liking / Sympathie** (Cialdini principe 5) : Benjamin se présente humain
- **Reciprocity** : offre 15 min de son temps personnel
- **Authority** : fondateur direct, pas chat bot
- **Specificity** : mentionne "saisie vocale", feature différenciante N°1

**À éviter** :
- Template HTML clinquant
- Signature avec photo + titre "CEO & Founder 🚀"
- "L'équipe KOVAS" (impersonnel)

**Métriques** :
- **Taux d'ouverture** : >55% cible (vs ~22% email marketing classique)
- **Taux de réponse** : 8-12% cible (très élevé pour B2B)
- **Taux d'activation post-email** : +15-20% vs pas d'email humain

### Pop-up in-app J+7 — Gain réalisé (Système 2 activation)

**Trigger** : 7 jours après signup, Benjamin a (idéalement) traité 2-5 missions dans KOVAS.

**Pop-up sobre, fermable** :

```
┌──────────────────────────────────────────────────┐
│ Votre bilan à J+7                                 │
│                                                   │
│ Missions traitées avec KOVAS :  4                │
│ Temps économisé estimé :        9h 47min         │
│ Productivité libérée :          979€             │
│                                                   │
│ Soit l'équivalent d'une journée et demie         │
│ de travail libérée en une semaine.                │
│                                                   │
│ ─────────────────────────────────────────────    │
│                                                   │
│ Il vous reste 7 jours d'essai.                   │
│ Sans engagement, sans CB.                        │
│                                                   │
│ [ Continuer mon essai ] [ Voir les tarifs ]      │
└──────────────────────────────────────────────────┘
```

**Triggers psychologiques** :
- **Loss Aversion** : "Il vous reste 7 jours" (pas "Plus que 7 jours" — neutre vs alarmant)
- **Demonstrated value** (Système 2) : chiffres réels personnels
- **Commitment** : Benjamin a déjà gagné 9h47, ne veut pas perdre cet acquis

**Anti-patterns évités** :
- Pas de "Vous économisez du temps incroyable !" — chiffre précis seulement
- Pas de gradients colorés
- Fermable sans friction

### Email J+8 — "Comment ça se passe ?" (automatique)

**Format** : HTML simple, signature Benjamin.

**Contenu** :
- Récapitulatif des missions traitées (chiffre réel)
- Lien vers 3 tips d'utilisation avancée
- Bouton "Démo personnalisée 15 min" (Calendly)

**Triggers** :
- Reciprocity (offre tips)
- Authority (expertise produit)

### Email J+11 — "Plus que 3 jours"

**Format** : HTML simple, signature Benjamin.

**Objet** : *"Pierre, plus que 3 jours d'essai — voici votre offre"*

**Contenu** :
```
Bonjour Pierre,

Votre essai KOVAS se termine dans 3 jours.

Récap personnel :
• Missions traitées : [X]
• Temps économisé : [Y]h
• Productivité libérée : [Z]€

Pour continuer après le [date J14], choisissez votre tier :

┌─────────────┬─────────────┬─────────────┐
│ Découverte  │ Pro         │ Volume      │
│ 29€/mo      │ 59€/mo      │ 99€/mo      │
│ 20 missions │ 60 missions │ 150 mission │
└─────────────┴─────────────┴─────────────┘

[ Voir les tarifs et choisir ]

Une question avant de souscrire ? Répondez simplement.

Benjamin
```

**Triggers psychologiques** :
- **Loss Aversion soft** : "Se termine dans 3 jours" (factuel)
- **Decoy Effect** : 3 tiers, Pro mis en avant subtilement
- **Reciprocity** : Benjamin offre encore son temps "Une question ?"

---

## 5. Conversion (J11-J14)

### Email J+13 — "Demain dernier jour"

**Objet** : *"Demain est le dernier jour de votre essai"*

**Format texte simple** :

```
Bonjour Pierre,

Votre essai se termine demain.

Si vous souhaitez continuer à utiliser KOVAS,
voici le récapitulatif personnalisé :

Votre activité sur 14 jours :
• Missions traitées : [X]
• Temps économisé : [Y]h
• Soit l'équivalent de [Z] journées de travail libérées

Recommandation basée sur votre usage :
→ Tier Pro 59€/mo (60 missions incluses)

[ Choisir mon tier et continuer ]

Témoignage :
"J'ai démarré KOVAS en septembre. 31h économisées
en novembre. Pour 59€/mo, c'est l'évidence."
— Christophe Delaunay, Cabinet Delaunay Diag, Lyon

Si vous préférez ne pas continuer, votre compte sera
gelé pendant 90 jours et vos données restent
récupérables.

Une question ? Répondez à cet email.

Benjamin
```

**Triggers psychologiques** :
- **Loss Aversion explicit** : "se termine demain"
- **Personalized recommendation** : Pro 59€ → Benjamin pense "ils me comprennent"
- **Social Proof chiffré** : témoignage avec chiffres
- **Zero Risk Bias** : compte gelé 90j, données récupérables

### Écran conversion J14

**Si Benjamin se connecte le J14 ou J15** :

```
┌────────────────────────────────────────────────────────┐
│ Bonjour Pierre,                                        │
│                                                        │
│ Votre essai est terminé.                              │
│ Pour continuer à utiliser KOVAS, choisissez votre tier.│
│                                                        │
│ Votre activité sur 14 jours :                         │
│ • [X] missions • [Y]h économisées • [Z]€ libérés      │
│                                                        │
│ ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│ │ Découverte │  │ Pro        │  │ Volume     │       │
│ │ 29€/mo     │  │ 59€/mo     │  │ 99€/mo     │       │
│ │            │  │ RECOMMANDÉ │  │            │       │
│ │ 20 miss.   │  │ 60 miss.   │  │ 150 miss.  │       │
│ │            │  │ (votre     │  │            │       │
│ │            │  │  usage)    │  │            │       │
│ │ [Choisir]  │  │ [Choisir]  │  │ [Choisir]  │       │
│ └────────────┘  └────────────┘  └────────────┘       │
│                                                        │
│ ─────────────────────────────────────────────         │
│ ○ Mensuel        ● Annuel — 2 mois offerts            │
│                                                        │
│ Sans engagement · Annulation 1 clic                   │
│ Données conservées 90j si vous ne convertissez pas    │
└────────────────────────────────────────────────────────┘
```

**Triggers psychologiques** :
- **Personalized recommendation** : tier Pro marqué "votre usage"
- **Decoy Effect** : 3 tiers, Pro highlighted
- **Annual switch** : par défaut OFF (Phase 1), peut être tested ON Phase 2
- **Anti-friction** : Stripe Checkout sur la même page, pas redirect

### Saisie CB Stripe — 1 seule fois

**Principe (CLAUDE.md §5)** : CB enregistrée une seule fois, **jamais redemandée** pour dépassements ou changements de tier.

**Flow** :
1. Benjamin clique "Choisir Pro"
2. Modal Stripe Checkout intégré (pas redirect)
3. Saisie CB + acceptation CGV
4. Confirmation → compte activé immédiatement

**Trigger psychologique** :
- **Anti-friction maximale** : moins de 30s pour finaliser
- **Stripe = trust** : Authority brand reconnu

### Si non-conversion à J14

**Compte gelé pendant 90 jours** :
- Données conservées
- Email J+30 : *"Vous pouvez réactiver votre compte en 1 clic"*
- Email J+60 : *"Plus que 30 jours pour récupérer vos données"*
- Email J+85 : *"Dernière chance avant suppression définitive"*

**Métriques** :
- **Conversion essai → payant J14** : 22-28% cible Phase 1
- **Conversion essai gelé → réactivation** : 3-5% cible (boost via emails)

---

## 6. Post-paiement (J14-J30)

### Email confirmation paiement

**Format sobre, signature Benjamin** :

```
Objet : Votre abonnement KOVAS Pro est activé

Bonjour Pierre,

Votre abonnement Pro 59€/mois est activé.
Première facture : 59€ HT (70,80€ TTC) — déjà prélevée.
Prochaine facture : [date] — prélèvement automatique.

Vous avez accès à :
• 60 missions/mois incluses
• Saisie vocale terrain illimitée
• Exports universels (PDF + Word + ZIP)
• Support email sous 24h

Pour toute question, répondez à cet email.

Benjamin
```

### J+15 — Email "Bienvenue dans la communauté"

**Trigger** : Onboarding social (Cialdini Unité, principe 7).

**Contenu** :
- Présentation rapide de la communauté KOVAS (LinkedIn group privé)
- Invitation à rejoindre 1 webinaire mensuel fondateur
- Mention des autres utilisateurs (nombres, types de cabinets)

### J+30 — Premier rapport mensuel projeté + NPS survey

**Email rapport mensuel** : cf. [`gain-tracker-system.md`](gain-tracker-system.md) §2 Élément 5 (V1.5 post-launch).

**NPS Survey court** :
- 1 question : *"Sur une échelle de 0 à 10, recommanderiez-vous KOVAS à un confrère diagnostiqueur ?"*
- 1 follow-up : *"Pourquoi cette note ?"* (texte libre)
- Envoyé via email + in-app
- Cible : NPS >40 M6, >55 M12

---

## 7. Métriques par étape — vue consolidée

| Étape | Métrique principale | Cible M6 | Cible M12 |
|---|---|---|---|
| Top-of-funnel (visite pricing) | Pricing page → CTA clic | 8% | 12% |
| Signup étape 1 | Étape 1 → étape 2 | 85% | 90% |
| Signup étape 2 | Étape 2 → étape 3 | 90% | 92% |
| Signup étape 3 | Étape 3 → compte créé | 95% | 96% |
| Activation J0 | Welcome → 1re mission | 65% | 75% |
| Activation J3 | 1re mission complétée | 55% | 70% |
| Engagement J7 | ≥2 missions traitées | 45% | 60% |
| Engagement J11 | ≥3 missions traitées | 40% | 55% |
| **Conversion J14** | **Essai → payant** | **22%** | **25%** |
| Post-paiement J30 | Activation maintenue | 92% | 95% |
| Rétention M3 | Churn 90j | <8% | <5% |

---

## 8. Tests A/B prioritaires sur le funnel

| Test | Variant A | Variant B | Métrique |
|---|---|---|---|
| **Email J+4 humain** | Avec photo Benjamin | Sans photo, signature manuscrite | Taux ouverture + réponse |
| **Email J+4 wording** | "Comment vous trouvez ?" | "Avez-vous testé la saisie vocale ?" | Taux réponse |
| **Pop-up J+7** | Avec chiffre productivité libérée € | Sans chiffre € (juste temps) | Conversion J14 |
| **Toggle annuel J14** | OFF par défaut | ON par défaut | ARPU + conversion |
| **Tier highlighted J14** | Pro 59€ | Recommandation personnalisée (basée usage réel essai) | Conversion + ARPU |

---

## 9. Anti-patterns à éviter (avatar §8)

1. ⛔ **Notifications push >1/jour** (avatar §8 anti-pattern N°5) — JAMAIS pendant onboarding
2. ⛔ **Wording infantilisant** : "Bravo champion !", "Tu as réussi !", "Yay 🎉"
3. ⛔ **Pop-ups exit-intent agressifs** : "Attendez ! 50% de réduction si vous restez !"
4. ⛔ **Faux compteurs de scarcity** : "Plus que 47 places !" (faux)
5. ⛔ **Onboarding tour intrusif** : "tooltip 1/15" qui bloque l'usage
6. ⛔ **Demande de témoignage trop tôt** : pas avant J30 minimum
7. ⛔ **Email "Vous nous manquez" 1 semaine après churn** : trop tôt, manipulatoire
8. ⛔ **Vouvoiement → tutoiement sans opt-in** : avatar §4

---

## 10. Checklist d'implémentation

Pour le sprint d'implémentation onboarding (post-validation fondateur) :

### Côté code (apps/web/src/app)

- [ ] Wireframes signup 3 étapes (`/signup` actuel à valider)
- [ ] Welcome screen `/onboarding/welcome` avec checklist
- [ ] Guide 1re mission in-app (composant `<FirstMissionGuide />`)
- [ ] Badge "1er dossier complété" sobre dans profil
- [ ] Pop-up in-app J+7 (composant `<TrialMidpointPopup />`)
- [ ] Écran conversion J14 (composant `<TrialEndScreen />`)
- [ ] Page de gel compte 90j (composant `<FrozenAccountPage />`)

### Côté emails (Resend templates)

- [ ] Email J+1 tutoriel (HTML simple)
- [ ] Email J+4 humain Benjamin (TEXT only)
- [ ] Email J+8 "Comment ça se passe" (HTML simple)
- [ ] Email J+11 "Plus que 3 jours" (HTML simple)
- [ ] Email J+13 "Demain dernier jour" (TEXT only)
- [ ] Email J+15 "Bienvenue communauté"
- [ ] Email J+30 rapport mensuel projeté + NPS survey
- [ ] Emails gel compte (J+30, J+60, J+85)

### Côté tracking (PostHog)

- [ ] Events funnel : `pricing_viewed`, `signup_started`, `signup_step_X_completed`, `welcome_viewed`, `first_mission_created`, `first_mission_completed`, `trial_midpoint_popup_viewed`, `trial_end_screen_viewed`, `conversion_completed`
- [ ] Funnels PostHog configurés pour chaque cohorte (M0-M3, M3-M6, M6-M9)
- [ ] Cohortes : "Activé J3", "Engaged J7", "Converti J14"

### Côté Stripe

- [ ] Webhook subscription created / canceled
- [ ] Stripe Customer Portal pour annulation 1 clic
- [ ] Stripe Tax pour TVA 20% FR

---

## 11. Zones grises à valider avec fondateur

1. **CalendlyVS email pour démo 15 min** : choisi Calendly (anti-friction) ou laisser email ouvert pour Benjamin (plus authentique) ?
2. **Photo Benjamin dans signature email** : oui/non ? Recommandation : non (sobriété), mais à tester A/B.
3. **NPS survey J+30** : in-app only ou email + in-app ? Recommandation : les deux pour maximiser réponses.
4. **Compte gelé 90j** : durée acceptable ? RGPD impose suppression sous 24 mois. 90j = sweet spot rétention sans risque légal.
5. **Témoignages dans emails J+11/J+13** : à constituer dès Phase A bêta (M6-M7). Si pas encore disponibles M9, omettre la section "Témoignage" plutôt qu'en inventer.
6. **Annual ON par défaut J14 vs OFF** : décision fondateur, recommandation Phase 1 = OFF (mensuel par défaut, Benjamin moins méfiant).
7. **Réactivation post-gel** : faut-il appliquer un tarif réduit (-20%) ou tarif normal ? Recommandation : tarif normal (pas de précédent dangereux), mais Cabinet gel >60j peut bénéficier d'un "bonus retour 1 mois offert".

---

## 12. Récapitulatif visuel

```
┌────────────────────────────────────────────────────────────┐
│  CONVERSION FUNNEL KOVAS — Phase 1 (M0-M9)                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Top-of-funnel  : 1000 visites pricing                    │
│                   ↓ 10% = 100 signups démarrés            │
│                                                            │
│  Signup 3 étapes : 100 → 75 comptes créés (75%)           │
│                   ↓ 75% = 56 activés (1re mission)        │
│                                                            │
│  Engagement J7   : 56 → 34 engagés (60%)                  │
│                                                            │
│  Conversion J14  : 34 → 22 payants (65% des engagés)      │
│                                                            │
│  RATIO GLOBAL    : 22 payants / 1000 visites = 2,2%       │
│  CONVERSION ESSAI: 22 / 100 = 22% (cible Phase 1)         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

**Fin du document funnel onboarding.**
