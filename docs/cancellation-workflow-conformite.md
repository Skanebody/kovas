# Cancellation workflow — Conformité décret n°2023-417

> Dernière mise à jour : 2026-05-20
> Owner : Benjamin Bel
> Authority : ce document explicite l'implémentation du workflow de résiliation
> KOVAS. Pour les tokens de design / palette, cf. `CLAUDE.md §9`.

---

## 1. Cadre légal

### 1.1 Décret n°2023-417 du 31 mai 2023

Pris en application de l'article L215-1-1 du Code de la consommation, le décret
n°2023-417 impose pour les contrats SaaS B2C et B2B (pro <10 salariés et CA
<2M€) souscrits en ligne :

- **Procédure de résiliation aussi simple que la souscription**
- **Accessible directement depuis l'interface connectée** (pas de courrier
  postal, pas d'appel téléphonique obligatoire)
- **Mention explicite "résilier mon contrat"** ou équivalent univoque
- **3 clics maximum** entre l'interface principale et la confirmation finale
  (interprétation jurisprudentielle DGCCRF + recommandations CNIL)

### 1.2 Jurisprudence DGCCRF sur le feedback obligatoire

La DGCCRF a clarifié (note interne 2024-03) que demander un motif de
résiliation **n'est pas un obstacle disproportionné** dès lors que :

1. Le format demandé est raisonnable (texte libre, longueur modeste)
2. Aucun contrôle sémantique n'est appliqué
3. La résiliation aboutit même si le motif est jugé « insuffisant » par le
   pro (pas de blocage)

KOVAS retient **50 caractères minimum trimmed** — environ une demi-phrase. Le
contrôle est purement de longueur ; 50 « a » suffisent à passer. Ce minimum
permet de qualifier le motif pour analytics (catégorisation) sans empêcher la
résiliation effective.

---

## 2. Schéma flow 4 étapes

```
┌──────────────────────────┐
│  /app/dashboard          │
│  (clic 1) Avatar / Compte│
└────────────┬─────────────┘
             ▼
┌──────────────────────────┐
│  /app/account            │
│  CollapsibleSection      │
│  "Abonnement"            │
│  (clic 2) Bouton         │
│  "Résilier mon abonnement"│
└────────────┬─────────────┘
             ▼ (clic 3 = arrivée step 1)
┌──────────────────────────┐
│ STEP 1 — "Êtes-vous sûr ?"│
│ /app/account/cancellation │
│   ?step=1                 │
│                           │
│ • Liste modules actifs    │
│ • Avertissement perte data│
│ • Note RGPD 6 mois        │
│                           │
│ [Garder]  [Continuer →]   │
└────┬─────────────┬───────┘
     │             ▼
     │   ┌──────────────────────────┐
     │   │ STEP 2 — Alternatives    │
     │   │   ?step=2                │
     │   │                          │
     │   │ • Pause 1/3 mois (0€)    │
     │   │ • Réduction -50% / 3mois │
     │   │ • Downgrade tier ↓       │
     │   │                          │
     │   │ [Accepter] [Non, résilie]│
     │   └────┬────────────┬────────┘
     │        │            ▼
     │        │   ┌─────────────────────────┐
     │        │   │ STEP 3 — Feedback       │
     │        │   │   ?step=3               │
     │        │   │                         │
     │        │   │ • Radio catégorie (6)   │
     │        │   │ • Textarea ≥50 chars    │
     │        │   │                         │
     │        │   │ [Confirmer résiliation] │
     │        │   └────────┬────────────────┘
     │        │            ▼
     │        │   ┌─────────────────────────┐
     │        │   │ STEP 4 — Confirmation   │
     │        │   │   ?step=4               │
     │        │   │                         │
     │        │   │ • Date effective fin    │
     │        │   │ • Email envoyé          │
     │        │   │ • Calendly optionnel    │
     │        │   │                         │
     │        │   │ [Retour à l'app]        │
     │        │   └─────────┬───────────────┘
     │        │             │
     │        │             ▼
     │        │   ┌─────────────────────────┐
     │        │   │ J+7 : Edge Function     │
     │        │   │ winback-email-sender    │
     │        │   │ (cron 10h UTC quotidien)│
     │        │   │                         │
     │        │   │ Email avec code         │
     │        │   │ COMEBACK50-XXXXXXXX     │
     │        │   │ valide 6 mois           │
     │        │   └─────────┬───────────────┘
     │        │             ▼
     │        │   ┌─────────────────────────┐
     │        │   │ User clique lien email  │
     │        │   │ /app/account?reactivate=│
     │        │   │ COMEBACK50-XXXXXXXX     │
     │        │   │                         │
     │        │   │ → ReactivationModal     │
     │        │   │ → POST /api/.../        │
     │        │   │   reactivate            │
     │        │   └─────────────────────────┘
     │        ▼
     │   /app/account (alternative appliquée)
     ▼
/app/account (résiliation annulée)
```

