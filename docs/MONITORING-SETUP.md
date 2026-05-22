# Monitoring & Observabilité — Setup

> Couche 7 d'industrialisation qualité KOVAS App.
> Stack : **Sentry** (errors + replay + profiling) + **PostHog** (analytics + replay business) + **Better Stack** (uptime) + endpoint `/api/health`.

---

## 1. Better Stack (Uptime + Heartbeats)

### 1.1. Création du compte

1. Inscription sur https://betterstack.com/uptime avec l'email `benjamin@kovas.fr` (Google Workspace).
2. Plan recommandé : **Freelancer (29 $/mois)** — 30 monitors, 3 régions, alertes SMS illimitées.
3. Création de l'équipe `KOVAS` puis ajout des escalades : Benjamin (SMS + email) en P1, advisor diagnostiqueur en P2 (M3+).

### 1.2. Endpoints à surveiller

| Endpoint | Fréquence | Régions | Trigger alerte |
|---|---|---|---|
| `https://kovas.fr/` | 60 s | EU-West (Frankfurt), US-East (Virginia), Asia (Singapore) | Down > 2 min |
| `https://kovas.fr/api/health` | 60 s | EU-West, US-East, Asia | HTTP ≠ 200 ou JSON `status: "degraded"` |
| `https://kovas.fr/login` | 60 s | EU-West | Down > 5 min |

Configuration recommandée par monitor :
- **Request method** : GET
- **Expected status code** : 200
- **Expected response body** (pour `/api/health` uniquement) : doit contenir `"status":"healthy"`
- **SSL certificate check** : activé, alerte 14 jours avant expiration
- **Domain expiration** : activé sur monitor racine `kovas.fr`

### 1.3. Politique d'alertes

| Sévérité | Trigger | Canal | Délai |
|---|---|---|---|
| **P1 (critique)** | Downtime > 2 min sur `/` ou `/api/health` | SMS + email + push app Better Stack | Immédiat |
| **P2 (dégradé)** | `/api/health` retourne 503 mais `/` répond | Slack `#alerts` + email | 5 min |
| **P3 (info)** | Latence p95 > 2 s pendant 10 min | Email seul | 15 min |
| **Rapport quotidien** | Synthèse uptime jour précédent | Email 8 h CET | Cron Better Stack |

### 1.4. Variables d'environnement

À ajouter dans Vercel + `.env.local` :

```bash
BETTER_STACK_UPTIME_TOKEN=BSU_xxx  # API token (Settings → API tokens)
```

Token utile uniquement si l'app récupère elle-même le statut Better Stack pour l'afficher in-app sur `/status`. Sinon, le monitoring fonctionne 100% côté Better Stack sans clé.

### 1.5. Récupération du `uptime_status_id`

Pour intégrer un widget statut dans le footer ou sur la page `/status` :

```bash
curl -X GET "https://uptime.betterstack.com/api/v2/monitors" \
  -H "Authorization: Bearer $BETTER_STACK_UPTIME_TOKEN"
```

La réponse liste chaque monitor avec son `id` (UUID) — à stocker côté config app pour interroger `GET /api/v2/monitors/:id/sla` et afficher le pourcentage SLA des 30 derniers jours.

---

## 2. Sentry (Errors + Performance + Replay)

Configuration : voir `apps/web/sentry.{client,server,edge}.config.ts`.

### 2.1. Variables d'environnement

```bash
NEXT_PUBLIC_SENTRY_DSN=https://xxx@oxxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntrys_xxx  # Pour upload des source maps en CI
SENTRY_ORG=nexus-1993
SENTRY_PROJECT=kovas-web
```

### 2.2. Sampling configuré

- Performance traces : **10%**
- Session replay normal : **5%**
- Session replay sur erreur : **100%**
- Profiling : **10%**

RGPD : `maskAllText` + `blockAllMedia` activés sur Replay — aucun contenu métier (adresses clients, photos, transcripts vocaux) ne quitte le navigateur.

### 2.3. beforeSend

Filtre `NODE_ENV !== 'production'` → aucune télémétrie envoyée depuis dev local ou staging.

---

## 3. PostHog (Analytics + Feature flags + Session replay business)

Configuration : voir `apps/web/src/lib/analytics/posthog.ts`.

### 3.1. Variables d'environnement

```bash
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
```

Hébergement **EU PostHog Cloud** (Frankfurt) → conformité RGPD.

### 3.2. Events business trackés (helpers exposés)

- `trackMissionStarted(diagnosticType)`
- `trackMissionSynced(missionId, durationMin)`
- `trackExportCompleted(missionId, targetFormat)`
- `trackSubscriptionStarted(plan, amountCents)`
- `trackTrialEnded(planCode, converted)`
- `trackPreExportAnalysis(missionId, score, criticalCount)`
- `trackDossierExported(dossierId, format)`
- `trackQuoteGenerated(quoteId)`
- `trackInvoiceCreated(invoiceId)`

---

## 4. Axiom (Logs centralisés) — TODO M3+

Skeleton présent dans `apps/web/instrumentation.ts`. À activer quand compte créé.

```bash
AXIOM_TOKEN=xaat-xxx
AXIOM_DATASET=kovas-production
```

Datasets recommandés :
- `kovas-production` : logs runtime prod (Next.js + Edge functions Supabase)
- `kovas-staging` : logs staging

---

## 5. Endpoint `/api/health`

Auto-check 5 services en parallèle (Supabase, Stripe, Anthropic, Groq, Brevo) avec timeout 3 s par check. Retourne 200 si all healthy, 503 sinon. Réponse cache-busted (`Cache-Control: no-store`).

Format JSON :

```json
{
  "status": "healthy",
  "timestamp": "2026-05-22T10:30:00.000Z",
  "checks": [
    { "service": "supabase", "status": "ok", "latency_ms": 42 },
    { "service": "stripe", "status": "ok", "latency_ms": 158 },
    { "service": "anthropic", "status": "ok", "latency_ms": 220 },
    { "service": "groq", "status": "skipped", "latency_ms": 0 },
    { "service": "brevo", "status": "ok", "latency_ms": 95 }
  ]
}
```

Status `skipped` : clé API absente (cas dev local) — pas considéré comme une erreur. En prod, toutes les clés doivent être présentes.

---

## 6. Récapitulatif — ordre d'activation

1. **M0** : Sentry compte créé + DSN dans Vercel ; PostHog EU compte créé ; déploiement de cette couche 7.
2. **M3** : Better Stack monitor `/`, `/api/health`, `/login` actifs ; Axiom compte créé.
3. **M5 (avant bêta)** : Tests d'incident — couper Stripe sandbox, vérifier que `/api/health` passe à 503 et que Better Stack alerte sous 2 min.
4. **M6+** : Page `/status` publique avec données Better Stack + banner in-app temps réel.
