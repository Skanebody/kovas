/**
 * KOVAS — Multi-envoi lead K1.
 *
 * Sélectionne jusqu'à 5 diag pour une demande de devis B2C, avec mix par défaut
 * 2-3 premium (Pro+ payant), 2-3 verified (Essential/Découverte claimed), 2-3 basic
 * (DHUP non-claimed). Skip les diag soft_disabled / archived / en pause manuelle.
 *
 * Ranking : routing_score DESC (10 > 5 > 1), distance ASC, gmb_rating DESC.
 * V1.5 : ajouter une distance "rayon d'intervention" intelligente
 * (haversine vs intervention_radius_km).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface QuoteRequestContext {
  property_city: string | null
  property_postal_code: string | null
  property_geo_lat: number | null
  property_geo_lng: number | null
  diagnostics_requested: string[]
  /** ID du diag initialement ciblé (la fiche source du formulaire) — toujours inclus en priorité. */
  primary_diagnostician_id: string | null
}

export type RecipientTier = 'premium' | 'verified' | 'basic'

export interface RoutingOptions {
  maxRecipients: number
  preferredMix: { premium: number; verified: number; basic: number }
}

export const DEFAULT_ROUTING_OPTIONS: RoutingOptions = {
  maxRecipients: 5,
  preferredMix: { premium: 2, verified: 2, basic: 1 },
}

export interface RecipientSelection {
  diagnosticianId: string
  tier: RecipientTier
}

interface CandidateRow {
  id: string
  slug: string
  city: string | null
  department_code: string | null
  postal_code: string | null
  geo_lat: number | null
  geo_lng: number | null
  intervention_radius_km: number | null
  gmb_rating: number | null
  gmb_review_count: number | null
  routing_score: number
  recipient_tier: RecipientTier
  claimed_by_user_id: string | null
  ghost_status: string
}

/**
 * Distance haversine en km entre 2 points (formule simple V1).
 */
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Récupère les candidats potentiels pour le lead :
 *  - Diag publiés, non archivés / soft_disabled / en pause
 *  - Couvrant la ville/code postal de la propriété OU avec intervention_radius_km
 *    compatible (si lat/lng disponibles)
 *  - Routing score > 0
 */
export async function fetchCandidates(
  // biome-ignore lint/suspicious/noExplicitAny: client générique
  supabase: SupabaseClient<any, any, any>,
  ctx: QuoteRequestContext,
  limit = 50,
): Promise<CandidateRow[]> {
  // Stratégie : on charge un set large par ville/dept + on filtre/ranke en mémoire.
  // Volume cible V1 : ~13k diag FR → max 200-300 par ville la plus dense, OK.
  let query =
    // biome-ignore lint/suspicious/noExplicitAny: dynamic view not typed
    (supabase as any)
      .from('v_diagnostician_routing_score')
      .select('*')
      .gt('routing_score', 0)
      .order('routing_score', { ascending: false })
      .order('gmb_rating', { ascending: false, nullsFirst: false })
      .limit(limit)

  if (ctx.property_city) {
    query = query.ilike('city', ctx.property_city)
  } else if (ctx.property_postal_code) {
    // Approche département : 2 premiers chiffres
    const dept = ctx.property_postal_code.slice(0, 2)
    query = query.eq('department_code', dept)
  }

  const { data, error } = await query
  if (error) {
    console.error('[multi-recipient-router] fetch candidates failed', error)
    return []
  }

  return (data ?? []) as CandidateRow[]
}

/**
 * Filtre les candidats par distance vs rayon d'intervention déclaré.
 * Sans coordonnées, on garde le candidat.
 */
function filterByCoverage(candidates: CandidateRow[], ctx: QuoteRequestContext): CandidateRow[] {
  if (ctx.property_geo_lat == null || ctx.property_geo_lng == null) {
    return candidates
  }
  return candidates.filter((c) => {
    if (c.geo_lat == null || c.geo_lng == null) return true // pas de filtre si on ne sait pas
    const radius = c.intervention_radius_km ?? 30 // défaut 30km
    const dist = haversineDistanceKm(
      ctx.property_geo_lat as number,
      ctx.property_geo_lng as number,
      c.geo_lat,
      c.geo_lng,
    )
    return dist <= radius
  })
}

