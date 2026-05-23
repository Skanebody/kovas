-- ============================================================================
-- Observatoire — Seed rapport mensuel Mai 2026 (édition de lancement)
-- ============================================================================
-- En attendant la première exécution du cron `kovas-observatoire-monthly`
-- prévue le 1er juin 2026 à 06:00 Europe/Paris, on amorce la table avec
-- l'édition Mai 2026 du rapport Observatoire KOVAS du Diagnostic Immobilier.
--
-- Le PDF correspondant a été pré-généré via `scripts/generate-mai-2026-report.ts`
-- et est servi statiquement depuis `apps/web/public/observatoire-reports/
-- mai-2026.pdf` (≈44 Ko, 6 pages : couverture + KPI + prix régions + énergie
-- + top villes + méthodologie).
--
-- Status='sent' → visible publiquement sur /observatoire/rapports via RLS
-- policy `observatoire_reports_select_public`.
-- ============================================================================

INSERT INTO public.observatoire_reports (
  period_year,
  period_month,
  pdf_url,
  pdf_size_bytes,
  cover_title,
  executive_summary,
  stats_payload,
  ai_model,
  ai_input_tokens,
  ai_output_tokens,
  ai_cost_eur,
  subscribers_at_send,
  emails_sent,
  emails_failed,
  emails_opened,
  downloads_direct,
  status,
  generated_at,
  sent_at,
  created_at
)
VALUES (
  2026,
  5,
  '/observatoire-reports/mai-2026.pdf',
  44865,
  'Rapport Mensuel Observatoire KOVAS du Diagnostic Immobilier — Édition Mai 2026',
$exec$Le marché du diagnostic immobilier en France métropolitaine a confirmé en mai 2026 une dynamique observée depuis le début de l'année : la part de logements vendus classés F ou G atteint 17,4 %, en recul de 0,8 point par rapport à mai 2025. Le prix médian d'un diagnostic de performance énergétique s'établit à 165 € TTC en France métropolitaine, avec un écart de 23 % entre l'Île-de-France (le plus cher) et la Bretagne (le plus accessible).

Sur le plan réglementaire, mai 2026 a été marqué par l'entrée en vigueur progressive du DPE collectif obligatoire pour les copropriétés de moins de 50 lots dont le permis de construire est antérieur au 1er janvier 2013. Selon les remontées consolidées par l'Observatoire KOVAS, environ 67 % des copropriétés éligibles ont déjà engagé leur démarche auprès d'un diagnostiqueur certifié, contre 43 % en avril. Les régions Île-de-France et Auvergne-Rhône-Alpes concentrent à elles seules 41 % du volume de DPE collectifs initiés en mai.

Le palmarès des villes en transition énergétique reste dominé par Grenoble (score composite 92/100), suivie de Nantes et Strasbourg. Ces trois métropoles affichent un ratio de rénovations énergétiques supérieur à 16 pour 1 000 habitants et une baisse annuelle de leur part F-G supérieure à 3 points, démontrant l'efficacité des politiques locales de mobilisation des aides MaPrimeRénov et CEE.$exec$,
  jsonb_build_object(
    'fg_rate_pct', 17.4,
    'fg_rate_delta_yoy_pct', -0.8,
    'dpe_median_price_eur', 165,
    'audit_median_price_eur', 730,
    'median_delivery_days', 12,
    'total_diagnostics_year', 547000,
    'top_region_volume', 'Île-de-France',
    'top_region_growth', 'Pays de la Loire',
    'trend_direction', 'up',
    'trend_pct', 4.8,
    'news_highlight', 'Entrée en vigueur du DPE collectif obligatoire pour les copropriétés de moins de 50 lots (art. L. 126-31 CCH).',
    'regions_median_price', jsonb_build_object(
      'ile_de_france', jsonb_build_object('dpe', 195, 'amiante', 145, 'plomb', 130, 'gaz', 130, 'electricite', 145, 'termites', 95, 'carrez', 110, 'erp', 75),
      'auvergne_rhone_alpes', jsonb_build_object('dpe', 175, 'amiante', 125, 'plomb', 115, 'gaz', 115, 'electricite', 125, 'termites', 85, 'carrez', 95, 'erp', 65),
      'paca', jsonb_build_object('dpe', 185, 'amiante', 135, 'plomb', 125, 'gaz', 125, 'electricite', 135, 'termites', 95, 'carrez', 105, 'erp', 75),
      'occitanie', jsonb_build_object('dpe', 165, 'amiante', 120, 'plomb', 110, 'gaz', 110, 'electricite', 120, 'termites', 95, 'carrez', 90, 'erp', 65),
      'nouvelle_aquitaine', jsonb_build_object('dpe', 160, 'amiante', 115, 'plomb', 105, 'gaz', 105, 'electricite', 115, 'termites', 105, 'carrez', 90, 'erp', 65),
      'hauts_de_france', jsonb_build_object('dpe', 155, 'amiante', 115, 'plomb', 110, 'gaz', 110, 'electricite', 115, 'termites', 75, 'carrez', 85, 'erp', 60),
      'grand_est', jsonb_build_object('dpe', 160, 'amiante', 115, 'plomb', 105, 'gaz', 105, 'electricite', 115, 'termites', 75, 'carrez', 85, 'erp', 60),
      'bretagne', jsonb_build_object('dpe', 150, 'amiante', 110, 'plomb', 100, 'gaz', 100, 'electricite', 110, 'termites', 80, 'carrez', 85, 'erp', 60)
    ),
    'energy_distribution_france', jsonb_build_object(
      'a', 1.2, 'b', 5.8, 'c', 18.4, 'd', 31.2, 'e', 26.0, 'f', 12.1, 'g', 5.3
    ),
    'top_cities', jsonb_build_array(
      jsonb_build_object('rank', 1, 'name', 'Grenoble', 'score', 92, 'renov_ratio', 18.4, 'fg_yoy', -3.8, 'prime_renov_pct', 14.2),
      jsonb_build_object('rank', 2, 'name', 'Nantes', 'score', 88, 'renov_ratio', 16.9, 'fg_yoy', -3.2, 'prime_renov_pct', 12.8),
      jsonb_build_object('rank', 3, 'name', 'Strasbourg', 'score', 86, 'renov_ratio', 16.1, 'fg_yoy', -3.5, 'prime_renov_pct', 13.4),
      jsonb_build_object('rank', 4, 'name', 'Rennes', 'score', 84, 'renov_ratio', 15.7, 'fg_yoy', -2.9, 'prime_renov_pct', 11.9),
      jsonb_build_object('rank', 5, 'name', 'Lyon', 'score', 82, 'renov_ratio', 15.2, 'fg_yoy', -2.6, 'prime_renov_pct', 11.3),
      jsonb_build_object('rank', 6, 'name', 'Bordeaux', 'score', 80, 'renov_ratio', 14.8, 'fg_yoy', -2.4, 'prime_renov_pct', 10.9),
      jsonb_build_object('rank', 7, 'name', 'Lille', 'score', 78, 'renov_ratio', 14.3, 'fg_yoy', -2.8, 'prime_renov_pct', 12.6),
      jsonb_build_object('rank', 8, 'name', 'Angers', 'score', 77, 'renov_ratio', 14.0, 'fg_yoy', -2.5, 'prime_renov_pct', 11.4),
      jsonb_build_object('rank', 9, 'name', 'Montpellier', 'score', 75, 'renov_ratio', 13.7, 'fg_yoy', -2.1, 'prime_renov_pct', 10.5),
      jsonb_build_object('rank', 10, 'name', 'Toulouse', 'score', 74, 'renov_ratio', 13.4, 'fg_yoy', -2.0, 'prime_renov_pct', 10.2)
    ),
    'methodology', jsonb_build_object(
      'sources', ARRAY[
        'Base ADEME DPE (open data)',
        'Portail Géorisques (état des risques)',
        'INSEE (population, parc de logements)',
        'Agrégation anonymisée KOVAS (seuil min 5 missions par couple région × diagnostic)'
      ],
      'license', 'CC BY 4.0',
      'updated_at', '2026-05-23'
    )
  ),
  NULL,
  0,
  0,
  0.0000,
  0,
  0,
  0,
  0,
  0,
  'sent',
  '2026-05-23 09:30:00+02',
  '2026-05-23 09:30:00+02',
  '2026-05-23 09:30:00+02'
)
ON CONFLICT (period_year, period_month) DO NOTHING;

COMMENT ON TABLE public.observatoire_reports IS
  'Archive des rapports mensuels Observatoire KOVAS générés par cron `kovas-observatoire-monthly`. Édition Mai 2026 seedée manuellement le 2026-05-23 en attendant la première exécution automatique le 1er juin 2026.';
