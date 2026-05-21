# Pricing finale KOVAS — Décision fondateur 2026-06-02

> **Statut** : décision validée et figée.
> **Signataire** : Benjamin Bel, fondateur SASU Nexus 1993.
> **Cadre** : itération E2c — remplace définitivement les travaux E2 (audit caps) et E2b (neuromarketing).
> **Source de vérité technique** : `apps/web/src/lib/pricing-plans.ts` + migration `supabase/migrations/20260602100000_pricing_premium_final.sql`.

---

## 1. Synthèse en une ligne

5 tiers (19 / 29 / 39 / 99 / 149 €) avec **Pro 39 EUR comme point de gravité commercial "POPULAIRE"**, complétés de **9 add-ons** indépendants à modèle forfait + inclus + overage, regroupables en **3 packs thématiques** (Croissance 29€, Cabinet 49€, International 25€). Stratification LIBRE entre tiers et add-ons.

## 2. Justifications stratégiques

### "Douleur forte + pas de concurrence directe"

- Les diagnostiqueurs FR (Liciel 40-52% PdM) **payent déjà 50-150€/mo sans gains de productivité** mesurables.
- L'offre KOVAS apporte 1h30 gagnée par mission DPE — soit **40-60€/mo de temps économisé** sur un solopreneur typique (75 missions).
- Le tier d'entrée **19€** crée un **point de friction nul** (équivalent à un abonnement Netflix) et casse l'objection "encore un outil cher".
- Le tier médian **39€** se positionne entre Découverte et All Inclusive comme le choix par défaut — ancrage psychologique du milieu (decoy effect).

### Pourquoi 5 tiers et pas 3 ?

- E2 (3 tiers 29/59/99) laissait un trou bas (rebute les démarrants prudents) et un trou haut (cabinets en équipe).
- E2c étend en bas (Essential 19€, élargit funnel) et en haut (All Inclusive 99€ pour power users solo, Cabinet 149€ pour multi-users).
- **Pro 39€** devient le médian recommandé — meilleure conversion essai → payant attendue.

### Pourquoi des add-ons + des packs ?

- E2 avait banni les add-ons. E2b avait proposé une matrice complexe. E2c **trouve l'équilibre** :
  - **Add-ons à l'unité** pour les besoins spécifiques (Pennylane, Factur-X, signatures eIDAS).
  - **Packs thématiques** pour les profils types (croissance, cabinet, international) qui économisent 7-15€/mo.
- Stratification **LIBRE** : n'importe quel tier peut acheter n'importe quel add-on/pack — pas de mécanique d'upsell forcé.

---

## 3. Grille TIERS (finale)

| Code | Nom | Prix HT/mo | Annuel (10×) | Missions | Whisper | Vision | Users | Stockage |
|---|---|---|---|---|---|---|---|---|
| `essential` | Essential | **19€** | 190€ | 30 | 1h | 0 | 1 | 5 Go |
| `decouverte` | Découverte | **29€** | 290€ | 60 | 5h | 0 | 1 | 12 Go |
| `pro` (POPULAIRE) | Pro POPULAIRE | **39€** | 390€ | 150 | 10h | 100 | 1 | 25 Go |
| `all_inclusive` | All Inclusive | **99€** | 990€ | 250 | 25h | 200 | 1 | 80 Go |
| `cabinet` | Cabinet | **149€** | 1 490€ | 400 | 40h | 600 | 3 | 100 Go |

## 4. Add-ons mensuels

| Code | Nom | Prix/mo | Inclus | Overage |
|---|---|---|---|---|
| `signatures_eidas` | Signatures électroniques eIDAS | 18€ | 5 sigs/mo | +4€/sig |
| `bilingual_reports` | Rapports bilingues FR/EN | 19€ | 5 rapports/mo | +8€/rapport |
| `sms_reminders` | SMS rappel client J-1 | 12€ | 50 SMS/mo | +0,25€/SMS |
| `pennylane_sync` | Synchronisation Pennylane | 15€ | Illimité | — |
| `facturx_ppf` | Facturation Factur-X PPF Iopole | 22€ | 100 factures/mo | +0,30€/facture |
| `community_pro` | Communauté Pro | 9€ | Illimité | — |
| `analytics_advanced` | Analytics avancés cabinet | 24€ | Illimité | — |
| `regulatory_watch` | Veille IA hebdomadaire | 12€ | 4 digests/mois | — |
| `cockpit_ademe_m2` | Cockpit ADEME Mode 2 | 15€ | Illimité | — |

## 5. Packs thématiques

| Code | Pack | Prix/mo | Contenu | Économie |
|---|---|---|---|---|
| `pack_growth` (POPULAIRE) | Pack Croissance | **29€** | Veille IA + Cockpit ADEME M2 + Communauté Pro | 7€/mo |
| `pack_cabinet` | Pack Cabinet | **49€** | Analytics + Pennylane + Factur-X (100 factures) | 12€/mo |
| `pack_international` | Pack International | **25€** | 3 signatures eIDAS + 3 rapports bilingues inclus/mo | ~15€/mo |

---

## 6. Marges détaillées tier par tier

### Cas réaliste (usage médian par tier)