/**
 * Sélectionne le mix premium/verified/basic. Complète avec un fallback si un tier
 * est en sous-effectif.
 */
function buildMix(
  candidates: CandidateRow[],
  options: RoutingOptions,
  primaryDiagnosticianId: string | null,
): RecipientSelection[] {
  const result: RecipientSelection[] = []
  const used = new Set<string>()

  // 1. Toujours inclure le diag d'origine si présent et éligible
  if (primaryDiagnosticianId) {
    const primary = candidates.find((c) => c.id === primaryDiagnosticianId)
    if (primary) {
      result.push({ diagnosticianId: primary.id, tier: primary.recipient_tier })
      used.add(primary.id)
    }
  }

  const remaining = (tier: RecipientTier) =>
    candidates.filter((c) => c.recipient_tier === tier && !used.has(c.id))

  const tiers: Array<{ tier: RecipientTier; target: number }> = [
    { tier: 'premium', target: options.preferredMix.premium },
    { tier: 'verified', target: options.preferredMix.verified },
    { tier: 'basic', target: options.preferredMix.basic },
  ]

  // 2. Première passe : respecter le mix
  for (const { tier, target } of tiers) {
    const pool = remaining(tier)
    const slots = Math.min(target, pool.length, options.maxRecipients - result.length)
    for (let i = 0; i < slots; i++) {
      const c = pool[i]
      if (!c) break
      result.push({ diagnosticianId: c.id, tier })
      used.add(c.id)
    }
    if (result.length >= options.maxRecipients) break
  }

  // 3. Si moins de N → compléter avec n'importe quel tier dispo
  if (result.length < options.maxRecipients) {
    const fallback = candidates.filter((c) => !used.has(c.id))
    for (const c of fallback) {
      result.push({ diagnosticianId: c.id, tier: c.recipient_tier })
      used.add(c.id)
      if (result.length >= options.maxRecipients) break
    }
  }

  return result
}

/**
 * Sélectionne les destinataires d'un lead — point d'entrée principal.
 */
export async function selectRecipientsForRequest(
  // biome-ignore lint/suspicious/noExplicitAny: client générique
  supabase: SupabaseClient<any, any, any>,
  ctx: QuoteRequestContext,
  options: RoutingOptions = DEFAULT_ROUTING_OPTIONS,
): Promise<RecipientSelection[]> {
  const candidatesRaw = await fetchCandidates(supabase, ctx, 80)
  const candidates = filterByCoverage(candidatesRaw, ctx)
  return buildMix(candidates, options, ctx.primary_diagnostician_id)
}

/**
 * Insert un batch de recipients en base. Idempotent via UNIQUE(quote_request_id, diag_id).
 */
export async function insertRecipientsBatch(
  // biome-ignore lint/suspicious/noExplicitAny: client générique
  supabase: SupabaseClient<any, any, any>,
  quoteRequestId: string,
  recipients: RecipientSelection[],
): Promise<Array<{ id: string; diagnostician_id: string; recipient_tier: RecipientTier }>> {
  if (recipients.length === 0) return []

  const payload = recipients.map((r) => ({
    quote_request_id: quoteRequestId,
    diagnostician_id: r.diagnosticianId,
    recipient_tier: r.tier,
    status: 'sent',
  }))

  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data, error } = await (supabase as any)
    .from('quote_request_recipients')
    .insert(payload)
    .select('id, diagnostician_id, recipient_tier')

  if (error) {
    console.error('[multi-recipient-router] insert recipients failed', error)
    return []
  }

  return (data ?? []) as Array<{
    id: string
    diagnostician_id: string
    recipient_tier: RecipientTier
  }>
}