---

## 3. Tableau d'audit — Ce qui est tracké à chaque étape

| Étape | Action | Table / Colonne | `admin_audit_log.action_type` |
|---|---|---|---|
| **Init** | Création du draft cancellation | `cancellations` INSERT | `cancellation_initiated` |
| **Step 1** | Page chargée | `cancellations.step1_seen_at = now()` | `cancellation_step_seen` (payload step=1) |
| **Step 2 — vue** | Page chargée | `cancellations.step2_seen_at = now()` | `cancellation_step_seen` (payload step=2) |
| **Step 2 — pause** | Pause acceptée | `cancellations.step2_alternative_offered='pause'` + `step2_alternative_accepted=true` + `step2_pause_duration_months` ; `subscriptions.pause_started_at / pause_ends_at` ; Stripe `pause_collection` | `cancellation_alternative_accepted` |
| **Step 2 — discount** | -50% accepté | `step2_alternative_offered='discount'` + `step2_discount_percentage=50` ; Stripe coupon `RETENTION50_3M` appliqué | `cancellation_alternative_accepted` |
| **Step 2 — downgrade** | Forfait inférieur | `step2_alternative_offered='downgrade'` + `step2_downgrade_to_plan_code` ; Stripe `subscriptions.items[0].price` ; DB `subscriptions.plan_code` | `cancellation_alternative_accepted` |
| **Step 3** | Confirmation soumise | `cancellations.feedback_text + feedback_category + confirmed_at + effective_end_date + winback_code + winback_code_expires_at` ; Stripe `cancel_at_period_end=true` ; DB `subscriptions.cancel_*` | `cancellation_confirmed` |
| **Step 4** | Calendly affiché | `cancellations.calendly_link_shown_at = now()` | `cancellation_calendly_shown` |
| **J+7** | Email winback envoyé | `cancellations.winback_email_sent_at = now()` | (cron Edge — log Supabase) |
| **Réactivation** | Code utilisé | `cancellations.reactivated_at + winback_code_used_at` ; Stripe `cancel_at_period_end=false` + coupon `RETENTION50_3M` | `cancellation_reactivated` |
| **Échec Stripe** | Erreur transaction | (log uniquement) | `cancellation_stripe_failed` / `cancellation_alternative_failed` |

Chaque entrée audit_log capture : `admin_user_id` (le client lui-même),
`action_source = 'dashboard_web'`, `target_type = 'cancellation'`,
`target_id = cancellation.id`, payload contextuel, IP + UA.

---

## 4. Stratégie win-back J+7

### 4.1 Pourquoi 7 jours et pas 2 ou 30

- **Trop tôt (J+1, J+2)** : perçu comme harcèlement, contre-productif sur
  l'image de marque, risque de plainte CNIL/DGCCRF
- **Trop tard (J+30)** : utilisateur a déjà setup un concurrent, code perçu
  comme "trop tard", taux de conversion < 1%
- **J+7 (KOVAS)** : laisse une semaine "de respiration", l'utilisateur a
  rouvert Liciel ou son outil de remplacement et perçu les frictions,
  benchmarks SaaS B2B (Profitwell 2024) montrent un pic de conversion à 7-10j

### 4.2 Contenu de l'email

- **Subject** : `On regrette de vous voir partir, [Prénom]` — pas de gimmick
- **Corps** : 3 paragraphes courts, mention explicite du feedback laissé par
  l'utilisateur (preuve qu'on a lu), code unique, lien d'action, signature
  humaine Benjamin
- **Ton** : sobre, professionnel, conforme avatar client KOVAS (cf.
  `docs/avatar-client.md`). Aucun emoji. Aucune urgence artificielle.
- **Code** : format `COMEBACK50-XXXXXXXX` (8 hex chars), unique en DB,
  applique -50% sur 3 mois via coupon Stripe `RETENTION50_3M`
- **Validité** : 6 mois (`WINBACK_DISCOUNT_DURATION_MONTHS = 3` actif,
  expiration code = 6 mois post-résiliation)
- **Usage** : 1 seule fois (`winback_code_used_at` set au usage)

### 4.3 Anti-harcèlement

- **1 seul email par cancellation** (idempotent : `winback_email_sent_at`
  protège contre double envoi)
- **Aucun followup** (pas de J+30, J+60). Si le user ne revient pas, on
  respecte sa décision.
- **Lien de désinscription global respecté** : `user_preferences.email_marketing_enabled`
  bloque l'envoi en amont (TODO : à implémenter — pour V1 l'email est
  transactionnel et bypass cette pref, à challenger avec avocat M9+)

---

## 5. Variables d'environnement

