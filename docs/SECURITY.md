# Politique de sécurité — KOVAS App

Ce document décrit la posture sécurité de KOVAS App (SASU Nexus 1993), les
contrôles techniques en place, et la procédure à suivre en cas d'incident.

Authority : ce document complète `CLAUDE.md` section 10 (« Contraintes techniques
non négociables ») et la stratégie défensive
`.claude/orchestration-kovas-app/kovas-defense-strategy.md`.

Dernière mise à jour : 2026-05-22.

---

## 1. Reporting d'une vulnérabilité

Si vous découvrez une faille de sécurité dans KOVAS App :

- **Email dédié** : `security@kovas.fr`
- **Ne pas** ouvrir d'issue GitHub publique pour les vulnérabilités exploitables
- **Délai d'engagement** : accusé de réception sous 48 h, premier diagnostic
  sous 7 jours ouvrés, correctif déployé en moins de 30 jours pour les
  sévérités critiques ou élevées.

Une politique de divulgation responsable est appliquée. Nous valoriserons
publiquement les chercheurs ayant suivi la procédure (page Hall of Fame
sur `kovas.fr/security`).

---

## 2. Couche 1 — Headers HTTP appliqués

Configurés dans `apps/web/next.config.ts` via `async headers()`, appliqués à
toutes les routes (`source: '/:path*'`).

| Header | Valeur |
|---|---|
| `X-DNS-Prefetch-Control` | `on` |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-XSS-Protection` | `1; mode=block` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(self), microphone=(self), geolocation=(self), payment=(self)` |
| `Content-Security-Policy` | cf. ci-dessous |

### Content-Security-Policy détaillée

```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval'
           https://js.stripe.com https://*.vercel-insights.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob:
        https://*.supabase.co
        https://*.tile.openstreetmap.org
        https://unpkg.com;
connect-src 'self'
            https://*.supabase.co
            https://api.anthropic.com
            https://api.groq.com
            https://api.stripe.com
            https://api.brevo.com
            https://*.vercel-insights.com
            https://app.dvf.etalab.gouv.fr
            https://geo.api.gouv.fr
            https://data.ademe.fr;
frame-src 'self' https://js.stripe.com https://hooks.stripe.com;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests;
```

**Limitations connues** :
- `'unsafe-inline'` et `'unsafe-eval'` sur `script-src` sont tolérés à cause
  des inline scripts Next.js et React DevTools. Plan V2 : passer à un nonce
  CSP dynamique généré dans le middleware Next.
- `'unsafe-inline'` sur `style-src` reste nécessaire pour les styles dynamiques
  shadcn/ui (variants class-variance-authority).

---

## 3. Couche 2 — SAST Semgrep custom

Le fichier `.semgrep.yml` à la racine définit 7 règles métier KOVAS :

| Règle | Sévérité | Objet |
|---|---|---|
| `no-hardcoded-supabase-key` | ERROR | Interdit toute clé `eyJ...` en clair dans le code |
| `no-direct-sql-string` | ERROR | Bloque l'interpolation dans `supabase.rpc()` / `.from()` |
| `ensure-rls-enabled` | ERROR | Toute `CREATE TABLE` doit activer RLS dans le même fichier |
| `no-eval` | ERROR | Interdit `eval()`, `new Function()`, `window.eval()` |
| `no-dangerously-set-inner-html` | WARNING | Autorisé si sanitizé + justifié |
| `no-console-log-in-server-action` | WARNING | Fuite info via logs Vercel |
| `no-process-env-in-client` | ERROR | Empêche les secrets côté navigateur |

Exécution : automatique sur push/PR via `.github/workflows/security.yml`,
ou en local : `semgrep --config .semgrep.yml`.

Le workflow charge en plus les rulesets publics
`p/security-audit`, `p/owasp-top-ten`, `p/typescript`, `p/react`, `p/nextjs`.

---

## 4. Couche 3 — Rate limiting tiers

Implémentation : `apps/web/src/lib/rate-limit.ts` (Upstash Redis serverless,
algorithme sliding window).

| Tier | Limite | Cible | Cas d'usage |
|---|---|---|---|
| `public` | 10 req / 10 s | par IP | Formulaires de contact, signup, upload propriétaire |
| `authenticated` | 60 req / 1 m | par user | API CRUD missions/clients/biens, dashboard |
| `expensive` | 20 req / 1 h | par user | Whisper, Claude, génération PDF, exports ZIP |

Helper prêt à brancher dans une API route :

```ts
import { enforceRateLimit } from '@/lib/rate-limit-middleware'

export async function POST(request: NextRequest) {
  const limited = await enforceRateLimit(request, 'expensive', userId)
  if (limited) return limited
  // ... reste du handler
}
```

Variables d'environnement requises :
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

Comportement en l'absence de Redis : fail-open en dev avec warning console,
à durcir avant prod (assertion env au boot).

