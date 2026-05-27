/**
 * KOVAS — Cache lecture/écriture Géorisques étendu (Radon / PPRI / Argiles / Cavités).
 *
 * Stratégie : applicatif TTL 30j. Tables :
 *   - public.georisques_radon_cache (clé : code_insee)
 *   - public.georisques_ppri_cache (clé : code_insee)
 *   - public.georisques_argiles_cache (clé : geohash 7)
 *   - public.georisques_cavites_cache (clé : geohash 7)
 *
 * Géocodage : `encodeGeohash(lat, lng, 7)` ≈ 152m de précision N-S × 153m E-O.
 * Suffisant pour la déclaration IAL (aléa argile/cavité varie peu à 150m).
 *
 * Wrappers servent à éviter de retaper la logique fetch + cache dans chaque
 * caller (fiche dossier, page risques, edge function de pré-export, etc.).
 *
 * Authority : docs/data-gouv-opportunities.md §3 Top #3.
 */

import { createClient } from '@supabase/supabase-js'
import {
  type ArgilesAlea,
  type ArgilesRisk,
  type Cavite,
  GEORISQUES_SOURCE_LABEL,
  type PPRIResult,
  type RadonClasse,
  type RadonRisk,
  getArgilesRisk,
  getCavitesNearby,
  getPPRI,
  getRadonRisk,
} from './georisques'

const CACHE_TTL_MS = 30 * 24 * 3600 * 1000 // 30 jours

/** Précision geohash utilisée pour les caches lat/lng (~150m). */
export const CACHE_GEOHASH_PRECISION = 7

// biome-ignore lint/suspicious/noExplicitAny: tables ajoutées par migration récente, types DB pas encore regenerés
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = any

function getServiceClient(): ServiceClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function isFresh(fetchedAtIso: string): boolean {
  const ts = new Date(fetchedAtIso).getTime()
  if (Number.isNaN(ts)) return false
  return Date.now() - ts < CACHE_TTL_MS
}

/**
 * Encode lat/lng en geohash de précision `precision`.
 * Implémentation pure-fn (BSD encoder classique), zéro dépendance.
 */
export function encodeGeohash(
  lat: number,
  lng: number,
  precision = CACHE_GEOHASH_PRECISION,
): string {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'
  let latMin = -90
  let latMax = 90
  let lngMin = -180
  let lngMax = 180
  let evenBit = true
  let bit = 0
  let ch = 0
  let geohash = ''
  while (geohash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2
      if (lng >= mid) {
        ch |= 1 << (4 - bit)
        lngMin = mid
      } else {
        lngMax = mid
      }
    } else {
      const mid = (latMin + latMax) / 2
      if (lat >= mid) {
        ch |= 1 << (4 - bit)
        latMin = mid
      } else {
        latMax = mid
      }
    }
    evenBit = !evenBit
    bit += 1
    if (bit === 5) {
      geohash += BASE32.charAt(ch)
      bit = 0
      ch = 0
    }
  }
  return geohash
}

// ─── Radon ─────────────────────────────────────────────────────────────────

export async function getRadonRiskCached(codeInsee: string): Promise<RadonRisk | null> {
  if (!codeInsee) return null
  const supabase = getServiceClient()
  if (supabase) {
    const { data: cached } = await supabase
      .from('georisques_radon_cache')
      .select('code_insee, classe, obligation_ial, fetched_at')
      .eq('code_insee', codeInsee)
      .maybeSingle()
    if (cached && isFresh((cached as { fetched_at: string }).fetched_at)) {
      const row = cached as { code_insee: string; classe: number; obligation_ial: boolean }
      return {
        codeInsee: row.code_insee,
        classe: row.classe as RadonClasse,
        obligationIAL: row.obligation_ial,
        source: GEORISQUES_SOURCE_LABEL,
      }
    }
  }
  const fresh = await getRadonRisk(codeInsee)
  if (!fresh) return null
  if (supabase) {
    await supabase.from('georisques_radon_cache').upsert(
      {
        code_insee: fresh.codeInsee,
        classe: fresh.classe,
        obligation_ial: fresh.obligationIAL,
        raw_data: fresh as unknown as Record<string, unknown>,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'code_insee' },
    )
  }
  return fresh
}

// ─── PPRI ──────────────────────────────────────────────────────────────────

