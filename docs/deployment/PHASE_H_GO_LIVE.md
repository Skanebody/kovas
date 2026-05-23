# KOVAS — Checklist Go-Live Phase H

> Document maître pour le déploiement en production de KOVAS Annuaire + KOVAS 360 v1.
> Société éditrice : NEXUS 1993 (SIREN 982 786 154 — cf. `apps/web/src/lib/legal/company-identity.ts`).
> Date prévisionnelle go-live : **septembre-octobre 2026** (cf. CLAUDE.md §1.2).
>
> Une fois ce document terminé, supprimer/cocher en place ne pas oublier d'archiver
> en `PHASE_H_GO_LIVE_<DATE>.md` pour audit ultérieur.

---

## 0. Vue d'ensemble — ce qui est livré Phase H

Stack consolidée des phases A-G (post `b91c26e`) :

- **98 migrations Supabase** (`supabase/migrations/`)
- **56 Edge Functions Supabase** (`supabase/functions/`)
- **3 workflows GitHub Actions cron** (`.github/workflows/cron-*.yml`) + 1 CI (`ci.yml`)
- **44 Stripe Price IDs** (cf. `docs/deployment/STRIPE_PRICE_IDS_SETUP.md`)
- **Pricing V3 dual track** : Annuaire (4 plans : free + 3 payants) × Logiciel (5 plans : free + 4 payants) + 5 bundles + 6 slots sponsorisés + 4 add-ons
- **Brevo SMS** (Phase E — OTP `send-otp-sms`/`verify-otp`) + **Brevo transactional email** (Phase F — 10 templates upsell)
- **Anthropic Claude** : Haiku 4.5 (voice + bot Telegram + drafts), Sonnet 4.6 (vision + consolidation + chatbot RAG)
- **9 sources d'ingestion SEO** (Phase D) : GSC, SerpAPI Trends, Apify PAA, NewsAPI, Reddit, ADEME signals, INSEE données locales, DVF, Autocomplete
- **Anti-spam reCAPTCHA v3** (B2C devis), **OTP SMS** (vérification téléphone leads)
- **Telegram bot admin** (notifications + commandes NLP Claude Haiku)
- **Schema.org JSON-LD + sitemap segmenté + tests E2E Playwright** (Phase G)

---

## 1. Pré-requis avant go-live

### Infrastructure & comptes

- [ ] Domaine `kovas.fr` enregistré (Cloudflare Registrar) — verification DNSSEC active
- [ ] Compte Vercel team `kovas` créé + lié au repo GitHub `Skanebody/KOVAS`
- [ ] Compte Supabase projet eu-west-3 (Paris) provisionné, plan **Pro** activé (PITR 7j)
- [ ] Compte Stripe — passage Test → **Live** demandé à Stripe (vérification KBis NEXUS 1993 + RIB SEPA)
- [ ] Compte Brevo email + SMS — sender `KOVAS` validé (max 11 alphanumériques)
- [ ] Compte Anthropic Console (workspace prod séparé du dev/staging)
- [ ] Compte OpenAI Platform (Whisper)
- [ ] Compte INSEE Sirene API (OAuth2 client_id/secret production)
- [ ] Compte INPI Pro (RNE auth basic, gratuit)
- [ ] Compte SerpAPI plan $50/mo (5k req/mo)
- [ ] Compte Apify (token API)
- [ ] Compte NewsAPI (plan Business ou Dev OK pour M0-M6)
- [ ] Compte Google Cloud (service account JSON pour GSC + Trends si fallback)
- [ ] D-U-N-S Dun & Bradstreet NEXUS 1993 (déjà obtenu : **281 515 446**)
- [ ] Compte Cloudflare (DNS + CDN + SSL) lié au domaine
- [ ] Compte Sentry projet `kovas-web`
- [ ] Compte PostHog projet `kovas`

### Légal & conformité

