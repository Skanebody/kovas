# Pricing V3 — Dual Track (KOVAS Annuaire + KOVAS 360)

> **Statut** : décision validée fondateur 2026-05-21. Cette grille remplace l'E2c (5 tiers all-you-can-eat 2026-06-02).
> **Source de vérité code** : `apps/web/src/lib/pricing-plans.ts` (refonte Phase B en cours).
> **Naming verrouillé (cf. CLAUDE.md §1.1)** : `KOVAS 360` = logiciel B2B / `KOVAS Annuaire` = annuaire B2C.
> **Société éditrice** : NEXUS 1993 (cf. `apps/web/src/lib/legal/company-identity.ts`).

---

## 1. Architecture dual track

Deux produits distincts, achetables séparément ou combinés via Bundle :

| Track | Cible | Promesse |
|---|---|---|
| **KOVAS Annuaire** | Diagnostiqueurs cherchant visibilité B2C | Recevoir des leads particuliers qualifiés |
| **KOVAS 360** | Diagnostiqueurs cherchant productivité métier | Gagner 1h30/mission, conformité automatique |

Prix HT en centimes (integer) dans le code, jamais float/string.

---

## 2. Grille Annuaire (4 tiers + 6 slots sponsorisés)

| Code | Nom | Prix HT/mo | Prix HT/an | Cap leads/mo | Niveau fiche |
|---|---|---|---|---|---|
| `annuaire_free` | Annuaire Vérifié | **0 €** | 0 € | 0 (lecture seule) | Vérifié (claim done) |
| `annuaire_pro` | Annuaire Pro | **19 €** | 190 € (2 mois offerts) | 5 leads | Premium (photos, services, tarifs indicatifs) |
| `annuaire_visibility` | Annuaire Visibilité | **39 €** | 390 € | 15 leads | Premium + boost SEO local + analytics fiche |
| `annuaire_sponsored` | Annuaire Sponsorisé | **79 €** | 790 € | 30 leads | Top dept + badge "Recommandé" + leads premium |

**Sponsored slots par taille de ville** (exclusif `annuaire_sponsored`, 1 slot par ville par diag) :

| Slot code | Catégorie | Population | Surcoût/mo |
|---|---|---|---|
| `slot_metropole` | Métropole | > 500 000 hab (Paris, Lyon, Marseille…) | **+ 199 €** |
| `slot_grande_ville` | Grande ville | 200 000 – 500 000 hab | **+ 119 €** |
| `slot_ville_moyenne` | Ville moyenne | 50 000 – 200 000 hab | **+ 79 €** |
| `slot_petite_ville` | Petite ville | 10 000 – 50 000 hab | **+ 39 €** |
| `slot_commune` | Commune | 3 000 – 10 000 hab | **+ 19 €** |
| `slot_rural` | Rural | < 3 000 hab | **+ 9 €** |

Auction interne quand plusieurs candidats sur même slot : ordre de souscription + activity_score >= 70 prioritaire.

---

## 3. Grille KOVAS 360 (5 tiers logiciel)

| Code | Nom | Prix HT/mo | Prix HT/an | Missions/mo | Voice | Vision | Storage | Users |
|---|---|---|---|---|---|---|---|---|
| `logiciel_free` | Essai 14 jours | **0 €** | – | 30 (cap) | 1h | 0 | 5 Go | 1 |
| `logiciel_starter` | Starter | **29 €** | 290 € | 60 | 5h | 0 | 12 Go | 1 |
| `logiciel_active` | Active (recommandé) | **59 €** | 590 € | 150 | 10h | 100 | 25 Go | 1 |
| `logiciel_cabinet` | Cabinet | **149 €** | 1 490 € | 400 | 40h | 600 | 100 Go | 3 |
| `logiciel_enterprise` | Enterprise | **299 €** | 2 990 € | illimité (fair-use) | 80h | 1500 | 250 Go | 10+ |

**Features par tier** (8 diagnostics inclus dès Starter) :

- **Starter 29€** : 8 diagnostics + voice basique + exports universels + sync mobile/web + 1 user
- **Active 59€** : + IA Vision + recos post-DPE F/G + validation cohérence + support 4h + templates pièces
- **Cabinet 149€** : + multi-users 3 + audit trail + analytics avancés + Factur-X + gestion rôles + manager dédié
- **Enterprise 299€** : + API publique + SLA 4h + onboarding white-glove + multi-user 10+

---

## 4. Bundles (5 combos avec économies)

Souscription jointe Annuaire + Logiciel à prix réduit :

