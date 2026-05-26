/**
 * KOVAS — Cache 7j des vérifications SIRENE (table `sirene_check_cache`).
 *
 * Pourquoi un cache long :
 *   - Les codes NAF / état administratif INSEE évoluent peu (mois).
 *   - L'API Recherche d'Entreprises est ouverte mais on évite la pression
 *     inutile sur un service public partagé.
 *   - Économie de latence : un signup ou un affichage badge annuaire ne
 *     repaie pas l'aller-retour HTTP.
 *
 * Schéma :
 *   sirene_check_cache (
 *     siret      PK,
 *     result     JSONB    -- VerificationResult sérialisé
 *     checked_at TIMESTAMPTZ,
 *     expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '7 days'
 *   )
 *
 * Stratégie d'écriture : on stocke uniquement les résultats `found=true`
 * (positifs ou négatifs sur l'activité diagnostic). Les erreurs réseau /
 * not_found / rate_limit ne sont jamais cachées — on doit retenter.
 *
 * Authority : CLAUDE.md §6.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { VerificationResult } from './client'

const TABLE = 'sirene_check_cache'

interface CacheRow {
  siret: string
  result: VerificationResult
  checked_at: string
  expires_at: string
}

export interface CacheLookupResult {
  hit: boolean
  result: VerificationResult | null
}

/**
 * Cherche un résultat de vérification valide en cache. Renvoie `hit=false`
 * si absent, expiré, ou en cas d'erreur DB (pas bloquant — on retombera
 * sur l'appel API).
 */
export async function lookupVerificationCache(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase typed/untyped both accepted
  supabase: SupabaseClient<any, any, any>,
  siret: string,
): Promise<CacheLookupResult> {
  try {
    // biome-ignore lint/suspicious/noExplicitAny: table non typée tant que `kovas/database/types` n'a pas régénéré
    const { data, error } = await (supabase as any)
      .from(TABLE)
      .select('siret, result, checked_at, expires_at')
      .eq('siret', siret)
      .maybeSingle()

    if (error || !data) return { hit: false, result: null }
    const row = data as CacheRow
    const expiresAt = new Date(row.expires_at).getTime()
    if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
      return { hit: false, result: null }
    }
    return { hit: true, result: row.result }
  } catch {
    return { hit: false, result: null }
  }
}

/**
 * Stocke un résultat positif en cache. Idempotent (upsert sur PK siret).
 * Non bloquant : log + return false si la DB râle.
 */
export async function storeVerificationCache(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase typed/untyped both accepted
  supabase: SupabaseClient<any, any, any>,
  result: VerificationResult,
): Promise<boolean> {
  // On ne cache pas les erreurs (network/rate_limit/not_found) — elles
  // doivent être re-tentées.
  if (!result.found) return false

  try {
    // biome-ignore lint/suspicious/noExplicitAny: idem
    const { error } = await (supabase as any).from(TABLE).upsert(
      {
        siret: result.siret,
        result,
        checked_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      },
      { onConflict: 'siret' },
    )

    if (error) {
      console.warn('[sirene-cache] upsert failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn('[sirene-cache] upsert exception:', err)
    return false
  }
}
