-- ============================================
-- KOVAS — Seed fixtures annuaire diagnostiqueurs (50 fiches, 10 villes)
-- Date  : 2026-05-24
-- Lot   : FIX-D (annuaire recherche fonctionnelle)
--
-- Objectif
--   Fixtures DEMO le temps que la cron DHUP officielle (Edge Function
--   `absorb-dhup-directory`, déclenchée par `.github/workflows/cron-dhup-weekly.yml`)
--   ait peuplé la table avec les ~13 000 diagnostiqueurs réels.
--
-- Schéma cible (post-migration 20260524110000_diagnosticians_unified.sql) :
--   colonnes canoniques utilisées : full_name, city, city_slug, postcode,
--   dept_code, address, latitude, longitude, certifications, sirene_siret,
--   slug, dhup_source_id, gmb_rating, gmb_review_count, claim_status.
--   Les colonnes legacy (first_name/last_name/postal_code/geo_lat/geo_lng/
--   department_code/slug_city/slug_dept) sont alimentées par triggers ou
--   ignorées (NULLABLE depuis FIX-D).
--
-- Données 100% fictives, aucune correspondance réelle.
-- Répartition : 5 fiches × 10 villes principales = 50 fiches.
-- ============================================

-- Idempotence : supprime uniquement les fixtures FIX-D (préfixe 'fix_')
DELETE FROM diagnosticians WHERE dhup_source_id LIKE 'fix_%';

INSERT INTO diagnosticians (
  full_name, city, city_slug, postcode, dept_code, address,
  latitude, longitude, certifications, sirene_siret, sirene_state,
  slug, dhup_source_id, gmb_rating, gmb_review_count, claim_status,
  is_published, withdrawal_requested
) VALUES

-- ===== Paris (75) =====
('Camille Lefevre', 'Paris', 'paris', '75001', '75', '14 rue de Rivoli, 75001 Paris',
 48.8625, 2.3360,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI001","valid_until":"2028-06-30","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM001","valid_until":"2028-06-30","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL001","valid_until":"2028-06-30","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA001","valid_until":"2028-06-30","status":"valid"}]'::jsonb,
 '81234567800011', 'active', 'fix-camille-lefevre-75001', 'fix_75_paris_001',
 4.8, 47, 'unclaimed', true, false),

('Thomas Bernard', 'Paris', 'paris', '75008', '75', '28 boulevard Haussmann, 75008 Paris',
 48.8722, 2.3072,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI002","valid_until":"2027-12-31","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA002","valid_until":"2027-12-31","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"FIX-CPEL002","valid_until":"2027-12-31","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM002","valid_until":"2027-12-31","status":"valid"}]'::jsonb,
 '81234567800012', 'active', 'fix-thomas-bernard-75008', 'fix_75_paris_002',
 4.6, 92, 'unclaimed', true, false),

('Lucie Moreau', 'Paris', 'paris', '75011', '75', '42 rue de la Roquette, 75011 Paris',
 48.8589, 2.3795,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI003","valid_until":"2029-03-15","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL003","valid_until":"2029-03-15","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL003","valid_until":"2029-03-15","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"FIX-CPCA003","valid_until":"2029-03-15","status":"valid"},{"type":"ERP","organism":"AFNOR","number":"FIX-CPER003","valid_until":"2029-03-15","status":"valid"}]'::jsonb,
 '81234567800013', 'active', 'fix-lucie-moreau-75011', 'fix_75_paris_003',
 4.9, 134, 'unclaimed', true, false),

('Antoine Dubois', 'Paris', 'paris', '75015', '75', '78 rue de Vaugirard, 75015 Paris',
 48.8410, 2.2980,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI004","valid_until":"2028-09-22","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM004","valid_until":"2028-09-22","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"FIX-CPTE004","valid_until":"2028-09-22","status":"valid"}]'::jsonb,
 '81234567800014', 'active', 'fix-antoine-dubois-75015', 'fix_75_paris_004',
 4.5, 28, 'unclaimed', true, false),

