-- ============================================
-- KOVAS — Adresse complète sur clients (facturation / siège cabinet)
-- Aligné sur properties.apartment_detail, building_letter, floor_number
-- ============================================

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS apartment_detail text,
  ADD COLUMN IF NOT EXISTS floor_number int,
  ADD COLUMN IF NOT EXISTS building_letter text,
  ADD COLUMN IF NOT EXISTS address_complement text;

COMMENT ON COLUMN clients.apartment_detail IS
  'N° appartement, porte, local — ex « Apt 12B », « 3ème gauche »';
COMMENT ON COLUMN clients.floor_number IS 'Étage (0 = RDC, -1 = sous-sol)';
COMMENT ON COLUMN clients.building_letter IS 'Bâtiment / entrée — ex « A », « B »';
COMMENT ON COLUMN clients.address_complement IS
  'Complément libre — résidence, BP, digicode courrier, etc.';