- [ ] Mentions légales v1.2+ générées par `formatLegalMentions()` validées (cf. `apps/web/src/lib/legal/company-identity.ts`)
- [ ] CGV v1.3 KOVAS 360 publiées + acceptées au signup (checkbox obligatoire)
- [ ] Conditions B2C Annuaire publiées (formulaire devis particuliers)
- [ ] DPA Brevo + Anthropic + Supabase signés (hébergement EU vérifié)
- [ ] Hiscox RC pro souscrite (plafond 500k€/sinistre + extension PI 100k€) — **avant bêta privée**
- [ ] Cookies banner custom déployé (4h dev, cf. CLAUDE.md §19 "Rejetés")
- [ ] Politique de confidentialité RGPD publiée sur `/legal/confidentialite`
- [ ] DPO / contact RGPD désigné (Benjamin Bel, email `dpo@kovas.fr`)
- [ ] INPI dépôt marques **KOVAS** + **KOVAS 360** + **KOVAS Annuaire** (classes 9 + 42) — idéalement déposé avant go-live

---

## 2. Variables d'environnement Vercel (production)

Liste exhaustive : `.env.example` à la racine du repo (370+ vars documentées).

### Catégories à provisionner (résumé)

| Catégorie | Vars | Notes |
|---|---|---|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_REF`, `SUPABASE_FUNCTIONS_BASE_URL` | Service role NEVER exposé client |
| **Stripe Live** | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` + 44 `STRIPE_PRICE_*` | Cf. `STRIPE_PRICE_IDS_SETUP.md` |
| **Anthropic** | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL_VOICE`, `ANTHROPIC_MODEL_VISION`, `ANTHROPIC_MODEL_CHAT`, `ANTHROPIC_MODEL`, etc. | Pin snapshots datés en prod |
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL_TRANSCRIBE` | Whisper `gpt-4o-mini-transcribe` |
| **Deepgram** | `DEEPGRAM_API_KEY` | Fallback EU Frankfurt |
| **Brevo** | `BREVO_API_KEY`, `BREVO_SMS_SENDER`, `BREVO_FROM_EMAIL`, `BREVO_FROM_NAME`, `BREVO_REPLY_TO`, `BREVO_INBOUND_WEBHOOK_SECRET` | SMS sender validé console Brevo |
| **Resend (legacy emails)** | `RESEND_API_KEY`, `RESEND_FROM` | Peut être remplacé entièrement par Brevo Phase F+ |
| **PostHog/Sentry** | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, etc. | EU host PostHog |
| **INSEE / INPI / DHUP / ADEME** | `INSEE_CLIENT_ID/SECRET`, `INPI_USERNAME/PASSWORD`, `DHUP_DATASET_RESOURCE_URL`, `ADEME_API_BASE_URL` | Cf. Phase A docs |
| **SEO ingest pipeline** | `GSC_SERVICE_ACCOUNT_JSON`, `GSC_SITE_URL`, `SERPAPI_API_KEY`, `APIFY_API_TOKEN`, `NEWSAPI_API_KEY` | Phase D |
| **Cron / internal secrets** | `CRON_SECRET`, `INTERNAL_CRON_SECRET`, `INTERNAL_RGPD_SECRET`, `INTERNAL_API_SECRET`, `KOVAS_SYSTEM_USER_ID` | Générer via `openssl rand -hex 32` |
| **reCAPTCHA v3** | `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `RECAPTCHA_SECRET_KEY` | Domaine kovas.fr + localhost |
| **Telegram bot** | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `TELEGRAM_CHAT_ID_*`, `ANTHROPIC_BOT_MODEL` | 4 channels : signups/revenue/alerts/errors |
| **Admin 2FA** | `ADMIN_2FA_ENCRYPTION_KEY` | 64 hex chars |
| **Google APIs (OAuth)** | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI` | Pour bouton "Partager 3 modes" |
| **Dropbox OAuth** | `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` | Mode 2 partage |
| **Liciel MDB Writer** | `MDB_WRITER_URL`, `MDB_WRITER_API_KEY` | Microservice Railway |
| **Public URLs** | `NEXT_PUBLIC_APP_URL=https://kovas.fr`, `NEXT_PUBLIC_API_URL=https://kovas.fr/api` | |
| **Identité société** | `COMPANY_*` | Documentaire, source vérité = `company-identity.ts` |
| **Dev flags** | `KOVAS_DEV_*`, `OTP_DEV_MODE=false`, `NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=` (vide) | Vérifier qu'ils sont **OFF/vides en prod** |

