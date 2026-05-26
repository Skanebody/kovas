/**
 * RNB + BDNB CSTB — pré-remplissage mission depuis l'open data État FR.
 *
 * Surface publique :
 *   - Types : `BanAddressInput`, `PrefillResult`, `PrefillField`, erreurs typées
 *   - RNB   : `lookupByPoint`, `lookupById`, `lookupByAddress`
 *   - BDNB  : `enrichBuilding`
 *   - Prefill : `getBuildingPrefill` (orchestrateur recommandé)
 *   - Cache : `createSupabaseRnbCache`, `createSupabaseRnbCacheFromEnv`
 */

export {
  type BanAddressInput,
  type BdnbEnrichment,
  type GeoJsonPoint,
  type PrefillField,
  type PrefillResult,
  type RnbAddress,
  type RnbBuilding,
  type RnbBuildingList,
  type RnbBuildingStatus,
  BdnbApiError,
  RnbApiError,
} from './types'

export {
  type RnbCacheRow,
  type RnbCacheStore,
  type RnbClientOptions,
  NO_OP_CACHE,
  RNB_CACHE_TTL_MS,
  lookupByAddress,
  lookupById,
  lookupByPoint,
} from './rnb-client'

export {
  type BdnbCacheStore,
  type BdnbClientOptions,
  BDNB_CACHE_TTL_MS,
  enrichBuilding,
} from './bdnb-client'

export {
  type PrefillOptions,
  getBuildingPrefill,
  mapToPrefillResult,
} from './prefill'

export {
  createSupabaseRnbCache,
  createSupabaseRnbCacheFromEnv,
} from './supabase-cache'
