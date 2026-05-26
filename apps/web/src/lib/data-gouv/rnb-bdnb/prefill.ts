/**
 * Orchestrateur de pré-remplissage mission RNB + BDNB.
 *
 * Flux :
 *   1. Adresse BAN (lng/lat) → RNB `lookupByPoint` → `rnb_id`
 *   2. `rnb_id` → BDNB `enrichBuilding` → carte d'identité bâtiment
 *   3. Mapping vers les noms de champs KOVAS + score de confiance par champ
 *
 * Dégradation gracieuse : si RNB répond mais BDNB échoue, on retourne tout de
 * même le `rnb_id` (utile comme clé étrangère future). Si RNB échoue, retour
 * `null` — l'utilisateur saisira manuellement.
 *
 * Aucune mention "IA" : c'est de l'open data État (RNB beta.gouv + BDNB CSTB).
 */

import { type BdnbCacheStore, type BdnbClientOptions, enrichBuilding } from './bdnb-client'
import { type RnbClientOptions, lookupByAddress } from './rnb-client'
import {
  type BanAddressInput,
  BdnbApiError,
  type BdnbEnrichment,
  type PrefillResult,
  RnbApiError,
  type RnbBuilding,
} from './types'

export interface PrefillOptions {
  rnb?: RnbClientOptions
  bdnb?: BdnbClientOptions
  /**
   * Sortie : passer un store unique. Si fourni, sert à la fois pour RNB et
   * BDNB. Le store doit implémenter `BdnbCacheStore` (qui étend `RnbCacheStore`).
   */
  cache?: BdnbCacheStore
}

/**
 * Pré-remplit les champs mission depuis l'open data État.
 *
 * @returns `PrefillResult` si RNB a trouvé un bâtiment, `null` sinon.
 *          `meta.degraded === true` si BDNB a échoué mais RNB a réussi.
 */