---

## 5. Couche 4 — RGPD compliance

### Politique résumée

KOVAS est responsable de traitement au sens du RGPD (art. 4) pour les données
collectées dans l'app (clients, biens, dossiers, photos, vocaux). Engagements :

- **Hébergement EU** : Supabase eu-west-3 (Paris) + Vercel EU
- **Consentement explicite** : opt-in coché pour CGU + politique de confidentialité
  à la création de compte, revalidation tous les 12 mois (cf.
  `assertPrivacyPolicyCurrent()`)
- **Droit à l'oubli** : endpoint server action de suppression complète du compte,
  cascade `ON DELETE CASCADE` sur toutes les FK
- **Portabilité** : export 1 clic JSON complet de l'organisation (Phase 1)
- **Audit trail** : toute lecture/export/suppression de données personnelles
  est tracée dans `audit_data_access` (admin-only, immutable par design)
- **DPA** : signable à la demande pour clients Cabinet (Phase 2)

### Helpers `apps/web/src/lib/compliance/rgpd-checker.ts`

- `validateConsent(formData, requiredConsents)` — vérifie que tous les
  consentements requis ont été cochés
- `logDataAccess({ userId, dataType, action, ip, ua, orgId })` — logge un
  accès dans `audit_data_access` (best-effort)
- `assertPrivacyPolicyCurrent()` — vérifie que la politique est toujours
  valide pour l'utilisateur authentifié (acceptée < 12 mois)

### Table d'audit

Migration : `supabase/migrations/20260522000000_audit_data_access.sql`.

Schéma :

| Colonne | Type | Description |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid → auth.users | Auteur de l'accès |
| `organization_id` | uuid → organizations | Org scope (nullable pour accès cross-org) |
| `data_type` | text | Catégorie — ex `client.email`, `dossier.address` |
| `action` | text | `read` \| `export` \| `delete` |
| `ip` | text | IP client (anonymisable selon politique CNIL) |
| `user_agent` | text | UA navigateur |
| `accessed_at` | timestamptz | Horodatage |

RLS : lecture admin/owner uniquement, insertion par l'utilisateur lui-même,
ni UPDATE ni DELETE (immutable).

---

## 6. Couche 5 — CI/CD security workflow

Fichier : `.github/workflows/security.yml`.

Trois jobs :

1. **`audit-deps`** — `pnpm audit --audit-level high` (fail si vulnérabilité high)
2. **`semgrep`** — Semgrep CI avec `.semgrep.yml` + rulesets publics
3. **`snyk`** — Snyk Open Source (continue-on-error si `SNYK_TOKEN` absent)

Triggers : push sur `main`, PR vers `main`, schedule daily à 04:00 UTC.

---

## 7. Procédure d'urgence — incident sécurité

### 7.1. Découverte

Sources possibles :
- alerte Sentry (erreur 500 massive, pattern d'exploit)
- email `security@kovas.fr`
- alerte Snyk / GitHub Dependabot
- comportement anormal d'un utilisateur (rate-limit en boucle)

### 7.2. Triage immédiat (< 15 min)

1. **Évaluer la sévérité** : Critique (RCE, exfiltration), Élevée (XSS, SSRF),
   Moyenne (CSRF, IDOR limité), Basse (info disclosure).
2. **Confiner** : si critique, désactiver l'endpoint impacté via flag PostHog
   ou rollback Vercel immédiat.
3. **Préserver les preuves** : snapshots Sentry, logs Vercel, requêtes PostHog
   archivés sous `/incidents/YYYY-MM-DD-<slug>/`.

### 7.3. Communication (< 24 h)

- Si données personnelles compromises : **notification CNIL obligatoire sous
  72 h** (cf. RGPD art. 33). Modèle de courrier : `/docs/incidents/cnil-template.md`.
- Notification utilisateurs impactés : email transactionnel Resend depuis
  `noreply@kovas.fr`, copie Benjamin.
- Status page custom (`/status`) mise à jour en temps réel.

### 7.4. Remédiation

1. Hotfix sur branche `hotfix/security-<slug>`
2. Code review + tests automatisés (Semgrep + Vitest + Playwright critique)
3. Déploiement Vercel preview puis prod
4. Post-mortem rédigé sous 7 jours, partagé en interne

### 7.5. Apprentissage

- Ajout d'une règle Semgrep custom si applicable
- Ajout d'un test e2e Playwright sur le scénario d'exploit
- Mise à jour de ce document

---

## 8. Contacts

| Rôle | Contact |
|---|---|
| Responsable sécurité | Benjamin Bel — `security@kovas.fr` |
| DPO (à désigner M9+) | TBD — `dpo@kovas.fr` |
| Hébergeur EU | Supabase (eu-west-3) + Vercel EU |
| Assurance Cyber | Hiscox RC Pro (souscription M5) — cf. CLAUDE.md §15 |
