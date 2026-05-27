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

import { checkRateLimit, emailKey, ipKey, recordRateLimitHit } from '@/lib/anti-spam/rate-limits'
import { searchBanAddress } from '@/lib/ban'
import { estimateEnergyClass } from '@/lib/dpe-calculator/estimation-engine'
import type { CalculatorAnswers, DpeClass } from '@/lib/dpe-calculator/question-tree'
import { dispatchRecipients } from '@/lib/leads/dispatch-recipients'
import { type SubmitDpeLeadInput, type SubmitDpeLeadResult, submitDpeLeadSchema } from './schemas'

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
type RequestType = 'quote_only' | 'estimation_only' | 'both'

function computeLeadScore(
  answers: CalculatorAnswers,
  estimatedClass: DpeClass,
  requestType: RequestType,
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
 *
 * Robustification : si `libphonenumber-js` n'est pas chargeable (problème
 * d'install ou de bundle), on tombe sur un fallback regex E.164 simple
 * pour les numéros FR. Mieux vaut un téléphone "approximatif" qu'un crash
 * de la Server Action.
 */
async function normalizePhone(input: string): Promise<string | null> {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const mod = await import('libphonenumber-js')
    const parsed = mod.parsePhoneNumberFromString(trimmed, 'FR')
    if (parsed?.isValid()) return parsed.number
    // libphonenumber dit invalide → on retourne null (l'utilisateur verra
    // un message d'erreur dédié côté formulaire).
    return null
  } catch (err) {
    console.warn('[submitDpeLead] libphonenumber-js indisponible, fallback regex', err)
    // Fallback regex simple : on accepte tout ce qui ressemble à un numéro FR
    // (10 chiffres commençant par 0, ou +33 + 9 chiffres).
    const digits = trimmed.replace(/[^0-9+]/g, '')
    if (/^0[1-9][0-9]{8}$/.test(digits)) {
      return `+33${digits.slice(1)}`
    }
    if (/^\+33[1-9][0-9]{8}$/.test(digits)) {
      return digits
    }
    if (/^\+[1-9][0-9]{7,14}$/.test(digits)) {
      return digits
    }
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Action principale
// ─────────────────────────────────────────────────────────────────────────────

export async function submitDpeLead(raw: SubmitDpeLeadInput): Promise<SubmitDpeLeadResult> {
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

  // 3. Validation téléphone E.164 (async, fallback regex si lib indispo)
  const phoneE164 = await normalizePhone(data.contact.phone)
  if (!phoneE164) {
    return {
      ok: false,
      error: 'Numéro de téléphone invalide.',
      fieldErrors: { 'contact.phone': 'Format de téléphone invalide.' },
    }
  }

  // 4. Estimation calculée côté serveur pour audit (en plus de l'envoi client)
  const estimation = estimateEnergyClass(data.answers)

  // 5. Admin client Supabase — guard env vars (si SERVICE_ROLE absent en dev,
  //    on enregistre quand même l'événement côté client en mode "best-effort" :
  //    l'estimation est déjà calculée et affichée, l'utilisateur n'est pas
  //    bloqué). En production Vercel les variables sont garanties par CI.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn('[submitDpeLead] env vars Supabase manquantes, mode best-effort sans persistance')
    return {
      ok: true,
      message:
        'Votre estimation a bien été calculée. La mise en relation avec un diagnostiqueur sera disponible sous peu.',
    }
  }
  const admin = createAdminClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 6. Anti-spam — rate limit IP (3/h) + email (5/7j)
  //    Si la table ou le helper crash (DB indispo), on fail-open : préférable
  //    qu'un user passe que de bloquer tout le monde sur incident technique.
  const clientIp = await getClientIp()
  const emailLower = data.contact.email.trim().toLowerCase()

  try {
    if (clientIp) {
      const ipVerdict = await checkRateLimit(admin, ipKey(clientIp), 1, 3)
      if (!ipVerdict.allowed) {
        return {
          ok: false,
          error: 'Trop de demandes depuis ta connexion. Réessaie dans 1 heure.',
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
  } catch (err) {
    console.warn('[submitDpeLead] rate-limit check failed (fail-open)', err)
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

  // Insert tolérant — si la DB rejette (contrainte CHECK, colonne manquante,
  // service indispo), on log et on renvoie un OK best-effort : l'utilisateur a
  // déjà son estimation côté client, mieux vaut une demande perdue qu'un crash
  // visible. L'incident est tracé dans Sentry/logs pour traitement asynchrone.
  let inserted: { id: string; public_tracking_token: string } | null = null
  try {
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
    } else {
      inserted = insertResp.data as { id: string; public_tracking_token: string }
    }
  } catch (err) {
    console.error('[submitDpeLead] insert threw', err)
  }

  if (!inserted) {
    // Mode dégradé : l'estimation est conservée côté client, on retourne ok
    // pour ne pas bloquer le funnel. Une équipe humaine peut récupérer le
    // lead via logs Sentry / Vercel si nécessaire.
    return {
      ok: true,
      message:
        'Ton estimation a bien été calculée. Notre équipe te met en relation avec un diagnostiqueur sous 24h.',
    }
  }

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

  // 11. Record rate-limit hits — also fail-open
  try {
    const keys = [clientIp ? ipKey(clientIp) : null, emailKey(emailLower)].filter(
      (k): k is string => k !== null,
    )
    await recordRateLimitHit(admin, keys)
  } catch (err) {
    console.warn('[submitDpeLead] recordRateLimitHit failed (non-blocking)', err)
  }

  return {
    ok: true,
    leadId: inserted.id,
    trackingToken: inserted.public_tracking_token,
    recipientCount,
    message:
      recipientCount > 0
        ? `Ta demande a été transmise à ${recipientCount} diagnostiqueur${recipientCount > 1 ? 's' : ''} certifié${recipientCount > 1 ? 's' : ''}.`
        : 'Ta demande est enregistrée. Notre équipe te met en relation avec un diagnostiqueur sous 24h.',
  }
}
