# Supabase — Fixes manuels (console Studio)

> **Date** : 2026-05-22
> **Migration SQL associée** : [`supabase/migrations/20260522200000_supabase_advisor_fixes.sql`](../supabase/migrations/20260522200000_supabase_advisor_fixes.sql)
> **Projet** : `jlizdkffwjdiokvmhcwg` (KOVAS prod, EU-West-3 Paris)

Cette doc liste les corrections remontées par l'Advisor Supabase qui **ne peuvent pas être faites en SQL** (settings runtime, extensions à déplacer prudemment). La migration SQL prend en charge tout le reste (RLS, search_path, FK indexes, REVOKE EXECUTE, security_invoker view).

---

## 1. Auth — Leaked Password Protection (obligatoire)

**Sévérité** : sécurité (auth).
**Action** : activer la vérification des mots de passe contre la base haveibeenpwned.

### Étapes

1. Ouvrir [Supabase Studio → Authentication → Policies](https://supabase.com/dashboard/project/jlizdkffwjdiokvmhcwg/auth/policies).
2. Onglet **Settings → Security** (ou directement [Auth Settings](https://supabase.com/dashboard/project/jlizdkffwjdiokvmhcwg/settings/auth)).
3. Section **Password Strength** → activer **Leaked Password Protection** (toggle).
4. Confirmer.

### Effet

- À chaque signup / reset password, le hash SHA-1 du mot de passe est vérifié contre la liste haveibeenpwned (k-anonymity, aucun mot de passe transmis en clair).
- Si compromis : rejet avec message d'erreur localisé `auth_pwned_password`.

### Risque

- Aucun. Hors-bande, opt-in, n'impacte pas les comptes existants tant qu'ils ne changent pas leur mot de passe.

---

## 2. Extensions — déplacer hors du schéma `public` (à valider avant action)

**Sévérité** : warning Advisor (low priority).
**Action** : déplacer `postgis`, `pg_trgm`, `vector`, `uuid-ossp`, `pgcrypto` vers le schéma dédié `extensions`.

### ⚠️ Important — risque casse applicative

Le code KOVAS référence directement plusieurs fonctions de ces extensions :
- `uuid_generate_v4()` (uuid-ossp) → utilisé dans toutes les migrations `CREATE TABLE`
- `gen_random_uuid()` (pgcrypto) → utilisé dans plusieurs migrations
- Fonctions PostGIS `ST_*` → utilisées dans recherche géographique
- `pg_trgm` → opérateurs `%` dans les index GIN sur clients/properties
- `vector` → embeddings RAG (regulatory_documents, community_cases)

**Avant de déplacer**, il faut soit :
- A) S'assurer que `search_path` inclut bien `extensions` partout (dans postgres role par défaut, c'est déjà le cas chez Supabase).
- B) Ou préfixer explicitement tous les appels dans les nouvelles migrations (`extensions.uuid_generate_v4()`).

### Recommandation

**Reporter** ce fix tant que la production tourne sans incident. Le bénéfice (clean separation of concerns) est marginal vs le risque (potentielle régression silencieuse sur les Edge Functions / RPC qui n'ont pas `extensions` dans leur search_path).

À traiter dans une migration séparée et testée sur staging d'abord.

### Si quand même validé

1. Ouvrir [Studio → Database → Extensions](https://supabase.com/dashboard/project/jlizdkffwjdiokvmhcwg/database/extensions).
2. Pour chaque extension, cliquer **⋯ → Move to schema** → `extensions`.
3. Tester immédiatement :
   - Signup d'un nouvel utilisateur (déclenche `uuid_generate_v4`).
   - Création d'un client (search trigram).
   - Recherche géo BAN (PostGIS).
4. Si KO : ré-installer dans `public` via `CREATE EXTENSION ... WITH SCHEMA public`.

---

## 3. Replication — vérifier publication Realtime sur partitions

**Sévérité** : informatif.
**Action** : confirmer que les partitions `photos_2026_*` et `events_2026_*` sont bien publiées via `supabase_realtime`.

### Étapes

1. Ouvrir [Studio → Database → Replication](https://supabase.com/dashboard/project/jlizdkffwjdiokvmhcwg/database/replication).
2. Sélectionner `supabase_realtime` publication.
3. Vérifier que les tables `missions`, `photos`, `voice_notes`, `equipment_findings`, `mission_rooms` sont actives (cf. note dans `20260518000000_init_schema.sql` §27).
4. Les partitions enfants suivent automatiquement la publication parente (PG 13+).

### Si manquant

Exécuter en SQL Editor :

```sql
ALTER PUBLICATION supabase_realtime
  ADD TABLE missions, photos, voice_notes, equipment_findings, mission_rooms;
```

---

## 4. Vérification post-migration

Après application de `20260522200000_supabase_advisor_fixes.sql`, exécuter dans SQL Editor pour vérifier l'absence de tables `public` sans RLS :

```sql
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname NOT IN ('spatial_ref_sys')        -- table système PostGIS
  AND c.relrowsecurity = false
ORDER BY c.relname;
```

Résultat attendu : **0 lignes** (hors `spatial_ref_sys` exclu).

Vérification des FK sans index :

```sql
SELECT
  c.relname AS table_name,
  a.attname AS column_name,
  con.conname AS constraint_name
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
WHERE con.contype = 'f'
  AND cardinality(con.conkey) = 1
  AND n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relispartition
  AND NOT EXISTS (
    SELECT 1 FROM pg_index idx
    JOIN pg_attribute ia ON ia.attrelid = idx.indrelid AND ia.attnum = idx.indkey[0]
    WHERE idx.indrelid = c.oid
      AND ia.attname = a.attname
      AND idx.indpred IS NULL
  )
ORDER BY c.relname, a.attname;
```

Résultat attendu : **0 lignes** (toutes les FK simple-colonne sont indexées).

---

## 5. Rouvrir l'Advisor

[Studio → Advisors → Security](https://supabase.com/dashboard/project/jlizdkffwjdiokvmhcwg/advisors/security) — refresh.

Tout doit être vert sauf :
- `spatial_ref_sys` : faux positif PostGIS, ignoré intentionnellement (table système non modifiable).
- Extensions in public : warning low, reporté (voir §2).
- Leaked Password Protection : à activer manuellement (voir §1).

---

## 6. Roll-back (si besoin)

La migration est **non destructive** : pas de DROP TABLE, pas de DELETE.

Pour annuler les fixes (déconseillé) :

```sql
-- Désactiver RLS sur partitions
ALTER TABLE public.photos_2026_05 DISABLE ROW LEVEL SECURITY;
-- (...etc pour chaque partition)

-- Re-DEFINER la view
DROP VIEW public.monthly_mission_counts;
CREATE OR REPLACE VIEW public.monthly_mission_counts AS
SELECT organization_id, date_trunc('month', created_at)::date AS month,
       COUNT(*)::int AS missions_count
FROM missions WHERE deleted_at IS NULL
GROUP BY organization_id, date_trunc('month', created_at);

-- Retirer search_path pin
ALTER FUNCTION public.update_updated_at() RESET search_path;
-- (...etc)
```

Les index FK peuvent rester (ils n'ont aucun impact négatif, seulement un petit coût d'écriture).
