-- ============================================
-- KOVAS — Seed mock annuaire diagnostiqueurs (50 fiches FR)
-- Usage : exécuter manuellement en local/staging tant que
--         DHUP_RESOURCE_URL n'est pas configuree (cf. Edge Function
--         import-dhup-annuaire).
--
-- ATTENTION : données 100 % fictives. Aucune correspondance avec des
-- personnes réelles. Ne PAS exécuter en production sans bascule sur
-- l'import DHUP officiel.
--
-- Répartition geographique :
--   Paris (75)           x10
--   Marseille (13)       x5
--   Lyon (69)            x5
--   Toulouse (31)        x4
--   Bordeaux (33)        x3
--   Lille (59)           x3
--   Rouen (76)           x3
--   Nantes (44)          x3
--   Dieppe (76)          x1  (Benjamin Bel — fondateur, fiche test)
--   Autres villes        x13 (Strasbourg, Nice, Rennes, Montpellier,
--                              Grenoble, Reims, Brest, Tours, Le Havre,
--                              Dijon, Limoges, Caen, Clermont-Ferrand)
-- ============================================

-- Reset (idempotent) — uniquement les fiches mock (dhup_source_id 'mock_*')
DELETE FROM diagnosticians WHERE dhup_source_id LIKE 'mock_%';

INSERT INTO diagnosticians
  (first_name, last_name, city, postal_code, department_code, geo_lat, geo_lng,
   certifications, official_email, official_phone, official_company_name,
   slug, slug_city, slug_dept, dhup_source_id, dhup_imported_at)
VALUES
-- ===== Paris (75) — 10 =====
('Camille', 'Lefevre', 'Paris', '75001', '75', 48.8625, 2.3360,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0001","valid_until":"2028-06-30","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"CPAM0001","valid_until":"2028-06-30","status":"valid"}]'::jsonb,
 'c.lefevre@diag-paris.fr', '+33142960001', 'Diag Paris 1',
 'camille-lefevre-75001', 'paris', 'paris', 'mock_75001_lefevre_camille', now()),

('Thomas', 'Bernard', 'Paris', '75008', '75', 48.8722, 2.3072,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0002","valid_until":"2027-12-31","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"CPGA0002","valid_until":"2027-12-31","status":"valid"}]'::jsonb,
 't.bernard@diag-haussmann.fr', '+33145620002', 'Diag Haussmann',
 'thomas-bernard-75008', 'paris', 'paris', 'mock_75008_bernard_thomas', now()),

('Lucie', 'Moreau', 'Paris', '75011', '75', 48.8589, 2.3795,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0003","valid_until":"2029-03-15","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"CPEL0003","valid_until":"2029-03-15","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"CPPL0003","valid_until":"2029-03-15","status":"valid"}]'::jsonb,
 'l.moreau@diagbastille.fr', '+33143570003', 'Diag Bastille',
 'lucie-moreau-75011', 'paris', 'paris', 'mock_75011_moreau_lucie', now()),

('Antoine', 'Dubois', 'Paris', '75015', '75', 48.8410, 2.2980,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0004","valid_until":"2028-09-22","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"CPAM0004","valid_until":"2028-09-22","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"CPTE0004","valid_until":"2028-09-22","status":"valid"}]'::jsonb,
 'a.dubois@diag-vaugirard.fr', '+33145320004', 'Vaugirard Diagnostics',
 'antoine-dubois-75015', 'paris', 'paris', 'mock_75015_dubois_antoine', now()),

('Marie', 'Petit', 'Paris', '75018', '75', 48.8920, 2.3450,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0005","valid_until":"2027-08-01","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"CPCA0005","valid_until":"2027-08-01","status":"valid"}]'::jsonb,
 'm.petit@diag-montmartre.fr', '+33142540005', 'Montmartre Diagnostic',
 'marie-petit-75018', 'paris', 'paris', 'mock_75018_petit_marie', now()),