('Sophie Martin', 'Paris', 'paris', '75019', '75', '156 avenue Jean Jaures, 75019 Paris',
 48.8865, 2.3960,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI005","valid_until":"2027-08-10","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"FIX-CPEL005","valid_until":"2027-08-10","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA005","valid_until":"2027-08-10","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"FIX-CPPL005","valid_until":"2027-08-10","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM005","valid_until":"2027-08-10","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE005","valid_until":"2027-08-10","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA005","valid_until":"2027-08-10","status":"valid"},{"type":"ERP","organism":"I_CERT","number":"FIX-CPER005","valid_until":"2027-08-10","status":"valid"}]'::jsonb,
 '81234567800015', 'active', 'fix-sophie-martin-75019', 'fix_75_paris_005',
 5.0, 211, 'claimed', true, false),

-- ===== Lyon (69) =====
('Jean-Pierre Garnier', 'Lyon', 'lyon', '69002', '69', '8 place Bellecour, 69002 Lyon',
 45.7578, 4.8320,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI006","valid_until":"2028-11-05","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"FIX-CPAM006","valid_until":"2028-11-05","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL006","valid_until":"2028-11-05","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL006","valid_until":"2028-11-05","status":"valid"}]'::jsonb,
 '81234567800021', 'active', 'fix-jean-pierre-garnier-69002', 'fix_69_lyon_001',
 4.7, 73, 'unclaimed', true, false),

('Aurelie Roux', 'Lyon', 'lyon', '69003', '69', '24 cours Lafayette, 69003 Lyon',
 45.7600, 4.8520,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI007","valid_until":"2029-01-18","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA007","valid_until":"2029-01-18","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"FIX-CPCA007","valid_until":"2029-01-18","status":"valid"}]'::jsonb,
 '81234567800022', 'active', 'fix-aurelie-roux-69003', 'fix_69_lyon_002',
 4.8, 56, 'unclaimed', true, false),

('Marc Lefevre', 'Lyon', 'lyon', '69006', '69', '12 cours Vitton, 69006 Lyon',
 45.7710, 4.8530,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI008","valid_until":"2028-04-30","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM008","valid_until":"2028-04-30","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"FIX-CPEL008","valid_until":"2028-04-30","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE008","valid_until":"2028-04-30","status":"valid"},{"type":"ERP","organism":"I_CERT","number":"FIX-CPER008","valid_until":"2028-04-30","status":"valid"}]'::jsonb,
 '81234567800023', 'active', 'fix-marc-lefevre-69006', 'fix_69_lyon_003',
 4.6, 41, 'unclaimed', true, false),

('Isabelle Renault', 'Lyon', 'lyon', '69007', '69', '180 avenue Jean Jaures, 69007 Lyon',
 45.7390, 4.8460,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI009","valid_until":"2027-10-12","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL009","valid_until":"2027-10-12","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"FIX-CPGA009","valid_until":"2027-10-12","status":"valid"}]'::jsonb,
 '81234567800024', 'active', 'fix-isabelle-renault-69007', 'fix_69_lyon_004',
 4.4, 19, 'unclaimed', true, false),

('Vincent Charpentier', 'Lyon', 'lyon', '69009', '69', '5 rue du Bourbonnais, 69009 Lyon',
 45.7790, 4.8050,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI010","valid_until":"2029-06-25","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM010","valid_until":"2029-06-25","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"FIX-CPEL010","valid_until":"2029-06-25","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA010","valid_until":"2029-06-25","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL010","valid_until":"2029-06-25","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"FIX-CPCA010","valid_until":"2029-06-25","status":"valid"}]'::jsonb,
 '81234567800025', 'active', 'fix-vincent-charpentier-69009', 'fix_69_lyon_005',
 4.9, 88, 'claimed', true, false),

-- ===== Marseille (13) =====
('Karim Benali', 'Marseille', 'marseille', '13001', '13', '34 La Canebiere, 13001 Marseille',
 43.2980, 5.3810,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI011","valid_until":"2028-07-14","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM011","valid_until":"2028-07-14","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE011","valid_until":"2028-07-14","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"FIX-CPPL011","valid_until":"2028-07-14","status":"valid"}]'::jsonb,
 '81234567800031', 'active', 'fix-karim-benali-13001', 'fix_13_marseille_001',
 4.7, 64, 'unclaimed', true, false),

