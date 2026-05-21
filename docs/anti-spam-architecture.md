# KOVAS — Architecture anti-spam leads (Mission K1)

> Statut : V1 — implémenté 2026-06-04
> Niveau de protection : minimum viable (Email vérification + reCAPTCHA v3 + Rate limits)
> V1.5 : ajout SMS si abus détecté + Redis pour rate limits précis

## 1. Vue d'ensemble — défense multi-couches

| Couche | Mécanisme | Réponse violation | Coût impl. |
|---|---|---|---|
| **L1** | Honeypot champ caché | Insert en `status=spam` puis succès silencieux | < 1h |
| **L2** | Validation email réelle (code 6 chiffres) | Demande bloquée tant que non vérifiée | 2j |
| **L3** | reCAPTCHA v3 score ≥ 0.5 | 403 "Vérification anti-bot échouée" | 1j |
| **L4** | Rate limits IP / email / email_diag | 429 avec resetAt | 1j |
| **L5 (V1.5)** | SMS OTP optionnel pour gros volume | Code 6 chiffres SMS (Brevo) | 2j |

## 2. Workflow lead complet

```
┌─────────────────────────────────────────────────────────────┐
│  /diagnostiqueurs/[dept]/[city]/[slug]                      │
│  → <QuoteRequestForm /> (3 steps wizard + reCAPTCHA v3)     │
└────────────────────────────┬────────────────────────────────┘
                             │ POST /api/diagnosticians/[id]/quote-request
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Server checks (route.ts)                                   │
│  1. Zod validate                                            │
│  2. Honeypot check                                          │
│  3. reCAPTCHA verify (score < 0.5 → 403)                    │
│  4. Rate limits IP/email/email_diag (exceeded → 429)        │
│  5. Insert quote_requests (status='pending_email_verification')│
│     + generate 6-digit code (TTL 30min)                     │
│  6. Send verification email (Resend)                        │
│  7. Record rate-limit hits                                  │
└────────────────────────────┬────────────────────────────────┘
                             │ { trackingToken }
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Redirect /verifier-mon-email/[token]                       │
│  → User saisit code 6 chiffres                              │
└────────────────────────────┬────────────────────────────────┘
                             │ POST /api/quote-requests/verify-email
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Server (verify-email/route.ts)                             │
│  1. verifyCode (max 5 attempts, expires 30min)              │
│  2. Si valide :                                             │
│     - status = 'pending'                                    │
│     - email_verified = true                                 │
│     - dispatchRecipients()                                  │
│       └─ selectRecipientsForRequest (5 diag mix premium/    │
│          verified/basic, distance + routing_score)          │
│       └─ insertRecipientsBatch (quote_request_recipients)   │
│       └─ Resend email × N (template adapté claimed/basic)   │
│       └─ Resend récap au requester                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  Redirect /mes-demandes/[token]                             │
│  → Timeline 5 diag avec statuts en temps réel               │
└─────────────────────────────────────────────────────────────┘
```

## 3. Rate limits (V1 SQL)

Table `quote_request_rate_limits`. Fenêtre fixe par bucket d'1h.

| Clé | Fenêtre | Max | Justification |
|---|---|---|---|
| `ip:<addr>` | 24h | 3 | Bloque attaques distribuées légères |
| `email:<addr>` | 7j | 5 | Limite vrais utilisateurs abusifs |
| `email_diag:<addr>:<uuid>` | 24h | 1 | Empêche spam d'1 utilisateur vers 1 diag |
| `resend_code_min:<token>` | 1min | 1 | Anti-flood renvoi de code |
| `resend_code_hour:<token>` | 1h | 5 | Quota horaire renvoi de code |

**Fail-open** : si la DB est down, on autorise (mieux que bloquer tout le monde). Logs Sentry pour alerting.

**V1.5** : passer à Upstash Redis (sliding window précis, sub-ms latency) si volume > 1000 req/jour OU abus détecté.

## 4. Multi-envoi 5 diag

Source de vérité : `lib/leads/multi-recipient-router.ts` + vue SQL `v_diagnostician_routing_score`.

**Mix par défaut** :
- 2 premium (Pro+, abonnement payant) — V1 : aucun encore, fallback verified
- 2 verified (claimed Essential/Découverte)
- 1 basic (DHUP non-claimed)

**Ranking** :
1. `routing_score DESC` (10 active / 5 warned / 1 demoted / 0 disabled)
2. `gmb_rating DESC NULLS LAST`
3. Distance haversine ≤ `intervention_radius_km` (défaut 30km)

**Toujours inclus** : le diag d'origine (fiche source du formulaire) si éligible.

## 5. Cycle vie diag fantôme