('Julien', 'Roux', 'Paris', '75020', '75', 48.8631, 2.4000,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0006","valid_until":"2029-01-12","status":"valid"},{"type":"ERP","organism":"AFNOR","number":"CPER0006","valid_until":"2029-01-12","status":"valid"}]'::jsonb,
 'j.roux@diag-belleville.fr', '+33143660006', 'Belleville Expertises',
 'julien-roux-75020', 'paris', 'paris', 'mock_75020_roux_julien', now()),

('Sophie', 'Garnier', 'Paris', '75009', '75', 48.8767, 2.3373,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0007","valid_until":"2028-05-20","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"CPGA0007","valid_until":"2028-05-20","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"CPEL0007","valid_until":"2028-05-20","status":"valid"}]'::jsonb,
 's.garnier@diag-opera.fr', '+33148780007', 'Diag Opera',
 'sophie-garnier-75009', 'paris', 'paris', 'mock_75009_garnier_sophie', now()),

('Pierre', 'Fontaine', 'Paris', '75013', '75', 48.8290, 2.3550,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0008","valid_until":"2027-11-30","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"CPAM0008","valid_until":"2027-11-30","status":"valid"}]'::jsonb,
 'p.fontaine@diag-tolbiac.fr', '+33145830008', 'Tolbiac Diag',
 'pierre-fontaine-75013', 'paris', 'paris', 'mock_75013_fontaine_pierre', now()),

('Elodie', 'Chevalier', 'Paris', '75017', '75', 48.8870, 2.3170,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0009","valid_until":"2029-02-28","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"CPCA0009","valid_until":"2029-02-28","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"CPPL0009","valid_until":"2029-02-28","status":"valid"}]'::jsonb,
 'e.chevalier@diag-batignolles.fr', '+33142270009', 'Batignolles Conseil',
 'elodie-chevalier-75017', 'paris', 'paris', 'mock_75017_chevalier_elodie', now()),

('Nicolas', 'Faure', 'Paris', '75019', '75', 48.8830, 2.3870,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0010","valid_until":"2028-07-10","status":"valid"}]'::jsonb,
 'n.faure@diag-buttes.fr', '+33142450010', 'Buttes Chaumont Diag',
 'nicolas-faure-75019', 'paris', 'paris', 'mock_75019_faure_nicolas', now()),

-- ===== Marseille (13) — 5 =====
('Aurelie', 'Martinez', 'Marseille', '13001', '13', 43.2965, 5.3760,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0011","valid_until":"2028-04-15","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"CPTE0011","valid_until":"2028-04-15","status":"valid"}]'::jsonb,
 'a.martinez@diag-marseille.fr', '+33491550011', 'Diag Vieux-Port',
 'aurelie-martinez-13001', 'marseille', 'bouches-du-rhone', 'mock_13001_martinez_aurelie', now()),

('Frederic', 'Lopez', 'Marseille', '13008', '13', 43.2660, 5.3870,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0012","valid_until":"2027-10-05","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"CPAM0012","valid_until":"2027-10-05","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"CPPL0012","valid_until":"2027-10-05","status":"valid"}]'::jsonb,
 'f.lopez@diag-prado.fr', '+33491230012', 'Diag Prado',
 'frederic-lopez-13008', 'marseille', 'bouches-du-rhone', 'mock_13008_lopez_frederic', now()),

('Caroline', 'Rey', 'Marseille', '13006', '13', 43.2880, 5.3820,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0013","valid_until":"2029-06-30","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"CPCA0013","valid_until":"2029-06-30","status":"valid"}]'::jsonb,
 'c.rey@diag-castellane.fr', '+33491770013', 'Castellane Diagnostic',
 'caroline-rey-13006', 'marseille', 'bouches-du-rhone', 'mock_13006_rey_caroline', now()),

('Vincent', 'Olivier', 'Marseille', '13012', '13', 43.3050, 5.4150,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0014","valid_until":"2028-11-20","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"CPGA0014","valid_until":"2028-11-20","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"CPEL0014","valid_until":"2028-11-20","status":"valid"}]'::jsonb,
 'v.olivier@diag-saintbarnabe.fr', '+33491880014', 'Saint-Barnabe Expertises',
 'vincent-olivier-13012', 'marseille', 'bouches-du-rhone', 'mock_13012_olivier_vincent', now()),