('Nadia Aubry', 'Marseille', 'marseille', '13006', '13', '88 rue Paradis, 13006 Marseille',
 43.2900, 5.3780,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI012","valid_until":"2029-02-08","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"FIX-CPGA012","valid_until":"2029-02-08","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL012","valid_until":"2029-02-08","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"FIX-CPCA012","valid_until":"2029-02-08","status":"valid"}]'::jsonb,
 '81234567800032', 'active', 'fix-nadia-aubry-13006', 'fix_13_marseille_002',
 4.5, 37, 'unclaimed', true, false),

('Olivier Garcia', 'Marseille', 'marseille', '13008', '13', '210 avenue du Prado, 13008 Marseille',
 43.2680, 5.3960,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI013","valid_until":"2028-05-19","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM013","valid_until":"2028-05-19","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL013","valid_until":"2028-05-19","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"FIX-CPTE013","valid_until":"2028-05-19","status":"valid"},{"type":"ERP","organism":"BUREAU_VERITAS","number":"FIX-CPER013","valid_until":"2028-05-19","status":"valid"}]'::jsonb,
 '81234567800033', 'active', 'fix-olivier-garcia-13008', 'fix_13_marseille_003',
 4.8, 102, 'claimed', true, false),

('Celine Mercier', 'Marseille', 'marseille', '13009', '13', '15 boulevard Michelet, 13009 Marseille',
 43.2570, 5.3990,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI014","valid_until":"2027-11-22","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA014","valid_until":"2027-11-22","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"FIX-CPEL014","valid_until":"2027-11-22","status":"valid"}]'::jsonb,
 '81234567800034', 'active', 'fix-celine-mercier-13009', 'fix_13_marseille_004',
 4.3, 22, 'unclaimed', true, false),

('Hadrien Sarroche', 'Marseille', 'marseille', '13012', '13', '60 boulevard Sakakini, 13012 Marseille',
 43.2980, 5.4150,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI015","valid_until":"2029-04-03","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"FIX-CPAM015","valid_until":"2029-04-03","status":"valid"},{"type":"TERMITES","organism":"AFNOR","number":"FIX-CPTE015","valid_until":"2029-04-03","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL015","valid_until":"2029-04-03","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"FIX-CPCA015","valid_until":"2029-04-03","status":"valid"}]'::jsonb,
 '81234567800035', 'active', 'fix-hadrien-sarroche-13012', 'fix_13_marseille_005',
 4.6, 51, 'unclaimed', true, false),

-- ===== Toulouse (31) =====
('Pierre Cazals', 'Toulouse', 'toulouse', '31000', '31', '8 place du Capitole, 31000 Toulouse',
 43.6045, 1.4440,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI016","valid_until":"2028-08-30","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM016","valid_until":"2028-08-30","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"FIX-CPEL016","valid_until":"2028-08-30","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA016","valid_until":"2028-08-30","status":"valid"}]'::jsonb,
 '81234567800041', 'active', 'fix-pierre-cazals-31000', 'fix_31_toulouse_001',
 4.7, 49, 'unclaimed', true, false),

('Magali Toulouse', 'Toulouse', 'toulouse', '31200', '31', '120 route de Bayonne, 31200 Toulouse',
 43.6200, 1.4050,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI017","valid_until":"2029-05-12","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL017","valid_until":"2029-05-12","status":"valid"},{"type":"TERMITES","organism":"AFNOR","number":"FIX-CPTE017","valid_until":"2029-05-12","status":"valid"}]'::jsonb,
 '81234567800042', 'active', 'fix-magali-toulouse-31200', 'fix_31_toulouse_002',
 4.5, 31, 'unclaimed', true, false),

