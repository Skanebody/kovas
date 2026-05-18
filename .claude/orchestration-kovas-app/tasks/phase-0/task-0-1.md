# Task 0.1 : Création comptes services M0

## Objective

Ouvrir les 12 comptes services impératifs M0 sous facturation Nexus 1993 et documenter les variables d'environnement dans `.env.example`. Déclencher la demande D-U-N-S Dun & Bradstreet (5-15j de délai, prérequis pour Apple Developer Program).

## Context

Première task de la Phase 0 pre-sprint setup. Sans ces comptes, rien ne peut démarrer côté tech (Supabase, Stripe, Anthropic API, etc.). La demande D-U-N-S a un délai administratif de 5-15 jours ouvrés qui bloque ensuite la Task 0.2 (Apple Developer enrollment) — donc à déclencher EN PREMIER.

## Dependencies

- None (première task)

## Blocked By

- Aucune

## Research Findings

- De `research/supabase-architecture.md` §1 : région **eu-west-3 Paris** confirmée + Pro plan ($25/mo) à activer M2 (Free OK M0-M1)
- De `research/anthropic-claude.md` §10 : créer **Anthropic Workspaces** séparés dev/staging/prod
- De `research/whisper-transcription.md` §12 : signer DPA OpenAI dès création compte
- De `CLAUDE.md` §19 : 12 comptes M0 + 6 différés/conditionnels + 7 supprimés (économie ~1750€/an)

## Implementation Plan

### Step 1 : Demande D-U-N-S Dun & Bradstreet (priorité absolue, J0)

- Aller sur https://www.dnb.com/duns-number/get-a-duns.html (formulaire FR)
- Renseigner données Nexus 1993 (SIRET, KBis, adresse Dieppe)
- Délai 5-15 jours ouvrés
- Email confirmation à archiver dans `docs/credentials-setup.md`

### Step 2 : Google Workspace Business Starter (~6€/mo)

- Créer espace `kovas.fr` (DNS Cloudflare déjà délégué → ajout MX records Google)
- Adresses : `benjamin@kovas.fr`, `contact@kovas.fr`, `support@kovas.fr`, `juridique@kovas.fr`
- 2FA TOTP obligatoire sur le compte admin

### Step 3 : Cloudflare DNS + SSL gratuit

- Créer compte sous email pro `benjamin@kovas.fr`
- Pointer NS du registrar du domaine kovas.fr vers Cloudflare
- Configurer records : A/CNAME pour Vercel + Google Workspace MX
- SSL universel activé (gratuit)

### Step 4 : GitHub Nexus 1993 organization