### Process Vercel

1. Vercel Dashboard → Project Settings → Environment Variables
2. Pour chaque var, choisir le scope : **Production** (impératif), **Preview** (optionnel pour staging), **Development** (impératif pour `vercel dev`)
3. Les `NEXT_PUBLIC_*` sont exposés au browser : OK uniquement pour clés publiques
4. Les `*_SERVICE_ROLE_KEY`, `*_SECRET_KEY`, `*_PASSWORD` : **JAMAIS** `NEXT_PUBLIC_`

### Vérification post-provisionnement

```bash
vercel env ls production
# Compter ~150 entrées (varie selon options activées)
```

---

## 3. Migrations Supabase (98 migrations)

### Application sur la base production

```bash
# Depuis le repo, lié au projet Supabase production
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase db push --linked
```

### Ordre chronologique (résumé)

Les 98 migrations s'appliquent dans l'ordre lexicographique des timestamps :

1. **Foundation** (`20260518*`-`20260520*`) : auth, profiles, organizations, dossiers, storage buckets, import Liciel, capture-first
2. **Admin dashboard** (`20260521*`) : 2FA TOTP, alerts, milestones, broadcasts, Telegram bot
3. **Scheduling + pricing** (`20260522*`) : rendez-vous, calculateur prix
4. **Utilities + docs** (`20260523*`-`20260524*`) : gadgets métier, document intelligence, RGPD, monthly reports
5. **Cockpit ADEME** (`20260525*`) : KPI snapshots, cache DPE, prévalidations, défense dossiers
6. **Regulatory veille** (`20260526*`) : seed documents
7. **Branding + factures** (`20260527*`-`20260528*`) : org branding, quotes Factur-X, invoices, business card, pricing refonte illimité
8. **Annuaire** (`20260530*`) : diagnosticians, claim workflow, RGPD emails, quote requests B2C, SEO geo pages, A/B testing
9. **Pricing premium** (`20260601*`-`20260602*`) : caps optimization, pricing premium final
10. **Annuaire freemium + anti-spam** (`20260603*`-`20260605*`) : freemium levels, ghost lifecycle, upsell system
11. **Phase A cross-validation** (`20260606*`) : diagnostician_cross_validation, routing functions
12. **Phase B pricing V3** (`20260607*`) : `pricing_dual_track_v3.sql`
13. **Phase D SEO pipeline** (`20260608*`) : `seo_pipeline.sql`
14. **Phase E leads engine** (`20260609*`) : `leads_engine.sql`, `otp_sms_verification.sql`, `diagnosticians_boost_lead_cooldown.sql`
15. **Phase F upsell email tracking** (`20260610*`)

### Vérification post-migration

```sql
-- Compter les tables (attendu ~60+ tables)
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public';

-- Vérifier RLS activée sur toutes les tables sensibles
SELECT schemaname, tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Devrait retourner uniquement tables explicitement publiques (ex: seo_geo_pages)
```

---

## 4. Edge Functions Supabase (56 fonctions)

### Déploiement en masse

```bash
# Lister
ls supabase/functions/

# Déployer toutes les fonctions (loop)
for fn in supabase/functions/*/; do
  name=$(basename "$fn")
  echo "Deploying $name..."
  supabase functions deploy "$name" --no-verify-jwt --project-ref "$SUPABASE_PROJECT_REF"
done
```

