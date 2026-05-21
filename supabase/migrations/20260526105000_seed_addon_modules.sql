-- ============================================
-- KOVAS — Seed des 9 modules add-on
-- Date : 2026-05-26
-- Cf. CLAUDE.md §4
--
-- Stripe IDs (stripe_product_id, stripe_price_id) laissés en NULL — voir le
-- commentaire en tête de 20260526104000_seed_subscription_plans.sql.
--
-- Le champ included_in_plans est la source de vérité pour savoir si un
-- abonné a déjà accès au module via son forfait (pas besoin de l'acheter
-- séparément).
-- ============================================

INSERT INTO public.addon_modules (
  module_code, display_name, description, category,
  price_monthly_cents, trial_duration_days, included_in_plans,
  is_active, sort_order
) VALUES
  (
    'cockpit_ademe_mode1',
    'Cockpit ADEME — Monitoring rétroactif',
    'Surveille en continu vos DPE publiés à l''ADEME, signale les écarts et anomalies après publication.',
    'ademe',
    900, 14,
    '["decouverte","pro","all_inclusive","cabinet"]'::jsonb,
    true, 10
  ),
  (
    'cockpit_ademe_mode2',
    'Cockpit ADEME — Pré-validation pré-publication',
    'Contrôle vos DPE AVANT publication ADEME : détection des incohérences et risques d''erreur.',
    'ademe',
    900, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 20
  ),
  (
    'shield_defense',
    'Bouclier de défense IA',
    'Préparation automatique de votre défense en cas de contestation client ou litige assurantiel.',
    'ia',
    900, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 30
  ),
  (
    'parameter_suggestions',
    'Standardisation IA des paramètres',
    'Suggère automatiquement les paramètres standards (équipements, matériaux) à partir de vos saisies.',
    'ia',
    700, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 40
  ),
  (
    'regulatory_chat',
    'Chatbot IA méthodologique',
    'Assistant conversationnel sur la réglementation française du diagnostic immobilier (sources sourcées).',
    'ia',
    900, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 50
  ),
  (
    'community_referentiel',
    'Référentiel partagé communauté',
    'Accès au référentiel collaboratif de cas anonymisés et aux votes communauté entre diagnostiqueurs.',
    'community',
    500, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 60
  ),
  (
    'analytics_benchmark',
    'Analytics + benchmark anonyme',
    'Tableau de bord analytique avancé + comparaison anonymisée avec les pairs de votre tranche.',
    'analytics',
    700, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 70
  ),
  (
    'auto_quote_email',
    'Devis automatique depuis email',
    'Génère et envoie automatiquement un devis dès qu''une demande qualifiée arrive par email.',
    'workflow',
    900, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 80
  ),
  (
    'followup_advanced',
    'Séquences relance automatiques',
    'Séquences de relance multi-canal (email + SMS) entièrement scriptées pour devis, missions et factures.',
    'workflow',
    500, 14,
    '["all_inclusive","cabinet"]'::jsonb,
    true, 90
  )
ON CONFLICT (module_code) DO UPDATE SET
  display_name        = EXCLUDED.display_name,
  description         = EXCLUDED.description,
  category            = EXCLUDED.category,
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  trial_duration_days = EXCLUDED.trial_duration_days,
  included_in_plans   = EXCLUDED.included_in_plans,
  is_active           = EXCLUDED.is_active,
  sort_order          = EXCLUDED.sort_order;
