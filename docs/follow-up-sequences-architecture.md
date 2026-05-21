# Séquences de relance (Module 5) — Architecture

> Statut : implémenté V1 (sprint 2026-05-25).
> Tables : `follow_up_sequences`, `outgoing_message_log`, `user_preferences.email_marketing_enabled`.
> Edge Function cron : `supabase/functions/follow-up-sequence-tick` (toutes les 15 min).
> Helpers Node : `apps/web/src/lib/followup/{templates,executor}.ts`.

---

## 1. Vue d'ensemble

Les séquences de relance permettent au diagnostiqueur d'automatiser le suivi
d'événements business sans avoir à se rappeler "ah il faut que je relance Marc
dans 15 jours pour le devis". Une fois une séquence créée, l'Edge Function
`follow-up-sequence-tick` (cron 15 min) déroule les étapes l'une après l'autre
jusqu'à la fin de la séquence, l'opt-out du destinataire, ou une erreur.

5 templates principaux :

| Template            | Usage                                    | Steps par défaut | Délais (jours) |
|---------------------|------------------------------------------|------------------|----------------|
| `quote_pending`     | Devis envoyé sans réponse                | 3                | 7 / 15 / 30    |
| `invoice_unpaid`    | Facture émise sans paiement              | 3                | 7 / 21 / 36    |
| `post_dpe_fg`       | DPE F/G livré → opportunité travaux      | 2                | 14 / 90        |
| `prescriber_silent` | Prescripteur sans mission depuis N jours | 1                | 60             |
| `review_request`    | Demande d'avis post-livraison            | 1                | 3              |

---

## 2. Structure JSONB `follow_up_sequences.context`

Le champ `context` (JSONB, default `'{}'::jsonb`) porte la définition complète
de la séquence + les données contextuelles d'envoi. Schéma type :

```jsonc
{
  // Steps à exécuter (max 4 par séquence, min 24 h entre 2 steps)
  "steps": [
    {
      "delayDays": 7,
      "channel": "email",          // "email" | "sms" | "in_app" | "task"
      "templateVariant": null,     // facultatif (sous-template)
      "manualSubject": null,       // surcharge sujet (bypass template)
      "manualBody": null           // surcharge corps texte
    },
    { "delayDays": 8, "channel": "email" },
    { "delayDays": 15, "channel": "email" }
  ],

  // Données pour les templates (toutes optionnelles, le template fait du best effort)
  "reference": "DEV-2026-042",
  "amountEur": 850,
  "viewUrl": "https://kovas.fr/q/abc123",
  "paymentUrl": "https://kovas.fr/pay/abc123",
  "propertyAddress": "12 rue Lambert, 75018 Paris",
  "dpeClass": "F",
  "reviewUrl": "https://g.page/r/kovas/review"
}
```

### Contraintes invariants

- **Max 4 steps** par séquence (constante `MAX_STEPS_PER_SEQUENCE` dans
  `executor.ts`).
- **Délai minimum** 24 h entre 2 steps (anti-spam, constante
  `MIN_DELAY_HOURS`).
- Les `delayDays` sont des **délais depuis le step précédent** (ou la création
  pour le step 0), pas des délais absolus depuis le début.

---

## 3. Flux d'exécution (Edge Function)

```
                 ┌──────────────────────────────┐
                 │ Cron pg_cron : */15 * * * *  │
                 │ POST /follow-up-sequence-tick│
                 │ + Authorization: Bearer CRON │
                 └──────────────┬───────────────┘
                                │
                                ▼
            SELECT follow_up_sequences WHERE
            status='active' AND next_action_at <= now()
            ORDER BY next_action_at ASC LIMIT 100
                                │
                                ▼
       ┌────────────────────────────────────────────┐
       │ Pour chaque seq :                          │
       │   1. Charge contact destinataire           │
       │      (contacts/quotes/invoices/clients/    │
       │       auto_quotes selon target_entity_type)│
       │   2. Check opt-out user_preferences        │
       │   3. Check rate limit (1 envoi / 6 h /     │
       │      destinataire dans outgoing_message_   │
       │      log)                                  │
       │   4. Compose subject+text+html via         │
       │      composeForTemplate()                  │
       │   5. sendEmail Resend / sendSms Brevo      │
       │   6. INSERT outgoing_message_log          │
       │   7. Update current_step + next_action_at  │
       │      OU status='completed' si fini         │
       └────────────────────────────────────────────┘
```

### Gestion d'erreur

- Envoi raté → `status='paused'` + `last_action_result='send_error: ...'`.
- Opt-out détecté → `status='cancelled'` + log `skipped_optout` dans
  `outgoing_message_log`.
- Rate limit → next_action_at reporté de 6 h, séquence reste `active`.
- Exception non gérée → `status='paused'` + `last_action_result='tick_exception: ...'`.

Une séquence en `paused` peut être relancée manuellement par un admin (UI à
prévoir : bouton "Reprendre" qui remet `status='active'` + recalcule
`next_action_at`).

---

## 4. Garde-fous RGPD

### 4.1 Opt-out global

Colonnes ajoutées à `user_preferences` (migration 20260525193000) :

- `email_marketing_enabled boolean default true`
- `sms_marketing_enabled boolean default true`
- `follow_up_opt_out_at timestamptz`

Si `follow_up_opt_out_at` est non null OU si le flag canal est à false, la
séquence saute l'envoi, log `skipped_optout` et passe à `status='cancelled'`.

**Note importante** : les emails transactionnels (auth, paiement, déverrouillage
rapport) NE sont PAS bloqués par ces flags — seuls les emails non-transactionnels
(séquences de relance, digests) le sont.

