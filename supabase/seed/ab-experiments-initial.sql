-- ============================================
-- KOVAS — Seed A/B experiments (mission C2)
-- 5 expériences en mode draft, prêtes à être activées
-- depuis le dashboard admin /admin/ab-testing.
-- Idempotent via ON CONFLICT (experiment_key).
-- ============================================

INSERT INTO public.ab_experiments
  (experiment_key, description, hypothesis, variants, traffic_split, status, primary_metric)
VALUES
  (
    'email-1-tone',
    'Email J+1 onboarding : tutoiement vs vouvoiement',
    'Le tutoiement augmente le taux d''ouverture et de clic sur le tutoriel pour la cible diagnostiqueur 35-50 ans.',
    '[{"name":"control","weight":50,"label":"Vouvoiement"},{"name":"variant_a","weight":50,"label":"Tutoiement"}]'::jsonb,
    '{"control":0.5,"variant_a":0.5}'::jsonb,
    'draft',
    'email_click_rate'
  ),
  (
    'claim-banner-position',
    'Bannière "réclamez votre essai" : top page vs sticky bottom',
    'Une bannière sticky en bas augmente la conversion essai gratuit vs un banner top fixe.',
    '[{"name":"control","weight":50,"label":"Top page"},{"name":"variant_a","weight":50,"label":"Sticky bottom"}]'::jsonb,
    '{"control":0.5,"variant_a":0.5}'::jsonb,
    'draft',
    'claim_rate'
  ),
  (
    'cta-color-quote',
    'CTA "Demander un devis" : navy uni vs navy avec souligné chartreuse',
    'L''accent chartreuse (DS v5) sur le souligné CTA améliore le clic vs CTA navy uni.',
    '[{"name":"control","weight":50,"label":"Navy uni"},{"name":"variant_a","weight":50,"label":"Navy + souligné chartreuse"}]'::jsonb,
    '{"control":0.5,"variant_a":0.5}'::jsonb,
    'draft',
    'quote_cta_click_rate'
  ),
  (
    'quote-form-steps',
    'Formulaire devis : 1 page longue vs 3 étapes wizard',
    'Un wizard 3 étapes réduit l''abandon et augmente le submit final.',
    '[{"name":"control","weight":50,"label":"1 page"},{"name":"variant_a","weight":50,"label":"3 étapes"}]'::jsonb,
    '{"control":0.5,"variant_a":0.5}'::jsonb,
    'draft',
    'quote_submit_rate'
  ),
  (
    'diag-photo-placeholder',
    'Photo profil diagnostiqueur absente : initiales colorées vs avatar générique',
    'Les initiales colorées rendent les fiches plus humaines et augmentent les leads entrants.',
    '[{"name":"control","weight":50,"label":"Avatar générique"},{"name":"variant_a","weight":50,"label":"Initiales colorées"}]'::jsonb,
    '{"control":0.5,"variant_a":0.5}'::jsonb,
    'draft',
    'lead_contact_rate'
  )
ON CONFLICT (experiment_key) DO NOTHING;