> ⚠️ `--no-verify-jwt` car la plupart des fonctions sont appelées via `x-cron-secret` ou
> `Authorization: Bearer <SERVICE_ROLE>` plutôt qu'un JWT user. Fonctions appelées
> uniquement par utilisateur authentifié (ex: `regulatory-ai-chat`) doivent être
> redéployées sans ce flag :
> ```bash
> supabase functions deploy regulatory-ai-chat --project-ref "$SUPABASE_PROJECT_REF"
> ```

### Secrets Supabase (Edge Functions)

```bash
# Provisionner les secrets nécessaires (vue d'ensemble — cf. .env.example)
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-5-20250930
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set BREVO_API_KEY=xkeysib-...
supabase secrets set BREVO_SMS_SENDER=KOVAS
supabase secrets set BREVO_FROM_EMAIL=noreply@kovas.fr
supabase secrets set CRON_SECRET=$(openssl rand -hex 32)
supabase secrets set INTERNAL_CRON_SECRET=$(openssl rand -hex 32)
supabase secrets set INTERNAL_RGPD_SECRET=$(openssl rand -hex 32)
supabase secrets set INTERNAL_API_SECRET=$(openssl rand -hex 32)
supabase secrets set KOVAS_SYSTEM_USER_ID=<uuid-du-user-system>
supabase secrets set INSEE_CLIENT_ID=...
supabase secrets set INSEE_CLIENT_SECRET=...
supabase secrets set INPI_USERNAME=...
supabase secrets set INPI_PASSWORD=...
supabase secrets set GSC_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
supabase secrets set GSC_SITE_URL=sc-domain:kovas.fr
supabase secrets set SERPAPI_API_KEY=...
supabase secrets set APIFY_API_TOKEN=...
supabase secrets set NEWSAPI_API_KEY=...
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
supabase secrets set DHUP_DATASET_RESOURCE_URL=https://www.data.gouv.fr/.../annuaire-diagnostiqueurs.csv
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...

# Lister pour vérifier
supabase secrets list --project-ref "$SUPABASE_PROJECT_REF"
```

### Création du user "system" (KOVAS_SYSTEM_USER_ID)

Avant la première exécution d'un cron qui logue dans `ai_usage_log` :

```sql
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'system@kovas.fr',
  '<bcrypt-hash-random>',
  now(),
  '{"provider":"system"}'::jsonb,
  '{"display_name":"KOVAS System"}'::jsonb,
  now(), now()
)
RETURNING id;
-- → Copier l'UUID dans KOVAS_SYSTEM_USER_ID (Vercel + Supabase secrets)
```

### Configuration webhook Telegram

```bash
node scripts/telegram-setup-webhook.mjs
# Définit l'URL du webhook + le secret HMAC dans BotFather
```

---

## 5. Stripe Price IDs (44 IDs Phase B)

Cf. document détaillé : [`STRIPE_PRICE_IDS_SETUP.md`](./STRIPE_PRICE_IDS_SETUP.md).

### Résumé

| Surface | Nombre Prix | Naming pattern |
|---|---|---|
| KOVAS Annuaire (3 tiers × 2 cycles) | 6 | `STRIPE_PRICE_ANNUAIRE_<TIER>_<CYCLE>` |
| KOVAS 360 Logiciel (4 tiers × 2 cycles) | 8 | `STRIPE_PRICE_LOGICIEL_<TIER>_<CYCLE>` |
| Bundles Annuaire+Logiciel (5 combos × 2) | 10 | `STRIPE_PRICE_BUNDLE_<NAME>_<CYCLE>` |
| Sponsored Slots (6 catégories × 2) | 12 | `STRIPE_PRICE_SLOT_<CATEGORY>_<CYCLE>` |
| Add-ons (4 modules × 2) | 8 | `STRIPE_PRICE_ADDON_<MODULE>_<CYCLE>` |
| **Total** | **44** | |

### Webhook Stripe

```
URL : https://kovas.fr/api/stripe/webhook
Events à abonner :
- checkout.session.completed
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- invoice.payment_succeeded
- invoice.payment_failed
- payment_intent.succeeded
- payment_intent.payment_failed
```

Copier le `whsec_...` dans `STRIPE_WEBHOOK_SECRET` (Vercel + Supabase secret).

