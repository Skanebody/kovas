-- ============================================
-- KOVAS App — Seed dev (à exécuter UNIQUEMENT en local/staging, JAMAIS en prod)
-- ============================================
-- Usage : pnpm exec supabase db reset (applique migrations + seed)
-- ============================================

-- Note : seed minimal. Les users de test sont créés via signup standard,
-- ce qui déclenche le trigger handle_new_user() pour auto-créer org + membership.

-- Pour seed manuel d'un user de test, utiliser l'admin API Supabase
-- ou créer via signup UI puis ajouter des données via authenticated client.

-- Example seed (commented — désactiver en prod) :

-- INSERT INTO clients (organization_id, type, display_name, email, phone, city, postal_code)
-- SELECT
--   o.id,
--   'particulier'::client_type,
--   'Dupont, Marie',
--   'marie.dupont@example.com',
--   '+33612345678',
--   'Paris',
--   '75008'
-- FROM organizations o
-- LIMIT 1;
