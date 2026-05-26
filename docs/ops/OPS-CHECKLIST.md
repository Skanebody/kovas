# Checklist actions ops — Mai 2026

Actions à exécuter par Benjamin côté prod (Supabase + Vercel) suite à
l'audit mode mission + fix annuaire. Chaque action est **idempotente** —
tu peux la rejouer sans risque.

> Ordre recommandé : 1 → 2 → 3 → 4. Action #1 et #4 sont indépendantes,
> #2 et #3 dépendent de la connexion Supabase prod.

---

## 1. Provisionner `MISSION_PAYLOAD_INVOKE_SECRET`

**Pourquoi** : sécurise l'invocation de l'Edge Function `process-mission-payload`
sans exposer la `SUPABASE_SERVICE_ROLE_KEY` dans le payload (cf. commit
`c1aebdd`, audit P0-1 mode mission).

### Génération du secret (32 chars aléatoires)

```bash
openssl rand -hex 32
# exemple sortie : 4f9c2e8b1a7d6f5e3c0b9a8d7e6f5c4b3a2918765432109876543210fedcba98
```

### A) Côté Vercel (variable d'env Next.js)

```bash
# Si Vercel CLI installé :
vercel env add MISSION_PAYLOAD_INVOKE_SECRET production
# (colle le secret généré, puis Enter)

# Sinon dashboard : https://vercel.com/<team>/<project>/settings/environment-variables
# → Add new : name=MISSION_PAYLOAD_INVOKE_SECRET, value=<secret>, env=Production
```

### B) Côté Supabase Vault (consommé par l'Edge Function)

```sql
-- Dans Supabase Studio → SQL Editor → New query :
SELECT vault.create_secret(
  '<colle-le-meme-secret-ici>',
  'MISSION_PAYLOAD_INVOKE_SECRET',
  'Secret partage pour invoquer process-mission-payload depuis Next.js'
);

-- Verification :
SELECT name, description, created_at
FROM vault.decrypted_secrets
WHERE name = 'MISSION_PAYLOAD_INVOKE_SECRET';
```

### C) Mettre à jour l'Edge Function `process-mission-payload`

Le code actuel de l'Edge Function vérifie peut-être encore le service_role
key. Il faut le changer pour lire `MISSION_PAYLOAD_INVOKE_SECRET`. Fichier
attendu : `supabase/functions/process-mission-payload/index.ts`.

Diff minimal au début du handler :

```ts
// AVANT (vulnérable) :
const auth = req.headers.get('authorization')
if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
  return new Response('forbidden', { status: 403 })
}

// APRÈS (sécurisé) :
const expectedSecret = Deno.env.get('MISSION_PAYLOAD_INVOKE_SECRET')
const auth = req.headers.get('authorization')
if (!expectedSecret || auth !== `Bearer ${expectedSecret}`) {
  return new Response('forbidden', { status: 403 })
}
```

Puis redéployer :

```bash
supabase functions deploy process-mission-payload --no-verify-jwt
```

---

## 2. Appliquer la migration `20260615100000_dossier_rooms_dedup.sql`

**Pourquoi** : ajoute le UNIQUE INDEX partial sur `dossier_rooms (dossier_id,
lower(name))` + RPC atomique `create_or_get_dossier_room` pour empêcher les
doublons de pièces lors des sync offline (cf. commit `07b6ea2`, audit P1-1
+ P1-2 mode mission).

### Vérification pré-migration (état actuel)

```sql
-- Y a-t-il déjà des doublons ?
SELECT
  dossier_id,
  lower(name) AS normalized_name,
  count(*) AS dup_count
FROM dossier_rooms
WHERE deleted_at IS NULL OR deleted_at IS NOT DISTINCT FROM NULL
GROUP BY dossier_id, lower(name)
HAVING count(*) > 1
ORDER BY dup_count DESC
LIMIT 20;

-- Si 0 ligne → pas de cleanup à faire. Si N lignes → la migration les fusionnera.
```

### Application de la migration

```bash
# Option A — CLI Supabase (recommandé) :
supabase db push

# Option B — Coller le contenu du fichier dans Studio → SQL Editor → Run :
cat supabase/migrations/20260615100000_dossier_rooms_dedup.sql
```

### Vérification post-migration

