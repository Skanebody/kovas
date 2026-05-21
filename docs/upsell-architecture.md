# KOVAS — Architecture upsell intelligent (L1)

> Date : 2026-06-05
> Auteur : équipe KOVAS
> Status : implémenté V1

## 1. Objectif

Transformer la sidebar KOVAS en une **navigation adaptive** qui n'affiche
que les modules réellement débloqués pour l'utilisateur, complétée par un
**drawer "Découvrir KOVAS"** et un **moteur de suggestions comportementales**
contextuel.

Cible business :
- **+25-35% de conversion sur les add-ons** (benchmarks Patrick Campbell)
- Baisse du bruit visuel pour les forfaits bas (Essential / Découverte)
- Promesse premium discrète mais omniprésente pour les comportements
  power-user qui révèlent un besoin réel.

## 2. Flow utilisateur

```
1. User ouvre l'app
   → layout charge UserAccess + suggestions pending
   → sidebar render UNIQUEMENT les items accessibles
   → bouton "Découvrir" sticky bas (+ dot chartreuse si pending)

2. User clique sur "Découvrir" OU sur le badge dot dans "Plus" mobile
   → DiscoverDrawer slide-in (3 onglets)
        a) Modules en essai     (cards add-ons / packs non-actifs)
        b) Forfait supérieur    (preview tier+1 + features uniques)
        c) Tout le catalogue    (5 tiers + 9 add-ons + 3 packs, recherche)

3. User clique "Démarrer" sur un module
   → server action startTrialAction(target)
   → insert dans module_trials (status='active', trial_ends_at = now + 14j)
   → mark suggestion converted
   → revalidatePath '/app/account' + '/app/dashboard'
   → l'item correspondant apparaît IMMÉDIATEMENT dans la sidebar

4. Triggers contextuels (sans déranger)
   → User tape /app/analytics sans Pro
       → trackBehaviorEvent 'analytics_attempted'
       → render <UpsellEmptyState target="pro" /> à la place du contenu
   → User clique "Synchroniser Pennylane" sans addon
       → trackBehaviorEvent 'pennylane_attempted' (via /api/upsell/track)
       → <UpsellModal target="pennylane_sync" /> s'ouvre
   → User atteint 80% du quota Whisper
       → l'edge function behavioral-trigger-analyzer enregistre l'event
         et insère une suggestion (priority 70)

5. Email mensuel (1er du mois, 8h CET)
   → monthly-upsell-digest envoie un rapport sobre avec 1-2 suggestions
     top priority non encore shown_email
   → mark shown_email_at sur les suggestions envoyées
   → 1 email max par mois (anti-spam)
```

## 3. Modèle de données

### Table `user_behavior_events`

```sql
id              uuid PK
user_id         uuid FK auth.users
organization_id uuid FK organizations (nullable)
event_type      text CHECK IN (19 types)
event_data      jsonb
created_at      timestamptz
```

Lecture/écriture **service-role uniquement** (toutes les analyses passent
par routes API server-side).

### Table `upsell_suggestions`

```sql
id                  uuid PK
user_id             uuid FK auth.users
suggestion_type     'addon' | 'pack' | 'tier_upgrade'
suggested_target    text  -- code addon / pack / plan
reason_label        text  -- "Vous avez créé 23 factures ce mois"
reason_benefit      text  -- "Factur-X économise ~4h/mois"
estimated_value_eur int
priority            int   -- 0-100, plus haut = priorité affichage
status              'pending' | 'shown_in_app' | 'shown_email' | 'dismissed' | 'converted'
shown_in_app_at     timestamptz
shown_email_at      timestamptz
dismissed_at        timestamptz
converted_at        timestamptz
created_at          timestamptz
```

RLS :
- `service_role` : ALL
- `authenticated` user : SELECT own + UPDATE own (pour dismiss)

## 4. Règles métier (10 règles V1)

| # | Trigger | Suggestion | Priority |
|---|---|---|---|
| R1 | >20 factures émises sans addon `facturx_ppf` (et hors pack Cabinet) | addon `facturx_ppf` | 80 |
| R2 | >5 leads reçus, <30% taux réponse, tier < Pro | tier `pro` | 85 |
| R3 | Event `pennylane_attempted` sans `pennylane_sync` | addon `pennylane_sync` | 75 |
| R4 | Quota Whisper >= 80% | tier supérieur | 70 |
| R5 | Stockage >= 80% | tier supérieur | 65 |
| R6 | Missions >= 80% du quota | tier supérieur | 78 |
| R7 | Plan Essential et >= 30 missions/30j | tier `decouverte` | 72 |
| R8 | Event `analytics_attempted` sans Pro+ | tier `pro` | 60 |
| R9 | Event `bilingual_report_attempted` sans addon | pack `pack_international` | 55 |
| R10 | Quota Vision IA >= 80% | tier supérieur | 58 |

