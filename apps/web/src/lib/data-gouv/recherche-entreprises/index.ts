/**
 * KOVAS — API Recherche d'Entreprises (api.gouv.fr).
 * Point d'entrée du module : vérification SIRET réelle au registre SIRENE +
 * détection activité diagnostic immobilier (NAF 71.20B / 71.12B).
 *
 * Authority : CLAUDE.md §6, docs/data-gouv-opportunities.md §2.5.
 */

export {
  DIAGNOSTIC_NAF_CODES,
  getNafLabel,
  isDiagnosticNAF,
  NAF_LABELS,
  normalizeNafCode,
  type DiagnosticNafCode,
} from './naf-codes'

export {
  verifyDiagnosticActivity,
  type VerificationError,
  type VerificationResult,
  type VerifyOptions,
} from './client'

export {
  lookupVerificationCache,
  storeVerificationCache,
  type CacheLookupResult,
} from './cache'

import type { SupabaseClient } from '@supabase/supabase-js'
import { lookupVerificationCache, storeVerificationCache } from './cache'
import { type VerificationResult, type VerifyOptions, verifyDiagnosticActivity } from './client'

/**
 * Pipeline complet : cache 7j → API fallback → store cache.
 *
 * Si la DB échoue, l'appel API est quand même effectué (cache best-effort).
 * Le `force=true` ignore le cache (utile admin re-check).
 */
export async function verifyDiagnosticActivityCached(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase générique pour ne pas forcer la régen des types
  supabase: SupabaseClient<any, any, any>,
  siret: string,
  opts: VerifyOptions & { force?: boolean } = {},
): Promise<VerificationResult & { cached: boolean }> {
  const cleaned = siret.replace(/\s/g, '')

  if (!opts.force) {
    const cache = await lookupVerificationCache(supabase, cleaned)
    if (cache.hit && cache.result) {
      return { ...cache.result, cached: true }
    }
  }

  const fresh = await verifyDiagnosticActivity(cleaned, opts)
  // Store best-effort (n'attend pas la confirmation)
  if (fresh.found) {
    await storeVerificationCache(supabase, fresh)
  }
  return { ...fresh, cached: false }
}
