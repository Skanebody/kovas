# Quotas, overflow & fair use — architecture

> Authority : ce document décrit l'implémentation des quotas mensuels, du tracking
> temps réel, de la facturation des dépassements (overflow billing) et des alertes
> 80 % introduits par le pivot tarifaire mai 2026 (CLAUDE.md §4 + §5).
>
> Tables : `subscription_plans`, `user_usage_quotas`, `ai_usage_logs`.
> Edge Functions : `module-trial-tick`, `quota-tracker`, `quota-monthly-reset`,
> `overflow-billing`, `ai-usage-tracker`.
> Helpers TS : `apps/web/src/lib/billing/quotas.ts`,
> `apps/web/src/lib/billing/ai-cost-calculator.ts`.

---

## 1. Reset mensuel — provisionnement automatique de la ligne du mois

Le 1er de chaque mois à **03:00 UTC**, la Edge Function
[`quota-monthly-reset`](../supabase/functions/quota-monthly-reset/index.ts)
provisionne une ligne `user_usage_quotas` pour chaque organisation ayant une
souscription dans `active`, `trialing` ou `past_due`. Les compteurs `*_used`
démarrent à 0 ; les quotas sont copiés depuis `subscription_plans` selon le
`plan_code` actif.

Cas particulier **Cabinet** : le quota `missions_quota` est ajusté à
`base_quota + extra_users_count * 60` (1 utilisateur = ~60 missions/mois).

L'idempotence est garantie par la contrainte `UNIQUE(organization_id,
period_month)` : si le cron est rejoué, l'insertion échoue avec `23505` qui est
traité comme `status='exists'` (pas une erreur).

### Cron Postgres recommandé

```sql
SELECT cron.schedule(
  'quota-monthly-reset',
  '0 3 1 * *',
  $$ SELECT net.http_post(
       url := current_setting('app.settings.supabase_functions_url') || '/quota-monthly-reset',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
       )
     ); $$
);
```

---

## 2. Tracking temps réel — `quota-tracker`

L'endpoint POST `/quota-tracker` est appelé **synchroniquement** par les
workers et API routes après chaque action consommant un quota (création
mission, envoi signature, requête geocoding, message chatbot…).

### Stratégie d'incrémentation atomique

L'incrément passe par la fonction PL/pgSQL
[`increment_quota_usage(p_org, p_period, p_column, p_delta)`](../supabase/migrations/20260526140000_user_usage_quotas.sql)
qui :

1. **Whitelist les colonnes autorisées** (anti-SQL injection sur `p_column`).
2. **Exécute un UPDATE** atomique avec `format(%I, %I)` pour interpoler le nom
   de colonne. Le `UPDATE ... RETURNING <col>` est intrinsèquement atomique en
   PostgreSQL (lock de ligne implicite).
3. **SECURITY DEFINER** : appelable depuis les Edge Functions sous service_role
   sans contourner RLS.

Pourquoi pas un trigger sur `missions` (INSERT)? Trois raisons :
- Un trigger ne sait pas distinguer une création "vraie" mission d'un brouillon
  ou d'une duplication interne.
- Le tracking de chatbot/yousign/geocoding ne mappe pas 1:1 sur une table
  unique (relais multi-services).
- L'Edge Function permet de centraliser **80 % alert + overflow billing dans
  le même write** — un trigger devrait appeler NOTIFY/LISTEN avec un worker
  externe.

### Workflow complet

```
Worker → POST /quota-tracker { orgId, column, delta }
       → RPC ensure_current_month_quota_row(orgId)   [no-op si déjà créée]
       → SELECT before state
       → RPC increment_quota_usage(orgId, period, column, delta)
       → Calcule percentage (used / quota, -1 = illimité ⇒ 0)
       → Si crossing 80% : email "vous avez consommé 80 %"
                          + UPDATE alert_80pct_sent_at (idempotence)
                          + INSERT notifications (in-app)
       → Si >= 100% :
            - auto_overflow_enabled=true → UPDATE *_overflow_count + amount
            - auto_overflow_enabled=false → return 429 + email "quota atteint"
       → Return { used, quota, percentage, isOverflowing, overflowCount,
                  overflowAmountCents, autoOverflowEnabled }
