# KOVAS — Audit sécurité 360° du 27 mai 2026

> Audit complet anti-piratage et anti-fuite de données, 4 agents auditeurs parallèles.
> Résultat : 24 fichiers fixés automatiquement (commit cette session) + 11 actions
> manuelles Benjamin documentées ci-dessous.

---

## 🟢 Ce qui a été fixé automatiquement (commit `sec/audit-1`)

### Auth & rate-limit (Agent Fixer-1)

- **Open redirect `/api/auth/callback`** : helper `isValidNextPath()` rejette `null`, `!startsWith('/')`, `startsWith('//')`, schemes `http:/javascript:/data:/vbscript:/...` (case-insensitive), backslash prefix. Fallback `/dashboard/dashboard`. Defense-in-depth identique dans `lib/supabase/middleware.ts` ligne 50.
- **Scopes rate-limit `auth` (10 req/15min) et `auth_strict` (3 req/15min)** ajoutés dans `lib/rate-limit.ts` avec limiters Upstash dédiés.
- **`loginAction` rate-limité** par email lowercase (anti credential-stuffing).
- **`signupAction` rate-limité** par email lowercase.
- **`/api/auth/callback` rate-limité** par IP.
- **6 endpoints claim KYC rate-limités** (send-email-code, send-sms-code, verify-code, verify-siret, upload-identity, upload-manual) en `auth_strict` par IP — coût Brevo SMS + brute-force OTP.
- **Fail-closed Upstash en prod** : si Upstash absent en `NODE_ENV=production`, `checkRateLimit` retourne `{ success: false }` au lieu de fail-open silencieux. Dev/preview garde le fail-open soft.

### Headers HTTP + CSP (Agent Fixer-2)

- **`X-Frame-Options: SAMEORIGIN` → `DENY`** (cohérent avec `frame-ancestors 'none'`).
- **`X-XSS-Protection` supprimé** (header legacy obsolète, retiré par Chrome en 2019).
- **`Cross-Origin-Opener-Policy: same-origin`** ajouté.
- **`Cross-Origin-Embedder-Policy: credentialless`** ajouté — **À OBSERVER 7 jours**. Si tuiles OSM/avatars cassent, basculer sur `unsafe-none`. Commentaire de décision en place dans `next.config.ts`.
- **`Cross-Origin-Resource-Policy: same-site`** ajouté.
- **CSP `report-uri` + `report-to`** vers `/api/security/csp-report` ajouté.
- **Header `Report-To`** configuré (groupe `csp-endpoint`, max_age 10886400).
- **Endpoint `/api/security/csp-report` créé** : POST, rate-limit 50/min/IP, `Sentry.captureMessage('csp_violation')`, return 204 No Content.

### Sentry + PostHog privacy (Agent Fixer-2)

