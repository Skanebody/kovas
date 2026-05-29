-- ============================================================
-- KOVAS — Champs profil marketing diagnostiqueur (Ma fiche)
--
-- Ajoute les 4 colonnes "marketing" éditées dans la section
-- Profil de /dashboard/annuaire/ma-fiche mais jusqu'ici NON
-- persistées (display_name / title / slogan / languages).
-- Avant ce patch, ces champs étaient validés (Zod) + affichaient
-- un toast de succès, mais la saisie était perdue silencieusement.
--
-- Table cible : diagnostician_public_profile
--   (table marketing publique, propriété du diagnostiqueur via
--    diagnosticians.claimed_by_user_id — cf. migration
--    20260524290000_diagnostician_public_profile.sql).
-- Les colonnes réglementaires (certifications, Sirene…) restent
-- gérées par les pipelines de validation, pas ici.
--
-- Idempotent : ADD COLUMN IF NOT EXISTS uniquement.
-- ⚠️ NON APPLIQUÉE — à appliquer manuellement (Benjamin).
-- ============================================================

ALTER TABLE public.diagnostician_public_profile
  -- Nom commercial public affiché sur la fiche (override du full_name DHUP).
  ADD COLUMN IF NOT EXISTS display_name text,
  -- Titre / accroche métier (ex. "Diagnostiqueur certifié DPE & Amiante").
  ADD COLUMN IF NOT EXISTS title text,
  -- Slogan court (max 80c, contrainte côté Zod ; garde-fou DB ci-dessous).
  ADD COLUMN IF NOT EXISTS slogan text,
  -- Langues parlées (ISO 639-1) — liste blanche FR/EN/ES/DE côté app.
  ADD COLUMN IF NOT EXISTS languages text[] NOT NULL DEFAULT '{}'::text[];

-- Garde-fous longueur alignés sur le schéma Zod (profileFormSchema).
-- DROP avant ADD pour rester idempotent (ré-exécutable sans erreur).
ALTER TABLE public.diagnostician_public_profile
  DROP CONSTRAINT IF EXISTS dpp_display_name_length;
ALTER TABLE public.diagnostician_public_profile
  ADD CONSTRAINT dpp_display_name_length
  CHECK (char_length(coalesce(display_name, '')) <= 80);

ALTER TABLE public.diagnostician_public_profile
  DROP CONSTRAINT IF EXISTS dpp_title_length;
ALTER TABLE public.diagnostician_public_profile
  ADD CONSTRAINT dpp_title_length
  CHECK (char_length(coalesce(title, '')) <= 120);

ALTER TABLE public.diagnostician_public_profile
  DROP CONSTRAINT IF EXISTS dpp_slogan_length;
ALTER TABLE public.diagnostician_public_profile
  ADD CONSTRAINT dpp_slogan_length
  CHECK (char_length(coalesce(slogan, '')) <= 80);

COMMENT ON COLUMN public.diagnostician_public_profile.display_name IS
  'Nom commercial public éditable (override du full_name DHUP).';
COMMENT ON COLUMN public.diagnostician_public_profile.title IS
  'Titre / accroche métier affiché sur la fiche publique.';
COMMENT ON COLUMN public.diagnostician_public_profile.slogan IS
  'Slogan court (<= 80 caractères).';
COMMENT ON COLUMN public.diagnostician_public_profile.languages IS
  'Langues parlées (ISO 639-1) — liste blanche FR/EN/ES/DE.';