### Stripe Tax

Activer dans Stripe Dashboard → Tax. Configurer :
- France : TVA 20% taux normal
- Numéro TVA NEXUS 1993 : `FR18982786154`
- Origin address : 66 Avenue des Champs Élysées, 75008 Paris

---

## 6. GitHub Actions cron secrets

Workflows actifs :
- `cron-cross-validation.yml` — pipeline diagnostiqueurs Phase A (quotidien 03:30 UTC)
- `cron-dhup-weekly.yml` — import DHUP hebdomadaire (lundi 03:00 UTC)
- `cron-boost-onboarding.yml` — boost lead onboarding (lundi 09:00 UTC)

### Secrets à provisionner (Settings → Secrets and variables → Actions)

| Secret | Valeur |
|---|---|
| `SUPABASE_FUNCTIONS_BASE_URL` | `https://<project-ref>.supabase.co/functions/v1` |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role JWT (depuis Supabase Dashboard → API) |
| `CRON_SECRET` | secret partagé (généré via `openssl rand -hex 32`, **identique** à celui des Edge Functions) |

### Validation

Lancer manuellement chaque workflow via `workflow_dispatch` après go-live pour valider.

---

## 7. Cloudflare DNS

```
A     kovas.fr            → 76.76.21.21          (Vercel anycast IP)
AAAA  kovas.fr            → 2606:4700::...        (optionnel IPv6)
CNAME www.kovas.fr        → cname.vercel-dns.com
TXT   _vercel             → vc-domain-verify=<token>
MX    kovas.fr  10        → in1-mxa.bind.brevo.com
MX    kovas.fr  20        → in2-mxb.bind.brevo.com
TXT   kovas.fr            → "v=spf1 include:spf.brevo.com -all"
TXT   _dmarc.kovas.fr     → "v=DMARC1; p=quarantine; rua=mailto:dmarc@kovas.fr"
TXT   brevo._domainkey.kovas.fr → <DKIM Brevo généré dashboard>
TXT   _acme-challenge     → (auto par Cloudflare SSL)
```

### Cloudflare features à activer

- [ ] SSL/TLS : **Full (strict)**
- [ ] Always Use HTTPS : **on**
- [ ] Min TLS Version : **1.2**
- [ ] Auto-redirect HTTP → HTTPS : **on**
- [ ] Bot Fight Mode : **on** (anti-scraping basique gratuit)
- [ ] DNSSEC : **on**
- [ ] WAF rules basiques (rate limit `/api/diagnosticians/.../quote-request` à 5 req/h/IP)

### Catch-all email Brevo Inbound Parsing

Configurer dans Cloudflare Email Routing OU Brevo Inbound Parsing :
- `devis-*@kovas.fr` → webhook `https://kovas.fr/api/inbound/brevo`
- Header signature `X-Brevo-Webhook-Signature` validé via `BREVO_INBOUND_WEBHOOK_SECRET`

---

## 8. Migration legacy plans (Edge Function dryRun-first)

Une fois migrations + Edge Functions déployées, migrer les utilisateurs des plans legacy
vers la grille V3 dual track.

### Dry-run (obligatoire en premier)

```bash
# Mode lecture seule, retourne stats sans modifier
./scripts/migrate-legacy-plans.sh --dry-run
```

Lire la réponse JSON : si statistiques attendues (ex : `would_migrate: 0` pour go-live initial,
ou compte exact de bêta-testeurs à migrer), passer au run réel. Sinon investiguer.

### Run réel

```bash
./scripts/migrate-legacy-plans.sh --run
```

> ⚠️ Cette migration ne crée PAS de souscription Stripe — elle update les rows
> `subscriptions` en BDD. Pour les bêta-testeurs en tarif Founder à vie, les
> conserver sur leur tier `*_legacy` (cf. CLAUDE.md §4 "Plans grandfather").

---

## 9. Smoke tests post-déploiement

### Manuels