- **`scrubPii<T>` helper** créé dans `lib/security/scrub-pii.ts` (générique pour préserver le type strict `ErrorEvent` de Sentry 10.x).
- **`Sentry.beforeSend` upgrade** côté server + client : strip headers `authorization|cookie|x-api-key|api-key`, `user.email`, `user.ip_address` ; scrub regex dans `exception.values[].value` + `event.message` (emails, phones FR E.164 + 0X, SIRET, JWT, Stripe/Supabase/Anthropic/OpenAI keys) ; scrub `extra` context par key name (`email|phone|password|token|secret|key|siret`).
- **PostHog `maskTextSelector: '*'`** (équivalent moderne de `maskAllText` qui n'existe pas dans `@posthog/types` 1.374.0).
- **PostHog `secure_cookie: true` + `cross_subdomain_cookie: false`** ajoutés.
- **PostHog `properties_string_max_length: 1024`** (anti-leak data volumineuse).

### Hygiène & DB hardening (Agent Fixer-3 + Fixer-2)

- **`.gitignore` enrichi** : `*.pem`, `*.key`, `*.p12`, `*.pfx`, `*.crt`, `*.cert`, `*.bak`, `*.backup`, `*.orig`, `*~`, `tmp/`, `temp/`, `.netlify` (defense-in-depth).
- **`safeLog` helper** créé dans `lib/security/safe-logger.ts` : 9 patterns PII scrubbés (emails, phones FR +33 + 0X, SIRET, JWT, Stripe/Supabase/Anthropic/OpenAI keys). API : `safeLog.{log,info,warn,error,debug}` + `scrubPiiString()` standalone. Bypass scrub si `NODE_ENV !== 'production'` (dev = debug brut). **17/17 tests Vitest passing**.
- **MIME + magic number validation** sur `/api/client-photo-upload/route.ts` (JPEG, PNG, WebP, HEIC/HEIF). Mismatch type ↔ magic → 400 « Type de fichier non valide ».
- **MIME + magic number validation** sur `/api/upload-owner-document/route.ts` (PDF, images, OOXML, MS Office legacy OLE).
- **`MAX_BYTES` owner-uploads : 20MB → 10MB** (aligné CLAUDE.md §8).
- **Zod validation sur Telegram webhook** : `TelegramUpdateSchema` avec `.passthrough()`, limites max chars anti-DoS payload, `safeParse` → 400 si invalid.

### Migration SQL defense-in-depth (Agent Fixer-3) — **NON appliquée prod**

Fichier créé : `supabase/migrations/20260527230000_security_hardening.sql`

**4 sections**, à jouer manuellement après revue :
1. **Pin search_path** sur toutes les fonctions SECURITY DEFINER non couvertes par advisor_fixes (DO block ALTER FUNCTION ... SET search_path = public, pg_temp).
2. **REVOKE USAGE schemas data + analytics FROM anon** + activer RLS service_role-only sur toutes leurs tables (defense-in-depth contre erreur config.toml).
3. **Bloquer DELETE sur invoices** (rétention 10 ans Code Commerce L123-22 + DGFiP). 3 policies SELECT/INSERT/UPDATE séparées + 1 policy DELETE → `USING (false)`. service_role conserve son accès via bypass RLS.
4. **Sanity check final** : NOTICE + WARNING si fonctions non pinées, anon a encore USAGE sur data/analytics, ou policy DELETE invoice manquante.

---

## 🔴 Actions à faire MANUELLEMENT côté Benjamin

### Priorité 1 — Action immédiate (< 24h)

#### 1. Rotation préventive des secrets locaux

Les secrets dans `.env.local` (racine + `apps/web/`) ET `.claude/settings.local.json` sont en clair sur ton disque. Si la machine a été synchronisée avec iCloud/Dropbox ou exposée, ils peuvent fuiter.

**Actions** :

```bash
# Supprime tous les worktrees Claude obsolètes (17 dirs contiennent des copies de secrets)
rm -rf /Users/benjaminbel/Desktop/KOVAS/.claude/worktrees/agent-*

# Vérifie qu'aucun secret n'est dans git history (devrait être 0 hits)
cd /Users/benjaminbel/Desktop/KOVAS
git log --all -p -S "sk-ant-api03" | head -5
git log --all -p -S "sb_secret_" | head -5
```

**À rotater dans Supabase Dashboard → Account → Access Tokens** :
- `sbp_REDACTED_VOIR_GESTIONNAIRE_SECRETS`
- `sbp_REDACTED_VOIR_GESTIONNAIRE_SECRETS`

**À rotater dans Supabase Dashboard → Project → API** :
- `service_role` key (et mettre à jour `SUPABASE_SERVICE_ROLE_KEY` dans Vercel env vars prod + `.env.local`)

**À rotater dans console fournisseur si exposé** :
- Anthropic API key (`sk-ant-api03-...`)
- OpenAI API key (`sk-proj-...`)

Mets ces secrets ensuite dans **1Password ou Bitwarden** (la machine + le cloud sync ne sont plus la source de vérité).

#### 2. Activer Leaked Password Protection Supabase

Dashboard Supabase → **Authentication → Security → Enable Leaked Password Protection**.

Vérifie que les seuils min password sont raisonnables (12 chars min recommandé).

#### 3. Activer 2FA sur tous les comptes admin

- **Supabase** : account.supabase.com → Settings → MFA → TOTP
- **Stripe** : dashboard.stripe.com → Profile → 2FA → SMS + Authenticator app
- **Vercel** : vercel.com/account/login-connections → Two-Factor Authentication
- **GitHub** : github.com/settings/security → Two-factor authentication
- **Resend** : resend.com/settings/security
- **PostHog** : app.posthog.com → User settings → Security

### Priorité 2 — Sous 48h

#### 4. Appliquer la migration SQL hardening

```bash
# Vérifier d'abord en local
cd /Users/benjaminbel/Desktop/KOVAS
npx supabase db reset --local  # ou test sur un projet staging séparé

# Si OK, appliquer en prod via Management API ou Studio SQL Editor
psql $DATABASE_URL -f supabase/migrations/20260527230000_security_hardening.sql
```

⚠️ **Tester d'abord sur un projet staging.** La section 3 (block invoice DELETE) modifie des policies existantes — vérifie qu'aucun code applicatif ne dépend de DELETE invoices.

Sanity check après application : observer les `RAISE NOTICE` :
- 0 fonction SECURITY DEFINER non pinée
- 0 grant anon sur data/analytics  
- 1 policy DELETE block sur invoices

#### 5. Vérifier `verify_jwt` per Edge Function

Edge Functions publiques (webhooks/upload externes) qui doivent rester `verify_jwt = false` :
- `stripe-webhook-payment`
- `inbound-email-process`
- `request-client-photo`
- `upload-client-photo`
- `verify-otp`
- `send-otp-sms`

Toutes les autres → `verify_jwt = true`.

À configurer dans **Dashboard Supabase → Edge Functions → [function] → Details → Settings**.

Ou en code via `supabase/config.toml` :
```toml
[functions.stripe-webhook-payment]
verify_jwt = false
```

#### 6. Configurer SPF + DKIM + DMARC Resend

Dashboard Resend → Domains → kovas.fr → Configure DNS records (SPF, DKIM, DMARC).

DMARC progressif :
1. Semaine 1 : `p=none` (monitoring only)
2. Semaine 2-4 : `p=quarantine`
3. Semaine 5+ : `p=reject`

### Priorité 3 — Sous 1 semaine

#### 7. Cookie consent banner (RGPD/CNIL)

**CRITIQUE conformité** : KOVAS active PostHog/Sentry sans consent banner. Risque sanction CNIL.

Options :
- **Klaro!** (open source, gratuit, granulaire) — recommandé
- **Custom React component** (4h dev, contrôle total)

Implémentation cible :
- Banner cookies au premier visite anonyme
- 3 catégories : essential (toujours) / analytics (PostHog) / functional (Sentry session replay)
- localStorage `kovas_consent_v1` = JSON `{analytics: true, functional: false}`
- PostHog `posthog.opt_in_capturing()` SEULEMENT si consent.analytics
- Sentry init seulement si consent.functional

#### 8. Vérifier `incidents` table colonnes exposées publiquement

Si la table contient `internal_notes`, `affected_org_ids` ou autres colonnes sensibles, ajouter une view filtrée OU restreindre la policy SELECT public à liste blanche colonnes.

```sql
-- Exemple : view publique limitée
CREATE OR REPLACE VIEW public_incidents AS
  SELECT id, title, severity, started_at, resolved_at, public_message
  FROM public.incidents
  WHERE status IN ('investigating', 'resolved');

-- Puis pointer le front sur public_incidents au lieu de incidents directement
```

#### 9. PITR Backups Supabase

Dashboard Supabase → **Database → Backups → Enable Point-in-Time Recovery**.

Nécessite tier **Pro** (25€/mo). Backup 7 jours minimum.

#### 10. WAF Cloudflare basique

Cloudflare → kovas.fr → **Security → WAF → Enable Bot Fight Mode** (gratuit).

Configurer aussi :
- Rate Limiting Rules : 10k req/min/IP global → challenge
- Page Rules : `https://kovas.fr/api/auth/*` → 5 req/min/IP

### Priorité 4 — Audit annuel

#### 11. Signer DPA (Data Processing Agreement) avec les providers

Tous les providers qui traitent de la PII doivent avoir un DPA signé.

À signer (si pas déjà fait) :
- **Stripe** : auto-signé via dashboard.stripe.com → Settings → Compliance
- **Resend** : dashboard.resend.com → DPA
- **Anthropic** : console.anthropic.com → Settings → Data Processing
- **OpenAI** : platform.openai.com → Settings → Data Controls
- **PostHog** : app.posthog.com → Settings → Data
- **Supabase** : auto via Pro tier
- **Vercel** : auto via Pro tier
- **Better Stack** : à vérifier

---

## 📊 Synthèse scores sécurité

| Couche | Score avant audit | Score après commit auto | Score cible (post-actions Benjamin) |
|---|---|---|---|
| Secrets + git hygiene | 6/10 | 8/10 | 9/10 |
| DB security (RLS + functions) | 8.5/10 | 8.5/10 | 9.5/10 |
| Transport (headers + middleware) | 6.5/10 | 8.5/10 | 9/10 |
| Application (validation + uploads) | 7/10 | 8.5/10 | 9/10 |
| RGPD compliance | 4/10 | 5/10 (PII scrubbed) | 8/10 (post cookie banner) |
| **Total** | **6.4/10** | **7.7/10** | **8.9/10** |

---

## 📁 Fichiers touchés

### Modifiés (19)

- `.gitignore`
- `apps/web/next.config.ts`
- `apps/web/sentry.client.config.ts`
- `apps/web/sentry.server.config.ts`
- `apps/web/src/app/(auth)/login/actions.ts`
- `apps/web/src/app/(auth)/signup/actions.ts`
- `apps/web/src/app/api/auth/callback/route.ts`
- `apps/web/src/app/api/client-photo-upload/route.ts`
- `apps/web/src/app/api/diagnosticians/[id]/claim/send-email-code/route.ts`
- `apps/web/src/app/api/diagnosticians/[id]/claim/send-sms-code/route.ts`
- `apps/web/src/app/api/diagnosticians/[id]/claim/upload-identity/route.ts`
- `apps/web/src/app/api/diagnosticians/[id]/claim/upload-manual/route.ts`
- `apps/web/src/app/api/diagnosticians/[id]/claim/verify-code/route.ts`
- `apps/web/src/app/api/diagnosticians/[id]/claim/verify-siret/route.ts`
- `apps/web/src/app/api/telegram/webhook/route.ts`
- `apps/web/src/app/api/upload-owner-document/route.ts`
- `apps/web/src/lib/analytics/posthog.ts`
- `apps/web/src/lib/rate-limit.ts`
- `apps/web/src/lib/supabase/middleware.ts`

### Créés (5)

- `apps/web/src/app/api/security/csp-report/route.ts`
- `apps/web/src/lib/security/safe-logger.ts`
- `apps/web/src/lib/security/safe-logger.test.ts`
- `apps/web/src/lib/security/scrub-pii.ts`
- `supabase/migrations/20260527230000_security_hardening.sql` (**NON appliquée prod**)

---

## 📚 Référence audit complet

Rapports détaillés disponibles dans les logs Claude :
- Agent A (Secrets + git) : score 8/10
- Agent B (DB + RLS) : score 8.5/10
- Agent C (Transport + middleware) : score 6.5/10 → 8.5/10
- Agent D (Application + RGPD) : score app 7/10, RGPD 4/10

---

**Audit déclenché 2026-05-27 par Benjamin. Tâche #304 SECURITY-AUDIT-1.**
