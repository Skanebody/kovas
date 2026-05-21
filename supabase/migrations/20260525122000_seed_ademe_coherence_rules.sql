-- ============================================
-- KOVAS — Module 1 (Cockpit ADEME) — SEED ademe_coherence_rules
--
-- 10 règles initiales de cohérence DPE (arrêté 31/03/2021 méthode 3CL-2021
-- + arrêté 25/03/2024 modificatif seuils petites surfaces).
--
-- Sources :
--   - Arrêté 31/03/2021 : https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353335
--   - Méthode 3CL-2021 :  https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381
--   - Arrêté 25/03/2024 (petites surfaces) :
--                         https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049446315
--
-- Format `rule_logic` :
--   { "operator": "AND" | "OR",
--     "conditions": [ { "field": "...", "op": "eq|ne|in|gt|lt|between|is_null|is_not_null", "value": ... } ] }
--
-- ON CONFLICT : ré-exécution idempotente sur rule_code (UNIQUE).
-- ============================================

INSERT INTO ademe_coherence_rules (rule_code, title, description, diagnostic_types, severity, rule_logic, suggested_fix, source_url, source_reference, applies_from)
VALUES
  -- 1. PAC air/air déclarée sans climatisation cohérente
  ('PAC_AIR_SANS_CLIM',
   'PAC air/air déclarée sans climatisation',
   'Une pompe à chaleur air/air est déclarée comme système de chauffage mais aucune climatisation n''est renseignée. Une PAC air/air assure techniquement le rafraîchissement : vérifier la cohérence des champs ECS / climatisation.',
   ARRAY['dpe_vente','dpe_location'],
   'warning',
   '{"operator":"AND","conditions":[{"field":"type_chauffage","op":"eq","value":"PAC_AIR_AIR"},{"field":"type_climatisation","op":"is_null"}]}'::jsonb,
   'Renseigner le système de climatisation associé (la PAC air/air permet le rafraîchissement) ou justifier l''absence dans les notes.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381',
   'Arrêté 31/03/2021, méthode 3CL-2021, annexe systèmes',
   '2021-07-01'),

  -- 2. Surface > 250m² + année < 1948 + maison individuelle
  ('SURF_INCOHERENT_ANNEE',
   'Surface élevée incohérente avec année et type de bâtiment',
   'Maison individuelle de plus de 250 m² construite avant 1948 : configuration rare. Vérifier la surface mesurée et l''année de construction (souvent confusion avec date d''extension).',
   ARRAY['dpe_vente','dpe_location'],
   'warning',
   '{"operator":"AND","conditions":[{"field":"type_batiment","op":"eq","value":"maison"},{"field":"surface_habitable_m2","op":"gt","value":250},{"field":"annee_construction","op":"lt","value":1948}]}'::jsonb,
   'Recontrôler la surface habitable (loi Boutin) et l''année effective de construction d''origine. Documenter d''éventuelles extensions postérieures.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353335',
   'Arrêté 31/03/2021, art. 4 — données d''entrée caractéristiques bâtiment',
   '2021-07-01'),

  -- 3. Étiquette F/G + chauffage électrique récent (< 2020) sans logique
  ('ETIQUETTE_F_G_AMELIORATION',
   'Étiquette F/G avec chauffage électrique récent',
   'Étiquette DPE F ou G avec un chauffage électrique installé après 2020 : à vérifier. Un chauffage récent performant ne devrait pas conduire systématiquement à une passoire thermique sans cause aggravante (isolation, ECS, ventilation).',
   ARRAY['dpe_vente','dpe_location'],
   'warning',
   '{"operator":"AND","conditions":[{"field":"etiquette_dpe","op":"in","value":["F","G"]},{"field":"type_chauffage","op":"eq","value":"ELECTRIQUE"},{"field":"annee_chauffage","op":"gt","value":2020}]}'::jsonb,
   'Vérifier la cohérence isolation/ECS/ventilation qui expliquerait l''étiquette malgré un chauffage récent. Sinon recontrôler le calcul.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381',
   'Arrêté 31/03/2021, méthode 3CL-2021, calcul consommation conventionnelle',
   '2021-07-01'),

  -- 4. Émissions GES > 50 kgCO2/m².an avec chauffage bois
  ('EMISSIONS_INCOHERENTES_BOIS',
   'Émissions GES élevées avec chauffage bois',
   'Le facteur d''émission du bois est très faible (≈ 30 gCO2/kWh PCI). Des émissions > 50 kgCO2/m².an avec un chauffage bois principal sont incohérentes : vérifier le mode de calcul ou l''existence d''un appoint fossile non déclaré.',
   ARRAY['dpe_vente','dpe_location'],
   'warning',
   '{"operator":"AND","conditions":[{"field":"type_chauffage","op":"eq","value":"BOIS"},{"field":"emissions_kgco2_m2","op":"gt","value":50}]}'::jsonb,
   'Vérifier la part d''appoint fossile (fioul, propane). Contrôler le facteur d''émission appliqué et le contenu CO2 retenu.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381',
   'Arrêté 31/03/2021, méthode 3CL-2021, facteurs d''émission par énergie',
   '2021-07-01'),

  -- 5. Année construction 1900 (valeur par défaut soupçonnée)
  ('ANNEE_1900_PROBABLE',
   'Année de construction 1900 (valeur par défaut suspectée)',
   'L''année de construction "1900" est très fréquemment saisie comme valeur par défaut quand la date réelle est inconnue. Vérifier l''antériorité réelle du bâtiment (cadastre, titre de propriété).',
   ARRAY['dpe_vente','dpe_location','amiante_vente','plomb_crep'],
   'info',
   '{"operator":"AND","conditions":[{"field":"annee_construction","op":"eq","value":1900}]}'::jsonb,
   'Recouper avec le cadastre, le titre de propriété, ou estimer par typologie constructive. Documenter la source dans les notes.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353335',
   'Arrêté 31/03/2021, art. 4 — caractéristiques du bâtiment',
   '2021-07-01'),

  -- 6. Surface entre 9 et 14 m² (limite Boutin/Carrez)
  ('SURFACE_LIMITE_BOUTIN',
   'Surface proche du seuil Boutin/Carrez',
   'Surface habitable entre 9 et 14 m² : zone de seuil critique. La loi Boutin (location) exige ≥ 9 m². Vérifier la méthode de mesurage et la hauteur sous plafond (≥ 1,80 m pour la surface de référence DPE depuis 01/07/2024).',
   ARRAY['dpe_vente','dpe_location','carrez_boutin'],
   'warning',
   '{"operator":"AND","conditions":[{"field":"surface_habitable_m2","op":"between","value":[9,14]}]}'::jsonb,
   'Recontrôler le mesurage (hauteur sous plafond ≥ 1,80 m). Vérifier la conformité au seuil Boutin pour la location.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000049446315',
   'Arrêté 25/03/2024 (petites surfaces) — surface de référence ≥ 1,80 m HSP, en vigueur 01/07/2024',
   '2024-07-01'),

  -- 7. Étiquette A avec construction avant 1990 sans rénovation
  ('ETIQUETTE_A_SANS_ISOLATION',
   'Étiquette A pour bâti avant 1990 sans rénovation déclarée',
   'Étiquette DPE A pour un bâtiment construit avant 1990 sans aucune rénovation lourde déclarée : à vérifier. Une enveloppe ancienne non rénovée atteint rarement le niveau A.',
   ARRAY['dpe_vente','dpe_location'],
   'warning',
   '{"operator":"AND","conditions":[{"field":"etiquette_dpe","op":"eq","value":"A"},{"field":"annee_construction","op":"lt","value":1990},{"field":"annee_renovation","op":"is_null"}]}'::jsonb,
   'Documenter les travaux d''isolation (murs, toiture, menuiseries) et le système ECS/chauffage qui justifient l''étiquette A. Sinon recontrôler le calcul.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381',
   'Arrêté 31/03/2021, méthode 3CL-2021, caractéristiques d''enveloppe',
   '2021-07-01'),

  -- 8. Émissions < 100 kgCO2/m².an avec chauffage fioul
  ('EMISSIONS_FAIBLES_FIOUL',
   'Émissions GES faibles avec chauffage fioul',
   'Le facteur d''émission du fioul est élevé (≈ 324 gCO2/kWh PCI). Des émissions < 100 kgCO2/m².an avec un chauffage fioul principal sont peu plausibles, sauf si le bâtiment est très peu énergivore (isolation excellente) — à recontrôler.',
   ARRAY['dpe_vente','dpe_location'],
   'warning',
   '{"operator":"AND","conditions":[{"field":"type_chauffage","op":"eq","value":"FIOUL"},{"field":"emissions_kgco2_m2","op":"lt","value":100}]}'::jsonb,
   'Vérifier la consommation conventionnelle de chauffage et le facteur d''émission appliqué. Contrôler la déclaration du système principal vs appoint.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381',
   'Arrêté 31/03/2021, méthode 3CL-2021, facteurs d''émission par énergie',
   '2021-07-01'),

  -- 9. VMC déclarée dans construction antérieure à 1985
  ('VENT_MECA_AVANT_1985',
   'VMC dans bâti antérieur à 1985',
   'Bâtiment construit avant 1985 avec VMC mécanique déclarée : à vérifier. La généralisation VMC date des années 1980 ; possible installation rétroactive non documentée.',
   ARRAY['dpe_vente','dpe_location'],
   'info',
   '{"operator":"AND","conditions":[{"field":"annee_construction","op":"lt","value":1985},{"field":"type_ventilation","op":"in","value":["VMC_SIMPLE_FLUX","VMC_DOUBLE_FLUX","VMC_HYGRO_A","VMC_HYGRO_B"]}]}'::jsonb,
   'Documenter la date d''installation de la VMC et son type effectif (rénovation a posteriori).',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381',
   'Arrêté 31/03/2021, méthode 3CL-2021, systèmes de ventilation',
   '2021-07-01'),

  -- 10. ECS instantanée gaz dans maison > 100m²
  ('ECS_INSTANTANE_GAZ_MAISON',
   'ECS instantanée gaz dans maison > 100 m²',
   'Eau chaude sanitaire instantanée au gaz dans une maison de plus de 100 m² : configuration peu adaptée au confort multi-puisages. Vérifier qu''il ne s''agit pas d''une chaudière mixte (chauffage + ECS) déclarée à tort en ECS instantanée seule.',
   ARRAY['dpe_vente','dpe_location'],
   'info',
   '{"operator":"AND","conditions":[{"field":"type_batiment","op":"eq","value":"maison"},{"field":"surface_habitable_m2","op":"gt","value":100},{"field":"type_ecs","op":"eq","value":"GAZ_INSTANTANE"}]}'::jsonb,
   'Vérifier le type d''ECS effectif (instantané pur vs chaudière mixte). Reclassifier le système si nécessaire.',
   'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043353381',
   'Arrêté 31/03/2021, méthode 3CL-2021, systèmes ECS',
   '2021-07-01')

ON CONFLICT (rule_code) DO UPDATE
  SET title           = EXCLUDED.title,
      description     = EXCLUDED.description,
      diagnostic_types= EXCLUDED.diagnostic_types,
      severity        = EXCLUDED.severity,
      rule_logic      = EXCLUDED.rule_logic,
      suggested_fix   = EXCLUDED.suggested_fix,
      source_url      = EXCLUDED.source_url,
      source_reference= EXCLUDED.source_reference,
      applies_from    = EXCLUDED.applies_from,
      updated_at      = now();
