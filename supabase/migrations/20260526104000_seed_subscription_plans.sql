-- ============================================
-- KOVAS — Seed des 5 forfaits subscription_plans
-- Date : 2026-05-26
-- Cf. CLAUDE.md §4
--
-- Stripe IDs (stripe_product_id, stripe_price_monthly_id, stripe_price_annual_id)
-- laissés en NULL. Ils seront provisionnés en production via un script séparé
-- (scripts/stripe-provision-plans.ts à venir) qui :
--   1. crée le produit + prix dans Stripe via l'API
--   2. UPDATE public.subscription_plans SET stripe_* = ... WHERE plan_code = ...
-- ============================================

INSERT INTO public.subscription_plans (
  plan_code, display_name, description,
  price_monthly_cents, price_annual_cents,
  missions_quota, storage_gb, users_included,
  extra_user_price_cents, max_users,
  chatbot_messages_quota, yousign_signatures_quota, geocoding_requests_quota,
  overage_mission_price_cents, overage_chatbot_price_cents,
  overage_signature_price_cents, overage_geocoding_price_cents,
  overage_storage_price_cents_per_gb,
  features, is_active, is_featured, sort_order
) VALUES
  (
    'essential', 'Essential',
    'Démarrer en toute simplicité',
    900,    9000,                  -- 9 €/mo · 90 €/an (10 mois sur 12)
    10,     5,    1,
    NULL,   NULL,
    50,     0,    0,
    200,    5,    50,    1,    10,
    jsonb_build_object(
      'capture_first',         true,
      'crm_basic',             true,
      'reports_basic',         3,
      'devis_basic',           true,
      'factures_basic',        true,
      'veille_basic_notifs',   true,
      'support_email',         true
    ),
    true, false, 10
  ),
  (
    'decouverte', 'Pack Découverte',
    'Pour valider sa pratique sereinement',
    1900,   19000,                 -- 19 €/mo · 190 €/an
    25,     20,   1,
    NULL,   NULL,
    100,    0,    0,
    200,    5,    50,    1,    10,
    jsonb_build_object(
      'capture_first',         true,
      'crm_basic',             true,
      'reports_basic',         10,
      'devis_basic',           true,
      'factures_basic',        true,
      'veille_basic_notifs',   true,
      'support_email',         true,
      'cockpit_ademe_mode1',   true
    ),
    true, false, 20
  ),
  (
    'pro', 'Pack Pro',
    'Le quotidien du diagnostiqueur indépendant',
    3500,   35000,                 -- 35 €/mo · 350 €/an
    60,     50,   1,
    NULL,   NULL,
    150,    5,    1000,
    150,    5,    50,    1,    10,
    jsonb_build_object(
      'capture_first',         true,
      'crm_basic',             true,
      'reports_basic',         10,
      'reports_all',           true,
      'devis_basic',           true,
      'devis_pro',             true,
      'factures_basic',        true,
      'veille_basic_notifs',   true,
      'support_email',         true,
      'support_priority',      true,
      'cockpit_ademe_mode1',   true,
      'yousign',               true,
      'factur_x',              true,
      'pennylane_sync',        true,
      'prescribers',           true,
      'opendata',              true,
      'payment_lock',          true
    ),
    true, true, 30
  ),
  (
    'all_inclusive', 'Pack All Inclusive',
    'Toute la puissance KOVAS, sans limite',
    4900,   49000,                 -- 49 €/mo · 490 €/an
    -1,     200,  1,                -- illimité
    NULL,   NULL,
    200,    15,   5000,
    100,    5,    50,    1,    10,
    jsonb_build_object(
      'capture_first',          true,
      'crm_basic',              true,
      'reports_basic',          10,
      'reports_all',            true,
      'devis_basic',            true,
      'devis_pro',              true,
      'factures_basic',         true,
      'veille_basic_notifs',    true,
      'support_email',          true,
      'support_priority',       true,
      'support_dedicated',      true,
      'cockpit_ademe_mode1',    true,
      'cockpit_ademe_mode2',    true,
      'yousign',                true,
      'factur_x',               true,
      'pennylane_sync',         true,
      'prescribers',            true,
      'opendata',               true,
      'payment_lock',           true,
      'parameter_suggestions',  true,
      'shield_defense',         true,
      'regulatory_chat',        true,
      'auto_quote_email',       true,
      'nurturing_fg',           true,
      'followup_sequences',     true,
      'community',              true,
      'analytics_business',     true,
      'benchmark',              true,
      'pipeline_kanban',        true,
      'custom_kpi',             true,
      'goals',                  true
    ),
    true, false, 40
  ),
  (
    'cabinet', 'Cabinet',
    'Pour les équipes et les cabinets multi-diag',
    8900,   89000,                 -- 89 €/mo · 890 €/an
    -1,     300,  3,                -- 3 users inclus, +19€/user, max 10
    1900,   10,
    600,    30,   10000,
    100,    5,    50,    1,    10,
    jsonb_build_object(
      'capture_first',          true,
      'crm_basic',              true,
      'reports_basic',          10,
      'reports_all',            true,
      'devis_basic',            true,
      'devis_pro',              true,
      'factures_basic',         true,
      'veille_basic_notifs',    true,
      'support_email',          true,
      'support_priority',       true,
      'support_dedicated',      true,
      'cockpit_ademe_mode1',    true,
      'cockpit_ademe_mode2',    true,
      'yousign',                true,
      'factur_x',               true,
      'pennylane_sync',         true,
      'prescribers',            true,
      'opendata',               true,
      'payment_lock',           true,
      'parameter_suggestions',  true,
      'shield_defense',         true,
      'regulatory_chat',        true,
      'auto_quote_email',       true,
      'nurturing_fg',           true,
      'followup_sequences',     true,
      'community',              true,
      'analytics_business',     true,
      'benchmark',              true,
      'pipeline_kanban',        true,
      'custom_kpi',             true,
      'goals',                  true,
      'multi_user',             true,
      'cabinet_dashboard',      true,
      'mission_routing',        true,
      'multi_rib',              true,
      'pipeline_shared',        true
    ),
    true, false, 50
  )
ON CONFLICT (plan_code) DO UPDATE SET
  display_name                       = EXCLUDED.display_name,
  description                        = EXCLUDED.description,
  price_monthly_cents                = EXCLUDED.price_monthly_cents,
  price_annual_cents                 = EXCLUDED.price_annual_cents,
  missions_quota                     = EXCLUDED.missions_quota,
  storage_gb                         = EXCLUDED.storage_gb,
  users_included                     = EXCLUDED.users_included,
  extra_user_price_cents             = EXCLUDED.extra_user_price_cents,
  max_users                          = EXCLUDED.max_users,
  chatbot_messages_quota             = EXCLUDED.chatbot_messages_quota,
  yousign_signatures_quota           = EXCLUDED.yousign_signatures_quota,
  geocoding_requests_quota           = EXCLUDED.geocoding_requests_quota,
  overage_mission_price_cents        = EXCLUDED.overage_mission_price_cents,
  overage_chatbot_price_cents        = EXCLUDED.overage_chatbot_price_cents,
  overage_signature_price_cents      = EXCLUDED.overage_signature_price_cents,
  overage_geocoding_price_cents      = EXCLUDED.overage_geocoding_price_cents,
  overage_storage_price_cents_per_gb = EXCLUDED.overage_storage_price_cents_per_gb,
  features                           = EXCLUDED.features,
  is_active                          = EXCLUDED.is_active,
  is_featured                        = EXCLUDED.is_featured,
  sort_order                         = EXCLUDED.sort_order,
  updated_at                         = now();
