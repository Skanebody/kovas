/**
 * KOVAS — Storage quota helper.
 *
 * Authority : CLAUDE.md §4 (3 tiers Phase 1 + Founder).
 *
 * Source de vérité au runtime : `organizations.storage_used_bytes` et
 * `organizations.storage_quota_bytes` (alimentés par les triggers SQL de la
 * migration 20260524100000_storage_tracking.sql).
 *
 * Le mapping tier → quota est exposé ici pour :
 *   - re-synchroniser quota_bytes lors d'un changement d'abonnement Stripe
 *   - afficher la "promesse" de chaque tier sur la page d'upgrade
 *   - garantir une valeur par défaut si la colonne n'a jamais été initialisée
 *
 * Estimation consommation par mission DPE typique : ~8-15 MB
 *   (≈ 10 photos WebP 250KB + 2 audio Opus 200KB + 1 PDF 1MB + JSON).
 * Donc 20 Go ≈ 1 500-2 500 missions ; 50 Go ≈ 4 000-6 000 ; 100 Go ≈ 8 000+.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Constantes
// ============================================

const ONE_GB_BYTES = 1024n * 1024n * 1024n

/** Tier IDs internes côté `organizations.plan` (cf. init_schema). */
export type StorageTier = 'decouverte' | 'standard' | 'volume' | 'founder'

/** Mapping tier → quota storage (bytes). Founder = 50 Go (parité Standard). */
export const STORAGE_QUOTA_BY_TIER: Record<StorageTier, bigint> = {
  decouverte: 20n * ONE_GB_BYTES, // 21 474 836 480
  standard: 50n * ONE_GB_BYTES, // 53 687 091 200
  volume: 100n * ONE_GB_BYTES, // 107 374 182 400
  founder: 50n * ONE_GB_BYTES, // parité Standard
}

/**
 * Retourne le quota storage (bytes) pour un tier.
 * Fallback Découverte (20 Go) si tier inconnu.
 */
export function getStorageQuotaBytes(tier: StorageTier | string | null | undefined): bigint {
  if (tier && tier in STORAGE_QUOTA_BY_TIER) {
    return STORAGE_QUOTA_BY_TIER[tier as StorageTier]
  }
  return STORAGE_QUOTA_BY_TIER.decouverte
}

// ============================================
// Erreur typée
// ============================================

export class StorageQuotaExceeded extends Error {
  readonly code = 'storage_quota_exceeded' as const
  readonly httpStatus = 413 as const
  readonly usedBytes: bigint
  readonly quotaBytes: bigint
  readonly attemptedBytes: bigint

  constructor(usedBytes: bigint, quotaBytes: bigint, attemptedBytes: bigint) {
    super(
      `Quota stockage atteint : ${formatBytes(usedBytes + attemptedBytes)} > ${formatBytes(quotaBytes)}. ` +
        `Supprimez d'anciens dossiers ou passez à un tier supérieur.`,
    )
    this.name = 'StorageQuotaExceeded'
    this.usedBytes = usedBytes
    this.quotaBytes = quotaBytes
    this.attemptedBytes = attemptedBytes
  }
}

// ============================================
// Lecture usage
// ============================================

export interface StorageUsage {
  usedBytes: bigint
  quotaBytes: bigint
  remainingBytes: bigint
  /** Pourcentage 0-100 (peut dépasser 100 si over-quota). */
  usagePct: number
}

interface OrgStorageRow {
  storage_used_bytes: number | string | null
  storage_quota_bytes: number | string | null
}

/**
 * Lit l'état d'usage d'une organisation. Lance une erreur si l'org n'existe pas.
 *
 * Notes :
 *   - Postgres bigint est sérialisé en string par PostgREST quand > 2^53,
 *     d'où la conversion via BigInt(String(...)).
 *   - Si une colonne est NULL (org créée avant la migration), on tombe sur 0
 *     pour used et sur le quota Découverte (20 Go) pour quota.
 */