| Tier | ARPU réel | Coûts IA + infra | Marge brute | Marge % |
|---|---|---|---|---|
| Essential | 19€ | ~5€ | 14€ | **74%** |
| Découverte | 29€ | ~10€ | 19€ | **66%** |
| Pro | 45€ (39 + add-on ponctuel) | ~22€ | 23€ | **51%** |
| All Inclusive | 115€ (99 + pack partiel) | ~42€ | 73€ | **63%** |
| Cabinet | 195€ (149 + Pack Cabinet) | ~75€ | 120€ | **62%** |

### Cas worst case (overage maximum)

| Tier | ARPU worst | Coûts IA + infra | Marge brute | Marge % |
|---|---|---|---|---|
| Essential | 19€ + 0 (cap dur Whisper 1h) | ~7€ | 12€ | **63%** |
| Découverte | 29€ + 0 (cap dur Whisper 5h) | ~13€ | 16€ | **55%** |
| Pro | 39€ + 0 (cap dur Whisper 10h, Vision 100) | ~27€ | 12€ | **31%** |
| All Inclusive | 99€ + 0 (cap dur Whisper 25h, Vision 200) | ~55€ | 44€ | **44%** |
| Cabinet | 149€ + 0 (cap dur Whisper 40h, Vision 600) | ~95€ | 54€ | **36%** |

> Les caps fair-use missions sont eux soft (notification + mode dégradé + suggestion upgrade) ; les caps IA (Whisper, Vision) sont hard. La marge worst-case du Pro à 31% reste acceptable car le comportement attendu (75-100 missions/mo) maintient la marge réaliste à ~50%.

---

## 7. Comparatif vs E2 et E2b

| Critère | E2 (audit) | E2b (neuro) | E2c (finale) |
|---|---|---|---|
| Nombre de tiers | 3 | 4 | **5** |
| Tier d'entrée | 29€ | 19€ | **19€** |
| Tier "POPULAIRE" | 59€ Standard | 39€ Pro | **39€ Pro** |
| Tier haut | 99€ Volume | 99€ All-In + 149€ Cabinet | **99€ + 149€ Cabinet** |
| Add-ons | Aucun (rejetés) | 9 indépendants | **9 + 3 packs (réduction)** |
| Stratification | Sans objet | Stricte par tier | **LIBRE** |
| Caps Whisper | 60 missions implicites | Hard cap par tier | **Hard cap par tier + missions fair-use** |
| Caps Vision | Pas d'IA Vision Phase 1 | Hard cap par tier | **Hard cap par tier (Phase 1 = 0 ou 100/200/600)** |

### Pourquoi E2c gagne

- **Élargit le funnel par le bas** sans compromettre la marge (Essential 19€ = ~74% marge brute).
- **Crée un point de gravité commercial** explicite avec Pro 39€ "POPULAIRE".
- **Réintroduit les add-ons** que E2 avait jugés trop complexes — mais en les empaquetant en 3 packs thématiques lisibles (économie 7-15€/mo affichée).
- **Stratification libre** : ne pénalise pas l'utilisateur Essential qui aurait besoin ponctuellement de Pennylane.

---

## 8. Stratégies anti-perte

| Niveau | Déclencheur | Action |
|---|---|---|
| 80% du cap missions | Notification soft in-app | Suggestion upgrade contextuelle, valorisation gain de temps |
| 100% du cap missions | Mode dégradé léger | Watermark "essai dépassé" sur PDF, missions toujours fonctionnelles |
| 150% sur 2 mois consécutifs | Email + in-app | Suggestion explicite upgrade tier + calcul d'économies |
| 100% cap Whisper / Vision | Hard cap technique | Refus + proposition add-on ou upgrade tier |
| Abus manifeste | Script / bot / multi-comptes | Hard ban après contrôle manuel (audit_log) |

---

## 9. Migration et compatibilité

### Stripe Price IDs

- Les **anciens Price IDs** des tiers Phase 1 (Découverte 29 / Standard 59 / Volume 99) **restent actifs** pour les abonnés grandfathered. Ne pas les désactiver.
- Les **nouveaux Price IDs** (essential / decouverte / pro / all_inclusive / cabinet, mensuel + annuel) doivent être **provisionnés manuellement** dans le dashboard Stripe avant déploiement public.
- Convention env var : `STRIPE_PRICE_<TIER_UPPER>_<MONTHLY|ANNUAL>` (ex. `STRIPE_PRICE_PRO_MONTHLY`).
- Pour les packs et add-ons : Price IDs additionnels à créer en Phase 1.1 (post-launch).

### Base de données

- Migration idempotente : ajoute les colonnes manquantes (`plan_code`, `is_grandfathered`, caps) si elles n'existent pas déjà.
- Met à jour les caps pour tous les abonnés **non grandfathered**.
- Crée la table `addon_packs` et y insère les 3 packs.

### Audit log

Une entrée `pricing_update_premium` est inscrite dans `audit_log` à l'application de la migration (si la table existe).

---

## 10. Roadmap d'application

1. **Sprint en cours** — déploiement code + migration (E2c).
2. **+1 jour** — provisionnement Stripe Price IDs prod.
3. **+3 jours** — tests E2E flow conversion (essai → tier `pro` → ajout `pack_growth`).
4. **+7 jours** — communication clients beta (email + in-app) sur la nouvelle grille.
5. **+30 jours** — bilan d'adoption (mix de tiers réel vs prévu, ajustements add-ons).