```

### Helper TS Node (API routes Next.js)

`apps/web/src/lib/billing/quotas.ts` expose :

- `getCurrentMonthQuota(orgId)` : lecture directe via service role
- `incrementUsage(orgId, column, delta)` : relay HTTP vers Edge Function
- `assertQuotaAvailable(orgId, column, delta)` : check **avant** action sans
  muter

Pattern type :

```ts
const guard = await assertQuotaAvailable(orgId, 'missions_used', 1)
if (!guard.allowed) return { error: 'quota_exceeded' }
// ... création de la mission ...
await incrementUsage(orgId, 'missions_used', 1)
```

---

## 3. Overflow billing — facturation des dépassements

Le 1er du mois à **05:00 UTC** (2 h après le reset), la Edge Function
[`overflow-billing`](../supabase/functions/overflow-billing/index.ts) parcourt
toutes les lignes `user_usage_quotas WHERE period_month = (mois précédent) AND
billed_at IS NULL` et :

1. Somme les `*_overflow_amount_cents` (missions + chatbot + signatures +
   geocoding + storage).
2. Si total > 0 et `auto_overflow_enabled=true` :
   - Crée un **Stripe Invoice Item** (lump sum, pas usage record metered) sur
     la prochaine invoice du customer. Pourquoi InvoiceItem plutôt que
     SubscriptionItem metered ? Plus lisible côté user (une ligne "Dépassements
     janvier 2026 : 13,50 €"), pas besoin de price metered actif côté Stripe.
   - UPDATE `stripe_usage_record_id` + `billed_at = now()`.
   - Envoie un récap email au owner ("Surplus janvier 2026 : 13 missions =
     19,50 € HT facturé").
3. Si `auto_overflow_enabled=false` : marque `billed_at = now()` quand même
   (audit log "blocked") pour ne pas reboucler.

### Retry & alerting

Erreur Stripe (5xx ou 429) → backoff exponentiel 1 s / 3 s / 9 s (3 tentatives).
Après échec final : email admin (KOVAS_ADMIN_EMAIL) + ligne **non** marquée
`billed_at` (le cron du jour suivant ré-essaiera).

Erreur Stripe 4xx (auth, customer manquant, etc.) → pas de retry, alert admin
immédiat. Ces erreurs nécessitent intervention humaine (KBis, mise à jour CB).

---

## 4. Alertes 80 % et 100 % — UX anti-friction

Conformément à CLAUDE.md §5 (UX anti-friction paiement), les notifications de
quota suivent une logique **positive** :

- **80 %** (info) : email "Vous avez consommé 80 % de votre quota. Sans
  changement, vous basculerez en mode auto-débordement à 100 %." + in-app
  notification de niveau `warning`.
- **100 % auto-overflow ON** : facturation transparente à l'usage, **pas
  d'email** au passage 100 % (le récap mensuel suffit).
- **100 % auto-overflow OFF** : email "Quota atteint, 3 options : activer
  l'auto-débordement / passer au tier supérieur / attendre le 1er du mois".
  L'action de quota échoue avec HTTP 429.

L'idempotence est garantie par `alert_80pct_sent_at` / `alert_100pct_sent_at`
qui empêchent un double-envoi sur la même période de quota.

---

## 5. Module trials — essai 14j des add-ons

La Edge Function
[`module-trial-tick`](../supabase/functions/module-trial-tick/index.ts) tourne
quotidiennement à **09:00 UTC** et :

- Envoie un rappel **J-5** (`reminder_j_minus_5_sent_at`).
- Envoie un rappel **J-2** (`reminder_j_minus_2_sent_at`).
- À l'échéance :
  - Si `user_decision='cancel'` → `status='cancelled_before_payment'` + email
    de confirmation "essai annulé, aucun prélèvement effectué".
  - Sinon → conversion en `user_addons` actif, ajout d'un `subscription_item`
    Stripe (si `stripe_price_id` défini), `status='converted_to_paid'`,
    `first_payment_amount_cents` enregistré, email "premier prélèvement
    effectué".

Les 4 templates email sont dans
[`apps/web/src/lib/email/templates/module-trial-*.ts`](../apps/web/src/lib/email/templates/).
Ils respectent le ton sobre KOVAS (vouvoiement, signature "— Benjamin / KOVAS",
zéro émoji fun).

---

## 6. AI usage tracking — `ai-usage-tracker`

L'endpoint POST `/ai-usage-tracker` est appelé après chaque appel IA
(Claude/Whisper/Deepgram/Embeddings) pour :

1. Calculer le coût en centimes EUR via la grille tarifaire (env-overridable :
   `ANTHROPIC_PRICING_*` / `OPENAI_PRICING_*` / `DEEPGRAM_PRICING_*` + taux
   `USD_TO_EUR_RATE`).
2. INSERT dans `ai_usage_logs` (audit immuable, indexé par org + feature +
   created_at).
3. Side effect : si `feature='chatbot_methodo'` → relay vers `quota-tracker`
   pour incrémenter `chatbot_messages_used` (+1).

Le helper pur `apps/web/src/lib/billing/ai-cost-calculator.ts` partage la
logique de calcul avec le Node (API routes) — la grille tarifaire est codée
en dur en fallback ; les Edge Functions Deno lisent en plus les variables env
pour ajuster sans redéploiement.

### Estimation coût IA — 100 users actifs / mois (Standard / Pro tier)

Hypothèses moyennes par user actif :

| Service | Volume mensuel | Coût unitaire | Coût/user/mois |
|---|---|---|---|
| Chatbot méthodo (Haiku) | 200 messages × 600 in / 200 out tok | ~3 € HT/MTok | **~0,42 €** |
| Voice transcription (Whisper) | 60 min/mo | 0,006 $/min × 0.92 | **~0,33 €** |
| Voice structuration (Haiku) | 60 appels × 1500 in / 500 out tok | – | **~0,12 €** |
| Vision photos Capture-First (Haiku) | 200 photos × 1200 in / 300 out tok | – | **~0,32 €** |
| Consolidation finale (Sonnet) | 30 appels × 8000 in / 1500 out tok | – | **~1,28 €** |
| Embeddings RAG (text-embed-small) | 50k tokens cumulés | 0,02 $/MTok × 0.92 | **~0,001 €** |
| ADEME sync (Haiku) | 10 prevalidations × 2000 in / 500 out tok | – | **~0,04 €** |
| **Total / user / mois** | | | **~2,51 €** |

Multiplié par **100 users actifs** → **~250 €/mois IA brut**. Avec prompt
caching agressif (–60 % sur les inputs répétés du chatbot) et batching 50 %
tarifs Anthropic → **~120-150 €/mois** réaliste, soit **~1,5 €/user/mo**
qui s'aligne avec la marge brute 80 % cible CLAUDE.md §7.

---

## 7. Variables d'environnement

Toutes les variables nouvelles sont documentées dans `.env.example` section
"Quotas & AI usage tracking". Récapitulatif :

```
ANTHROPIC_PRICING_HAIKU_INPUT_USD_PER_MTOK=1
ANTHROPIC_PRICING_HAIKU_OUTPUT_USD_PER_MTOK=5
... (12 lignes pricing Anthropic / OpenAI / Deepgram)
USD_TO_EUR_RATE=0.92
KOVAS_ADMIN_EMAIL=benjamin@kovas.fr
```

Les Edge Functions héritent en plus de `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`,
`STRIPE_SECRET_KEY` (déjà existants).

---

## 8. Schedule cron récapitulatif

| Fonction | Cron | Rôle |
|---|---|---|
| `module-trial-tick` | `0 9 * * *` (quotidien 09 UTC) | Rappels J-5/J-2 + conversion/cancel essais modules |
| `quota-tracker` | – (synchrone) | Incrément + alertes 80 %/100 % + overflow temps réel |
| `quota-monthly-reset` | `0 3 1 * *` (1er du mois 03 UTC) | Provisionne ligne `user_usage_quotas` du mois |
| `overflow-billing` | `0 5 1 * *` (1er du mois 05 UTC) | Stripe InvoiceItem + email récap dépassements |
| `ai-usage-tracker` | – (synchrone) | Log appel IA + cost + relay chatbot quota |