('Romain Bouchet', 'Toulouse', 'toulouse', '31400', '31', '45 avenue Crampel, 31400 Toulouse',
 43.5850, 1.4570,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI018","valid_until":"2027-09-08","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM018","valid_until":"2027-09-08","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA018","valid_until":"2027-09-08","status":"valid"},{"type":"ERP","organism":"I_CERT","number":"FIX-CPER018","valid_until":"2027-09-08","status":"valid"}]'::jsonb,
 '81234567800043', 'active', 'fix-romain-bouchet-31400', 'fix_31_toulouse_003',
 4.8, 67, 'claimed', true, false),

('Anais Doumerc', 'Toulouse', 'toulouse', '31500', '31', '25 avenue Camille Pujol, 31500 Toulouse',
 43.6090, 1.4720,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI019","valid_until":"2028-03-25","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA019","valid_until":"2028-03-25","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"FIX-CPEL019","valid_until":"2028-03-25","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL019","valid_until":"2028-03-25","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"FIX-CPTE019","valid_until":"2028-03-25","status":"valid"}]'::jsonb,
 '81234567800044', 'active', 'fix-anais-doumerc-31500', 'fix_31_toulouse_004',
 4.6, 44, 'unclaimed', true, false),

('Yves Bernadet', 'Toulouse', 'toulouse', '31700', '31', '3 place Charles de Gaulle, 31700 Blagnac',
 43.6360, 1.4030,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI020","valid_until":"2029-08-17","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"FIX-CPAM020","valid_until":"2029-08-17","status":"valid"}]'::jsonb,
 '81234567800045', 'active', 'fix-yves-bernadet-31700', 'fix_31_toulouse_005',
 4.4, 18, 'unclaimed', true, false),

-- ===== Bordeaux (33) =====
('Geraldine Lassalle', 'Bordeaux', 'bordeaux', '33000', '33', '12 cours de l Intendance, 33000 Bordeaux',
 44.8410, -0.5790,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI021","valid_until":"2028-10-04","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM021","valid_until":"2028-10-04","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL021","valid_until":"2028-10-04","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA021","valid_until":"2028-10-04","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"FIX-CPEL021","valid_until":"2028-10-04","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"FIX-CPTE021","valid_until":"2028-10-04","status":"valid"}]'::jsonb,
 '81234567800051', 'active', 'fix-geraldine-lassalle-33000', 'fix_33_bordeaux_001',
 4.9, 113, 'claimed', true, false),

('Sylvain Marquant', 'Bordeaux', 'bordeaux', '33100', '33', '50 quai Bacalan, 33300 Bordeaux',
 44.8650, -0.5610,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI022","valid_until":"2027-12-14","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM022","valid_until":"2027-12-14","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA022","valid_until":"2027-12-14","status":"valid"}]'::jsonb,
 '81234567800052', 'active', 'fix-sylvain-marquant-33100', 'fix_33_bordeaux_002',
 4.5, 38, 'unclaimed', true, false),

('Beatrice Lacombe', 'Bordeaux', 'bordeaux', '33200', '33', '8 avenue de la Liberation, 33200 Bordeaux',
 44.8540, -0.6020,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI023","valid_until":"2028-06-22","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"FIX-CPGA023","valid_until":"2028-06-22","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL023","valid_until":"2028-06-22","status":"valid"},{"type":"ERP","organism":"AFNOR","number":"FIX-CPER023","valid_until":"2028-06-22","status":"valid"}]'::jsonb,
 '81234567800053', 'active', 'fix-beatrice-lacombe-33200', 'fix_33_bordeaux_003',
 4.7, 59, 'unclaimed', true, false),

('Mathieu Delprat', 'Bordeaux', 'bordeaux', '33800', '33', '15 rue Saint-Pierre, 33000 Bordeaux',
 44.8390, -0.5710,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI024","valid_until":"2029-01-30","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL024","valid_until":"2029-01-30","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM024","valid_until":"2029-01-30","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"FIX-CPTE024","valid_until":"2029-01-30","status":"valid"}]'::jsonb,
 '81234567800054', 'active', 'fix-mathieu-delprat-33800', 'fix_33_bordeaux_004',
 4.6, 42, 'unclaimed', true, false),

