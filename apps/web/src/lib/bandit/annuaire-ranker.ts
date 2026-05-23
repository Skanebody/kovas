/**
 * Wrapper métier : classement Thompson sampling des diagnostiqueurs
 * sur les pages annuaire publiques `/trouver-un-diagnostiqueur/[dept]/[city]`.
 *
 * Pipeline :
 *  1. Lire stats Supabase pour les diagnostiqueurs candidats
 *  2. Cold start protection (≥ 1 warm arm dans top 10)
 *  3. Thompson sampling sur les arms restants
 *  4. Retourner les IDs ordonnés (slice `limit` si fourni)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadStatsFor, recordEvent, recordImpressionsBatch } from './stats-store'
import { type ThompsonOptions, rankWithColdStart } from './thompson-sampling'

export interface RankParams {
  supabase: SupabaseClient
  diagnosticianIds: ReadonlyArray<string>
  citySlug: string
  /** Nombre d'arms à retourner (défaut : 10, longueur d'une page annuaire). */
  limit?: number
  /** Nombre de places réservées aux nouveaux entrants (cold start). Défaut 2. */
  warmSlots?: number
  /** RNG injectable pour tests / SSR déterministe. */
  rng?: () => number
}

/**
 * Retourne la liste des `diagnosticianIds` réordonnée par Thompson sampling
 * + injection cold-start.
 */
export async function rankDiagnosticiansForCity(params: RankParams): Promise<string[]> {
  const { supabase, diagnosticianIds, limit = 10, warmSlots = 2, rng } = params
  if (diagnosticianIds.length === 0) return []

  const arms = await loadStatsFor(supabase, diagnosticianIds)

  const options: ThompsonOptions & { topN: number; warmSlots: number } = {
    topN: Math.min(limit, arms.length),
    warmSlots,
    coldStartThreshold: arms[0]?.warmThreshold ?? 50,
    ...(rng !== undefined ? { rng } : {}),
  }

  const ranked = rankWithColdStart(arms, options)
  return ranked.map((a) => a.armId)
}

/**
 * Log une impression unique (CTR tracking, conversion attribution).
 */
export async function recordImpression(params: {
  supabase: SupabaseClient
  diagnosticianId: string
  citySlug: string
}): Promise<void> {
  await recordEvent(params.supabase, {
    diagnosticianId: params.diagnosticianId,
    eventType: 'impression',
    citySlug: params.citySlug,
  })
}

/**
 * Log un événement de conversion (click sur fiche, demande de devis, devis accepté).
 * Le pondération α est gérée côté DB via le RPC.
 */
export async function recordConversion(params: {
  supabase: SupabaseClient
  diagnosticianId: string
  citySlug: string
  conversionType: 'click' | 'lead_request' | 'lead_accepted'
}): Promise<void> {
  await recordEvent(params.supabase, {
    diagnosticianId: params.diagnosticianId,
    eventType: params.conversionType,
    citySlug: params.citySlug,
  })
}

/**
 * Helper SSR : appelé après le rendu de la page annuaire pour logger
 * les impressions du top affiché. Non-bloquant côté UX.
 */
export async function logTopImpressions(params: {
  supabase: SupabaseClient
  topDiagnosticianIds: ReadonlyArray<string>
  citySlug: string
}): Promise<void> {
  await recordImpressionsBatch(params.supabase, params.topDiagnosticianIds, params.citySlug)
}
