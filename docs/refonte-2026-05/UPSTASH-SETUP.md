# Upstash Redis — Provisionnement production (rate limiting API publique v1)

> **Lot B51 — Refonte acqui-target 2026-05**
> Authority : ce document est le guide opérationnel pour Benjamin afin de provisionner Upstash Redis en production.
> Module consommateur : [`apps/web/src/lib/api-public/rate-limit.ts`](../../apps/web/src/lib/api-public/rate-limit.ts)
> Endpoints concernés : `/api/public/v1/*` (4 endpoints livrés Lots B18-B25).

---

## 1. Pourquoi Upstash ?

Le module `rate-limit.ts` implémente une **cascade résiliente** :

1. Si `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` sont définies → Upstash Redis sliding window (production-grade, distribué, persistent).
2. Si Upstash retourne une erreur réseau / 5xx → fallback in-memory automatique (try/catch, `console.warn` en monitoring).
3. Si env vars absentes → in-memory direct (Map JS local).

**Problème sans Upstash en prod** :

- Chaque lambda Vercel a son propre `Map` en mémoire.
- Un attaquant peut multiplier les requêtes en hammering plusieurs instances simultanément (chaque lambda froid démarre avec un compteur vierge).
- Le rate-limit reste actif mais **n'est PAS distribué** → la promesse "60 req/min anon, 600 req/min API key" n'est plus tenue.

**Solution Upstash** : compteur Redis partagé entre toutes les lambdas, persistance, latence < 10 ms depuis Vercel EU.

---

## 2. Provisionner le compte Upstash

### Étape 2.1 — Créer le compte

1. Aller sur https://upstash.com → **Sign Up** (GitHub OAuth recommandé).
2. **Free tier** suffit pour démarrer :
   - 10 000 commands/jour
   - 256 Mo storage
   - Latency multi-region
   - Pas de carte bancaire requise pour démarrer
3. Pour estimation : 1 requête API publique = 1 command Upstash (pipeline `INCR + EXPIRE` compté comme 2 commands en réalité, donc compter ~5000 req/jour gratuites en pratique).
4. Si dépassement attendu (> 5000 req/jour API publique), passer au plan **Pay as you go** : $0.20 / 100k commands (très bon marché).

### Étape 2.2 — Créer la base Redis

1. Dashboard Upstash → **Create Database**.
2. **Nom** : `kovas-rate-limit` (mnémotechnique pour Benjamin).
3. **Type** : `Regional` (suffit pour rate-limit, pas besoin de Global multi-region).
4. **Région** : **EU obligatoire pour RGPD** → choisir parmi :
   - `eu-west-1` (Ireland) — recommandé si Vercel = `iad1`/`cdg1` (latence ~25 ms depuis Paris)
   - `eu-central-1` (Frankfurt) — alternative équivalente
   - ⛔ NE PAS choisir `us-east-1` ou autre région hors UE (transferts de données IP utilisateurs FR → hors RGPD).
5. **TLS/SSL** : activé par défaut, laisser tel quel.
6. **Eviction policy** : laisser par défaut (`noeviction`), nos clés ont déjà un TTL (60s).
7. Cliquer **Create**.

### Étape 2.3 — Récupérer les credentials REST

Une fois la base créée :

1. Dans le dashboard de la base → onglet **REST API**.
2. Copier les 2 valeurs :
   - `UPSTASH_REDIS_REST_URL` (format `https://<random-name>-12345.upstash.io`)
   - `UPSTASH_REDIS_REST_TOKEN` (string base64, ~80-120 caractères)

⚠️  **NE JAMAIS commit ces secrets dans git.** Le token donne accès complet à la base.

---

## 3. Configurer les env vars

### Étape 3.1 — Local (dev)

Coller les 2 valeurs dans `.env.local` à la racine du repo :

```bash
# .env.local (PAS commité — cf. .gitignore)
UPSTASH_REDIS_REST_URL=https://kovas-rate-limit-12345.upstash.io
UPSTASH_REDIS_REST_TOKEN=AaBbCc...
```