('Nicole Carteret', 'Bordeaux', 'bordeaux', '33600', '33', '120 cours du Marechal Galieni, 33600 Pessac',
 44.8050, -0.6310,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI025","valid_until":"2028-09-11","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM025","valid_until":"2028-09-11","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA025","valid_until":"2028-09-11","status":"valid"}]'::jsonb,
 '81234567800055', 'active', 'fix-nicole-carteret-33600', 'fix_33_bordeaux_005',
 4.5, 33, 'unclaimed', true, false),

-- ===== Nice (06) =====
('Manon Riviere', 'Nice', 'nice', '06000', '06', '15 avenue Jean Medecin, 06000 Nice',
 43.7102, 7.2620,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI026","valid_until":"2029-03-07","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA026","valid_until":"2029-03-07","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE026","valid_until":"2029-03-07","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM026","valid_until":"2029-03-07","status":"valid"}]'::jsonb,
 '81234567800061', 'active', 'fix-manon-riviere-06000', 'fix_06_nice_001',
 4.7, 55, 'unclaimed', true, false),

('Fabien Tonnelier', 'Nice', 'nice', '06100', '06', '32 boulevard de Cessole, 06100 Nice',
 43.7330, 7.2540,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI027","valid_until":"2028-12-19","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA027","valid_until":"2028-12-19","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"FIX-CPEL027","valid_until":"2028-12-19","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL027","valid_until":"2028-12-19","status":"valid"}]'::jsonb,
 '81234567800062', 'active', 'fix-fabien-tonnelier-06100', 'fix_06_nice_002',
 4.6, 41, 'unclaimed', true, false),

('Charlotte Aubin', 'Nice', 'nice', '06200', '06', '80 promenade des Anglais, 06200 Nice',
 43.6850, 7.2160,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI028","valid_until":"2027-11-29","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"FIX-CPAM028","valid_until":"2027-11-29","status":"valid"},{"type":"ERP","organism":"AFNOR","number":"FIX-CPER028","valid_until":"2027-11-29","status":"valid"}]'::jsonb,
 '81234567800063', 'active', 'fix-charlotte-aubin-06200', 'fix_06_nice_003',
 4.4, 26, 'unclaimed', true, false),

('Bruno Pellegrini', 'Nice', 'nice', '06300', '06', '12 rue Bonaparte, 06300 Nice',
 43.7000, 7.2790,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI029","valid_until":"2028-04-15","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA029","valid_until":"2028-04-15","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE029","valid_until":"2028-04-15","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"FIX-CPPL029","valid_until":"2028-04-15","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA029","valid_until":"2028-04-15","status":"valid"}]'::jsonb,
 '81234567800064', 'active', 'fix-bruno-pellegrini-06300', 'fix_06_nice_004',
 4.8, 71, 'claimed', true, false),

('Helene Marchal', 'Nice', 'nice', '06600', '06', '40 avenue Saint Augustin, 06200 Nice',
 43.6620, 7.2030,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI030","valid_until":"2029-07-08","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM030","valid_until":"2029-07-08","status":"valid"}]'::jsonb,
 '81234567800065', 'active', 'fix-helene-marchal-06600', 'fix_06_nice_005',
 4.5, 29, 'unclaimed', true, false),

-- ===== Nantes (44) =====
('Pierrick Tanguy', 'Nantes', 'nantes', '44000', '44', '8 cours des 50 Otages, 44000 Nantes',
 47.2170, -1.5530,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI031","valid_until":"2028-08-21","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"FIX-CPAM031","valid_until":"2028-08-21","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL031","valid_until":"2028-08-21","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"FIX-CPGA031","valid_until":"2028-08-21","status":"valid"}]'::jsonb,
 '81234567800071', 'active', 'fix-pierrick-tanguy-44000', 'fix_44_nantes_001',
 4.6, 47, 'unclaimed', true, false),

