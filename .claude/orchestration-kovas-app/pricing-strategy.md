# KOVAS — Pricing Strategy

**Date** : 2026-05-18
**Statut** : Authority document pricing
**Référencé par** : CLAUDE.md §4, PRD §12, DISCOVERY.md Paquet 6 (RÉVISÉ)

> **Architecture finale** : 4 tiers simplifiés, quotas missions inclus + surplus à l'usage, AUCUN add-on activable, toutes fonctionnalités incluses dans tous les tiers, options ponctuelles à l'usage.

---

## 1. Philosophie

| Principe | Implémentation |
|---|---|
| Compréhension du pricing en < 5 secondes | 4 tiers + quotas missions visibles + 3 options ponctuelles à l'usage |
| Pas d'effet "j'ai déjà payé pour ça" | AUCUN add-on activable. IA jamais en supplément |
| Confiance utilisateur maximale | Widget transparence permanent, plafond auto-protecteur, email "tu paies trop" auto |
| Cohérence positionnement IA-first | Toutes fonctionnalités IA incluses dans le tier le moins cher (Découverte 29€) |
| Suggestion d'upgrade contextuelle | Notifications positives aux seuils, jamais bloquantes |

---

## 2. Phase 1 — KOVAS Compagnon (M1-M9)

### Tier Découverte — **29€/mois HT**

| Caractéristique | Valeur |
|---|---|
| Missions incluses | 20 |
| Surplus | 2€/mission |
| Utilisateurs | 1 |
| Toutes fonctionnalités IA | ✅ (vocal Whisper, vision Phase 2, recos F/G Phase 2, croquis manuel) |
| Tous formats d'export | ✅ (PDF, Word, ZIP Liciel, CSV, JSON) |
| Logo cabinet personnalisé sur PDF | ✅ |
| Signature électronique simple (DocuSeal SES) | ✅ |
| Stockage | 20 Go |
| **Cible** | Démarrants, partiels, sceptiques voulant tester sans engager budget |

### Tier Standard (RECOMMANDÉ) — **59€/mois HT**

| Caractéristique | Valeur |
|---|---|
| Missions incluses | 60 |
| Surplus | 1,50€/mission |
| Utilisateurs | 1 |
| Toutes fonctionnalités identiques | ✅ |
| Stockage | 50 Go |
| **Cible** | Solopreneur typique installé (75 missions/mois moyenne) |

### Tier Volume — **99€/mois HT**

| Caractéristique | Valeur |
|---|---|
| Missions incluses | 150 |
| Surplus | 1€/mission |
| Utilisateurs | 1 |
| Toutes fonctionnalités identiques | ✅ |
| Stockage | 100 Go |
| **Cible** | Power user installé (110-130 missions/mois) |

---

## 3. Phase 2 — KOVAS Complet (M10-M18)

### Standard Complet — **99€/mois HT**

60 missions + 1,50€ surplus + moteur DPE certifié ADEME 3CL-2021 intégré (remplace Liciel) + 1 utilisateur.

### Volume Complet — **149€/mois HT**

150 missions + 1€ surplus + moteur DPE certifié ADEME + 1 utilisateur.

### Cabinet — **199€/mois HT**

400 missions + 0,80€ surplus + jusqu'à **3 utilisateurs** + moteur DPE certifié ADEME + **signature eIDAS Yousign incluse** + dashboard analytics avancés + stockage 200 Go.

---

## 4. Phase 3 — KOVAS Augmenté (M19+)

| Tier | Prix HT/mo |
|---|---|
| Standard Augmenté | 149€ |
| Volume Augmenté | 199€ |
| Cabinet Augmenté | 299€ |
| **Enterprise** (4-10 users) | **499€** |

**Ajoute** : assistant IA conversationnel métier + audit énergétique complet + marketplace MAR/RGE avec commissions.

---

## 5. Tarif Founder à vie (40-50 bêta-testeurs M6-M9)

| Période | Tarif |
|---|---|
| **M6-M7** (1 mois) | **Gratuit total** (validation fonctionnelle) |
| **M7-M9** (2 mois) | Tier Découverte **29€/mois** (validation économique willingness-to-pay) |
| **M9+ à vie** | **Standard Founder 49€/mois** (vs 59€ public), **70 missions incluses** (vs 60), **surplus 1€/mission** (vs 1,50€) |
| **Cabinet Phase 2 Founder** | **169€/mois à vie** (vs 199€ public, rabais ~15%) |

