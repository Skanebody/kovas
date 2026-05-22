# RUNBOOK.md — Procédures opérationnelles KOVAS

> Document de référence pour les opérations courantes en production.
> Toutes les procédures sont testées en staging avant ajout ici.

## Table des matières

1. [Déploiement production](#1-déploiement-production)
2. [Rollback production](#2-rollback-production)
3. [Ajouter un nouveau diagnostiqueur (compte démo)](#3-ajouter-un-nouveau-diagnostiqueur-compte-démo)
4. [Activer un module add-on manuellement](#4-activer-un-module-add-on-manuellement)
5. [Générer un export DPE de test](#5-générer-un-export-dpe-de-test)
6. [Vérifier la santé production](#6-vérifier-la-santé-production)
7. [Lire les logs Sentry / Axiom](#7-lire-les-logs-sentry--axiom)
8. [Ré-exécuter une Edge Function manuellement](#8-ré-exécuter-une-edge-function-manuellement)
9. [Résoudre les pannes courantes](#9-résoudre-les-pannes-courantes)

---

## 1. Déploiement production

### Procédure standard (automatique via main)

Tout push sur `main` déclenche un déploiement Vercel automatique.

```bash
# 1. Mettre à jour main
git checkout main
git pull

# 2. Vérifier la CI verte sur le dernier commit
gh run list --branch main --limit 1

# 3. Suivre le déploiement
vercel deployments list --prod | head -3
```

### Déploiement manuel (en cas de bypass CI)

```bash
# Uniquement en cas d'urgence + override branch protection
vercel deploy --prod --scope kovas
```

### Pré-déploiement checklist

- [ ] Tous les checks CI verts
- [ ] Pas de migration Supabase non appliquée
- [ ] Variables d'env Vercel à jour (cf. `.env.example`)
- [ ] Status page propre (pas d'incident en cours)
- [ ] Sentry : pas de spike récent

### Post-déploiement vérification

```bash
# Smoke test
curl -I https://kovas.fr/api/health
# Expected: HTTP/2 200, {"status":"ok"}

# Build version
curl -s https://kovas.fr/api/health | jq .git_sha
# Expected: commit SHA matching git log -1
```

---

## 2. Rollback production

### Via Vercel UI (recommandé — 3 min)

1. https://vercel.com/kovas/kovas-app/deployments
2. Identifier le dernier déploiement stable (vert)
3. Cliquer "..." → "Promote to Production"
4. Confirmer

### Via CLI

```bash
# Lister les déploiements
vercel deployments list --prod

# Promouvoir un ancien
vercel promote https://kovas-app-<hash>.vercel.app --scope kovas
```

### Rollback d'une migration Supabase

```bash
# 1. Identifier la migration à rollback
ls -lt supabase/migrations/ | head -5

# 2. Écrire la migration inverse (NEVER use `supabase db reset` en prod)
# Créer supabase/migrations/<timestamp>_revert_<name>.sql

# 3. Appliquer
SUPABASE_DB_URL=$SUPABASE_DB_URL_PROD psql -f supabase/migrations/<timestamp>_revert_<name>.sql

# 4. Vérifier le schéma
psql "$SUPABASE_DB_URL_PROD" -c "\dt"
```

⚠️ **Ne JAMAIS** supprimer un fichier migration déjà appliqué. Toujours créer une migration inverse.

---

## 3. Ajouter un nouveau diagnostiqueur (compte démo)

Cas d'usage : démo client, advisor, bêta-testeur, support.

### Méthode A — Via signup standard (recommandé)

1. L'utilisateur s'inscrit sur https://kovas.fr/signup avec son email pro
2. Bénéficier de l'essai 14j par défaut
3. Pour upgrader manuellement → cf. §4

### Méthode B — Création manuelle (pour démos)

```bash
# Via Supabase Dashboard → Auth → Users → "Invite user"
# Email : demo@kovas.fr ou xxx@example.com

# Puis assigner addons via SQL :
psql "$SUPABASE_DB_URL_PROD" <<'SQL'
-- 1. Créer l'org si signup auto n'a pas marché
INSERT INTO organizations (name, owner_id)
SELECT 'Démo Diagnostiqueur', id FROM auth.users WHERE email = 'demo@kovas.fr';

-- 2. Bind profile à l'org
UPDATE profiles
SET default_org_id = (SELECT id FROM organizations WHERE name = 'Démo Diagnostiqueur')
WHERE email = 'demo@kovas.fr';

-- 3. Créer subscription "demo"
INSERT INTO subscriptions (organization_id, plan, status, current_period_end)
VALUES (
  (SELECT id FROM organizations WHERE name = 'Démo Diagnostiqueur'),
  'cabinet_demo',
  'active',
  now() + interval '1 year'
);
SQL
```

### Demo data seed

```bash
# Charger 5 clients + 10 dossiers + 20 missions
psql "$SUPABASE_DB_URL_PROD" -f supabase/seed.sql
```

---

## 4. Activer un module add-on manuellement

Cas d'usage : geste commercial, advisor, bêta-test feature.

```sql
-- Activer un addon (ex: signature_yousign) pour une org
INSERT INTO subscription_addons (subscription_id, addon_code, granted_at, granted_by, note)
SELECT
  s.id,
  'signature_yousign',
  now(),
  auth.uid(),
  'Geste commercial — incident YYYY-MM-DD'
FROM subscriptions s
JOIN organizations o ON o.id = s.organization_id
WHERE o.name = 'Nom Cabinet';
```

### Liste des add-ons disponibles

| Code | Description | Tier requis |
|---|---|---|
| `signature_yousign` | Signature eIDAS Yousign 2€/sig | Tous |
| `bilingue_report` | Rapport FR/EN 5€/rapport | Standard+ |
| `sms_reminder` | SMS rappel J-1 0,15€/SMS | Tous |
| `facturx` | Factur-X auto | Cabinet |
| `multi_users` | 3 users Cabinet | Cabinet |

---

## 5. Générer un export DPE de test

Cas d'usage : valider un changement export, debug client.

```bash
# 1. Identifier un dossier complet en staging
psql "$SUPABASE_DB_URL_STAGING" -c \
  "SELECT id, reference, type FROM dossiers WHERE status = 'completed' LIMIT 3;"

# 2. Appeler l'API d'export
DOSSIER_ID="<uuid>"
curl -X POST "https://staging.kovas.fr/api/export/dossier/$DOSSIER_ID" \
  -H "Authorization: Bearer $SUPABASE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"format":"liciel_zip"}' \
  -o /tmp/dossier-export.zip

# 3. Inspecter
unzip -l /tmp/dossier-export.zip
```

### Formats disponibles

| Format | Cas d'usage |
|---|---|
| `liciel_zip` | Import Liciel (compagnon Phase 1) |
| `pdf` | Rapport client |
| `docx` | Rapport éditable |
| `csv` | Import tableur |
| `json` | Backup / API tier |

---

## 6. Vérifier la santé production

### Endpoint `/api/health`

```bash
curl -s https://kovas.fr/api/health | jq
```

Réponse attendue :

```json
{
  "status": "ok",
  "version": "<git_sha>",
  "checks": {
    "supabase": "ok",
    "anthropic": "ok",
    "openai": "ok",
    "stripe": "ok"
  },
  "timestamp": "2026-05-22T10:00:00Z"
}
```

### Health checks manuels

| Service | Commande |
|---|---|
| Vercel deployment | `vercel deployments list --prod \| head -3` |
| Supabase API | `curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" -H "apikey: $ANON"` |
| Anthropic API | `curl -s https://api.anthropic.com/v1/models -H "x-api-key: $KEY"` |
| Stripe webhooks | Dashboard Stripe → Developers → Webhooks → Recent events |
| Resend deliverability | Dashboard Resend → Logs → derniers 24h |

### Dashboards admin

- **Quality dashboard** : https://kovas.fr/app/dashboard/admin/quality (admin only)
- **Vercel Analytics** : https://vercel.com/kovas/kovas-app/analytics
- **PostHog** : https://eu.posthog.com/project/<id>
- **Sentry** : https://sentry.io/organizations/kovas/issues/

---

## 7. Lire les logs Sentry / Axiom

### Sentry — Erreurs JS/server

```bash
# CLI Sentry
sentry-cli issues list --project kovas-web --statsPeriod 24h

# Ou via dashboard UI : filter `is:unresolved`
```

### Vercel logs — Edge Functions et API routes

```bash
# Dernières 100 lignes
vercel logs <deployment-url> --limit 100

# Live tail
vercel logs <deployment-url> --follow

# Filtrer par function
vercel logs <deployment-url> --grep "/api/voice"
```

### Supabase logs

```bash
# Via dashboard : https://supabase.com/dashboard/project/<id>/logs
# Filter : `severity:error`
# Ou via API :
curl -s "https://<id>.supabase.co/rest/v1/log_events" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY"
```

### Axiom (V2)

Non actif en V1. Roadmap V2 pour centralisation logs structurés.

---

## 8. Ré-exécuter une Edge Function manuellement

```bash
# Lister les functions
npx supabase functions list

# Invoquer manuellement (avec payload)
npx supabase functions invoke <function-name> \
  --body '{"key":"value"}'

# Re-déployer
npx supabase functions deploy <function-name> --no-verify-jwt
```

### Edge Functions actives

| Function | Trigger | Cas d'usage |
|---|---|---|
| `voice-transcribe` | HTTP | Transcription Whisper + parser custom |
| `voice-structurer` | HTTP | Structuration vocale Claude Haiku |
| `dossier-export` | HTTP | Export ZIP Liciel + PDF + DOCX |
| `fair-use-monthly-check` | Cron (1er du mois) | Email upgrade si soft cap dépassé 3 mois |
| `gain-tracker-monthly-report` | Cron (1er du mois 8h) | Rapport mensuel email |
| `trial-protection-check` | Cron (quotidien) | Anti-abus essai gratuit |

---

## 9. Résoudre les pannes courantes

### Panne A — Stripe webhook fail

**Symptôme** : Subscriptions non créées après paiement, événements Stripe en queue.

**Diagnostic** :

1. Dashboard Stripe → Developers → Webhooks → endpoint `/api/stripe/webhook`
2. Voir le tab "Failed events"
3. Lire la response error

**Fix** :

```bash
# 1. Replay events échoués depuis Stripe Dashboard
# Bouton "Resend" sur chaque event

# 2. Si signature webhook expirée :
# Régénérer le webhook secret → mettre à jour Vercel env STRIPE_WEBHOOK_SECRET
# Redéployer

# 3. Si bug logique → branche hotfix
```

### Panne B — Brevo SMS down

**Symptôme** : SMS rappel J-1 non envoyés.

**Fix temporaire** :

```bash
# 1. Désactiver le feature flag SMS via PostHog
# 2. Notifier les users impactés par email (Resend) à la place
# 3. Attendre rétablissement Brevo
# 4. Une fois UP, replay les SMS depuis la queue Supabase `sms_queue`
```

### Panne C — Supabase Auth indisponible

**Symptôme** : Login impossible, signup impossible.

**Fix** :

```bash
# 1. Vérifier status Supabase
curl -s https://status.supabase.com/api/v2/status.json | jq

# 2. Si incident éditeur → afficher banner status page + attendre
# 3. Si incident KOVAS spécifique → vérifier les RLS récemment modifiées :
psql "$SUPABASE_DB_URL_PROD" -c "\d+ auth.users"

# 4. Last resort : recréer le projet Supabase (très grave, perte données possible)
```

### Panne D — Anthropic API rate-limit / outage

**Symptôme** : `voice-structurer` retourne 429 / 500.

**Fix** :

```bash
# 1. Activer le fallback parser custom JS (déjà en place pour 80% des cas)
# 2. Si Claude indispo > 30 min → bascule complète parser :
#    Feature flag PostHog `voice_use_claude` = false
# 3. Communiquer aux users : "Mode rapide indisponible temporairement, traitement basique"
```

### Panne E — Vercel build fail répété

**Symptôme** : Tous les déploiements `main` échouent.

**Fix** :

```bash
# 1. Reproduire localement
git checkout main
corepack pnpm install
corepack pnpm --filter @kovas/web build

# 2. Si succès local mais fail Vercel → différence env vars
# Vérifier Vercel → Settings → Environment Variables

# 3. Si fail local → rollback dernier commit fautif
git revert <commit-sha>
git push
```

### Panne F — Realtime Supabase déconnecté

**Symptôme** : Sync mobile/web temps réel KO, indicateur sync rouge.

**Fix** :

```bash
# 1. Vérifier dashboard Supabase → Realtime → connexions actives
# 2. Si > 200 conn → upgrade plan Realtime
# 3. Reset connexions stales :
psql "$SUPABASE_DB_URL_PROD" -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name = 'realtime' AND state = 'idle' AND state_change < now() - interval '1h';"
```

### Panne G — Whisper transcription échoue

**Symptôme** : `voice-transcribe` retourne erreur, users ne peuvent plus saisir vocalement.

**Fix** :

```bash
# 1. Vérifier balance OpenAI : https://platform.openai.com/usage
# 2. Si quota dépassé → augmenter le hard limit
# 3. Si API down → bascule fallback Deepgram :
#    Feature flag PostHog `voice_provider` = 'deepgram'
# 4. Communiquer "Mode dégradé voix" via banner in-app
```
