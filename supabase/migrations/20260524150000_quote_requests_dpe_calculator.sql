-- ============================================
-- KOVAS — Calculateur DPE gratuit : ajout status 'pending_routing'
-- Date : 2026-05-24
-- Mission : compléter le CHECK constraint `quote_requests_status_check` avec
--           la valeur `pending_routing` utilisée par la Server Action
--           `submitDpeLead` (apps/web/src/app/calculateur-dpe-gratuit/actions.ts)
--           pour les leads issus du calculateur DPE qui n'ont pas de
--           diagnostician_id source.
--
-- Contexte : la migration 20260604100000_anti_spam_and_ghost_lifecycle.sql
--            a étendu le CHECK à
--              ('pending_email_verification','pending','contacted',
--               'quoted','expired','won','lost','spam')
--            mais la valeur 'pending_routing' (lead orphelin en attente
--            d'affectation géographique) n'a jamais été ajoutée — l'insert
--            échouait silencieusement côté Supabase et renvoyait une erreur
--            500 au navigateur.
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quote_requests_status_check'
      AND conrelid = 'public.quote_requests'::regclass
  ) THEN
    ALTER TABLE public.quote_requests DROP CONSTRAINT quote_requests_status_check;
  END IF;
END $$;

ALTER TABLE public.quote_requests
  ADD CONSTRAINT quote_requests_status_check
  CHECK (
    status IN (
      'pending_email_verification',
      'pending_routing',
      'pending',
      'contacted',
      'quoted',
      'expired',
      'won',
      'lost',
      'spam'
    )
  );

COMMENT ON CONSTRAINT quote_requests_status_check ON public.quote_requests IS
  'Statuts autorisés pour le cycle de vie d''un lead. pending_routing = lead orphelin (calculateur DPE) en attente d''affectation géographique par dispatchRecipients.';

-- Bonus : index pour les leads en attente de routage (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_quote_requests_pending_routing
  ON public.quote_requests (created_at DESC)
  WHERE status = 'pending_routing';
