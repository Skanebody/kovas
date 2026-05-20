/**
 * KOVAS — Schéma Zod : extraction plaque signalétique chaudière.
 *
 * Cible : photos de plaques signalétiques (chaudière gaz, fioul, PAC, etc.)
 * prises par le diagnostiqueur lors d'une visite. Champs alignés sur les
 * informations réglementaires CE + DPE 3CL-2021.
 */

import { z } from 'zod'

const ConfidenceByFieldSchema = z.record(z.string(), z.number().int().min(0).max(100))

export const ChaudiereExtractionSchema = z.object({
  brand: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  manufacturingYear: z.number().int().min(1900).max(2100).nullable(),
  installationYear: z.number().int().min(1900).max(2100).nullable(),
  powerKw: z.number().nonnegative().nullable(),
  efficiency: z.number().min(0).max(2).nullable(), // ex 0.92 = 92 %, certaines PAC > 1
  energyType: z
    .enum(['gaz_naturel', 'gaz_propane', 'fioul', 'electrique', 'bois_buche', 'bois_granules'])
    .nullable(),
  type: z
    .enum(['classique', 'basse_temperature', 'condensation', 'pac_air_eau', 'pac_geothermique'])
    .nullable(),
  ceCertification: z.boolean().nullable(),
  confidenceByField: ConfidenceByFieldSchema,
})

export type ChaudiereExtraction = z.infer<typeof ChaudiereExtractionSchema>