('Solenn Le Goff', 'Nantes', 'nantes', '44100', '44', '120 boulevard des Belges, 44100 Nantes',
 47.2240, -1.5800,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI032","valid_until":"2029-02-26","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"FIX-CPEL032","valid_until":"2029-02-26","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA032","valid_until":"2029-02-26","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE032","valid_until":"2029-02-26","status":"valid"}]'::jsonb,
 '81234567800072', 'active', 'fix-solenn-le-goff-44100', 'fix_44_nantes_002',
 4.8, 68, 'unclaimed', true, false),

('Gwendal Riou', 'Nantes', 'nantes', '44200', '44', '5 route de Vannes, 44200 Nantes',
 47.2360, -1.5710,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI033","valid_until":"2027-10-13","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM033","valid_until":"2027-10-13","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA033","valid_until":"2027-10-13","status":"valid"}]'::jsonb,
 '81234567800073', 'active', 'fix-gwendal-riou-44200', 'fix_44_nantes_003',
 4.5, 34, 'unclaimed', true, false),

('Yann Mahe', 'Nantes', 'nantes', '44300', '44', '60 rue de la Garde, 44300 Nantes',
 47.2620, -1.5470,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI034","valid_until":"2028-05-04","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL034","valid_until":"2028-05-04","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL034","valid_until":"2028-05-04","status":"valid"},{"type":"ERP","organism":"AFNOR","number":"FIX-CPER034","valid_until":"2028-05-04","status":"valid"}]'::jsonb,
 '81234567800074', 'active', 'fix-yann-mahe-44300', 'fix_44_nantes_004',
 4.7, 56, 'unclaimed', true, false),

('Anne Le Bras', 'Nantes', 'nantes', '44800', '44', '25 rue de la Convention, 44800 Saint-Herblain',
 47.2070, -1.6450,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI035","valid_until":"2029-06-16","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM035","valid_until":"2029-06-16","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE035","valid_until":"2029-06-16","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"FIX-CPCA035","valid_until":"2029-06-16","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA035","valid_until":"2029-06-16","status":"valid"}]'::jsonb,
 '81234567800075', 'active', 'fix-anne-le-bras-44800', 'fix_44_nantes_005',
 4.9, 95, 'claimed', true, false),

-- ===== Strasbourg (67) =====
('Eric Schneider', 'Strasbourg', 'strasbourg', '67000', '67', '24 place Kleber, 67000 Strasbourg',
 48.5840, 7.7470,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI036","valid_until":"2028-08-13","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"FIX-CPAM036","valid_until":"2028-08-13","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL036","valid_until":"2028-08-13","status":"valid"}]'::jsonb,
 '81234567800081', 'active', 'fix-eric-schneider-67000', 'fix_67_strasbourg_001',
 4.6, 43, 'unclaimed', true, false),

('Brigitte Muller', 'Strasbourg', 'strasbourg', '67100', '67', '90 route du Polygone, 67100 Strasbourg',
 48.5560, 7.7660,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI037","valid_until":"2029-04-22","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA037","valid_until":"2029-04-22","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL037","valid_until":"2029-04-22","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM037","valid_until":"2029-04-22","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"FIX-CPCA037","valid_until":"2029-04-22","status":"valid"}]'::jsonb,
 '81234567800082', 'active', 'fix-brigitte-muller-67100', 'fix_67_strasbourg_002',
 4.7, 52, 'unclaimed', true, false),

('Hans Weber', 'Strasbourg', 'strasbourg', '67200', '67', '40 avenue Francois Mitterrand, 67200 Strasbourg',
 48.5710, 7.7300,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI038","valid_until":"2028-01-09","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM038","valid_until":"2028-01-09","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE038","valid_until":"2028-01-09","status":"valid"},{"type":"ERP","organism":"I_CERT","number":"FIX-CPER038","valid_until":"2028-01-09","status":"valid"}]'::jsonb,
 '81234567800083', 'active', 'fix-hans-weber-67200', 'fix_67_strasbourg_003',
 4.5, 31, 'unclaimed', true, false),

