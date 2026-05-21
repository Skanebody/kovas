/**
 * KOVAS — schéma zod commun client/serveur pour la soumission d'une demande de devis B2C.
 * Server-side : utilisé dans /api/diagnosticians/[id]/quote-request route handler.
 */

import { z } from 'zod'

const DIAG_CODES = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'BOUTIN',
  'ERP',
] as const

export const quoteRequestPayloadSchema = z.object({
  // Contact
  requester_first_name: z.string().trim().min(1).max(80),
  requester_last_name: z.string().trim().min(1).max(80),
  requester_email: z.string().trim().email().max(160),
  requester_phone: z.string().trim().max(20).optional().nullable(),
  // Bien
  property_type: z.enum(['maison', 'appartement', 'local_commercial', 'autre']),
  property_situation: z.enum(['vente', 'location', 'travaux', 'audit']),
  property_address: z.string().trim().max(240).optional().nullable(),
  property_postal_code: z.string().trim().max(10).optional().nullable(),
  property_city: z.string().trim().max(120).optional().nullable(),
  property_surface_m2: z.number().int().positive().max(9999).optional().nullable(),
  property_year_built: z.number().int().min(1800).max(2026).optional().nullable(),
  property_geo_lat: z.number().min(-90).max(90).optional().nullable(),
  property_geo_lng: z.number().min(-180).max(180).optional().nullable(),
  // Diagnostics
  diagnostics_requested: z.array(z.enum(DIAG_CODES)).min(1, 'Sélectionnez au moins un diagnostic'),
  diagnostics_suggested: z
    .array(
      z.object({
        type: z.enum(DIAG_CODES),
        required: z.boolean(),
        reason: z.string().max(200),
      }),
    )
    .optional()
    .nullable(),
  // Message
  message: z.string().trim().max(2000).optional().nullable(),
  // Anti-spam
  honeypot: z.string().max(0).optional(), // doit rester vide
  recaptcha_token: z.string().optional().nullable(),
})

export type QuoteRequestPayload = z.infer<typeof quoteRequestPayloadSchema>