#### Pages publiques (KOVAS Annuaire)
- [ ] `https://kovas.fr/` charge correctement (homepage marketing)
- [ ] `https://kovas.fr/pour-les-diagnostiqueurs` (landing B2B SaaS)
- [ ] `https://kovas.fr/pricing` affiche les 4 plans Annuaire + 5 plans Logiciel + bundles
- [ ] `https://kovas.fr/trouver-un-diagnostiqueur` affiche l'annuaire racine
- [ ] `https://kovas.fr/trouver-un-diagnostiqueur/paris-75001` (page géo) charge avec liste paginée
- [ ] `https://kovas.fr/trouver-un-diagnostiqueur/[ville]/[slug]` (fiche pro) charge avec JSON-LD LocalBusiness

#### SEO
- [ ] `https://kovas.fr/sitemap.xml` retourne index XML valide avec sous-sitemaps
- [ ] `https://kovas.fr/sitemap-diagnosticians.xml` retourne sous-sitemap segmenté
- [ ] `https://kovas.fr/sitemap-cities.xml` retourne sitemap des pages géo
- [ ] `https://kovas.fr/robots.txt` autorise crawling + référence sitemap
- [ ] View Source `/` : `<script type="application/ld+json">` Organization + WebSite présents
- [ ] View Source `/trouver-un-diagnostiqueur/[ville]/[slug]` : JSON-LD LocalBusiness + BreadcrumbList

#### Flow d'inscription B2B (KOVAS 360)
- [ ] `https://kovas.fr/signup` → email pro + SIRET (validation INSEE Sirene en live) → onboarding
- [ ] Création premier dossier diagnostic (DPE T3 fictif)
- [ ] Saisie vocale → transcription Whisper → structuration Claude → champs remplis
- [ ] Upload photo géolocalisée → annotation → save
- [ ] Export PDF + Word + ZIP Liciel

#### Flow B2C (KOVAS Annuaire)
- [ ] `https://kovas.fr/trouver-un-diagnostiqueur/[ville]/[slug]` → bouton "Demander un devis"
- [ ] Formulaire devis (4 champs) → reCAPTCHA v3 → soumission
- [ ] OTP SMS reçu sur le téléphone fourni → validation OTP
- [ ] Statut quote_request passe à `submitted`
- [ ] Email transactionnel reçu (template Brevo)

#### Flow paiement
- [ ] Stripe checkout : sélectionner plan KOVAS 360 Active mensuel → redirection Stripe valide
- [ ] Carte test `4242 4242 4242 4242` (mode test Stripe Live = `4000 0000 0000 0077` succès)
- [ ] Webhook reçu côté `/api/stripe/webhook` (Sentry trace OK)
- [ ] Souscription créée en BDD `subscriptions` avec bon `stripe_subscription_id`

#### Admin
- [ ] `https://kovas.fr/admin` → login + 2FA TOTP → dashboard avec metrics
- [ ] Telegram : `/start` au bot → réponse avec liste commandes
- [ ] Telegram : `/status` → statistiques BDD live

### Automatisés (Playwright E2E)

```bash
cd apps/web
pnpm test:e2e -- --grep "smoke"
```

Tests E2E Phase G couvrent :
- Homepage marketing
- Pricing dual track
- Annuaire fiche pro
- Quote request B2C complet (avec OTP mocked en `OTP_DEV_MODE=true` staging)
- Signup B2B (avec SIRET fictif via `NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1` staging)

### Lighthouse audit

Objectifs (mobile + desktop) :
- Performance ≥ 80
- Accessibility ≥ 95
- Best Practices = 100
- SEO = 100

---

## 10. Monitoring + alerting

- [ ] Sentry projet `kovas-web` créé, `SENTRY_DSN` renseigné côté Vercel + Edge Functions
- [ ] Sentry source maps uploaded au build (`SENTRY_AUTH_TOKEN`)
- [ ] PostHog projet `kovas` (EU host `eu.i.posthog.com`), feature flags configurés :
  - `gain_tracker_enabled` (default off, activable per-user pour bêta V1.5)
  - `claude_opus_escape_hatch` (default off)
  - `recaptcha_enforce` (default on)