('Mathilde Klein', 'Strasbourg', 'strasbourg', '67300', '67', '18 rue Principale, 67300 Schiltigheim',
 48.6080, 7.7470,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI039","valid_until":"2027-12-26","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"FIX-CPGA039","valid_until":"2027-12-26","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL039","valid_until":"2027-12-26","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL039","valid_until":"2027-12-26","status":"valid"}]'::jsonb,
 '81234567800084', 'active', 'fix-mathilde-klein-67300', 'fix_67_strasbourg_004',
 4.8, 64, 'claimed', true, false),

('Pierre Wolff', 'Strasbourg', 'strasbourg', '67400', '67', '5 rue de Ravel, 67400 Illkirch',
 48.5290, 7.7220,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI040","valid_until":"2028-10-30","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM040","valid_until":"2028-10-30","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"FIX-CPCA040","valid_until":"2028-10-30","status":"valid"}]'::jsonb,
 '81234567800085', 'active', 'fix-pierre-wolff-67400', 'fix_67_strasbourg_005',
 4.4, 23, 'unclaimed', true, false),

-- ===== Lille (59) =====
('Sebastien Dewulf', 'Lille', 'lille', '59000', '59', '20 rue Faidherbe, 59000 Lille',
 50.6360, 3.0680,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI041","valid_until":"2028-07-07","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM041","valid_until":"2028-07-07","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"FIX-CPPL041","valid_until":"2028-07-07","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA041","valid_until":"2028-07-07","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"FIX-CPEL041","valid_until":"2028-07-07","status":"valid"}]'::jsonb,
 '81234567800091', 'active', 'fix-sebastien-dewulf-59000', 'fix_59_lille_001',
 4.7, 58, 'unclaimed', true, false),

('Justine Vandepitte', 'Lille', 'lille', '59100', '59', '90 boulevard de la Liberte, 59100 Roubaix',
 50.6940, 3.1740,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI042","valid_until":"2029-05-31","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"FIX-CPCA042","valid_until":"2029-05-31","status":"valid"},{"type":"ERP","organism":"AFNOR","number":"FIX-CPER042","valid_until":"2029-05-31","status":"valid"}]'::jsonb,
 '81234567800092', 'active', 'fix-justine-vandepitte-59100', 'fix_59_lille_002',
 4.5, 28, 'unclaimed', true, false),

('Thierry Lhermitte', 'Lille', 'lille', '59200', '59', '15 rue Nationale, 59200 Tourcoing',
 50.7240, 3.1610,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI043","valid_until":"2028-02-12","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM043","valid_until":"2028-02-12","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"FIX-CPTE043","valid_until":"2028-02-12","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL043","valid_until":"2028-02-12","status":"valid"}]'::jsonb,
 '81234567800093', 'active', 'fix-thierry-lhermitte-59200', 'fix_59_lille_003',
 4.6, 39, 'unclaimed', true, false),

('Aurore Coppin', 'Lille', 'lille', '59650', '59', '50 avenue de Bretagne, 59650 Villeneuve d Ascq',
 50.6190, 3.1480,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI044","valid_until":"2027-09-25","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA044","valid_until":"2027-09-25","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"FIX-CPEL044","valid_until":"2027-09-25","status":"valid"}]'::jsonb,
 '81234567800094', 'active', 'fix-aurore-coppin-59650', 'fix_59_lille_004',
 4.4, 22, 'unclaimed', true, false),

('Olivier Caron', 'Lille', 'lille', '59800', '59', '7 rue Esquermoise, 59800 Lille',
 50.6390, 3.0590,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI045","valid_until":"2029-01-15","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"FIX-CPAM045","valid_until":"2029-01-15","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"FIX-CPPL045","valid_until":"2029-01-15","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"FIX-CPCA045","valid_until":"2029-01-15","status":"valid"},{"type":"TERMITES","organism":"AFNOR","number":"FIX-CPTE045","valid_until":"2029-01-15","status":"valid"}]'::jsonb,
 '81234567800095', 'active', 'fix-olivier-caron-59800', 'fix_59_lille_005',
 4.9, 87, 'claimed', true, false),

