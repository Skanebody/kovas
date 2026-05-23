/**
 * KOVAS — Schemas /calculateur-dpe-gratuit (Lot #143 SITE-CALCULATEUR).
 *
 * Schemas Zod + types partagés entre actions.ts (server) et lead-form.tsx
 * (client). Pas de 'use server' ici : permet d'exporter des valeurs non-async.
 */

import { z } from 'zod'

const dpeClassSchema = z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G'])

const calculatorAnswersSchema = z.object({
  property_type: z.enum(['maison', 'appartement']),
  surface_m2: z.number().int().min(8).max(1000),
  year_bucket: z.enum([
    'before_1948',
    '1948_1974',
    '1975_1989',
    '1990_2000',
    '2001_2012',
    '2013_2020',
    'after_2020',
  ]),
  existing_dpe: z.union([
    z.object({ known: z.literal(false), value: z.null() }),
    z.object({ known: z.literal(true), value: dpeClassSchema.nullable() }),
    z.object({ known: z.literal('unsure'), value: z.null() }),
  ]),
  heating: z.enum([
    'gaz',
    'fioul',
    'electricite',
    'pompe_chaleur',
    'bois',
    'reseau_chaleur',
    'autre',
  ]),
  isolation: z.enum(['tres_bonne', 'bonne', 'moyenne', 'mauvaise', 'inconnue']),
  occupation: z.enum([
    'residence_principale',
    'residence_secondaire',
    'vacant',
    'locatif',
  ]),
  context: z.array(z.enum(['vente', 'location', 'renovation', 'curiosite'])).min(1),
})

const requestTypeSchema = z.enum(['quote_only', 'estimation_only', 'both'])

export const submitDpeLeadSchema = z.object({
  answers: calculatorAnswersSchema,
  contact: z.object({
    full_name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email(),
    phone: z.string().trim().min(8).max(30),
    postal_code: z
      .string()
      .trim()
      .regex(/^\d{5}$/, 'Code postal invalide (5 chiffres)'),
    city: z.string().trim().min(2).max(120),
    address: z.string().trim().max(200).optional().nullable(),
    request_type: requestTypeSchema,
    consent_rgpd: z.literal(true),
  }),
  honeypot: z.string().optional(),
})

export type SubmitDpeLeadInput = z.infer<typeof submitDpeLeadSchema>

export interface SubmitDpeLeadResult {
  ok: boolean
  leadId?: string
  trackingToken?: string
  recipientCount?: number
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}