**Avantages durables à vie** :
- Badge Founder visible dans le produit
- Accès anticipé features avant rollout général
- Influence directe roadmap (call mensuel fondateur)

---

## 6. Annuel : 2 mois offerts (10 mois payés)

Tous tiers en annuel = **10 mois payés au lieu de 12** (économie 17% pour utilisateur).

**Avantages KOVAS** :
- Réduction churn (engagement annuel)
- Cash-flow upfront (avantage pour solopreneur)

---

## 7. Options ponctuelles (paiement à l'usage)

**AUCUN pack mensuel.** Tout est à l'usage pour rester simple et cohérent avec la philosophie "no add-on mensuel".

| Action | Tarif unitaire |
|---|---|
| Signature eIDAS Yousign (tiers Découverte/Standard/Volume) | **2€/signature** |
| Rapport bilingue FR/EN | **5€/rapport** |
| SMS rappel client J-1 | **0,15€/SMS** |

**Cabinet tier Phase 2+** : signature eIDAS Yousign **incluse** (différentiateur Cabinet).

---

## 8. A/B test pricing Phase 1 au lancement

**Split 50/50 sur 29€ vs autre prix au lancement M9** :
- Variant A : **Découverte 29€** (référence)
- Variant B : **Découverte 39€** (test élasticité)

Feature flag PostHog assigne au signup, stable jusqu'à conversion.
Métriques comparées sur 3 mois : taux conversion essai → payant, churn 30j, churn 90j, MRR/abonné.
Décision finale ~M12 sur données réelles.

---

## 9. Mécaniques anti-friction paiement

### 9.1 CB enregistrée une seule fois

**Stripe Customer + PaymentMethod** créés à la conversion essai → payant. **Jamais redemandée** pour :
- Dépassements de quota
- Changement de tier (upgrade ou downgrade)
- Renouvellements
- Options ponctuelles (eIDAS, bilingue, SMS)

### 9.2 Widget transparence permanent

Position : dashboard, en haut à droite, visible en permanence.

```
┌─────────────────────────────────────────────┐
│ Ce mois : 73 missions • 13 au-delà du forfait│
│ Estimation facture : 78,50€ [Voir le détail] │
└─────────────────────────────────────────────┘
```

Mise à jour **temps réel** à chaque nouvelle mission complétée.

### 9.3 Notifications positives aux seuils

| Seuil | Message |
|---|---|
| **80% du quota** | Info contextuelle, sans stress : "Tu as utilisé 48 missions sur 60 ce mois. Continue à utiliser KOVAS librement." |
| **100% du quota** | Valorisation gain de temps + suggestion contextuelle : "Bravo ! 60 missions ce mois, tu as économisé ~90h vs Liciel + Word. Au-delà : 1,50€/mission. Tu envisages le tier Volume à 99€ (150 missions incluses) ? Tu économiserais 13,50€/mois à partir de la 80ème mission." |
| **150% du quota** | Suggestion explicite passage tier supérieur avec calcul économies : "À 90 missions ce mois sur Standard, tu paies déjà 104€. En tier Volume 99€ tu inclurais 60 missions de plus dans le forfait. Upgrade en 1 clic ?" |

### 9.4 Plafond mensuel auto-protecteur activable

```
┌──────────────────────────────────────────────┐
│ Plafond mensuel maximum : [120€]            │
│                                              │
│ Au-delà : les missions restent fonctionnelles│
│ mais le branding KOVAS revient sur les PDF.  │
└──────────────────────────────────────────────┘
```

**Effet** :
- Sécurité totale utilisateur (jamais de surprise > plafond)
- MRR garanti KOVAS (utilisateur reste actif, ne se désabonne pas)
- Branding KOVAS sur PDF = nudge naturel vers upgrade

### 9.5 Email récap mensuel transparent (28 du mois)

Format simple, humain, transparent :

```
Bonjour Benjamin,

Récap de votre mois de mai 2026 sur KOVAS :

📊 Missions réalisées : 73 (60 inclus + 13 dépassement)
⏱️  Temps économisé estimé : 109h
   = équivalent à 14 jours de productivité libérés !

💰 Facturation :
   - Abonnement Standard : 59€
   - Dépassement (13 × 1,50€) : 19,50€
   - Total HT : 78,50€
   - TVA 20% : 15,70€
   - Total TTC : 94,20€

Prélèvement automatique le 1er juin sur la carte se terminant par ****1234.

À bientôt,
Benjamin (Fondateur KOVAS)
```