Cron `ghost-lifecycle-cron` quotidien 6h CET → appelle RPC `recompute_diag_ghost_status` :

| Seuil | Action | Status | Email |
|---|---|---|---|
| 5 leads ignorés / 30j | Warning | `warned` | ghost-warned.html |
| 10 leads ignorés / 60j | Démotion (routing_score=1) | `demoted` | ghost-demoted.html |
| 15 leads ignorés / 90j | Veille (routing_score=0) | `soft_disabled` | ghost-soft-disabled.html |
| Pas de login 6 mois (claimed) | Archivage permanent | `archived` | aucun (final) |

**Reset auto** : dès qu'un diag répond à un lead (`record_diag_lead_interaction(..., 'responded')`), `ghost_status` revient à `active`.

**Pause manuelle** : `diagnosticians.manual_pause_until` = "vacances jusqu'à X" → routing_score = 0 sans changer ghost_status.

## 6. Tracking & métriques

| Métrique | Source | SLO cible |
|---|---|---|
| Taux vérification email | `count(status='pending') / count(status='pending_email_verification')` 7j | > 70% |
| Score reCAPTCHA moyen | `avg(recaptcha_score)` 7j | > 0.7 |
| Rate limit hits / jour | `count(quote_request_rate_limits) WHERE bucket_start_at > today` | < 50 |
| Taux réponse diag | `count(status='responded') / count(status='sent')` recipients 14j | > 40% |
| % diag warned + | `count(ghost_status != 'active') / count(*)` | < 15% |
| Coût Resend / lead | Calculé via tags Resend | < 0,005 € |

## 7. Variables d'environnement requises

```bash
# reCAPTCHA v3 (Google)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=6Lc...           # côté client
RECAPTCHA_SECRET_KEY=6Lc...                      # côté serveur (siteverify)

# Cron Supabase Edge Function
CRON_SECRET=...                                  # Auth Bearer Edge Function
INTERNAL_CRON_SECRET=...                         # Optionnel — séparé du cron secret pour /api/internal/*

# Resend (déjà existant)
RESEND_API_KEY=re_...
RESEND_FROM='KOVAS <hello@kovas.fr>'

# Site URL
NEXT_PUBLIC_SITE_URL=https://kovas.fr
```

## 8. Procédure escalade V1.5 (SMS)

Déclencheurs (au moins 1 sur 7 jours glissants) :
- Score reCAPTCHA moyen < 0.5
- > 200 rate-limit hits / jour
- > 10 plaintes diag "demandes spam"
- Taux verification email < 50%

Action : ajouter une couche SMS OTP via Brevo (~0,15€/SMS) en sus de l'email pour les seuils élevés. Code 6 chiffres double-canal.

## 9. RGPD

- IP + UA conservés 90j max (purge cron à ajouter)
- Codes de vérification effacés au succès
- Demandes `status='spam'` purgées à 30j
- Droit à l'effacement : suppression par tracking_token via support
- Pas de profiling reCAPTCHA conservé côté KOVAS (seul Google le fait)

## 10. Fichiers clés

| Rôle | Chemin |
|---|---|
| Migration SQL | `supabase/migrations/20260604100000_anti_spam_and_ghost_lifecycle.sql` |
| Rate limits | `apps/web/src/lib/anti-spam/rate-limits.ts` |
| Email verify | `apps/web/src/lib/anti-spam/email-verification.ts` |
| reCAPTCHA | `apps/web/src/lib/anti-spam/recaptcha.ts` |
| Multi-recipient router | `apps/web/src/lib/leads/multi-recipient-router.ts` |
| Dispatch | `apps/web/src/lib/leads/dispatch-recipients.ts` |
| API soumission | `apps/web/src/app/api/diagnosticians/[id]/quote-request/route.ts` |
| API verify-email | `apps/web/src/app/api/quote-requests/verify-email/route.ts` |
| API resend-code | `apps/web/src/app/api/quote-requests/resend-code/route.ts` |
| API timeline | `apps/web/src/app/api/quote-requests/[token]/timeline/route.ts` |
| Edge cron | `supabase/functions/ghost-lifecycle-cron/index.ts` |
| API interne ghost-notify | `apps/web/src/app/api/internal/ghost-notify/route.ts` |
| Page vérif email | `apps/web/src/app/verifier-mon-email/[token]/` |
| Page suivi | `apps/web/src/app/mes-demandes/[token]/` |
| Composant reCAPTCHA | `apps/web/src/components/anti-spam/RecaptchaV3.tsx` |
| Email templates K1 | `apps/web/src/emails/quote-request/verification-code.ts` + `ghost-lifecycle.ts` |