-- ===== Dieppe (76) — fondateur + équipe régionale =====
('Benjamin Bel', 'Dieppe', 'dieppe', '76200', '76', '12 quai Henri IV, 76200 Dieppe',
 49.9230, 1.0780,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI046","valid_until":"2029-09-23","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM046","valid_until":"2029-09-23","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"FIX-CPPL046","valid_until":"2029-09-23","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"FIX-CPGA046","valid_until":"2029-09-23","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"FIX-CPEL046","valid_until":"2029-09-23","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"FIX-CPTE046","valid_until":"2029-09-23","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"FIX-CPCA046","valid_until":"2029-09-23","status":"valid"},{"type":"ERP","organism":"BUREAU_VERITAS","number":"FIX-CPER046","valid_until":"2029-09-23","status":"valid"}]'::jsonb,
 '81234567800101', 'active', 'fix-benjamin-bel-76200', 'fix_76_dieppe_001',
 5.0, 156, 'claimed', true, false),

('Sandrine Lecoq', 'Dieppe', 'dieppe', '76200', '76', '45 grande rue, 76200 Dieppe',
 49.9270, 1.0830,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI047","valid_until":"2028-06-04","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM047","valid_until":"2028-06-04","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"FIX-CPPL047","valid_until":"2028-06-04","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE047","valid_until":"2028-06-04","status":"valid"}]'::jsonb,
 '81234567800102', 'active', 'fix-sandrine-lecoq-76200', 'fix_76_dieppe_002',
 4.7, 49, 'unclaimed', true, false),

('Christophe Hauchard', 'Dieppe', 'dieppe', '76370', '76', '8 rue de la Marne, 76370 Neuville-les-Dieppe',
 49.9180, 1.0890,
 '[{"type":"DPE","organism":"AFNOR","number":"FIX-CPDI048","valid_until":"2029-03-17","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"FIX-CPGA048","valid_until":"2029-03-17","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"FIX-CPEL048","valid_until":"2029-03-17","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"FIX-CPCA048","valid_until":"2029-03-17","status":"valid"}]'::jsonb,
 '81234567800103', 'active', 'fix-christophe-hauchard-76370', 'fix_76_dieppe_003',
 4.6, 37, 'unclaimed', true, false),

('Veronique Pichard', 'Dieppe', 'dieppe', '76550', '76', '12 rue de la Gare, 76550 Offranville',
 49.8770, 1.0510,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"FIX-CPDI049","valid_until":"2027-11-08","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"FIX-CPAM049","valid_until":"2027-11-08","status":"valid"},{"type":"ERP","organism":"BUREAU_VERITAS","number":"FIX-CPER049","valid_until":"2027-11-08","status":"valid"}]'::jsonb,
 '81234567800104', 'active', 'fix-veronique-pichard-76550', 'fix_76_dieppe_004',
 4.5, 26, 'unclaimed', true, false),

('Gilles Rocher', 'Dieppe', 'dieppe', '76630', '76', '5 rue du Bourg, 76630 Envermeu',
 49.8970, 1.2670,
 '[{"type":"DPE","organism":"I_CERT","number":"FIX-CPDI050","valid_until":"2028-08-29","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"FIX-CPPL050","valid_until":"2028-08-29","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"FIX-CPTE050","valid_until":"2028-08-29","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"FIX-CPGA050","valid_until":"2028-08-29","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"FIX-CPAM050","valid_until":"2028-08-29","status":"valid"}]'::jsonb,
 '81234567800105', 'active', 'fix-gilles-rocher-76630', 'fix_76_dieppe_005',
 4.8, 62, 'unclaimed', true, false);

-- ============================================
-- Fin seed FIX-D : 50 diagnostiqueurs sur 10 villes
-- Vérification rapide :
--   SELECT count(*) FROM diagnosticians WHERE dhup_source_id LIKE 'fix_%';   -- 50
--   SELECT city_slug, count(*) FROM diagnosticians WHERE dhup_source_id LIKE 'fix_%' GROUP BY 1 ORDER BY 1;
-- ============================================
