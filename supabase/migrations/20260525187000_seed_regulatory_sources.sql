-- ============================================
-- KOVAS App — Module 8 : Seed des 9 sources réglementaires V1
-- Date : 2026-05-25
-- ============================================
-- NOTE IMPORTANTE — Légifrance HTML scraping :
--   Le scraping HTML de legifrance.gouv.fr est fragile (changements DOM fréquents,
--   risque de blocage IP). Voie cible production = API PISTE
--   https://api.piste.gouv.fr/dila/legifrance/ (inscription gratuite + OAuth2).
--   V1 : on conserve le scraping HTML pour démarrer ; basculer sur PISTE dès que
--   l'inscription est validée (~ J+5 à J+10 ouvrés). TODO ticket SUIVI-VEILLE.
-- ============================================

INSERT INTO regulatory_sources
  (slug, name, authority, url, feed_url, api_url, fetch_method, fetch_frequency_hours,
   reliability, robots_txt_checked, tos_compatible, notes)
VALUES
  -- 1. Légifrance — JO + code construction / habitation
  ('legifrance-jo', 'Légifrance — Journal officiel', 'legifrance',
   'https://www.legifrance.gouv.fr/',
   'https://www.legifrance.gouv.fr/jo_rss.xml',
   'https://api.piste.gouv.fr/dila/legifrance/',  -- cible production
   'http_scrape', 24, 'critical', false, false,
   'V1 : scraping HTML fragile. Migrer vers API PISTE (OAuth2, inscription gratuite) ASAP.'),

  -- 2. Légifrance — Codes (CCH, code de la construction et de l'habitation)
  ('legifrance-cch', 'Légifrance — Code construction & habitation', 'legifrance',
   'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006074096/',
   NULL,
   'https://api.piste.gouv.fr/dila/legifrance/',
   'http_scrape', 168, 'critical', false, false,
   'Code CCH. Hebdomadaire. Idem : basculer PISTE.'),

  -- 3. ADEME — site officiel + observatoire DPE
  ('ademe-actualites', 'ADEME — Actualités diagnostics', 'ademe',
   'https://www.ademe.fr/',
   'https://www.ademe.fr/feed/',
   NULL,
   'rss', 24, 'critical', false, false,
   'Flux RSS officiel ADEME. Filtrage par mots-clés DPE/diagnostic côté worker.'),

  -- 4. ADEME — Observatoire DPE (statistiques publiques)
  ('ademe-observatoire-dpe', 'ADEME — Observatoire DPE', 'ademe',
   'https://observatoire-dpe-audit.ademe.fr/',
   NULL,
   NULL,
   'http_scrape', 168, 'standard', false, false,
   'Statistiques DPE nationaux. Hebdo.'),

  -- 5. COFRAC — actualités accréditation diagnostiqueurs
  ('cofrac-accreditation', 'COFRAC — Accréditation diagnostiqueurs', 'cofrac',
   'https://www.cofrac.fr/',
   'https://www.cofrac.fr/actualites/rss',
   NULL,
   'rss', 48, 'critical', false, false,
   'RSS COFRAC. Touche le statut accréditation des cabinets.'),

  -- 6. CSTB — Centre scientifique et technique du bâtiment
  ('cstb-actualites', 'CSTB — Actualités bâtiment', 'cstb',
   'https://www.cstb.fr/',
   'https://www.cstb.fr/feed/',
   NULL,
   'rss', 48, 'standard', false, false,
   'Normes techniques bâtiment. Pertinent amiante/plomb/électricité.'),

  -- 7. DGCCRF — protection consommateurs / sanctions diagnostiqueurs
  ('dgccrf-actualites', 'DGCCRF — Sanctions et alertes', 'dgccrf',
   'https://www.economie.gouv.fr/dgccrf',
   'https://www.economie.gouv.fr/dgccrf/rss.xml',
   NULL,
   'rss', 48, 'standard', false, false,
   'Sanctions / contrôles diagnostiqueurs. Importance "high" si mots-clés match.'),

  -- 8. AFNOR — normes techniques (publication officielle)
  ('afnor-normes', 'AFNOR — Normes diagnostic', 'afnor',
   'https://www.afnor.org/',
   NULL,
   NULL,
   'http_scrape', 168, 'standard', false, false,
   'NF P15-401, NF X46-020, etc. Mises à jour rares mais critiques.'),

  -- 9. Ministère de la Transition écologique — texte sur le logement
  ('mte-logement', 'Ministère Transition écologique — Logement', 'mte',
   'https://www.ecologie.gouv.fr/',
   'https://www.ecologie.gouv.fr/rss.xml',
   NULL,
   'rss', 24, 'critical', false, false,
   'Politique publique DPE / interdiction location passoires (loi Climat & Résilience).')
ON CONFLICT (slug) DO NOTHING;

-- ============================================
-- FIN MIGRATION seed_regulatory_sources
-- ============================================