('Sandrine', 'Blanc', 'Marseille', '13009', '13', 43.2480, 5.4080,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0015","valid_until":"2027-09-12","status":"valid"},{"type":"ERP","organism":"BUREAU_VERITAS","number":"CPER0015","valid_until":"2027-09-12","status":"valid"}]'::jsonb,
 's.blanc@diag-mazargues.fr', '+33491400015', 'Mazargues Diag',
 'sandrine-blanc-13009', 'marseille', 'bouches-du-rhone', 'mock_13009_blanc_sandrine', now()),

-- ===== Lyon (69) — 5 =====
('David', 'Roussel', 'Lyon', '69002', '69', 45.7484, 4.8295,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0016","valid_until":"2028-08-08","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"CPAM0016","valid_until":"2028-08-08","status":"valid"}]'::jsonb,
 'd.roussel@diag-presqu-ile.fr', '+33472100016', 'Diag Presqu-ile',
 'david-roussel-69002', 'lyon', 'rhone', 'mock_69002_roussel_david', now()),

('Isabelle', 'Vidal', 'Lyon', '69006', '69', 45.7700, 4.8550,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0017","valid_until":"2029-04-22","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"CPCA0017","valid_until":"2029-04-22","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"CPPL0017","valid_until":"2029-04-22","status":"valid"}]'::jsonb,
 'i.vidal@diag-foch.fr', '+33478890017', 'Foch Diagnostics',
 'isabelle-vidal-69006', 'lyon', 'rhone', 'mock_69006_vidal_isabelle', now()),

('Olivier', 'Renard', 'Lyon', '69007', '69', 45.7480, 4.8420,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0018","valid_until":"2027-12-15","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"CPGA0018","valid_until":"2027-12-15","status":"valid"}]'::jsonb,
 'o.renard@diag-guillotiere.fr', '+33472610018', 'Guillotiere Conseil',
 'olivier-renard-69007', 'lyon', 'rhone', 'mock_69007_renard_olivier', now()),

('Christelle', 'Brunet', 'Lyon', '69003', '69', 45.7600, 4.8540,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0019","valid_until":"2028-05-30","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"CPEL0019","valid_until":"2028-05-30","status":"valid"},{"type":"TERMITES","organism":"AFNOR","number":"CPTE0019","valid_until":"2028-05-30","status":"valid"}]'::jsonb,
 'c.brunet@diag-partdieu.fr', '+33472340019', 'Part-Dieu Diag',
 'christelle-brunet-69003', 'lyon', 'rhone', 'mock_69003_brunet_christelle', now()),

('Yann', 'Carre', 'Lyon', '69008', '69', 45.7370, 4.8700,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0020","valid_until":"2029-07-18","status":"valid"},{"type":"ERP","organism":"I_CERT","number":"CPER0020","valid_until":"2029-07-18","status":"valid"}]'::jsonb,
 'y.carre@diag-monplaisir.fr', '+33478690020', 'Monplaisir Expertises',
 'yann-carre-69008', 'lyon', 'rhone', 'mock_69008_carre_yann', now()),

-- ===== Toulouse (31) — 4 =====
('Bruno', 'Lambert', 'Toulouse', '31000', '31', 43.6045, 1.4440,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0021","valid_until":"2028-03-25","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"CPAM0021","valid_until":"2028-03-25","status":"valid"}]'::jsonb,
 'b.lambert@diag-capitole.fr', '+33561120021', 'Capitole Diagnostics',
 'bruno-lambert-31000', 'toulouse', 'haute-garonne', 'mock_31000_lambert_bruno', now()),

('Helene', 'Perrin', 'Toulouse', '31300', '31', 43.6100, 1.4150,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0022","valid_until":"2029-09-14","status":"valid"},{"type":"CARREZ","organism":"AFNOR","number":"CPCA0022","valid_until":"2029-09-14","status":"valid"}]'::jsonb,
 'h.perrin@diag-purpan.fr', '+33561430022', 'Purpan Diag',
 'helene-perrin-31300', 'toulouse', 'haute-garonne', 'mock_31300_perrin_helene', now()),

