/**
 * KOVAS — Schemas /partenaires (Lot #147 SITE-ANNEXES)
 *
 * Schemas Zod + types partagés entre actions.ts (server) et
 * partner-inquiry-form.tsx (client). Pas de 'use server' ici.
 */

import { z } from 'zod'

export const partnerInquirySchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(8).max(30),
  company_name: z.string().trim().min(2).max(160),
  company_role: z.string().trim().min(2).max(120),
  partnership_type: z.enum([
    'notaires',
    'agences-immobilieres',
    'banques-courtiers',
    'fournisseurs-energie',
    'autre',
  ]),
  message: z.string().trim().min(30).max(3000),
  honeypot: z.string().optional(),
  consent_rgpd: z.literal(true),
})

export type PartnerInquiryInput = z.infer<typeof partnerInquirySchema>

export interface PartnerInquiryResult {
  ok: boolean
  message?: string
  error?: string
  fieldErrors?: Record<string, string>
}