Cf. [`apps/web/src/lib/upsell/behavioral-triggers.ts`](../apps/web/src/lib/upsell/behavioral-triggers.ts)
pour le code, et [`apps/web/src/lib/upsell/behavioral-triggers.test.ts`](../apps/web/src/lib/upsell/behavioral-triggers.test.ts)
pour les tests.

## 5. Ajouter une nouvelle règle

**Template** :

```typescript
// Dans behavioral-triggers.ts
function rNNMyRule(ctx: BehaviorContext): TriggerRuleResult {
  // 1. Condition trigger
  if (/* condition non rencontrée */) return NO_TRIGGER

  // 2. Vérifier que la cible n'est pas déjà active
  if (ctx.currentAccess.activeAddons.includes('xxx')) return NO_TRIGGER

  return {
    shouldTrigger: true,
    suggestionType: 'addon',
    target: 'xxx',
    reasonLabel: 'Texte descriptif court de la situation',
    reasonBenefit: 'Bénéfice attendu (1 phrase, factuel)',
    estimatedValueEur: 40,
    priority: 60,
  }
}

// Ajouter dans le tableau RULES :
const RULES = [r1, r2, ..., rNNMyRule]
```

**Checklist** :
- [ ] Test unitaire dans `behavioral-triggers.test.ts` (1 cas trigger + 1 cas no-trigger)
- [ ] Si nouvelle event type → l'ajouter dans CHECK constraint migration + dans `BehaviorEventType`
- [ ] Mirror la règle dans `supabase/functions/behavioral-trigger-analyzer/index.ts`
- [ ] Documenter dans la table ci-dessus

## 6. Composants UI

| Composant | Rôle |
|---|---|
| `<AppSidebar>` | Sidebar 80px filtre `NAV_MAIN` selon UserAccess. Bouton Découvrir sticky bas. |
| `<MobileMoreSheet>` | Bottom-sheet mobile filtre par sections. Section "Découvrir" en bas. |
| `<DiscoverDrawer>` | Drawer slide-in right, 3 onglets (essai / upgrade / catalogue). |
| `<DiscoverSidebarButton>` | Bouton qui ouvre le drawer. Variants `sidebar` / `inline`. |
| `<UpsellModal>` | Dialog standard : titre + 3 bullets + CTA accent + "Plus tard". |
| `<UpsellEmptyState>` | Card pleine page à la place du contenu (gating mode `empty-state`). |
| `<FeatureGate>` | Composant gate, modes `hide` / `empty-state` / `show-disabled`. |

## 7. Métriques à tracker

| Métrique | Source | Cible |
|---|---|---|
| Conversion add-on (essai 14j démarrés / suggestions affichées) | `upsell_suggestions.status='converted'` | > 18% |
| Taux dismiss | `upsell_suggestions.status='dismissed'` | < 35% |
| Lift email mensuel (CTR / opens) | Resend webhook + `shown_email_at` | CTR > 8% |
| Sidebar items moyens visibles | `loadUserAccess` + nombre items après `filterNavItemsByAccess` | Tier Essential ~7 items / Pro ~12 / Cabinet 14 |
| Time-to-first-trial | conversion since signup | < 30 jours |

Mesure via PostHog events + `upsell_suggestions` directement.

## 8. Configuration cron (zones grises)

| Edge function | Cron | Auth | Variables env |
|---|---|---|---|
| `behavioral-trigger-analyzer` | `0 4 * * *` UTC | `Bearer CRON_SECRET` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` |
| `monthly-upsell-digest` | `0 7 1 * *` UTC | `Bearer CRON_SECRET` | + `RESEND_API_KEY`, `NEXT_PUBLIC_APP_URL` |

À déployer via `supabase functions deploy` puis activer le cron Supabase
ou via un job external (Railway, cron-job.org, Vercel Cron).

## 9. Contraintes UX (non négociables)

- **Max 1 modal upsell visible** à la fois (Radix Dialog focus trap)
- **Max 1 email upsell par mois** (cron mensuel + check shown_email_at)
- **Bouton "Plus tard" toujours présent** sur tous les modaux
- **Tracking obligatoire** des dismissals → analyse hebdo des règles
  contre-productives
- **Pas d'emoji**, ton sobre professionnel (cf. avatar diagnostiqueur)
- **Pas de pop-up intrusive au chargement** : les modaux ne s'ouvrent
  jamais d'eux-mêmes, seul l'EmptyState peut remplacer un contenu gated

## 10. Roadmap post-V1

- A/B test sur le wording des CTA (chartreuse vs ghost outline)
- Ajout de règles spécifiques cabinet (multi-user, capacités collectives)
- Webhook Resend pour tracker l'engagement email (opens, clicks)
- Dashboard admin pour visualiser la conversion par règle
- Auto-tuning des priorités selon taux conversion historique