('Stephane', 'Andre', 'Toulouse', '31500', '31', 43.6240, 1.4660,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0023","valid_until":"2027-11-08","status":"valid"},{"type":"GAZ","organism":"I_CERT","number":"CPGA0023","valid_until":"2027-11-08","status":"valid"},{"type":"ELECTRICITE","organism":"I_CERT","number":"CPEL0023","valid_until":"2027-11-08","status":"valid"}]'::jsonb,
 's.andre@diag-bonnefoy.fr', '+33561580023', 'Bonnefoy Expertises',
 'stephane-andre-31500', 'toulouse', 'haute-garonne', 'mock_31500_andre_stephane', now()),

('Patricia', 'Gauthier', 'Toulouse', '31400', '31', 43.5810, 1.4520,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0024","valid_until":"2028-12-01","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"CPTE0024","valid_until":"2028-12-01","status":"valid"},{"type":"ERP","organism":"BUREAU_VERITAS","number":"CPER0024","valid_until":"2028-12-01","status":"valid"}]'::jsonb,
 'p.gauthier@diag-rangueil.fr', '+33561520024', 'Rangueil Conseil',
 'patricia-gauthier-31400', 'toulouse', 'haute-garonne', 'mock_31400_gauthier_patricia', now()),

-- ===== Bordeaux (33) — 3 =====
('Mathieu', 'Roy', 'Bordeaux', '33000', '33', 44.8378, -0.5792,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0025","valid_until":"2028-06-17","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"CPAM0025","valid_until":"2028-06-17","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"CPPL0025","valid_until":"2028-06-17","status":"valid"}]'::jsonb,
 'm.roy@diag-chartrons.fr', '+33556810025', 'Chartrons Diag',
 'mathieu-roy-33000', 'bordeaux', 'gironde', 'mock_33000_roy_mathieu', now()),

('Valerie', 'Guillaume', 'Bordeaux', '33200', '33', 44.8520, -0.6080,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0026","valid_until":"2029-02-14","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"CPCA0026","valid_until":"2029-02-14","status":"valid"}]'::jsonb,
 'v.guillaume@diag-caudera.fr', '+33556470026', 'Caudera Conseil',
 'valerie-guillaume-33200', 'bordeaux', 'gironde', 'mock_33200_guillaume_valerie', now()),

('Romain', 'Robin', 'Bordeaux', '33800', '33', 44.8200, -0.5650,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0027","valid_until":"2027-10-29","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"CPGA0027","valid_until":"2027-10-29","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"CPEL0027","valid_until":"2027-10-29","status":"valid"}]'::jsonb,
 'r.robin@diag-saintjean.fr', '+33556910027', 'Saint-Jean Diagnostic',
 'romain-robin-33800', 'bordeaux', 'gironde', 'mock_33800_robin_romain', now()),

-- ===== Lille (59) — 3 =====
('Anne', 'Henry', 'Lille', '59000', '59', 50.6292, 3.0573,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0028","valid_until":"2028-07-25","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"CPAM0028","valid_until":"2028-07-25","status":"valid"}]'::jsonb,
 'a.henry@diag-vauban.fr', '+33320350028', 'Vauban Diag',
 'anne-henry-59000', 'lille', 'nord', 'mock_59000_henry_anne', now()),

('Jerome', 'Schmitt', 'Lille', '59800', '59', 50.6400, 3.0700,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0029","valid_until":"2029-05-11","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"CPCA0029","valid_until":"2029-05-11","status":"valid"},{"type":"ERP","organism":"I_CERT","number":"CPER0029","valid_until":"2029-05-11","status":"valid"}]'::jsonb,
 'j.schmitt@diag-vieux-lille.fr', '+33320720029', 'Vieux-Lille Expertises',
 'jerome-schmitt-59800', 'lille', 'nord', 'mock_59800_schmitt_jerome', now()),

('Beatrice', 'Lopez', 'Lille', '59000', '59', 50.6200, 3.0500,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0030","valid_until":"2028-04-02","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"CPPL0030","valid_until":"2028-04-02","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"CPTE0030","valid_until":"2028-04-02","status":"valid"}]'::jsonb,
 'b.lopez@diag-wazemmes.fr', '+33320990030', 'Wazemmes Diag',
 'beatrice-lopez-59000', 'lille', 'nord', 'mock_59000_lopez_beatrice', now()),