### 9.6 Email "Tu paies trop" automatique

Si utilisateur dépasse régulièrement son quota **3 mois consécutifs**, email auto suggestion d'upgrade vers tier plus économique pour lui (**même si MRR baisse temporairement pour KOVAS**).

```
Bonjour Benjamin,

Sur les 3 derniers mois, vous avez en moyenne dépassé votre forfait
Standard de 25 missions (≈ 37,50€ de dépassement par mois).

En tier Volume à 99€/mois (150 missions incluses), vous économiseriez
~22€/mois soit ~264€/an.

Voulez-vous basculer en Volume ? [Oui, je basculer] [Non, je préfère
rester en Standard]

Cette suggestion est automatique et désintéressée. KOVAS préfère que
vous payiez moins que vous changiez d'outil.
```

**Effet** : construit confiance + bouche-à-oreille + réduit churn long terme.

---

## 10. Comparaison concurrents (positioning)

| Logiciel | Prix mensuel | Mode |
|---|---|---|
| **Liciel Suite complète** | 120-200 €/mois | Forfait illimité |
| **Liciel + LICIELWEB + Audit** | 180-250 €/mois | Forfait illimité |
| **ORIS Diag** | 100-180 €/mois | Forfait |
| **Immo-Diag** | 80-150 €/mois | Forfait |
| **AnalysImmo** | 100-180 €/mois | Forfait |
| **KOVAS Phase 1 Compagnon** | **29-99 €/mois** | **Quotas + surplus** |
| **KOVAS Phase 2 Complet** | **99-199 €/mois** | **Quotas + surplus** |

**Positioning Phase 1** : *KOVAS = compagnon iPad qui ajoute l'IA à votre logiciel actuel pour 30-100€/mois, sans le remplacer*.

**Positioning Phase 2** : *KOVAS = remplace votre logiciel principal à 99€/mois (tier Standard Complet) — économie 50-100€/mois vs Liciel + bien plus d'IA*.

---

## 11. Pricing decision tree (UX onboarding)

```
Combien de missions par mois en moyenne ?
   │
   ├── < 30 → Tier Découverte 29€ recommandé
   ├── 30-90 → Tier Standard 59€ recommandé (idéal 60 missions)
   ├── 90-150 → Tier Volume 99€ recommandé
   └── > 150 → Tier Volume 99€ + acceptation surplus 1€/mission
              OU Cabinet Phase 2 si multi-user
```

Affiché dans le questionnaire signup (3 questions) après email/SIRET validés.

---

## 12. Évolution prix (gouvernance)

| Trigger | Action |
|---|---|
| Cohorte 100 abonnés payants atteinte + retention 90j > 80% | A/B test prix +10% sur nouveaux signups |
| Inflation FR > 3% sur 12 mois | Indexation annuelle CPI (clause CGV) |
| Coûts API Anthropic/OpenAI +50% | Activation tarif Phase 2 plus tôt (M8-M9) ou hausse modérée Phase 1 |
| Founder à vie | **Jamais d'augmentation** (engagement contractuel CGV) |

---

## 13. Risques pricing & mitigations

| Risque | Probabilité | Mitigation |
|---|---|---|
| Découverte 29€ cannibalise Standard 59€ | MEDIUM | Quota 20 missions = friction naturelle vers Standard à 30+ missions |
| Volume 99€ pas assez différencié vs Standard 59€ | LOW | 1€ surplus (vs 1,50€) + 150 missions inclues = ROI clair à 90+ missions |
| Cabinet 199€ Phase 2 = inflation perçue sur upgrade depuis Standard 59€ Phase 1 | MEDIUM | Founders gardent Standard 49€/mois à vie, upgrade Cabinet 169€ Founder seulement si besoin multi-user |
| Pricing perçu comme complexe (4 tiers + surplus + options ponctuelles) | LOW | Widget transparence + decision tree onboarding + plafond auto = compréhension naturelle |
| Pression Liciel/Enersweet pour baisser prix face à KOVAS | LOW | Si Liciel baisse à 89€ : KOVAS reste différencié sur IA + UX, pas sur prix |