- [ ] Better Stack ou status page custom Supabase + Resend : monitoring `kovas.fr`, `/trouver-un-diagnostiqueur`, `/pricing`, `/sitemap.xml`, `/api/health`
- [ ] Status page custom `/status` accessible
- [ ] Alertes Telegram configurées sur channel `errors` : Sentry → webhook → bot KOVAS admin
- [ ] Dashboard admin `/admin` métriques : DAU, MAU, MRR, signups jour, error rate

---

## 11. Rollback plan

En cas de blocage majeur en prod :

### Vercel
1. Dashboard → Deployments → ancien déploiement → "Promote to Production"
2. Vérifier que les vars d'env n'ont pas été modifiées entre-temps

### Supabase
1. Pour migrations : **ne pas faire `db reset`** en prod (perte de données)
2. Préparer migration `down` manuelle ciblée :
   ```sql
   -- Ex : annuler la dernière migration phase G
   BEGIN;
   ALTER TABLE seo_geo_pages DROP COLUMN IF EXISTS new_column;
   -- ...
   COMMIT;
   ```
3. PITR (Point In Time Recovery) Supabase Pro : restauration jusqu'à 7 jours en arrière (dernier recours)

### Stripe
- Pas de rollback automatique des Price IDs créés
- Désactiver les nouveaux Price IDs si bug critique (passer `active: false` via dashboard)
- Webhooks : peuvent être désactivés temporairement le temps de fixer un bug

### Cloudflare
- Activer "Under Attack Mode" si DDoS suspect
- Désactiver une route via Page Rules (`/api/* → 503 Maintenance`)

---

## 12. Communication go-live

- [ ] Email "Annonce KOVAS v1" aux 40-50 bêta-testeurs (Phase B2 historique CLAUDE.md §17)
- [ ] LinkedIn post Benjamin Bel (founder) — ton sobre business (cf. avatar-client.md)
- [ ] LinkedIn page KOVAS créée + post de lancement
- [ ] X/Twitter compte `@kovas_fr` (présence minimale, redirige vers site)
- [ ] Pas de post forum **Diagnostic-immo.com** avant M12 (cf. CLAUDE.md §13 interdits)
- [ ] Pas de mention publique de Liciel dans marketing avant M12 (idem)
- [ ] Article blog `kovas.fr/blog/lancement-v1` (SEO + storytelling fondateur)

---

## 13. Post-go-live — première semaine

### J+1
- [ ] Vérifier zero error rate Sentry critique
- [ ] Vérifier que les crons GitHub Actions tournent (`Actions` tab)
- [ ] Vérifier que `seo-ingest-*` Edge Functions ont des runs successifs (table `seo_ingest_runs`)

### J+3
- [ ] Premier check des conversions essai (signup → premier dossier complet)
- [ ] Premier check des leads B2C (table `quote_requests` non vide)
- [ ] Premier check des emails transactionnels Brevo (deliverability ≥ 98%)

### J+7
- [ ] Premier `monthly-upsell-digest` run validé
- [ ] Premier `fair-use-monthly-check` run validé
- [ ] Audit budget infra : coûts Vercel + Supabase + Anthropic + OpenAI + Brevo ~120€ attendus M0-M3

---

## 14. Documents annexes

- [`STRIPE_PRICE_IDS_SETUP.md`](./STRIPE_PRICE_IDS_SETUP.md) — création des 44 Price IDs
- [`../pricing/v3-dual-track-spec.md`](../pricing/v3-dual-track-spec.md) — spec produit pricing (si présent)
- [`../credentials-setup/nexus-1993-identity.md`](../credentials-setup/nexus-1993-identity.md) — identité société
- [`../../scripts/migrate-legacy-plans.sh`](../../scripts/migrate-legacy-plans.sh) — wrapper migration
- [`../../.env.example`](../../.env.example) — toutes les variables d'env documentées
