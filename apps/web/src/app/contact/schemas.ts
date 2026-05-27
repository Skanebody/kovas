/**
 * KOVAS — Schemas /contact (Lot #147 SITE-ANNEXES)
 *
 * Schemas Zod + types partagés entre actions.ts (server) et
 * contact-inquiry-form.tsx (client). Pas de 'use server' ici.
 */

import { z } from 'zod'

const baseContactSchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(20).max(2000),
  honeypot: z.string().optional(),
  consent_rgpd: z.literal(true),
})

const particulierSchema = baseContactSchema.extend({
  inquiry_type: z.literal('particulier'),
  city: z.string().trim().max(120).optional(),
  project_type: z.enum(['vente', 'location', 'renovation', 'achat', 'curiosite']).optional(),
})

const diagnostiqueurSchema = baseContactSchema.extend({
  inquiry_type: z.literal('diagnostiqueur'),
  monthly_volume: z.coerce.number().int().min(0).max(2000).optional(),
  current_software: z.string().trim().max(120).optional(),
})

const journalisteSchema = baseContactSchema.extend({
  inquiry_type: z.literal('journaliste'),
  media: z.string().trim().min(2).max(120),
  deadline: z.string().trim().max(120).optional(),
})

const partenariatSchema = baseContactSchema.extend({
  inquiry_type: z.literal('partenariat'),
  company: z.string().trim().min(2).max(160),
  partnership_type: z
    .enum([
      'notaires',
      'agences-immobilieres',
      'banques-courtiers',
      'fournisseurs-energie',
      'autre',
    ])
    .optional(),
})

export const contactInquirySchema = z.discriminatedUnion('inquiry_type', [
  particulierSchema,
  diagnostiqueurSchema,
  journalisteSchema,
  partenariatSchema,
])

export type ContactInquiryInput = z.infer<typeof contactInquirySchema>

export interface ContactInquiryResult {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}