```sql
-- 1. La colonne deleted_at existe-t-elle ?
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'dossier_rooms' AND column_name = 'deleted_at';
-- attendu : 1 ligne (deleted_at, timestamp with time zone)

-- 2. L'index UNIQUE est-il créé ?
SELECT indexname, indexdef FROM pg_indexes
WHERE indexname = 'dossier_rooms_unique_name_per_dossier';
-- attendu : 1 ligne (CREATE UNIQUE INDEX ... ON dossier_rooms USING btree (dossier_id, lower(name)) WHERE deleted_at IS NULL)

-- 3. La RPC existe-t-elle ?
SELECT proname, prosrc FROM pg_proc
WHERE proname = 'create_or_get_dossier_room';
-- attendu : 1 ligne

-- 4. Test smoke (remplace les UUIDs par les tiens) :
SELECT * FROM create_or_get_dossier_room(
  p_dossier_id := '<dossier-uuid>'::uuid,
  p_org_id := '<org-uuid>'::uuid,
  p_name := 'Salon (test idempotence)',
  p_room_type := 'salon'
);
-- 2e exécution avec mêmes args doit retourner created=false et même UUID
```

---

## 3. Configurer + activer l'import DHUP officiel

**Pourquoi** : la table `diagnosticians` contient peut-être uniquement les
50 fixtures démo (sources `dhup_source_id LIKE 'fix_%'`). L'import DHUP
officiel n'a probablement jamais tourné en prod, ce qui explique le bug
"recherche par adresse ne trouve rien" rapporté par toi (cf. commit `d9f5e7d`).

### A) Trouver l'URL de la ressource DHUP

Va sur https://www.data.gouv.fr/fr/datasets/ → cherche "diagnostiqueurs"
ou "annuaire diagnostiqueurs immobiliers". Note l'URL CSV/JSON officielle
(format attendu : .csv ou .json).

URL canonique connue (à confirmer) :
`https://annuaire-diagnostiqueurs.din.developpement-durable.gouv.fr/exports/diagnostiqueurs.csv`

### B) Configurer les variables d'env de l'Edge Function

```sql
-- Dans Supabase Studio → SQL Editor :
SELECT vault.create_secret('<url-csv-ou-json-dhup>', 'DHUP_RESOURCE_URL');

-- Si pas déjà fait :
SELECT vault.create_secret('<32-chars-random-secret>', 'CRON_SECRET');
```

Génère le `CRON_SECRET` avec `openssl rand -hex 32`. Il sera utilisé en
header `Authorization: Bearer <CRON_SECRET>` pour invoquer manuellement
ou via cron.

### C) Trigger manuel de l'import (premier run)

```bash
# Récupère ta project ref depuis Supabase Studio → Settings → API
PROJECT_REF=jlizdkffwjdiokvmhcwg  # ta valeur
CRON_SECRET=<la-valeur-générée>

curl -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  "https://${PROJECT_REF}.supabase.co/functions/v1/import-dhup-annuaire"

# Réponse attendue : { ok: true, imported: 13000+, updated: N, skipped: M }
# Temps attendu : 30-90 secondes selon volume.
```

### D) Activer le cron mensuel (Supabase Postgres)

```sql
-- Vérifier que l'extension pg_cron est activée (Settings → Database → Extensions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule mensuel (1er du mois à 3h UTC) :
SELECT cron.schedule(
  'import-dhup-annuaire-monthly',
  '0 3 1 * *',
  $$
    SELECT net.http_post(
      url := 'https://jlizdkffwjdiokvmhcwg.supabase.co/functions/v1/import-dhup-annuaire',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Vérifier que le cron est bien planifié :
SELECT * FROM cron.job WHERE jobname = 'import-dhup-annuaire-monthly';
```

---

## 4. Diagnostic santé annuaire — 4 queries SQL

**Pourquoi** : confirmer (ou infirmer) l'hypothèse "table vide ou ne contient
que les fixtures démo" comme cause racine du bug "recherche par adresse ne
trouve rien" rapporté par toi.

À exécuter dans Supabase Studio → SQL Editor, dans cet ordre :

### Query 1 — Volume global

```sql
SELECT
  count(*) AS total,
  count(*) FILTER (WHERE is_published = true AND withdrawal_requested = false) AS publiques,
  count(*) FILTER (WHERE city_slug IS NOT NULL) AS avec_city_slug,
  count(*) FILTER (WHERE COALESCE(department_code, dept_code) IS NOT NULL) AS avec_dept,
  count(*) FILTER (WHERE latitude IS NOT NULL OR geo_lat IS NOT NULL) AS avec_geoloc,
  count(*) FILTER (WHERE jsonb_array_length(COALESCE(certifications, '[]'::jsonb)) >= 1) AS avec_certif,
  count(*) FILTER (WHERE dhup_source_id LIKE 'fix_%') AS fixtures_demo
FROM diagnosticians;
```