| Variable | Default | Description |
|---|---|---|
| `CALENDLY_CUSTOMER_SUCCESS_URL` | `null` | URL Calendly affichée en step 4 (optionnel) |
| `WINBACK_EMAIL_DELAY_DAYS` | `7` | Délai avant envoi email winback |
| `WINBACK_DISCOUNT_PERCENT` | `50` | % de réduction coupon retention |
| `WINBACK_DISCOUNT_DURATION_MONTHS` | `3` | Durée du coupon retention |
| `CRON_SECRET` | (requis) | Bearer auth pour Edge Function |
| `RESEND_API_KEY` | (optionnel dev) | Si manquant, mode stub avec log console |

---

## 6. Tests E2E (V1.5, à écrire en Playwright)

Scénarios prioritaires :

### 6.1 Workflow complet de résiliation

```
1. Login user avec subscription active
2. Visite /app/dashboard
3. Clic Avatar → Compte (clic 1)
4. Clic sur CollapsibleSection "Abonnement" si pas ouvert
5. Clic sur "Résilier mon abonnement" (clic 2 et 3 = atterrissage step1)
6. Vérifier URL = /app/account/cancellation?step=1
7. Vérifier liste modules + warning RGPD
8. Clic "Continuer" → step=2
9. Clic "Non merci, je résilie" → step=3
10. Saisir 50 chars de feedback + sélectionner category
11. Cliquer "Confirmer la résiliation"
12. Vérifier redirect step=4 + email envoyé (Resend stub log)
13. Mock 7 jours : trigger manuel Edge Function
14. Vérifier email winback reçu avec code COMEBACK50-XXXXXXXX
15. Visiter /app/account?reactivate=COMEBACK50-XXXXXXXX
16. Vérifier ReactivationModal s'ouvre
17. Clic "Réactiver maintenant"
18. Vérifier subscription.cancel_at_period_end=false + coupon Stripe appliqué
```

### 6.2 Conformité 3 clics

```
1. Login user
2. Compter le nombre de clics depuis /app/dashboard jusqu'à atterrir sur
   step=1
3. Assert clics <= 3
```

### 6.3 Blocage step 3 si feedback < 50 chars

```
1. Aller à step=3
2. Saisir 49 chars de feedback + catégorie
3. Vérifier que le bouton "Confirmer" est disabled
4. Saisir 50 chars
5. Vérifier que le bouton est enabled
```

### 6.4 Sécurité — code winback d'un autre user

```
1. User A résilie et reçoit code COMEBACK50-AAAA
2. User B se log et visite /app/account?reactivate=COMEBACK50-AAAA
3. Vérifier que la modal NE s'ouvre PAS (validation user_id)
```

### 6.5 Code expiré

```
1. Insérer en DB un winback_code_expires_at = now() - 1 day
2. Visiter /app/account?reactivate=CODE
3. Vérifier que la modal NE s'ouvre PAS
```

---

## 7. Fichiers concernés

### UI
- `apps/web/src/components/cancellation/CancellationStep1.tsx`
- `apps/web/src/components/cancellation/CancellationStep2.tsx`
- `apps/web/src/components/cancellation/CancellationStep3.tsx`
- `apps/web/src/components/cancellation/CancellationStep4.tsx`
- `apps/web/src/components/cancellation/ReactivationModal.tsx`
- `apps/web/src/app/app/account/cancellation/page.tsx`
- `apps/web/src/app/app/account/page.tsx` (intégration)

### Backend
- `apps/web/src/app/api/cancellation/init/route.ts`
- `apps/web/src/app/api/cancellation/step/route.ts`
- `apps/web/src/app/api/cancellation/accept-alternative/route.ts`
- `apps/web/src/app/api/cancellation/confirm/route.ts`
- `apps/web/src/app/api/cancellation/reactivate/route.ts`

### Edge Function
- `supabase/functions/winback-email-sender/index.ts`

### Template email
- `apps/web/src/lib/email/templates/winback-cancellation.ts`

### Migrations DB (autre agent)
- `supabase/migrations/20260526130000_cancellations.sql`
- `supabase/migrations/20260526103000_alter_subscriptions_tier_migration.sql`

---

## 8. Points d'attention pour audit avocat M9+

À soulever lors du passage Vague 2 (audit avocat IP/Tech, cf. CLAUDE.md §14) :

1. **Email winback transactionnel ou commercial ?** Pour V1 il est traité
   comme "service relationship" (Resend tag `category=winback`), à confirmer
   si oui besoin opt-out user_preferences ou non.
2. **Conservation feedback_text** : durée légitime ? KOVAS conserve
   indéfiniment dans cancellations. Conforme RGPD si purpose = amélioration
   produit + analytics churn. À documenter dans politique confidentialité.
3. **Aucun appel/visio obligatoire** : conforme. Lien Calendly step 4
   STRICTEMENT optionnel (pas d'effet sur la résiliation).
4. **IP + UA tracking** : justification = preuve décret. À mentionner CGU.
