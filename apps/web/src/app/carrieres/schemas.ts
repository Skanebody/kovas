/**
 * KOVAS — Schemas /carrieres (Lot #147 SITE-ANNEXES)
 *
 * Schemas Zod + types partagés entre actions.ts (server) et
 * spontaneous-application-form.tsx (client). Ce fichier est neutre
 * (pas de 'use server') donc peut exporter des non-async values.
 */

import { z } from 'zod'

export const spontaneousApplicationSchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  linkedin_url: z
    .string()
    .trim()
    .max(300)
    .optional()
    .refine(
      (v) => !v || /^https?:\/\/(www\.)?linkedin\.com\//i.test(v),
      'Renseignez une URL LinkedIn valide.',
    ),
  target_role: z.string().trim().min(2).max(120),
  message: z.string().trim().min(30).max(3000),
  honeypot: z.string().optional(),
  consent_rgpd: z.literal(true),
})

export type SpontaneousApplicationInput = z.infer<typeof spontaneousApplicationSchema>

export interface SpontaneousApplicationResult {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}