| Bundle code | Composition | Prix individuel | Prix bundle | Économie/mo |
|---|---|---|---|---|
| `bundle_starter_visibility` | Annuaire Pro 19€ + KOVAS 360 Starter 29€ | 48 € | **39 €** | -9 € (-19%) |
| `bundle_active_pro` | Annuaire Pro 19€ + KOVAS 360 Active 59€ | 78 € | **69 €** | -9 € (-12%) |
| `bundle_active_visibility` | Annuaire Visibilité 39€ + KOVAS 360 Active 59€ | 98 € | **89 €** | -9 € (-9%) |
| `bundle_cabinet_pro` | Annuaire Pro 19€ + KOVAS 360 Cabinet 149€ | 168 € | **149 €** | -19 € (-11%) |
| `bundle_cabinet_visibility` | Annuaire Visibilité 39€ + KOVAS 360 Cabinet 149€ | 188 € | **169 €** | -19 € (-10%) |

---

## 5. Add-ons (4 modules indépendants des tracks)

| Add-on code | Nom | Prix/mo | Inclus | Overage |
|---|---|---|---|---|
| `addon_signatures_eidas` | Signatures eIDAS Yousign | **19 €** | 10 sigs/mo | 4 €/sig sup |
| `addon_pennylane_sync` | Synchronisation Pennylane | **9 €** | illimité | – |
| `addon_sms_reminders` | SMS rappel client J-1 | **9 €** | 50 SMS/mo | 0,25 €/SMS sup |
| `addon_community_pro` | Communauté Pro | **9 €** | accès illimité | – |

Souscriptibles depuis n'importe quel tier payant (sauf `logiciel_free` et `annuaire_free`).

---

## 6. Migration des comptes existants (grandfather)

Les utilisateurs actuels sur la grille E2c 5-tiers (2026-06-02) sont migrés vers la grille V3 **sans hausse de prix** via grandfather à vie. Mapping logique :

| Plan E2c (legacy) | Nouveau plan V3 | Prix grandfather | Prix V3 normal |
|---|---|---|---|
| `essential` 19 € | `logiciel_starter` (code interne grandfather `essential_legacy`) | 19 €/mo (à vie) | 29 €/mo |
| `decouverte` 29 € | `logiciel_starter` (grandfather `decouverte_legacy`) | 29 €/mo (à vie) | 29 €/mo |
| `pro` 39 € | `logiciel_active` (grandfather `pro_legacy`) | 39 €/mo (à vie) | 59 €/mo |
| `all_inclusive` 99 € | `logiciel_cabinet` (grandfather `all_inclusive_legacy`) | 99 €/mo (à vie) | 149 €/mo |
| `cabinet` 149 € | `logiciel_cabinet` (grandfather `cabinet_legacy`) | 149 €/mo (à vie) | 149 €/mo |

Si user legacy souhaite changer → propose nouvelle grille avec calculateur "économies estimées" + cancel-current + new-subscribe. Aucune migration forcée du prix.

Edge Function `migrate-legacy-plans-v3` exécutée une fois post-déploiement :
1. Inventaire des `subscriptions.status = 'active'` avec `plan_code` E2c
2. UPDATE `plan_code` → nouveau code grandfather (préserve `monthly_price_cents`)
3. UPDATE `subscription_history` (audit trail)
4. Envoi email Brevo "Votre forfait évolue — votre prix reste inchangé" (template à créer)

---

## 7. Économie révisée V3 vs E2c

ARPU moyen pondéré (mix attendu) :

| Track | Mix attendu | Prix moyen |
|---|---|---|
| Annuaire seul | 20% des comptes | 19 € (5×0 + 35×19 + 35×39 + 25×79) ≈ **29 €** |
| Logiciel seul | 40% | 59 € (10×0 + 30×29 + 40×59 + 15×149 + 5×299) ≈ **76 €** |
| Bundle | 35% | 89 € (mix) |
| Sponsored slot | 5% (top 1%) | + 79 € (slot moyen) |

**ARPU moyen pondéré V3** : ~62 €/mo (vs ~38 € en E2c). Hypothèse : montée en gamme Bundle + Sponsored.

**Marge brute** : conservée à 65-71% (caps IA hard sur Active/Cabinet préservés).

**LTV/CAC** : maintenu à ~8 (gains de marge brute compensent légère hausse CAC).

---

## 8. Roadmap Phase B livrables

| Lot | Effort | Livrable |
|---|---|---|
| B1 — Schema + migration | 1j | Migration `20260607100000_pricing_dual_track_v3.sql` (tables `bundles`, `sponsored_slots`, plan_code enum étendu) + Edge `migrate-legacy-plans-v3` + email template |
| B2 — Refonte `pricing-plans.ts` | 1j | Types dual track + helpers + retro-compat LEGACY_PLANS conservée |
| B3 — Page `/pricing` UI | 1j | 2 colonnes + bundle section + slot picker + addon picker + toggle annuel/mensuel |
| B4 — Stripe wiring + CGV v1.3 | 1j | `stripe-products.ts` mapping + checkout route + CGV v1.3 dual track + `.env.example` |

Total : 4 jours wall-clock, 2-3 jours en parallélisation.