-- ===== Rouen (76) — 3 =====
('Cedric', 'Boyer', 'Rouen', '76000', '76', 49.4432, 1.0993,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0031","valid_until":"2028-09-30","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"CPAM0031","valid_until":"2028-09-30","status":"valid"}]'::jsonb,
 'c.boyer@diag-rouen.fr', '+33235710031', 'Diag Cathedrale',
 'cedric-boyer-76000', 'rouen', 'seine-maritime', 'mock_76000_boyer_cedric', now()),

('Severine', 'Marchand', 'Rouen', '76100', '76', 49.4280, 1.0900,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0032","valid_until":"2029-08-19","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"CPGA0032","valid_until":"2029-08-19","status":"valid"},{"type":"ELECTRICITE","organism":"AFNOR","number":"CPEL0032","valid_until":"2029-08-19","status":"valid"}]'::jsonb,
 's.marchand@diag-saintsever.fr', '+33235800032', 'Saint-Sever Conseil',
 'severine-marchand-76100', 'rouen', 'seine-maritime', 'mock_76100_marchand_severine', now()),

('Laurent', 'Dupuis', 'Rouen', '76000', '76', 49.4500, 1.1100,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0033","valid_until":"2027-12-21","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"CPCA0033","valid_until":"2027-12-21","status":"valid"}]'::jsonb,
 'l.dupuis@diag-mont-gargan.fr', '+33235070033', 'Mont-Gargan Diag',
 'laurent-dupuis-76000', 'rouen', 'seine-maritime', 'mock_76000_dupuis_laurent', now()),

-- ===== Nantes (44) — 3 =====
('Claire', 'Joly', 'Nantes', '44000', '44', 47.2184, -1.5536,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0034","valid_until":"2028-11-05","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"CPAM0034","valid_until":"2028-11-05","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"CPPL0034","valid_until":"2028-11-05","status":"valid"}]'::jsonb,
 'c.joly@diag-graslin.fr', '+33240210034', 'Graslin Expertises',
 'claire-joly-44000', 'nantes', 'loire-atlantique', 'mock_44000_joly_claire', now()),

('Mickael', 'Picard', 'Nantes', '44300', '44', 47.2540, -1.5390,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0035","valid_until":"2029-01-28","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"CPTE0035","valid_until":"2029-01-28","status":"valid"}]'::jsonb,
 'm.picard@diag-erdre.fr', '+33240380035', 'Erdre Diagnostic',
 'mickael-picard-44300', 'nantes', 'loire-atlantique', 'mock_44300_picard_mickael', now()),

('Sylvie', 'Aubert', 'Nantes', '44100', '44', 47.2100, -1.5800,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0036","valid_until":"2028-06-09","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"CPGA0036","valid_until":"2028-06-09","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"CPEL0036","valid_until":"2028-06-09","status":"valid"}]'::jsonb,
 's.aubert@diag-chantenay.fr', '+33240500036', 'Chantenay Conseil',
 'sylvie-aubert-44100', 'nantes', 'loire-atlantique', 'mock_44100_aubert_sylvie', now()),

-- ===== Dieppe (76) — Benjamin Bel (fiche fondateur, test) =====
('Benjamin', 'Bel', 'Dieppe', '76200', '76', 49.9229, 1.0784,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0037","valid_until":"2029-12-31","status":"valid"},{"type":"AMIANTE","organism":"BUREAU_VERITAS","number":"CPAM0037","valid_until":"2029-12-31","status":"valid"},{"type":"PLOMB","organism":"BUREAU_VERITAS","number":"CPPL0037","valid_until":"2029-12-31","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"CPGA0037","valid_until":"2029-12-31","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"CPEL0037","valid_until":"2029-12-31","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"CPTE0037","valid_until":"2029-12-31","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"CPCA0037","valid_until":"2029-12-31","status":"valid"},{"type":"ERP","organism":"BUREAU_VERITAS","number":"CPER0037","valid_until":"2029-12-31","status":"valid"}]'::jsonb,
 'benjamin@nexus1993.fr', '+33232140037', 'Nexus 1993',
 'benjamin-bel-76200', 'dieppe', 'seine-maritime', 'mock_76200_bel_benjamin', now()),

