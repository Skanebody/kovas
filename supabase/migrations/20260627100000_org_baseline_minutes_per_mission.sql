-- KOVAS — `organizations.baseline_minutes_per_mission`
--
-- Stocke le temps moyen (en minutes) qu'un diagnostiqueur passait sur une
-- mission DPE typique AVANT KOVAS (saisie Liciel post-mission, ressaisie
-- bureau, etc.). Utilisé par le widget Gain Tracker pour calculer le
-- temps économisé personnalisé : `minutes_saved = baseline × missions`.
--
-- Auparavant hardcodé à 90 min dans `gain-tracker-card.tsx` (CLAUDE.md §2
-- "1h30 par DPE typique"). Désormais configurable depuis les réglages
-- `/dashboard/account` pour que chaque diag puisse coller à sa réalité.
--
-- Valeur par défaut : 90 min (cohérent avec la promesse marketing).
-- Limites : 15 min (cap bas anti-bug) à 240 min (4h cap haut sain).
--
-- Pas de Stripe involvement. Pas d'incidence pricing. Pure préférence UX.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS baseline_minutes_per_mission INTEGER NOT NULL DEFAULT 90
    CHECK (baseline_minutes_per_mission BETWEEN 15 AND 240);

COMMENT ON COLUMN organizations.baseline_minutes_per_mission IS
  'Temps moyen (minutes) qu''un diagnostiqueur passait sur une mission AVANT KOVAS. Configurable depuis /dashboard/account. Default 90, range 15-240.';