export async function getBuildingPrefill(
  address: BanAddressInput,
  opts: PrefillOptions = {},
): Promise<PrefillResult | null> {
  const cache = opts.cache
  const rnbOpts: RnbClientOptions = { ...(opts.rnb ?? {}), ...(cache ? { cache } : {}) }
  const bdnbOpts: BdnbClientOptions = { ...(opts.bdnb ?? {}), ...(cache ? { cache } : {}) }

  // 1. RNB lookup
  let rnbBuilding: RnbBuilding | null
  try {
    rnbBuilding = await lookupByAddress(address, rnbOpts)
  } catch (err) {
    // RNB est l'entrée de chaîne : si elle échoue, on rend la main proprement.
    // Pas d'erreur bloquante UX — l'utilisateur saisira manuellement.
    if (err instanceof RnbApiError) return null
    throw err
  }
  if (!rnbBuilding) return null

  const rnbFetchedAt = new Date().toISOString()

  // 2. BDNB lookup (best-effort)
  let bdnb: BdnbEnrichment | null = null
  let bdnbFetchedAt: string | null = null
  let degraded = false
  try {
    bdnb = await enrichBuilding(rnbBuilding.rnb_id, bdnbOpts)
    if (bdnb) bdnbFetchedAt = new Date().toISOString()
  } catch (err) {
    if (err instanceof BdnbApiError) {
      degraded = true
    } else {
      throw err
    }
  }

  // 3. Mapping vers PrefillResult
  return mapToPrefillResult(rnbBuilding, bdnb, { rnbFetchedAt, bdnbFetchedAt, degraded })
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping RNB+BDNB → PrefillResult
// ─────────────────────────────────────────────────────────────────────────────

interface MapMeta {
  rnbFetchedAt: string
  bdnbFetchedAt: string | null
  degraded: boolean
}

/**
 * Mapping pur (testable sans réseau). Exporté pour faciliter les tests unitaires.
 *
 * Heuristiques de confiance :
 *   - 1.0  → donnée directe BDNB (observation officielle CSTB)
 *   - 0.85 → donnée dérivée d'une règle réglementaire (amiante < 1997, plomb < 1949)
 *   - 0.7  → estimation BDNB (surface, hauteur, nb niveaux)
 *   - 0.5  → suggestion (utilisateur valide)
 */
export function mapToPrefillResult(
  rnb: RnbBuilding,
  bdnb: BdnbEnrichment | null,
  meta: MapMeta,
): PrefillResult {
  const result: PrefillResult = {
    rnb_id: rnb.rnb_id,
    meta: {
      rnb_fetched_at: meta.rnbFetchedAt,
      bdnb_fetched_at: meta.bdnbFetchedAt,
      degraded: meta.degraded,
    },
  }

  if (!bdnb) return result

  // Année construction
  if (typeof bdnb.annee_construction === 'number' && bdnb.annee_construction >= 1000) {
    result.year_built = {
      value: bdnb.annee_construction,
      confidence: 1.0,
      source: 'bdnb',
    }
  }

  // Surface habitable estimée
  if (
    typeof bdnb.surface_habitable_estimee_m2 === 'number' &&
    bdnb.surface_habitable_estimee_m2 > 0
  ) {
    result.surface_total = {
      value: bdnb.surface_habitable_estimee_m2,
      confidence: 0.7, // estimation BDNB, surface terrain ≠ surface habitable réelle
      source: 'bdnb',
    }
  }

  // Type bâtiment → property_type KOVAS
  const propType = mapBdnbToKovasPropertyType(bdnb)
  if (propType) {
    result.property_type = {
      value: propType,
      confidence: 0.85,
      source: 'bdnb',
    }
  }

  // Matériaux (informatif, pas mappé directement à un champ V1)
  if (bdnb.materiau_mur_principal) {
    result.wall_material = {
      value: bdnb.materiau_mur_principal,
      confidence: 0.7,
      source: 'bdnb',
    }
  }
  if (bdnb.materiau_toiture) {
    result.roof_material = {
      value: bdnb.materiau_toiture,
      confidence: 0.7,
      source: 'bdnb',
    }
  }

  // DPE consolidé (info indicative — le diag réel reste à faire)
  if (bdnb.classe_dpe && isDpeLetter(bdnb.classe_dpe)) {
    result.dpe_class = {
      value: bdnb.classe_dpe,
      confidence: 0.5, // dataset consolidé, peut être obsolète (DPE valable 10 ans)
      source: 'bdnb',
    }
  }

  // Probabilité amiante : règle réglementaire FR (permis construire < 1997).
  const asbestos = computeAsbestosProbable(bdnb)
  if (asbestos !== null) {
    result.asbestos_probable = {
      value: asbestos.value,
      confidence: asbestos.confidence,
      source: 'bdnb',
    }
  }

  // Probabilité plomb : règle réglementaire FR (permis construire < 1949).
  const lead = computeLeadProbable(bdnb)
  if (lead !== null) {
    result.lead_probable = {
      value: lead.value,
      confidence: lead.confidence,
      source: 'bdnb',
    }
  }

  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// Règles métier KOVAS — mapping BDNB → props et estimations réglementaires
// ─────────────────────────────────────────────────────────────────────────────

/** Mappe le `type_batiment` + `type_habitation` BDNB vers le KOVAS `property_type`. */
function mapBdnbToKovasPropertyType(bdnb: BdnbEnrichment): string | null {
  const t = bdnb.type_batiment?.toLowerCase()
  const h = bdnb.type_habitation?.toLowerCase()

  if (t === 'logement' || t === 'residentiel') {
    if (h === 'individuel') return 'maison'
    if (h === 'collectif') return 'appartement'
  }
  if (t === 'bureau' || t === 'tertiaire_bureau') return 'bureau'
  if (t === 'commerce' || t === 'tertiaire_commerce') return 'local_commercial'
  if (t === 'industrie' || t === 'industriel') return 'autre'
  return null
}

/**
 * Probabilité amiante d'après les règles FR :
 *   - Permis construire < 1997 → amiante probable (très haute confiance).
 *   - 1997 ≤ permis ≤ 2005 → possible (faible confiance, traces résiduelles).
 *   - > 2005 → improbable.
 *
 * Si BDNB a un champ `presence_amiante_probable` explicite, on l'utilise en priorité.
 */
function computeAsbestosProbable(
  bdnb: BdnbEnrichment,
): { value: boolean; confidence: number } | null {
  // Champ direct BDNB (rare mais possible).
  if (typeof bdnb.presence_amiante_probable === 'boolean') {
    return { value: bdnb.presence_amiante_probable, confidence: 0.9 }
  }
  if (typeof bdnb.presence_amiante_probable === 'number') {
    return { value: bdnb.presence_amiante_probable > 0.5, confidence: 0.85 }
  }

  // Règle réglementaire FR sur année construction.
  const year = bdnb.annee_construction
  if (typeof year !== 'number') return null
  if (year < 1997) return { value: true, confidence: 0.9 }
  if (year <= 2005) return { value: true, confidence: 0.5 }
  return { value: false, confidence: 0.8 }
}

/**
 * Probabilité plomb (CREP) d'après la règle FR :
 *   - Permis construire < 1949 → plomb probable (peintures au plomb autorisées
 *     jusqu'en 1948).
 */
function computeLeadProbable(bdnb: BdnbEnrichment): { value: boolean; confidence: number } | null {
  if (typeof bdnb.presence_plomb_probable === 'boolean') {
    return { value: bdnb.presence_plomb_probable, confidence: 0.9 }
  }
  if (typeof bdnb.presence_plomb_probable === 'number') {
    return { value: bdnb.presence_plomb_probable > 0.5, confidence: 0.85 }
  }

  const year = bdnb.annee_construction
  if (typeof year !== 'number') return null
  if (year < 1949) return { value: true, confidence: 0.95 }
  return { value: false, confidence: 0.9 }
}

function isDpeLetter(s: string): boolean {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(s.toUpperCase())
}
