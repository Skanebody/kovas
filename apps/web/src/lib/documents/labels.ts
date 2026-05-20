/**
 * KOVAS — Labels FR pour types de documents (Document Intelligence UI).
 */

import type { DocumentType } from './types'

/** Label court FR. */
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  dpe_anterior: 'DPE antérieur',
  boiler_plate: 'Plaque chaudière',
  energy_bill: 'Facture énergie',
  floor_plan: 'Plan du logement',
  property_deed: 'Acte de propriété',
  amiante_anterior: 'Diagnostic amiante antérieur',
  electrical_diagnosis: 'Diagnostic électricité',
  gas_diagnosis: 'Diagnostic gaz',
  lead_diagnosis: 'Diagnostic plomb (CREP)',
  termite_diagnosis: 'État termites',
  carrez_measurement: 'Mesurage Carrez',
  cadastral_extract: 'Extrait cadastral',
  building_permit: 'Permis de construire',
  invoice: 'Facture (travaux)',
  other: 'Autre document',
}

/** Emoji court pour cartouche visuelle. */
export const DOCUMENT_TYPE_EMOJI: Record<DocumentType, string> = {
  dpe_anterior: 'DPE',
  boiler_plate: 'CHA',
  energy_bill: 'NRG',
  floor_plan: 'PLN',
  property_deed: 'ACT',
  amiante_anterior: 'AMI',
  electrical_diagnosis: 'ELE',
  gas_diagnosis: 'GAZ',
  lead_diagnosis: 'PLB',
  termite_diagnosis: 'TER',
  carrez_measurement: 'CAR',
  cadastral_extract: 'CAD',
  building_permit: 'PCT',
  invoice: 'FAC',
  other: 'DOC',
}

/** Ordre canonique pour dropdowns. */
export const DOCUMENT_TYPE_ORDER: DocumentType[] = [
  'dpe_anterior',
  'boiler_plate',
  'energy_bill',
  'floor_plan',
  'property_deed',
  'amiante_anterior',
  'electrical_diagnosis',
  'gas_diagnosis',
  'lead_diagnosis',
  'termite_diagnosis',
  'carrez_measurement',
  'cadastral_extract',
  'building_permit',
  'invoice',
  'other',
]