- Créer org GitHub `nexus-1993-kovas` (ou similaire)
- Inviter Benjamin Bel admin
- Activer 2FA TOTP obligatoire sur l'org
- Créer repo privé principal `kovas-app` (vide pour l'instant)
- Créer repo privé séparé `kovas-discovery-log` (cf. Task 0.7)

### Step 5 : Supabase Free + project initial

- Créer compte sous `benjamin@kovas.fr`
- Créer project `kovas-prod` région **eu-west-3 (Paris)**
- Plan Free M0-M2 (sera upgradé Pro M2 → PITR M5)
- Signer **DPA Supabase** (Dashboard > Organization > Legal)
- Récupérer `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

### Step 6 : Anthropic Console

- Créer compte sous `benjamin@kovas.fr`
- Créer **3 Workspaces** : `dev`, `staging`, `prod`
- Générer 3 API keys (1 par workspace)
- Activer **opt-out training data** dans Settings
- Plan Pay-as-you-go avec budget alert $30/jour

### Step 7 : OpenAI Platform (Whisper)

- Créer compte sous `benjamin@kovas.fr`
- **Signer DPA OpenAI** : https://openai.com/policies/data-processing-addendum
- Générer API key dédiée `kovas-prod-whisper`
- Budget alert $30/jour

### Step 8 : Stripe (mode Test)

- Créer compte sous Nexus 1993 (KBis + RIB Qonto requis pour activation Live)
- Mode Test activé d'office, Live nécessite vérification 1-3 jours
- Récupérer `STRIPE_SECRET_KEY` test + `STRIPE_PUBLISHABLE_KEY` test + `STRIPE_WEBHOOK_SECRET`
- Activer Stripe Tax (TVA 20% FR)

### Step 9 : Vercel Hobby

- Créer compte sous `benjamin@kovas.fr` (lié GitHub)
- Region : Paris (cdg1)
- Vérifier compte capable de déployer apps depuis repo `kovas-app`

### Step 10 : Expo EAS Free

- Créer compte sous `benjamin@kovas.fr`
- `expo login` localement
- Free tier OK M0-M3

### Step 11 : Railway

- Créer compte sous `benjamin@kovas.fr`
- Free credits utilisables M0-M5
- Sera utilisé pour DocuSeal self-hosted + microservice Java/Jackcess (Tasks ultérieures)

### Step 12 : Resend

- Créer compte sous `benjamin@kovas.fr`
- Free tier 100 emails/jour M0-M3
- Configurer domain `kovas.fr` (records DNS Cloudflare : SPF, DKIM, DMARC)
- Vérifier domain : email test envoyable depuis `noreply@kovas.fr`

## Files to Create

- `.env.example` (template variables documenté)
- `docs/credentials-setup.md` (manuel de configuration + archive D-U-N-S)
- `docs/dns-records.md` (records Cloudflare consolidés)

## Files to Modify

- Aucun (premier setup)

## Contracts

### Provides (for downstream tasks)

- **`.env.example`** : template avec toutes les variables d'env standardisées
  ```env
  # Supabase
  SUPABASE_URL=https://xxx.supabase.co
  SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...

  # Anthropic (3 workspaces)
  ANTHROPIC_API_KEY_DEV=sk-ant-...
  ANTHROPIC_API_KEY_STAGING=sk-ant-...
  ANTHROPIC_API_KEY_PROD=sk-ant-...

  # OpenAI (Whisper)
  OPENAI_API_KEY=sk-...

  # Stripe
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_PUBLISHABLE_KEY=pk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...

  # Resend
  RESEND_API_KEY=re_...

  # PostHog (à ajouter Task 2.3+ quand instrumentation démarre)
  # POSTHOG_API_KEY=phc_...
  # POSTHOG_HOST=https://eu.posthog.com

  # Sentry (à ajouter Task 5.1)
  # SENTRY_DSN=https://...@sentry.io/...
  ```
- **`docs/credentials-setup.md`** : checklist de tous les comptes + statut

## Acceptance Criteria

- [ ] 12 comptes créés sous Nexus 1993 (facturation)
- [ ] D-U-N-S demandé (déclencheur Apple Developer dans 5-15j)
- [ ] Variables d'env documentées dans `.env.example`
- [ ] Email pro `benjamin@kovas.fr`, `contact@kovas.fr`, `support@kovas.fr`, `juridique@kovas.fr` opérationnels
- [ ] DNS kovas.fr pointant Cloudflare (records A/CNAME/MX/TXT visibles via `dig`)
- [ ] DPA signés : Supabase + OpenAI + Anthropic (opt-out training activé)
- [ ] 2FA TOTP actif sur tous les comptes (Google Workspace admin, GitHub org, Supabase, Anthropic, OpenAI, Stripe)
- [ ] Budget alerts configurés : $30/jour OpenAI + $30/jour Anthropic

## Testing Protocol

### API Testing (curl/SDK)

Pour chaque service, faire un test API minimal pour confirmer auth fonctionne :

```bash
# Supabase
curl "$SUPABASE_URL/rest/v1/" -H "apikey: $SUPABASE_ANON_KEY"

# Anthropic
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY_DEV" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":50,"messages":[{"role":"user","content":"hi"}]}'

# OpenAI
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Stripe
stripe customers list --limit 1

# Resend
curl https://api.resend.com/emails \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"from":"test@kovas.fr","to":"benjamin@kovas.fr","subject":"test","html":"test"}'
```

### Browser Testing (Claude_in_Chrome MCP)

- Login Google Workspace : reception email test sur `benjamin@kovas.fr` réussie
- Login Supabase Dashboard : projet `kovas-prod` visible eu-west-3
- Login Anthropic Console : 3 workspaces visibles
- Login Vercel : compte Hobby actif

### Build/Lint Checks

- N/A (pas de code à cette étape)

## Skills to Read

- `kovas-defense-strategy` (cohérence avec stratégie compte Nexus 1993 + 2FA + DPA)

## Research Files to Read

- `research/supabase-architecture.md` §1 (région eu-west-3 + Pro plan trajectoire)
- `research/anthropic-claude.md` §10 (server-side architecture + workspaces)
- `research/whisper-transcription.md` §12 (compliance OpenAI DPA)

## Git

- Branch : `feature/0-1-comptes-services-m0`
- Commit message prefix : `Task 0.1:`
- PR target : `main`

## Notes anti-pattern

- ⛔ Ne PAS utiliser email perso (Gmail/Outlook) pour créer les comptes — TOUJOURS `benjamin@kovas.fr` ou alias pro
- ⛔ Ne PAS skipper la 2FA — risque sécurité critique
- ⛔ Ne PAS skipper les DPA OpenAI/Supabase/Anthropic — exposition RGPD
- ⛔ Ne PAS attendre que tous les autres tasks soient prêts pour demander D-U-N-S — c'est LE bottleneck Apple Developer