export async function getPPRICached(codeInsee: string): Promise<PPRIResult[]> {
  if (!codeInsee) return []
  const supabase = getServiceClient()
  if (supabase) {
    const { data: cached } = await supabase
      .from('georisques_ppri_cache')
      .select('plans, fetched_at')
      .eq('code_insee', codeInsee)
      .maybeSingle()
    if (cached && isFresh((cached as { fetched_at: string }).fetched_at)) {
      const plans = (cached as { plans: unknown }).plans
      return Array.isArray(plans) ? (plans as PPRIResult[]) : []
    }
  }
  const fresh = await getPPRI(codeInsee)
  if (supabase) {
    await supabase.from('georisques_ppri_cache').upsert(
      {
        code_insee: codeInsee,
        plans: fresh as unknown as Record<string, unknown>[],
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'code_insee' },
    )
  }
  return fresh
}

// ─── Argiles ───────────────────────────────────────────────────────────────

export async function getArgilesRiskCached(lat: number, lng: number): Promise<ArgilesRisk | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const geohash = encodeGeohash(lat, lng)
  const supabase = getServiceClient()
  if (supabase) {
    const { data: cached } = await supabase
      .from('georisques_argiles_cache')
      .select('alea, fetched_at')
      .eq('geohash', geohash)
      .maybeSingle()
    if (cached && isFresh((cached as { fetched_at: string }).fetched_at)) {
      const alea = (cached as { alea: ArgilesAlea }).alea
      return {
        lat,
        lng,
        alea,
        obligationIAL: alea === 'moyen' || alea === 'fort',
        source: GEORISQUES_SOURCE_LABEL,
      }
    }
  }
  const fresh = await getArgilesRisk(lat, lng)
  if (!fresh) return null
  if (supabase) {
    await supabase.from('georisques_argiles_cache').upsert(
      {
        geohash,
        alea: fresh.alea,
        raw_data: fresh as unknown as Record<string, unknown>,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'geohash' },
    )
  }
  return fresh
}

// ─── Cavités ───────────────────────────────────────────────────────────────

export async function getCavitesNearbyCached(
  lat: number,
  lng: number,
  rayonM = 500,
): Promise<Cavite[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const geohash = encodeGeohash(lat, lng)
  const supabase = getServiceClient()
  if (supabase) {
    const { data: cached } = await supabase
      .from('georisques_cavites_cache')
      .select('cavites, fetched_at')
      .eq('geohash', geohash)
      .maybeSingle()
    if (cached && isFresh((cached as { fetched_at: string }).fetched_at)) {
      const cavites = (cached as { cavites: unknown }).cavites
      return Array.isArray(cavites) ? (cavites as Cavite[]) : []
    }
  }
  const fresh = await getCavitesNearby(lat, lng, rayonM)
  if (supabase) {
    await supabase.from('georisques_cavites_cache').upsert(
      {
        geohash,
        cavites: fresh as unknown as Record<string, unknown>[],
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'geohash' },
    )
  }
  return fresh
}

// ─── Agrégat utilitaire pour fiche dossier ─────────────────────────────────

export interface ExtendedRisksBundle {
  radon: RadonRisk | null
  ppri: PPRIResult[]
  argiles: ArgilesRisk | null
  cavites: Cavite[]
  /** Source officielle affichée sobrement (toujours Géorisques). */
  source: typeof GEORISQUES_SOURCE_LABEL
  /** Date de fraîcheur la plus ancienne parmi les 4 sous-sources. */
  fetchedAt: string
}

/**
 * Charge en parallèle les 4 risques étendus pour un bien (cache 30j si dispo).
 * Renvoie un bundle même si certaines sources échouent (graceful degradation).
 */
export async function getExtendedRisks(
  codeInsee: string | null,
  lat: number | null,
  lng: number | null,
): Promise<ExtendedRisksBundle> {
  const [radon, ppri, argiles, cavites] = await Promise.all([
    codeInsee ? getRadonRiskCached(codeInsee) : Promise.resolve(null),
    codeInsee ? getPPRICached(codeInsee) : Promise.resolve([] as PPRIResult[]),
    lat !== null && lng !== null
      ? getArgilesRiskCached(lat, lng)
      : Promise.resolve(null as ArgilesRisk | null),
    lat !== null && lng !== null
      ? getCavitesNearbyCached(lat, lng)
      : Promise.resolve([] as Cavite[]),
  ])
  return {
    radon,
    ppri,
    argiles,
    cavites,
    source: GEORISQUES_SOURCE_LABEL,
    fetchedAt: new Date().toISOString(),
  }
}
