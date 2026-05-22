'use server'

/**
 * KOVAS — Calculateur DPE gratuit (Lot #143)
 *
 * Server Action `submitDpeLead` :
 *  1. Validation Zod stricte du payload (réponses calculateur + coordonnées).
 *  2. Geocoding BAN sur l'adresse (best-effort) pour récupérer dept + INSEE.
 *  3. Anti-spam : rate limit 3/h par IP + 5/7j par email (réutilise table
 *     `quote_request_rate_limits` existante).
 *  4. Insert dans `quote_requests` avec :
 *       - source = 'dpe_calculator'
 *       - diagnostician_id = NULL (lead orphelin, routé géographiquement)
 *       - estimated_class, factors_json (algo client-side)
 *  5. Calcul lead score (baseline 50 + bonus).
 *  6. dispatchRecipients (sélection 3 diag max, insert recipients, envoi emails).
 *  7. Renvoi { ok, leadId, trackingToken } pour redirection client.
 *
 * Si dispatch échoue (pas de diag dans la zone), on garde le lead (status
 * 'pending_routing') — l'admin pourra router manuellement.
 *
 * Pré-requis post-cherry-pick :
 *   - migration `20260522170000_leads_dpe_calculator.sql` appliquée
 *   - modules `@/lib/anti-spam/rate-limits` + `@/lib/leads/dispatch-recipients`
 *     présents (cf. Lot E1 / Lot K1 leads engine)
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { headers } from 'next/headers'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { z } from 'zod'

import { searchBanAddress } from '@/lib/ban'
import {
  checkRateLimit,
  emailKey,
  ipKey,
  recordRateLimitHit,
} from '@/lib/anti-spam/rate-limits'
import { dispatchRecipients } from '@/lib/leads/dispatch-recipients'
import { estimateEnergyClass } from '@/lib/dpe-calculator/estimation-engine'
import type {
  CalculatorAnswers,
  DpeClass,
} from '@/lib/dpe-calculator/question-tree'

// ─────────────────────────────────────────────────────────────────────────────
// Schémas Zod — réponses calculateur (8 questions) + coordonnées (form final)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getClientIp(): Promise<string | null> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = h.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

interface GeocodingResult {
  latitude: number | null
  longitude: number | null
  inseeCode: string | null
  resolvedCity: string | null
  resolvedPostalCode: string | null
}

async function geocodeAddress(
  address: string | null | undefined,
  postalCode: string,
  city: string,
): Promise<GeocodingResult> {
  const fallback: GeocodingResult = {
    latitude: null,
    longitude: null,
    inseeCode: null,
    resolvedCity: city,
    resolvedPostalCode: postalCode,
  }

  const query = [address, postalCode, city].filter(Boolean).join(' ').trim()
  if (query.length < 3) return fallback

  try {
    const features = await searchBanAddress(query, 1)
    const top = features[0]
    if (!top) return fallback

    return {
      latitude: top.geometry.coordinates[1] ?? null,
      longitude: top.geometry.coordinates[0] ?? null,
      inseeCode: top.properties.citycode ?? null,
      resolvedCity: top.properties.city ?? city,
      resolvedPostalCode: top.properties.postcode ?? postalCode,
    }
  } catch {
    return fallback
  }
}

/**
 * Calcule un score lead 0-100. Baseline B2C = 50.
 *  +20 si "Je veux un devis"   (request_type = quote_only | both)
 *  +30 si surface > 100 m²
 *  +20 si classe estimée F ou G
 *  +10 si contexte "vente" (intent fort)
 *  -10 si contexte uniquement "curiosite"
 */
function computeLeadScore(
  answers: CalculatorAnswers,
  estimatedClass: DpeClass,
  requestType: z.infer<typeof requestTypeSchema>,
): number {
  let score = 50
  if (requestType === 'quote_only' || requestType === 'both') score += 20
  if ((answers.surface_m2 ?? 0) > 100) score += 30
  if (estimatedClass === 'F' || estimatedClass === 'G') score += 20
  if (answers.context?.includes('vente')) score += 10
  if (answers.context?.length === 1 && answers.context[0] === 'curiosite') score -= 10
  return Math.max(0, Math.min(100, score))
}

/**
 * Mapping context calculateur → property_situation (CHECK constraint DB).
 * vente → 'vente' / location → 'location' / renovation → 'travaux' / curiosite → 'audit'
 */
function mapPropertySituation(
  contexts: Array<'vente' | 'location' | 'renovation' | 'curiosite'>,
): 'vente' | 'location' | 'travaux' | 'audit' {
  if (contexts.includes('vente')) return 'vente'
  if (contexts.includes('location')) return 'location'
  if (contexts.includes('renovation')) return 'travaux'
  return 'audit'
}

/**
 * Normalisation E.164 best-effort (par défaut FR).
 */
