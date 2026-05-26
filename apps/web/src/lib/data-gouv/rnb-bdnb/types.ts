/**
 * Types RNB + BDNB CSTB — open data État FR.
 *
 * Toutes les structures sont défensives : la quasi-totalité des champs est
 * optionnelle car les APIs beta.gouv peuvent évoluer sans préavis et certains
 * bâtiments ont des fiches partielles (selon date de référencement INSEE/Sirene).
 */

// ─────────────────────────────────────────────────────────────────────────────
// RNB (Référentiel National des Bâtiments)
// ─────────────────────────────────────────────────────────────────────────────

/** Point GeoJSON [longitude, latitude] (WGS84 / EPSG:4326). */
export interface GeoJsonPoint {
  type: 'Point'
  coordinates: [number, number]
}

/** Adresse postale rattachée à un bâtiment RNB (issue de la BAN). */
export interface RnbAddress {
  id?: string
  source?: string
  street_number?: string
  street_rep?: string
  street_name?: string
  street_type?: string
  city_zipcode?: string
  city_name?: string
  city_insee_code?: string
}

/** Statut du bâtiment dans le référentiel (constructionPending, constructed, demolished...). */
export type RnbBuildingStatus =
  | 'constructionProject'
  | 'constructionPending'
  | 'constructed'
  | 'notUsable'
  | 'demolished'
  | 'demolishedPartially'
  | 'unknown'
  | string

/** Fiche bâtiment RNB. */
export interface RnbBuilding {
  rnb_id: string
  status?: RnbBuildingStatus
  point?: GeoJsonPoint
  addresses?: RnbAddress[]
  ext_ids?: Array<{ source: string; id: string; created_at?: string }>
  /** Date d'export RNB (ISO 8601). */
  exported_at?: string
}

/** Réponse paginée RNB sur recherche bbox/point/adresse. */
export interface RnbBuildingList {
  count?: number
  next?: string | null
  previous?: string | null
  results: RnbBuilding[]
}

// ─────────────────────────────────────────────────────────────────────────────
// BDNB CSTB (Base de Données Nationale des Bâtiments — dataset Open)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enrichissement BDNB brut.
 *
 * Les noms de champs reflètent les colonnes documentées sur
 * https://api-portail.bdnb.io (subset Open). Tout est optionnel : l'API peut
 * ne pas avoir d'observation sur un bâtiment donné, ou avoir des cellules NULL
 * sur les attributs estimés (matériaux, DPE consolidé...).
 */
export interface BdnbEnrichment {
  batiment_groupe_id?: string

  // Construction
  annee_construction?: number
  /** "metal", "brique", "beton", "pierre", "bois", "isole" … */
  materiau_mur_principal?: string
  /** "tuile", "ardoise", "metal", "beton", "vegetal" … */
  materiau_toiture?: string
  nombre_niveau?: number
  hauteur_estimee_m?: number
  surface_habitable_estimee_m2?: number

  // Énergie / DPE consolidé
  classe_dpe?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | string
  classe_ges?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | string
  /** Énergie principale de chauffage estimée. */
  energie_chauffage?: string

  // Risques / matériaux dangereux (estimations BDNB)
  /** Probabilité amiante (calculée selon date permis < 1997). */
  presence_amiante_probable?: boolean | number
  /** Probabilité plomb (bâti < 1949). */
  presence_plomb_probable?: boolean | number

  // Type de bâtiment
  /** "logement", "bureau", "commerce", "industrie" … */
  type_batiment?: string
  /** "individuel" / "collectif". */
  type_habitation?: string

  /** Date de l'observation BDNB (ISO 8601). */
  observed_at?: string

  // Tolérance schéma : champs additionnels potentiels (BDNB 200+ datasets).
  // Volontairement typés `unknown` pour rester strict TS et forcer un narrow
  // explicite côté consommateur si besoin.
  [extra: string]: unknown
}

// ─────────────────────────────────────────────────────────────────────────────
// Erreurs typées
// ─────────────────────────────────────────────────────────────────────────────

export type RnbErrorCode =
  | 'network'
  | 'rate_limit'
  | 'not_found'
  | 'parse'
  | 'timeout'
  | 'server_error'

export class RnbApiError extends Error {
  readonly code: RnbErrorCode
  readonly status?: number

  constructor(code: RnbErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'RnbApiError'
    this.code = code
    this.status = status
  }
}

export type BdnbErrorCode = RnbErrorCode

export class BdnbApiError extends Error {
  readonly code: BdnbErrorCode
  readonly status?: number

  constructor(code: BdnbErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'BdnbApiError'
    this.code = code
    this.status = status
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Adresse BAN d'entrée (compatible @/lib/ban.ts BanFeature)
// ─────────────────────────────────────────────────────────────────────────────

export interface BanAddressInput {
  /** Coordonnées BAN [longitude, latitude]. */
  longitude: number
  latitude: number
  /** Label complet ("12 rue de Rivoli 75001 Paris") pour les logs. */
  label?: string
  /** Code INSEE commune (5 caractères). */
  insee?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Sortie agrégée du prefill (RNB + BDNB combinés)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un champ du prefill : la valeur + un score de confiance.
 *
 * - `confidence >= 0.8` → pré-rempli automatiquement (badge sourcé).
 * - `0.5 <= confidence < 0.8` → suggestion grisée (utilisateur valide).
 * - `< 0.5` → ignoré.
 */
export interface PrefillField<T> {
  value: T
  confidence: number
  source: 'rnb' | 'bdnb'
}

/**
 * Résultat du prefill agrégé mappé vers les noms de champs KOVAS.
 *
 * `null` au top-level si aucune donnée RNB n'a pu être trouvée pour l'adresse.
 */
export interface PrefillResult {
  /** RNB ID universel (clé étrangère avec toutes les bases État FR). */
  rnb_id: string

  /** Année de construction (BDNB → year_built KOVAS). */
  year_built?: PrefillField<number>

  /** Surface habitable estimée (BDNB → surface_total KOVAS). */
  surface_total?: PrefillField<number>

  /** Type bâtiment ("maison" / "appartement" / ...) → property_type KOVAS. */
  property_type?: PrefillField<string>

  /** Matériau mur principal (info contextuelle, pas mappé directement V1). */
  wall_material?: PrefillField<string>

  /** Matériau toiture (info contextuelle, pas mappé directement V1). */
  roof_material?: PrefillField<string>

  /** Classe DPE consolidée (pré-info, indicatif). */
  dpe_class?: PrefillField<string>

  /** Probabilité amiante (bâti < 1997). Sert à pré-cocher le diag amiante. */
  asbestos_probable?: PrefillField<boolean>

  /** Probabilité plomb (bâti < 1949). Sert à pré-cocher le diag plomb CREP. */
  lead_probable?: PrefillField<boolean>

  /** Métadonnées techniques (debug / observabilité). */
  meta: {
    rnb_fetched_at: string
    bdnb_fetched_at: string | null
    /** true si une des sources a échoué (dégradation gracieuse). */
    degraded: boolean
  }
}
