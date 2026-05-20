/**
 * KOVAS — Document Intelligence : routing par seuil de confiance.
 *
 * Règles V1.5 (alignées sur CLAUDE.md §3 feature 6 + UX écrans review) :
 *   - ≥ 90 → auto-validated  : pré-remplit le dossier sans confirmation user
 *   - 70-89 → to_verify       : pré-remplit MAIS demande confirmation user
 *   - < 70  → ignored         : non importé (le user peut éditer manuellement)
 *
 * Le caller (route API /prefill) applique ensuite ces décisions sur
 * dossier_field_values en UPSERT (cf. lib/mission/vision-analyzer.ts pour le
 * pattern de UPSERT respectueux de validated_by_user).
 */

import type { BackendDocumentType, ConfidenceMap } from './backend-types'

export interface PrefilledField {
  /** Chemin canonique dans le dossier (ex 'property.surface_total'). */
  fieldPath: string
  value: unknown
  /** Confidence 0-100 (entier). */
  confidence: number
  /** Document d'origine (UUID). */
  sourceDocumentId: string
}

export interface PrefillResult {
  /** Champs ≥ 90% confiance — pré-remplis sans confirmation. */
  autoValidated: PrefilledField[]
  /** Champs 70-89% — à confirmer par le user. */
  toVerify: PrefilledField[]
  /** Champs < 70% — non importés (visibles dans UI pour édition manuelle). */
  ignored: PrefilledField[]
}

const AUTO_THRESHOLD = 90
const VERIFY_THRESHOLD = 70

/**
 * Route les champs extraits selon leur confidence + mapping document → dossier.
 *
 * @param extraction       résultat extraction (objet Zod-validé, contient les champs)
 * @param confidenceMap    map { extractedFieldName: confidence 0-100 }
 * @param documentId       UUID du document source
 * @param fieldMapping     map { extractedFieldName: dossierFieldPath }
 *                         (les fields absents du mapping sont ignorés)
 */
export function routeByConfidence(
  extraction: unknown,
  confidenceMap: ConfidenceMap,
  documentId: string,
  fieldMapping: Record<string, string>,
): PrefillResult {
  const result: PrefillResult = {
    autoValidated: [],
    toVerify: [],
    ignored: [],
  }

  if (typeof extraction !== 'object' || extraction === null) {
    return result
  }

  const data = extraction as Record<string, unknown>

  for (const [sourceKey, targetPath] of Object.entries(fieldMapping)) {
    const value = data[sourceKey]
    // Skip si la valeur est null/undefined (Claude n'a pas extrait ce champ)
    if (value === null || value === undefined) continue
    // Skip pour les map de confiance elles-mêmes
    if (sourceKey === 'confidenceByField') continue

    const confidence = confidenceMap[sourceKey] ?? 0

    const field: PrefilledField = {
      fieldPath: targetPath,
      value,
      confidence,
      sourceDocumentId: documentId,
    }

    if (confidence >= AUTO_THRESHOLD) {
      result.autoValidated.push(field)
    } else if (confidence >= VERIFY_THRESHOLD) {
      result.toVerify.push(field)
    } else {
      result.ignored.push(field)
    }
  }

  return result
}

// ============================================
// Field mappings par document_type
// ============================================
// Note : ces chemins ciblent les colonnes/champs canoniques KOVAS dossier.
// Convention :
//   - "property.X"  → properties.X (ou dossier_field_values.field_path)
//   - "dpe.X"        → dossier_field_values.diagnostic_type='DPE', field_path='X'
//   - "equipment.X"  → equipment_findings.X
//
// V1.5 : le caller route les "property.*" vers properties row, les "dpe.*" vers
// dossier_field_values (DPE), etc.

export const DPE_FIELD_MAPPING: Record<string, string> = {
  // Métadonnées DPE → diagnostic
  realizationDate: 'dpe.realization_date',
  diagnosticianName: 'dpe.diagnostician_name',
  diagnosticianCompany: 'dpe.diagnostician_company',
  diagnosticianCertificate: 'dpe.diagnostician_certificate',
  dpeNumber: 'dpe.dpe_number',

  // Bien
  propertyAddress: 'property.address',
  propertyType: 'property.property_type',
  constructionYear: 'property.year_built',
  habitableSurface: 'property.surface_total',

  // Performance
  energyClass: 'dpe.energy_class',
  energyConsumption: 'dpe.energy_consumption',
  gesClass: 'dpe.ges_class',
  gesEmissions: 'dpe.ges_emissions',

  // Équipements
  heatingType: 'dpe.heating_type',
  heatingBrand: 'equipment.heating_brand',
  heatingModel: 'equipment.heating_model',
  heatingYear: 'equipment.heating_year',
  hotWaterType: 'dpe.hot_water_type',
  hotWaterBrand: 'equipment.hot_water_brand',
  hotWaterYear: 'equipment.hot_water_year',
  ventilationType: 'dpe.ventilation_type',
}

export const CHAUDIERE_FIELD_MAPPING: Record<string, string> = {
  brand: 'equipment.heating_brand',
  model: 'equipment.heating_model',
  serialNumber: 'equipment.heating_serial',
  manufacturingYear: 'equipment.heating_manufacturing_year',
  installationYear: 'equipment.heating_year',
  powerKw: 'equipment.heating_power_kw',
  efficiency: 'equipment.heating_efficiency',
  energyType: 'equipment.heating_energy_type',
  type: 'equipment.heating_type_detail',
  ceCertification: 'equipment.heating_ce_certified',
}

export const FACTURE_ENERGIE_FIELD_MAPPING: Record<string, string> = {
  provider: 'energy.provider',
  energyType: 'energy.type',
  periodStart: 'energy.period_start',
  periodEnd: 'energy.period_end',
  consumptionKwh: 'energy.consumption_kwh',
  consumptionM3: 'energy.consumption_m3',
  estimatedAnnualConsumptionKwh: 'energy.estimated_annual_kwh',
  pricingType: 'energy.pricing_type',
  meterNumber: 'energy.meter_number',
  pdlNumber: 'energy.pdl_number',
}

export const PLAN_FIELD_MAPPING: Record<string, string> = {
  totalSurfaceM2: 'property.surface_total',
  planKind: 'plan.kind',
}

/**
 * Retourne le mapping correspondant au document_type.
 */
export function getFieldMapping(documentType: BackendDocumentType): Record<string, string> {
  switch (documentType) {
    case 'dpe':
      return DPE_FIELD_MAPPING
    case 'plaque_chaudiere':
      return CHAUDIERE_FIELD_MAPPING
    case 'facture_energie':
      return FACTURE_ENERGIE_FIELD_MAPPING
    case 'plan':
      return PLAN_FIELD_MAPPING
    default:
      return {}
  }
}