function normalizePhone(input: string): string | null {
  const parsed = parsePhoneNumberFromString(input, 'FR')
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action principale
// ─────────────────────────────────────────────────────────────────────────────

export async function submitDpeLead(
  raw: SubmitDpeLeadInput,
): Promise<SubmitDpeLeadResult> {
  // 1. Validation Zod stricte
  const parsed = submitDpeLeadSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const path = issue.path.join('.')
      if (!fieldErrors[path]) fieldErrors[path] = issue.message
    }
    return {
      ok: false,
      error: 'Vérifiez les champs en erreur.',
      fieldErrors,
    }
  }
  const data = parsed.data

  // 2. Honeypot → succès silencieux (on retourne ok mais sans réellement insérer)
  if ((data.honeypot ?? '').length > 0) {
    return {
      ok: true,
      message: 'Votre demande a bien été reçue.',
    }
  }

  // 3. Validation téléphone E.164
  const phoneE164 = normalizePhone(data.contact.phone)
  if (!phoneE164) {
    return {
      ok: false,
      error: 'Numéro de téléphone invalide.',
      fieldErrors: { 'contact.phone': 'Format de téléphone invalide.' },
    }
  }

  // 4. Estimation calculée côté serveur pour audit (en plus de l'envoi client)
  const estimation = estimateEnergyClass(data.answers)

  // 5. Admin client Supabase
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 6. Anti-spam — rate limit IP (3/h) + email (5/7j)
  const clientIp = await getClientIp()
  const emailLower = data.contact.email.trim().toLowerCase()

  if (clientIp) {
    const ipVerdict = await checkRateLimit(admin, ipKey(clientIp), 1, 3)
    if (!ipVerdict.allowed) {
      return {
        ok: false,
        error: 'Trop de demandes depuis votre connexion. Réessayez dans 1 heure.',
      }
    }
  }
  const emailVerdict = await checkRateLimit(admin, emailKey(emailLower), 24 * 7, 5)
  if (!emailVerdict.allowed) {
    return {
      ok: false,
      error: 'Limite atteinte pour cet email cette semaine.',
    }
  }

  // 7. Geocoding BAN (best-effort)
  const geo = await geocodeAddress(
    data.contact.address ?? null,
    data.contact.postal_code,
    data.contact.city,
  )

  // 8. Split nom complet → first / last (best-effort)
  const nameParts = data.contact.full_name.trim().split(/\s+/)
  const firstName = nameParts[0] ?? 'Prospect'
  const lastName = nameParts.slice(1).join(' ') || '—'

  // 9. Insert dans quote_requests (source = 'dpe_calculator', diagnostician_id = NULL)
  const propertySituation = mapPropertySituation(data.answers.context)
  const leadScore = computeLeadScore(
    data.answers,
    estimation.estimatedClass,
    data.contact.request_type,
  )

  // year_bucket → property_year_built (point milieu de la tranche)
  const yearMid: Record<typeof data.answers.year_bucket, number> = {
    before_1948: 1930,
    '1948_1974': 1961,
    '1975_1989': 1982,
    '1990_2000': 1995,
    '2001_2012': 2006,
    '2013_2020': 2016,
    after_2020: 2022,
  }

  const factorsJson = {
    answers: data.answers,
    estimation: {
      estimated_class: estimation.estimatedClass,
      score: estimation.score,
      confidence: estimation.confidence,
      positive: estimation.positive,
      negative: estimation.negative,
    },
    lead_score: leadScore,
    geocoding: {
      insee: geo.inseeCode,
      resolved_city: geo.resolvedCity,
      resolved_postal_code: geo.resolvedPostalCode,
    },
    request_type: data.contact.request_type,
  }

  // biome-ignore lint/suspicious/noExplicitAny: colonnes ajoutées par migration Lot #143 hors generated types
  const insertResp = await (admin as any)
    .from('quote_requests')
    .insert({
      diagnostician_id: null,
      source: 'dpe_calculator',
      estimated_class: estimation.estimatedClass,
      factors_json: factorsJson,
      requester_first_name: firstName,
      requester_last_name: lastName,
      requester_email: emailLower,
      requester_phone: phoneE164,
      property_type: data.answers.property_type,
      property_situation: propertySituation,
      property_address: data.contact.address ?? null,
      property_postal_code: geo.resolvedPostalCode ?? data.contact.postal_code,
      property_city: geo.resolvedCity ?? data.contact.city,
      property_surface_m2: data.answers.surface_m2,
      property_year_built: yearMid[data.answers.year_bucket],
      property_geo_lat: geo.latitude,
      property_geo_lng: geo.longitude,
      diagnostics_requested: ['DPE'],
      status: 'pending_routing',
      ip_address: clientIp,
      honeypot_filled: false,
    })
    .select('id, public_tracking_token')
    .single()

  if (insertResp.error || !insertResp.data) {
    console.error('[submitDpeLead] insert failed', insertResp.error)
    return {
      ok: false,
      error:
        'Une erreur technique nous empêche d’enregistrer votre demande. Réessayez dans quelques instants.',
    }
  }
  const inserted = insertResp.data as { id: string; public_tracking_token: string }

  // 10. Dispatch — sélection diag par géoloc seule (pas de diag d'origine)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'
  let recipientCount = 0
  try {
    const dispatch = await dispatchRecipients(admin, inserted.id, baseUrl)
    recipientCount = dispatch.totalRecipients
  } catch (err) {
    console.error('[submitDpeLead] dispatch failed', err)
    // On garde le lead en pending_routing — admin route manuel
  }

  // 11. Record rate-limit hits
  const keys = [clientIp ? ipKey(clientIp) : null, emailKey(emailLower)].filter(
    (k): k is string => k !== null,
  )
  await recordRateLimitHit(admin, keys)

  return {
    ok: true,
    leadId: inserted.id,
    trackingToken: inserted.public_tracking_token,
    recipientCount,
    message:
      recipientCount > 0
        ? `Votre demande a été transmise à ${recipientCount} diagnostiqueur${recipientCount > 1 ? 's' : ''} certifié${recipientCount > 1 ? 's' : ''}.`
        : 'Votre demande est enregistrée. Notre équipe vous met en relation avec un diagnostiqueur sous 24h.',
  }
}