### 4.2 Lien de désinscription

Chaque email contient un lien `${NEXT_PUBLIC_APP_URL}/preferences/unsubscribe?seq=<id>`
dans le footer HTML et en clair à la fin du texte. La route
`/preferences/unsubscribe` (à implémenter UI) doit :

1. Set `follow_up_opt_out_at = now()` sur le user concerné.
2. Set `status='cancelled'` sur toutes ses séquences actives.
3. Afficher une confirmation "Vous ne recevrez plus de relances KOVAS".

### 4.3 Audit complet

`outgoing_message_log` enregistre TOUS les envois (réussis, échoués, skippés)
avec :

- recipient_to (email/phone) — usage RGPD/audit
- subject + template_slug
- sequence_id + sequence_step (traçabilité de la cascade)
- status : sent | failed | skipped_optout | skipped_rate_limit
- provider_id (Resend/Brevo ID) pour debug

Conservation : pas de purge automatique V1 (audit légal). Phase 2 : purge à
3 ans (durée de conservation standard CNIL pour preuves d'envoi commercial).

### 4.4 Anti-spam applicatif

Rate limit 6 h par destinataire (toutes séquences confondues). Vérification
côté Edge Function via `outgoing_message_log` (count des envois `status='sent'`
dans les 6 dernières heures pour ce destinataire).

---

## 5. Ton et style des templates

Conformément à l'avatar client KOVAS (CLAUDE.md §21bis et `docs/avatar-client.md`) :

| ✅ FAVORISER                  | ❌ ÉVITER                                  |
|------------------------------|--------------------------------------------|
| Vouvoiement par défaut       | Tutoiement spontané                        |
| "Cordialement", "Bien à vous"| "À bientôt !", "Salut !"                  |
| Phrases courtes, factuelles  | Phrases vendeuses, superlatifs             |
| Signature "— Benjamin / KOVAS"| Signature équipe / "Toute l'équipe ..."   |
| HTML inline sobre (palette KOVAS) | Templates colorés, GIFs, emojis fun   |

Le HTML email est **table-based** pour compatibilité Gmail/Outlook (pas de CSS
flex/grid). Palette : `#F8F5EE` background, `#FDFBF6` paper, `#0F1E3D` ink,
`#D5CDB8` border. CTA pillule navy `border-radius:999px`.

---

## 6. Création d'une séquence (côté UI / API)

### Patron type

```ts
import { DEFAULT_SEQUENCES, validateSequenceDefinition } from '@/lib/followup/executor'

const def = {
  template: 'quote_pending' as const,
  steps: DEFAULT_SEQUENCES.quote_pending,
  targetEntityType: 'quote' as const,
  targetEntityId: quoteId,
}
validateSequenceDefinition(def) // throws si invalide

await supabase.from('follow_up_sequences').insert({
  organization_id: orgId,
  user_id: userId,
  target_entity_type: def.targetEntityType,
  target_entity_id: def.targetEntityId,
  sequence_template: def.template,
  total_steps: def.steps.length,
  channel: 'email',
  status: 'active',
  next_action_at: new Date(Date.now() + def.steps[0].delayDays * 86400 * 1000).toISOString(),
  context: {
    steps: def.steps,
    reference: quoteRef,
    amountEur: quoteAmount,
    viewUrl: `${appUrl}/quotes/${quoteId}`,
  },
})
```

### Quand créer la séquence ?

| Événement déclencheur                          | Séquence créée    |
|------------------------------------------------|-------------------|
| Devis envoyé (status=sent)                     | quote_pending     |
| Facture émise (status=issued, échéance dépassée) | invoice_unpaid    |
| Mission terminée + DPE en F ou G               | post_dpe_fg       |
| Cron mensuel : agent silent > 90 jours         | prescriber_silent |
| Mission terminée + payée                       | review_request    |

À implémenter via triggers SQL Phase 2 ou jobs Node de "création de séquences".
V1 : création manuelle côté API (UI bouton "Lancer la séquence standard").

---

## 7. Cron pg_cron (production)

```sql
SELECT cron.schedule(
  'follow-up-sequence-tick',
  '*/15 * * * *',
  $$ SELECT net.http_post(
       url := current_setting('app.settings.supabase_functions_url') || '/follow-up-sequence-tick',
       headers := jsonb_build_object(
         'Content-Type', 'application/json',
         'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
       )
     ); $$
);
```

Variables `app.settings.supabase_functions_url` et `app.settings.cron_secret`
à configurer côté Supabase dashboard (Project Settings → Database → Custom
Postgres Config).

---

## 8. Observabilité

Métriques à exposer dans `/admin/observability` (Phase 2) :

- Nombre d'envois par jour / canal / template
- Taux d'erreur (failed / total)
- Taux d'opt-out (skipped_optout / total_sent_30d)
- Latence moyenne du tick (à instrumenter via console.time)
- Séquences en `paused` (alert > 10 → action humaine requise)

Tables à requêter : `outgoing_message_log` (SUM + GROUP BY status/category/day).

---

## 9. Roadmap (V2+)

- [ ] Triggers SQL automatiques pour créer les séquences (post-MVP V1 manuel).
- [ ] UI admin : pause / reprise / preview d'une séquence.
- [ ] A/B test sur subject lines (template_variant).
- [ ] Multi-langue (clé i18n par template, FR uniquement V1).
- [ ] Webhook Resend (bounce / complaint) → status='paused' auto.
- [ ] Purge automatique outgoing_message_log à 3 ans (RGPD).