**Interprétation** :
- `total < 100` → table quasi vide, l'import DHUP n'a pas tourné. Lance action #3.
- `fixtures_demo > publiques * 0.5` → la majorité sont des fixtures démo, à purger.
- `avec_geoloc < publiques * 0.5` → géocodage incomplet, lance le cron `geocode-diagnosticians` si existe.

### Query 2 — Coverage géographique par département

```sql
SELECT
  COALESCE(department_code, dept_code) AS dept,
  count(*) AS total
FROM diagnosticians
WHERE is_published = true
  AND withdrawal_requested = false
  AND jsonb_array_length(COALESCE(certifications, '[]'::jsonb)) >= 1
GROUP BY 1
ORDER BY 1
LIMIT 100;
```

**Interprétation** : tu dois voir 95+ départements représentés. Si < 30
départements → l'import est incomplet ou filtré trop strict.

### Query 3 — Smoke test de la RPC search_diagnosticians

```sql
-- Sans filtre : combien la RPC retourne au max ?
SELECT count(*) FROM search_diagnosticians(
  p_query := NULL,
  p_dept_code := NULL,
  p_lat := NULL,
  p_lng := NULL,
  p_radius_km := NULL,
  p_limit := 100,
  p_offset := 0
);

-- Avec géoloc Paris (lat 48.8566, lng 2.3522), rayon 20 km :
SELECT count(*) FROM search_diagnosticians(
  p_query := NULL,
  p_dept_code := NULL,
  p_lat := 48.8566,
  p_lng := 2.3522,
  p_radius_km := 20,
  p_limit := 100,
  p_offset := 0
);
```

**Interprétation** : si la 2e query retourne 0 alors qu'il y a des diags
en région parisienne (Query 2 montre dept 75/92/93/94/77/78/91/95) →
problème géoloc / PostGIS. Si la 1ère retourne 0 → table vide / RLS.

### Query 4 — Statut import DHUP (a-t-il déjà tourné ?)

```sql
SELECT
  max(dhup_last_synced_at) AS dernier_sync,
  count(DISTINCT dhup_source_id) AS nb_sources_dhup_uniques,
  count(*) FILTER (WHERE dhup_source_id IS NOT NULL AND dhup_source_id NOT LIKE 'fix_%') AS nb_imports_dhup_reels
FROM diagnosticians;
```

**Interprétation** :
- `dernier_sync IS NULL` → l'import DHUP n'a JAMAIS tourné. Action #3 obligatoire.
- `dernier_sync < now() - interval '40 days'` → le cron a tourné une fois mais ne s'exécute plus. Vérifie le cron Postgres (Query : `SELECT * FROM cron.job WHERE jobname = 'import-dhup-annuaire-monthly'`).
- `nb_imports_dhup_reels < 1000` → import partiel, lance manuellement l'Edge Function.

---

## Validation finale

Après les 4 actions, refais un smoke test côté UX :

```bash
# 1. App locale doit démarrer sans erreur
cd apps/web && pnpm dev

# 2. Page d'annuaire B2C : taper "Paris 11" dans la barre,
#    sélectionner une suggestion → tu dois voir > 0 résultats.
# URL : http://localhost:3000/trouver-un-diagnostiqueur?q=Paris

# 3. Sitemap dynamique :
curl -s http://localhost:3000/sitemap-trouver-un-diagnostiqueur.xml | grep -c '<url>'
# attendu : > 1000 (et idéalement ~13k après import DHUP officiel)

# 4. Mode mission : créer un dossier test, démarrer une mission,
#    vérifier que les boutons Pause/Reprendre fonctionnent (commit c1aebdd).
```

---

## Rollback (si quelque chose casse)

Aucune des 4 actions n'est destructive. En cas de problème :

- **Action #1** : retirer la var Vercel + supprimer le secret Vault
  (`SELECT vault.delete_secret(<id>)`). L'Edge Function retombera sur
  l'ancien comportement (qui marche mais avec la faille SECRET_ROLE).

- **Action #2** : la migration est idempotente (`IF NOT EXISTS` partout).
  Pour rollback total :
  ```sql
  DROP FUNCTION IF EXISTS create_or_get_dossier_room;
  DROP INDEX IF EXISTS dossier_rooms_unique_name_per_dossier;
  ALTER TABLE dossier_rooms DROP COLUMN IF EXISTS deleted_at;
  ```

- **Action #3** : `SELECT cron.unschedule('import-dhup-annuaire-monthly')`.
  Les rows déjà importées restent en place (pas de DELETE).

- **Action #4** : queries en lecture seule, rien à rollback.
