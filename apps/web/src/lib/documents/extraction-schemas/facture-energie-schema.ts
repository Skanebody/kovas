/**
 * KOVAS — Schéma Zod : extraction facture énergie (gaz, électricité, fioul).
 *
 * Cible : factures EDF, Engie, TotalEnergies, etc. uploadées par le propriétaire
 * ou photographiées par le diagnostiqueur. La conso annuelle (réelle ou estimée)
 * est l'info la plus stratégique pour pré-remplir le DPE.
 */

import { z } from 'zod'

const ConfidenceByFieldSchema = z.record(z.string(), z.number().int().min(0).max(100))

export const FactureEnergieExtractionSchema = z.object({
  provider: z.string().nullable(),
  energyType: z.enum(['electricite', 'gaz', 'fioul', 'bois', 'reseau_chaleur']).nullable(),
  periodStart: z.string().nullable(), // ISO YYYY-MM-DD
  periodEnd: z.string().nullable(), // ISO YYYY-MM-DD
  consumptionKwh: z.number().nonnegative().nullable(),
  consumptionM3: z.number().nonnegative().nullable(), // gaz seulement
  estimatedAnnualConsumptionKwh: z.number().nonnegative().nullable(),
  pricingType: z
    .enum(['base', 'heures_creuses', 'tempo', 'effacement_jour_pointe', 'fixe', 'indexe'])
    .nullable(),
  meterNumber: z.string().nullable(),
  pdlNumber: z.string().nullable(), // Point de Livraison (élec) ou PCE (gaz)
  confidenceByField: ConfidenceByFieldSchema,
})

export type FactureEnergieExtraction = z.infer<typeof FactureEnergieExtractionSchema>
