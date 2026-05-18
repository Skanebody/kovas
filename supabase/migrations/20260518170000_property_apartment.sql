-- ============================================
-- KOVAS — Détails appartement / immeuble sur properties
-- Cf. user feedback J18 — diagnostics en immeuble nécessitent
-- numéro d'appartement / bâtiment / étage / lot copro
-- ============================================

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS apartment_detail text,
  ADD COLUMN IF NOT EXISTS floor_number int,
  ADD COLUMN IF NOT EXISTS building_letter text,
  ADD COLUMN IF NOT EXISTS lot_number text;

COMMENT ON COLUMN properties.apartment_detail IS
  'Texte libre — ex "Apt 12B", "Lot 23, 3ème étage", "Bât. C apt 5". Concaténé à l''adresse pour exports.';
COMMENT ON COLUMN properties.floor_number IS 'Étage (0 = RDC, -1 = sous-sol, 4 = 4e étage)';
COMMENT ON COLUMN properties.building_letter IS 'Bâtiment dans une résidence (ex "A", "B", "C")';
COMMENT ON COLUMN properties.lot_number IS 'Numéro de lot copropriété (ex "1234")';