-- ===== Autres villes — 13 =====
-- Strasbourg (67)
('Eric', 'Schneider', 'Strasbourg', '67000', '67', 48.5734, 7.7521,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0038","valid_until":"2028-08-13","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"CPAM0038","valid_until":"2028-08-13","status":"valid"}]'::jsonb,
 'e.schneider@diag-strasbourg.fr', '+33388350038', 'Diag Petite France',
 'eric-schneider-67000', 'strasbourg', 'bas-rhin', 'mock_67000_schneider_eric', now()),

-- Nice (06)
('Manon', 'Riviere', 'Nice', '06000', '06', 43.7102, 7.2620,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0039","valid_until":"2029-03-07","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"CPCA0039","valid_until":"2029-03-07","status":"valid"},{"type":"TERMITES","organism":"I_CERT","number":"CPTE0039","valid_until":"2029-03-07","status":"valid"}]'::jsonb,
 'm.riviere@diag-nice.fr', '+33493870039', 'Diag Promenade',
 'manon-riviere-06000', 'nice', 'alpes-maritimes', 'mock_06000_riviere_manon', now()),

-- Rennes (35)
('Gilles', 'Hamon', 'Rennes', '35000', '35', 48.1173, -1.6778,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0040","valid_until":"2028-10-19","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"CPEL0040","valid_until":"2028-10-19","status":"valid"}]'::jsonb,
 'g.hamon@diag-rennes.fr', '+33299040040', 'Diag Parlement',
 'gilles-hamon-35000', 'rennes', 'ille-et-vilaine', 'mock_35000_hamon_gilles', now()),

-- Montpellier (34)
('Florence', 'Rouge', 'Montpellier', '34000', '34', 43.6109, 3.8772,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0041","valid_until":"2029-07-02","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"CPGA0041","valid_until":"2029-07-02","status":"valid"},{"type":"PLOMB","organism":"AFNOR","number":"CPPL0041","valid_until":"2029-07-02","status":"valid"}]'::jsonb,
 'f.rouge@diag-ecusson.fr', '+33467630041', 'Ecusson Diag',
 'florence-rouge-34000', 'montpellier', 'herault', 'mock_34000_rouge_florence', now()),

-- Grenoble (38)
('Hugo', 'Charpentier', 'Grenoble', '38000', '38', 45.1885, 5.7245,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0042","valid_until":"2028-12-16","status":"valid"},{"type":"AMIANTE","organism":"I_CERT","number":"CPAM0042","valid_until":"2028-12-16","status":"valid"}]'::jsonb,
 'h.charpentier@diag-grenoble.fr', '+33476460042', 'Diag Bastille Grenoble',
 'hugo-charpentier-38000', 'grenoble', 'isere', 'mock_38000_charpentier_hugo', now()),

-- Reims (51)
('Karine', 'Bouvier', 'Reims', '51100', '51', 49.2583, 4.0317,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0043","valid_until":"2027-11-23","status":"valid"},{"type":"ERP","organism":"BUREAU_VERITAS","number":"CPER0043","valid_until":"2027-11-23","status":"valid"}]'::jsonb,
 'k.bouvier@diag-reims.fr', '+33326510043', 'Champagne Diag',
 'karine-bouvier-51100', 'reims', 'marne', 'mock_51100_bouvier_karine', now()),

-- Brest (29)
('Alain', 'Tanguy', 'Brest', '29200', '29', 48.3904, -4.4861,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0044","valid_until":"2028-05-04","status":"valid"},{"type":"TERMITES","organism":"AFNOR","number":"CPTE0044","valid_until":"2028-05-04","status":"valid"}]'::jsonb,
 'a.tanguy@diag-brest.fr', '+33298440044', 'Iroise Diagnostic',
 'alain-tanguy-29200', 'brest', 'finistere', 'mock_29200_tanguy_alain', now()),

