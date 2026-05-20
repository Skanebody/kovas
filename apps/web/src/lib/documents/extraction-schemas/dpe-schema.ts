/**
 * KOVAS — Schéma Zod : extraction DPE (Diagnostic de Performance Énergétique).
 *
 * Source du brief Document Intelligence V1.5. Champs définis pour cibler le
 * format DPE 3CL-2021 (ADEME) — version la plus récente, la majorité des DPEs
 * antérieurs étant maintenant invalides ou en fin de validité.
 *
 * Utilisé par `document-extractors/dpe-extractor.ts` (Claude Sonnet vision)
 * pour parser le JSON retourné par le modèle de manière stricte (zéro any).
 */

import { z } from 'zod'

const EnergyClassEnum = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

const ConfidenceByFieldSchema = z.record(z.string(), z.number().int().min(0).max(100))

export const DpeExtractionSchema = z.object({
  // Métadonnées du DPE
  realizationDate: z.string().nullable(), // ISO YYYY-MM-DD
  diagnosticianName: z.string().nullable(),
  diagnosticianCompany: z.string().nullable(),
  diagnosticianCertificate: z.string().nullable(),
  dpeNumber: z.string().nullable(),

  // Bien immobilier
  propertyAddress: z.string().nullable(),
  propertyType: z
    .enum(['maison', 'appartement', 'immeuble', 'local_commercial', 'bureau', 'autre'])
    .nullable(),
  constructionYear: z.number().int().min(1700).max(2100).nullable(),
  habitableSurface: z.number().positive().nullable(),

  // Performance énergétique
  energyClass: EnergyClassEnum.nullable(),
  energyConsumption: z.number().nonnegative().nullable(), // kWh/m²/an
  gesClass: EnergyClassEnum.nullable(),
  gesEmissions: z.number().nonnegative().nullable(), // kgCO2/m²/an

  // Équipements chauffage
  heatingType: z
    .enum([
      'gaz',
      'fioul',
      'electrique',
      'pompe_chaleur',
      'bois',
      'reseau_chaleur',
      'mixte',
      'autre',
    ])
    .nullable(),
  heatingBrand: z.string().nullable(),
  heatingModel: z.string().nullable(),
  heatingYear: z.number().int().min(1900).max(2100).nullable(),

  // Eau chaude sanitaire
  hotWaterType: z
    .enum(['gaz', 'electrique', 'pompe_chaleur', 'solaire', 'mixte', 'autre'])
    .nullable(),
  hotWaterBrand: z.string().nullable(),
  hotWaterYear: z.number().int().min(1900).max(2100).nullable(),

  // Ventilation
  ventilationType: z
    .enum(['naturelle', 'vmc_simple_flux', 'vmc_double_flux', 'vmc_hygro', 'absente', 'autre'])
    .nullable(),

  // Confidence par champ (0-100)
  confidenceByField: ConfidenceByFieldSchema,
})

export type DpeExtraction = z.infer<typeof DpeExtractionSchema>