export async function getStorageUsage(
  // biome-ignore lint/suspicious/noExplicitAny: types Database générés ne reflètent pas encore les colonnes storage_*_bytes
  supabase: SupabaseClient<any>,
  orgId: string,
): Promise<StorageUsage> {
  const { data, error } = await supabase
    .from('organizations')
    .select('storage_used_bytes, storage_quota_bytes')
    .eq('id', orgId)
    .maybeSingle<OrgStorageRow>()

  if (error) {
    throw new Error(`Failed to read storage usage: ${error.message}`)
  }
  if (!data) {
    throw new Error(`Organization ${orgId} not found`)
  }

  const usedBytes = toBigInt(data.storage_used_bytes, 0n)
  const quotaBytes = toBigInt(data.storage_quota_bytes, STORAGE_QUOTA_BY_TIER.decouverte)
  const remainingBytes = quotaBytes > usedBytes ? quotaBytes - usedBytes : 0n

  // Pourcentage en nombre (sur des bigint) : on accepte la perte de précision (< 0.001%)
  const usagePct =
    quotaBytes === 0n
      ? 0
      : Math.min(
          999,
          Math.max(0, Number((usedBytes * 10000n) / quotaBytes) / 100),
        )

  return {
    usedBytes,
    quotaBytes,
    remainingBytes,
    usagePct,
  }
}

/**
 * Vérifie qu'on peut encore stocker `bytesToAdd` octets. Throw `StorageQuotaExceeded` sinon.
 *
 * À appeler AVANT chaque upload (photos / voice notes / documents / owner uploads).
 * La fonction ne réserve pas le quota — les triggers SQL incrémentent à l'INSERT row.
 */
export async function assertStorageAvailable(
  // biome-ignore lint/suspicious/noExplicitAny: types Database générés ne reflètent pas encore les colonnes storage_*_bytes
  supabase: SupabaseClient<any>,
  orgId: string,
  bytesToAdd: bigint | number,
): Promise<void> {
  const attempted = typeof bytesToAdd === 'bigint' ? bytesToAdd : BigInt(Math.max(0, bytesToAdd))
  if (attempted === 0n) return

  const { usedBytes, quotaBytes } = await getStorageUsage(supabase, orgId)

  if (usedBytes + attempted > quotaBytes) {
    throw new StorageQuotaExceeded(usedBytes, quotaBytes, attempted)
  }
}

// ============================================
// Formatting humain (KB / MB / GB)
// ============================================

const KB = 1024
const MB = 1024 * 1024
const GB = 1024 * 1024 * 1024

/**
 * Formate une taille en octets en string humaine (FR — virgule décimale).
 * Exemples : 512 → "512 o", 2_500_000 → "2,4 Mo", 53_687_091_200 → "50,0 Go"
 */
export function formatBytes(bytes: bigint | number): string {
  const n = typeof bytes === 'bigint' ? Number(bytes) : bytes
  if (!Number.isFinite(n) || n < 0) return '0 o'

  if (n < KB) return `${Math.round(n)} o`
  if (n < MB) return `${formatNumberFr(n / KB, 0)} Ko`
  if (n < GB) return `${formatNumberFr(n / MB, 1)} Mo`
  return `${formatNumberFr(n / GB, 1)} Go`
}

function formatNumberFr(value: number, fractionDigits: number): string {
  return value
    .toLocaleString('fr-FR', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
}

// ============================================
// Internals
// ============================================

function toBigInt(value: number | string | null, fallback: bigint): bigint {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') return BigInt(Math.max(0, Math.trunc(value)))
  // string (cas PostgREST sur bigint > 2^53)
  const cleaned = String(value).trim()
  if (cleaned === '' || cleaned === '0') return cleaned === '' ? fallback : 0n
  try {
    return BigInt(cleaned)
  } catch {
    return fallback
  }
}