Redémarrer le serveur Next.js (`pnpm dev`).

### Étape 3.2 — Vercel Production

1. Vercel Dashboard → projet `kovas-web` → **Settings** → **Environment Variables**.
2. Ajouter les 2 vars :
   - Name : `UPSTASH_REDIS_REST_URL` · Value : `https://kovas-rate-limit-12345.upstash.io` · Environment : ✅ Production ✅ Preview (laisser **Development** décoché si on veut isoler).
   - Name : `UPSTASH_REDIS_REST_TOKEN` · Value : `AaBbCc...` · Environment : ✅ Production ✅ Preview · ✅ **Sensitive** (masqué dans les logs).
3. Redéployer la branche `main` (ou attendre le prochain push) pour propagation.

### Étape 3.3 — Vercel Preview (optionnel mais recommandé)

Si on veut tester Upstash sur les déploiements preview (PR), cocher aussi **Preview** lors de l'ajout des vars.

Sinon, les previews tournent en in-memory (comportement actuel) — acceptable car les previews ne reçoivent pas de trafic public.

---

## 4. Tester localement

### Étape 4.1 — Vérifier que la cascade détecte Upstash

```bash
cd /Users/benjaminbel/Desktop/KOVAS/apps/web
pnpm dev
```

Dans un autre terminal :

```bash
curl -i http://localhost:3000/api/public/v1/openapi.json
```

Réponse attendue (headers) :

```
HTTP/1.1 200 OK
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1717255260
X-RateLimit-Source: upstash    ← ✅ Upstash actif
Content-Type: application/json
```

Si `X-RateLimit-Source: memory` apparaît malgré les env vars → vérifier :
- Les vars sont bien définies (`echo $UPSTASH_REDIS_REST_URL` dans le terminal qui lance `pnpm dev`)
- Le serveur Next.js a été redémarré après l'ajout des vars
- Pas d'erreur réseau (regarder `console.warn '[rate-limit] Upstash error, fallback memory'` dans les logs Next.js)

### Étape 4.2 — Vérifier que les clés apparaissent dans Upstash

1. Faire 3-4 requêtes `curl` consécutives.
2. Dashboard Upstash → onglet **Data Browser**.
3. Filtrer par `ratelimit:*` ou `openapi:*` (le préfixe dépend de la route appelée, voir [`apps/web/src/app/api/public/v1/*/route.ts`](../../apps/web/src/app/api/public/v1/)).
4. Vous devriez voir des clés du type `openapi:ip:127.0.0.1` avec valeur entière et TTL 60s.

### Étape 4.3 — Tester le déclenchement du 429

```bash
for i in $(seq 1 65); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/public/v1/openapi.json
done
```

Vous devriez voir 60 réponses `200` puis ~5 réponses `429` (Too Many Requests).

---

## 5. Vérifier en production

Après déploiement Vercel :

```bash
curl -i https://kovas.fr/api/public/v1/openapi.json
```

Header attendu : `X-RateLimit-Source: upstash`.

Si `memory` apparaît en prod → urgence : vérifier env vars Vercel + redeploy.

---

## 6. Monitoring & alertes

### Dashboard Upstash

- **Metrics** : commands/sec, latency, throughput.
- **Logs** : voir les commandes exécutées (utile pour debug).
- **Alertes email** : configurer une alerte à 80% du quota free tier (8000 commands/jour) pour anticiper l'upgrade.

### Sentry

Le `console.warn('[rate-limit] Upstash error, fallback memory:', err)` (ligne ~133 de `rate-limit.ts`) est capturé par Sentry si on a `Sentry.captureMessage` branché. Sinon, regarder les logs Vercel.

### Métrique à tracker (optionnel V2)

Compter le taux `X-RateLimit-Source: upstash` vs `memory` côté analytics. Si `memory` > 1% en prod → Upstash a un problème de disponibilité.

---