-- Tours (37)
('Catherine', 'Lemoine', 'Tours', '37000', '37', 47.3941, 0.6848,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0045","valid_until":"2029-04-08","status":"valid"},{"type":"CARREZ","organism":"I_CERT","number":"CPCA0045","valid_until":"2029-04-08","status":"valid"}]'::jsonb,
 'c.lemoine@diag-tours.fr', '+33247200045', 'Diag Loire',
 'catherine-lemoine-37000', 'tours', 'indre-et-loire', 'mock_37000_lemoine_catherine', now()),

-- Le Havre (76)
('Philippe', 'Cordier', 'Le Havre', '76600', '76', 49.4944, 0.1079,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0046","valid_until":"2028-02-26","status":"valid"},{"type":"GAZ","organism":"BUREAU_VERITAS","number":"CPGA0046","valid_until":"2028-02-26","status":"valid"},{"type":"ELECTRICITE","organism":"BUREAU_VERITAS","number":"CPEL0046","valid_until":"2028-02-26","status":"valid"}]'::jsonb,
 'p.cordier@diag-lehavre.fr', '+33235220046', 'Port Diagnostics',
 'philippe-cordier-76600', 'le-havre', 'seine-maritime', 'mock_76600_cordier_philippe', now()),

-- Dijon (21)
('Sabrina', 'Marty', 'Dijon', '21000', '21', 47.3220, 5.0415,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0047","valid_until":"2029-06-21","status":"valid"},{"type":"AMIANTE","organism":"AFNOR","number":"CPAM0047","valid_until":"2029-06-21","status":"valid"}]'::jsonb,
 's.marty@diag-dijon.fr', '+33380780047', 'Bourgogne Diag',
 'sabrina-marty-21000', 'dijon', 'cote-dor', 'mock_21000_marty_sabrina', now()),

-- Limoges (87)
('Damien', 'Brun', 'Limoges', '87000', '87', 45.8336, 1.2611,
 '[{"type":"DPE","organism":"I_CERT","number":"CPDI0048","valid_until":"2028-09-15","status":"valid"},{"type":"PLOMB","organism":"I_CERT","number":"CPPL0048","valid_until":"2028-09-15","status":"valid"}]'::jsonb,
 'd.brun@diag-limoges.fr', '+33555340048', 'Diag Porcelaine',
 'damien-brun-87000', 'limoges', 'haute-vienne', 'mock_87000_brun_damien', now()),

-- Caen (14)
('Adeline', 'Leclerc', 'Caen', '14000', '14', 49.1829, -0.3707,
 '[{"type":"DPE","organism":"BUREAU_VERITAS","number":"CPDI0049","valid_until":"2027-10-12","status":"valid"},{"type":"CARREZ","organism":"BUREAU_VERITAS","number":"CPCA0049","valid_until":"2027-10-12","status":"valid"},{"type":"TERMITES","organism":"BUREAU_VERITAS","number":"CPTE0049","valid_until":"2027-10-12","status":"valid"}]'::jsonb,
 'a.leclerc@diag-caen.fr', '+33231860049', 'Diag Memorial',
 'adeline-leclerc-14000', 'caen', 'calvados', 'mock_14000_leclerc_adeline', now()),

-- Clermont-Ferrand (63)
('Xavier', 'Mercier', 'Clermont-Ferrand', '63000', '63', 45.7772, 3.0870,
 '[{"type":"DPE","organism":"AFNOR","number":"CPDI0050","valid_until":"2028-07-08","status":"valid"},{"type":"ERP","organism":"AFNOR","number":"CPER0050","valid_until":"2028-07-08","status":"valid"},{"type":"GAZ","organism":"AFNOR","number":"CPGA0050","valid_until":"2028-07-08","status":"valid"}]'::jsonb,
 'x.mercier@diag-clermont.fr', '+33473420050', 'Auvergne Diag',
 'xavier-mercier-63000', 'clermont-ferrand', 'puy-de-dome', 'mock_63000_mercier_xavier', now());

-- ============================================
-- Verification post-seed (optionnel)
-- ============================================
-- SELECT department_code, count(*) FROM diagnosticians
--   WHERE dhup_source_id LIKE 'mock_%' GROUP BY department_code ORDER BY 1;
