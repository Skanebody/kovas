/**
 * KOVAS — Schéma Zod : extraction plan (architectural / cadastral).
 *
 * Cible : plans uploadés (PDF ou image) — extraction très simple, on se
 * contente de l'OCR brut et du nombre de pages. La reconnaissance de pièces
 * + métré est V2 (Vision avancée).
 */

import { z } from 'zod'

const ConfidenceByFieldSchema = z.record(z.string(), z.number().int().min(0).max(100))

export const PlanExtractionSchema = z.object({
  /** OCR brut concatené du plan (notes, légendes, surfaces si écrites). */
  ocrText: z.string().nullable(),
  /** Nombre de pages détectées (PDF) — 1 pour image simple. */
  pagesCount: z.number().int().min(1).nullable(),
  /** Type de plan détecté si lisible dans légende. */
  planKind: z
    .enum(['plan_masse', 'plan_etage', 'plan_coupe', 'plan_cadastral', 'plan_facade', 'autre'])
    .nullable(),
  /** Surface totale annotée sur le plan si présente (m²). */
  totalSurfaceM2: z.number().positive().nullable(),
  confidenceByField: ConfidenceByFieldSchema,
})

export type PlanExtraction = z.infer<typeof PlanExtractionSchema>