## 7. Procédure de rollback (Upstash down)

Si Upstash est en panne ou si on veut désactiver temporairement :

1. **Option A — Rollback complet** : Vercel Dashboard → Settings → Environment Variables → **Delete** les 2 vars `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN`. Redeploy.
   - Conséquence : retour fallback in-memory (acceptable temporairement, non distribué).
2. **Option B — Rollback automatique** : ne rien faire. La cascade try/catch ligne 119-135 du module rate-limit fait déjà le fallback automatique en cas d'erreur réseau Upstash. Aucune intervention nécessaire. Les requêtes continuent de fonctionner avec `X-RateLimit-Source: memory`.

**Recommandation** : Option B en premier réflexe (rien à faire, ça fallback tout seul). Option A uniquement si on veut couper Upstash pour économies budget.

---

## 8. Coûts estimés

| Trafic API publique | Commands/mois Upstash | Plan | Coût/mois |
|---|---|---|---|
| < 5000 req/jour (~150k/mois) | 300k | Free | **0 €** |
| 5k-50k req/jour (~1,5M/mois) | 3M | Pay-as-you-go | ~$6 |
| 50k-500k req/jour (~15M/mois) | 30M | Pay-as-you-go | ~$60 |
| > 500k req/jour | > 30M | Fixed plan | $99/mois (250M commands) |

**Cible bêta M6-M9** : < 1000 req/jour API publique externe → 100% Free tier OK.

---

## 9. FAQ

**Q : Pourquoi Upstash plutôt que Vercel KV ou Redis self-hosted ?**
R : Upstash REST API = pas de connexion persistante (compatible Vercel serverless). Vercel KV est un wrapper Upstash de toute façon. Redis self-hosted = inutile pour cette charge.

**Q : Faut-il une base par environnement (dev/staging/prod) ?**
R : Pour démarrer, **une seule base prod suffit**. Les préfixes de clés (`openapi:*`, `lookup:*`, etc.) sont distincts par endpoint et l'in-memory en local évite la pollution. Si volume bêta important, créer une base `kovas-rate-limit-staging` séparée.

**Q : Que se passe-t-il si le token Upstash fuite (commit accidentel) ?**
R : Dashboard Upstash → base → **REST API** → **Reset Token**. Régénérer la valeur, mettre à jour `.env.local` + Vercel. Pas d'incident data (juste un re-keying).

**Q : Apps/web a-t-il son propre `.env.example` ?**
R : Non, la source unique est [`.env.example`](../../.env.example) à la racine du monorepo. La section Upstash y est documentée (lignes 159-178 environ).

---

## 10. Checklist Benjamin (à cocher au moment du provisionnement)

- [ ] Compte Upstash créé (https://upstash.com)
- [ ] Base `kovas-rate-limit` créée en région EU (`eu-west-1` ou `eu-central-1`)
- [ ] Credentials REST récupérés (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
- [ ] Vars ajoutées à `.env.local` (dev)
- [ ] Test local : `curl /api/public/v1/openapi.json` retourne `X-RateLimit-Source: upstash`
- [ ] Test déclenchement 429 : 65 requêtes consécutives → ~5 retours 429
- [ ] Clés `*:ip:*` visibles dans Upstash Data Browser
- [ ] Vars ajoutées à Vercel Production env (et Preview si souhaité)
- [ ] Redeploy Vercel `main`
- [ ] Test prod : `curl https://kovas.fr/api/public/v1/openapi.json` retourne `X-RateLimit-Source: upstash`
- [ ] Alerte Upstash configurée à 80% quota free tier (optionnel)

---

**Dernière mise à jour** : 2026-05-25 (Lot B51).
**Référence module** : [`apps/web/src/lib/api-public/rate-limit.ts`](../../apps/web/src/lib/api-public/rate-limit.ts)
**Tests** : [`apps/web/src/lib/api-public/rate-limit.test.ts`](../../apps/web/src/lib/api-public/rate-limit.test.ts)
