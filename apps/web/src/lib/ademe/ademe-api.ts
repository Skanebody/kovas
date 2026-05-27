/**
 * KOVAS — Module Cockpit ADEME — Wrapper API publique ADEME (open data).
 *
 * Endpoint racine : ADEME_API_BASE_URL (default https://data.ademe.fr/data-fair/api/v1)
 * Dataset visé V1 : `dpe-v2-logements-existants`.
 *
 * Caractéristiques :
 *   - Gratuit, sans clé API, soft rate limit ~10 req/s (constaté empiriquement,
 *     non documenté publiquement). On respecte ce plafond via une queue interne.
 *   - Pagination par `size` (max 10 000 par requête sur data-fair, on cap à
 *     10 000 et on enchaîne `after` pour aller au-delà).
 *   - Erreurs typiques : 429 (rate limit) / 500 / 502 — retry exponentiel.
 *
 * Stratégie de matching diagnostiqueur :
 *   1. **Priorité 1** : filtre exact sur `NUM_CERTIFICAT_RGE` (= certificat
 *      du diagnostiqueur). Champ stable, peu de bruit.
 *   2. **Fallback fuzzy** (V2 — cf. TODO `ademe-daily-sync`) : query par
 *      `NOM_DIAGNOSTIQUEUR` + filtre Levenshtein côté client. Bruyant, à
 *      étiqueter "non garanti" dans l'UI.
 *
 * Toutes les requêtes passent par fetch natif (Edge / Node 20+ compatible).
 */

import { haversineDistanceKm } from './haversine'

// ============================================================
// Configuration
// ============================================================

const DEFAULT_BASE_URL = 'https://data.ademe.fr/data-fair/api/v1'
const DATASET_DPE_V2 = 'dpe-v2-logements-existants'

/** Limite documentée data-fair pour `size`. Au-delà, l'API rejette. */
const MAX_PAGE_SIZE = 10_000

/** Plafond rate limit (req/s). On vise 8 pour garder une marge sur 429. */
const MAX_REQUESTS_PER_SECOND = 8

/** TTL cache en mémoire (ms). 1 heure = compromis fraîcheur / volume. */
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000

/** Capacité max du cache LRU en mémoire. */
const MEMORY_CACHE_MAX_ENTRIES = 200

/** Nombre max de retries sur erreurs transitoires (429, 5xx). */
const MAX_RETRIES = 4

/** Délai initial entre retries (ms), doublé à chaque essai. */
const RETRY_BASE_DELAY_MS = 500

function getBaseUrl(): string {
  // Compatible Node (process.env) + Edge (process.env injecté par Next.js).
  // Pour Deno : remplacer par `Deno.env.get(...)` côté Edge Function.
  const envBase =
    typeof process !== 'undefined' && process.env ? process.env.ADEME_API_BASE_URL : undefined
  return envBase ?? DEFAULT_BASE_URL
}

// ============================================================
// Types — champs ADEME (subset des ~150 champs disponibles)
// ============================================================

/**
 * Représentation TS minimaliste d'une ligne DPE retournée par data.ademe.fr.
 * Les noms de champs ADEME utilisent un mix de PascalCase + snake — on garde
 * la casse d'origine pour éviter toute confusion (mapping bidirectionnel).
 *
 * Tous les champs sont optionnels car l'ADEME publie des lignes incomplètes
 * (DPE anciens migrés, erreurs de remplissage). Le code aval doit gérer
 * `undefined` partout.
 */
export interface AdemeDpe {
  Numero_DPE?: string
  Ancien_Numero_DPE?: string
  Date_etablissement_DPE?: string // ISO date
  Date_visite_diagnostiqueur?: string // ISO date
  Date_fin_validite_DPE?: string // ISO date

  // Diagnostiqueur
  NUM_CERTIFICAT_RGE?: string
  Nom_diagnostiqueur?: string
  Organisme_certificateur?: string

  // Adresse / géo
  Adresse_complete?: string
  Adresse_brut?: string
  Code_postal_brut?: string
  Code_postal_BAN?: string
  Nom_commune_brut?: string
  Nom_commune_BAN?: string
  Code_INSEE_BAN?: string
  Coordonnee_cartographique_x_BAN?: number
  Coordonnee_cartographique_y_BAN?: number
  Latitude?: number
  Longitude?: number

  // Caractéristiques bâti
  Type_batiment?: string // maison | appartement | immeuble
  Annee_construction?: number
  Surface_habitable_logement?: number // m²
  Surface_habitable_immeuble?: number
  Nombre_niveau_logement?: number

  // Équipements
  Type_energie_principale_chauffage?: string
  Type_installation_chauffage?: string
  Type_climatisation?: string
  Type_installation_ECS?: string
  Type_ventilation?: string

  // Résultats DPE
  Etiquette_DPE?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  Etiquette_GES?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  Conso_5_usages_par_m2_ep?: number // kWh/m²/an énergie primaire
  Conso_5_usages_ef?: number // kWh/an énergie finale totale
  Emission_GES_5_usages_par_m2?: number // kgCO2/m²/an
  Emission_GES_5_usages?: number // kgCO2/an total

  // Hors-périmètre V1 mais utiles
  Periode_construction?: string

  // Payload brut autre (data.ademe.fr renvoie ~150 champs)
  [key: string]: unknown
}

/** Réponse JSON brute data-fair. */
interface DataFairResponse {
  total: number
  results: AdemeDpe[]
  next?: string
}

// ============================================================
// Rate limiter — queue simple à fenêtre glissante (ms timestamps)
// ============================================================

/**
 * Limiteur très simple : on conserve les timestamps des N dernières
 * requêtes. Si la requête courante porterait le total > MAX/s sur la
 * dernière seconde, on attend.
 *
 * Pas de dépendance (`p-limit` non installé). Suffisant pour 1 worker.
 * En multi-worker (cron parallèle), risque de petit dépassement → 429
 * géré par retry.
 */
class RateLimiter {
  private readonly timestamps: number[] = []

  constructor(private readonly maxPerSecond: number) {}

  async acquire(): Promise<void> {
    const now = Date.now()
    // Purge des entries > 1s
    while (this.timestamps.length > 0 && now - (this.timestamps[0] ?? 0) > 1000) {
      this.timestamps.shift()
    }
    if (this.timestamps.length >= this.maxPerSecond) {
      const oldest = this.timestamps[0] ?? now
      const waitMs = Math.max(0, 1000 - (now - oldest)) + 5
      await sleep(waitMs)
      return this.acquire()
    }
    this.timestamps.push(Date.now())
  }
}

const limiter = new RateLimiter(MAX_REQUESTS_PER_SECOND)

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================
// Cache LRU en mémoire
// ============================================================

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class MemoryLruCache<T> {
  private readonly map = new Map<string, CacheEntry<T>>()

  constructor(private readonly maxEntries: number) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.map.delete(key)
      return undefined
    }
    // LRU touch
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.value
  }

  set(key: string, value: T, ttlMs: number): void {
    if (this.map.size >= this.maxEntries) {
      const firstKey = this.map.keys().next().value
      if (firstKey !== undefined) this.map.delete(firstKey)
    }
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
  }
}

const cache = new MemoryLruCache<AdemeDpe[]>(MEMORY_CACHE_MAX_ENTRIES)

// ============================================================
// Fetch interne avec retry exponentiel
// ============================================================

interface FetchOptions {
  /** Champs à projeter (data-fair `select`). `*` par défaut. */
  select?: string
  /** Page size (cap MAX_PAGE_SIZE). */
  size?: number
  /** Token de pagination data-fair (`next` retourné dans la réponse précédente). */
  after?: string
  /** Filtres data-fair `qs` (mini-query language). Ex: `NUM_CERTIFICAT_RGE:"XYZ"`. */
  qs?: string
  /** Recherche full-text simple (`q=...`). Moins précis que `qs`. */
  q?: string
  /** Filtre par date (`Date_etablissement_DPE>=YYYY-MM-DD`) — appended dans qs. */
  sinceDate?: string
}

async function fetchOnePage(opts: FetchOptions): Promise<DataFairResponse> {
  const url = new URL(`${getBaseUrl()}/datasets/${DATASET_DPE_V2}/lines`)
  url.searchParams.set('size', String(Math.min(opts.size ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE)))
  url.searchParams.set('select', opts.select ?? '*')
  if (opts.after) url.searchParams.set('after', opts.after)

  // Construction du filtre qs (data-fair mini-DSL)
  const qsParts: string[] = []
  if (opts.qs) qsParts.push(opts.qs)
  if (opts.sinceDate) qsParts.push(`Date_etablissement_DPE:>=${opts.sinceDate}`)
  if (qsParts.length > 0) url.searchParams.set('qs', qsParts.join(' AND '))
  if (opts.q) url.searchParams.set('q', opts.q)

  await limiter.acquire()

  let attempt = 0
  let lastError: unknown
  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      })
      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        // Retry transitoire
        attempt += 1
        const backoff = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
        await sleep(backoff)
        continue
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(`ADEME API ${res.status} ${res.statusText} — ${body.slice(0, 200)}`)
      }
      const json = (await res.json()) as DataFairResponse
      return json
    } catch (err) {
      lastError = err
      attempt += 1
      if (attempt > MAX_RETRIES) break
      const backoff = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
      await sleep(backoff)
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`ADEME API: échec après ${MAX_RETRIES} retries`)
}

/**
 * Pagine intégralement une requête `qs`/`q` et accumule tous les résultats.
 *
 * ⚠️ À utiliser avec parcimonie pour les diagnostiqueurs très volumineux
 * (> 50 000 DPE/an = impossible en pratique en France, mais théorique).
 */
async function fetchAllPages(opts: FetchOptions): Promise<AdemeDpe[]> {
  const all: AdemeDpe[] = []
  let after: string | undefined
  let safety = 0
  do {
    const page = await fetchOnePage({ ...opts, after })
    all.push(...page.results)
    after = page.next
    safety += 1
    if (safety > 50) {
      // Garde-fou : 50 pages × 10k = 500k lignes. Bug si on en arrive là.
      throw new Error(`ADEME API: pagination runaway (> ${safety} pages)`)
    }
  } while (after)
  return all
}

// ============================================================
// API publique du wrapper
// ============================================================

/**
 * Récupère tous les DPE émis par un diagnostiqueur identifié par son
 * certificat RGE (champ `NUM_CERTIFICAT_RGE`).
 *
 * @param certificat     Numéro de certificat RGE (ex: `1234`, casse exacte).
 * @param lastSyncDate   Optionnel — ne ramène que les DPE publiés depuis
 *                       cette date (mode incrémental pour daily sync).
 */
export async function fetchDpeByCertificat(
  certificat: string,
  lastSyncDate?: Date,
): Promise<AdemeDpe[]> {
  if (!certificat || certificat.trim().length === 0) return []

  const since = lastSyncDate ? lastSyncDate.toISOString().slice(0, 10) : undefined
  const cacheKey = `cert:${certificat}:${since ?? 'full'}`

  const cached = cache.get(cacheKey)
  if (cached) return cached

  // data-fair qs : filtre exact via guillemets pour échapper les espaces / tirets.
  const qs = `NUM_CERTIFICAT_RGE:"${certificat.replace(/"/g, '\\"')}"`
  const fetchOpts: FetchOptions = { qs, ...(since !== undefined ? { sinceDate: since } : {}) }
  const results = await fetchAllPages(fetchOpts)
  cache.set(cacheKey, results, MEMORY_CACHE_TTL_MS)
  return results
}

/**
 * Récupère tous les DPE d'une commune (filtre INSEE).
 *
 * Utilitaire pour comparaisons benchmark / clustering géographique.
 * Pas appelé dans le daily sync mais exposé pour les vues Cockpit.
 */
export async function fetchDpeByCommune(inseeCode: string): Promise<AdemeDpe[]> {
  if (!inseeCode || inseeCode.trim().length === 0) return []
  const cacheKey = `insee:${inseeCode}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const qs = `Code_INSEE_BAN:"${inseeCode}"`
  const results = await fetchAllPages({ qs })
  cache.set(cacheKey, results, MEMORY_CACHE_TTL_MS)
  return results
}

/**
 * Fallback fuzzy : query par nom diagnostiqueur (`q=`), puis filtrage
 * Levenshtein côté client (distance ≤ 3 sur Nom_diagnostiqueur).
 *
 * ⚠️ **Non garanti** :
 *   - Homonymes (deux diagnostiqueurs même nom dans des régions distinctes)
 *   - Faute de frappe ADEME (le diagnostiqueur ne contrôle pas la donnée saisie)
 *   - Cabinet vs nom individuel (le champ `Nom_diagnostiqueur` peut contenir
 *     l'un ou l'autre selon le logiciel émetteur)
 *
 * À utiliser uniquement quand l'utilisateur n'a pas de RGE renseigné (rare,
 * mais possible chez les diagnostiqueurs débutants en cours de certification).
 */
export async function fetchDpeByNameFuzzy(fullName: string): Promise<AdemeDpe[]> {
  if (!fullName || fullName.trim().length < 3) return []
  const cacheKey = `name:${fullName.toLowerCase()}`
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const raw = await fetchAllPages({ q: fullName })
  const target = fullName.toLowerCase().trim()
  const filtered = raw.filter((row) => {
    const name = (row.Nom_diagnostiqueur ?? '').toLowerCase().trim()
    if (!name) return false
    return levenshtein(name, target) <= 3
  })
  cache.set(cacheKey, filtered, MEMORY_CACHE_TTL_MS)
  return filtered
}

// ============================================================
// Helpers exposés
// ============================================================

/**
 * Distance entre deux DPE (utilitaire pour `risk-calculator`).
 * Retourne `null` si l'une des coordonnées manque.
 */
export function distanceBetweenDpe(a: AdemeDpe, b: AdemeDpe): number | null {
  if (
    typeof a.Latitude !== 'number' ||
    typeof a.Longitude !== 'number' ||
    typeof b.Latitude !== 'number' ||
    typeof b.Longitude !== 'number'
  ) {
    return null
  }
  return haversineDistanceKm(
    { latitude: a.Latitude, longitude: a.Longitude },
    { latitude: b.Latitude, longitude: b.Longitude },
  )
}

// ============================================================
// Levenshtein (matching fuzzy nom)
// ============================================================

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = Array.from(
    { length: a.length + 1 },
    () => new Array(b.length + 1).fill(0) as number[],
  )
  for (let i = 0; i <= a.length; i += 1) {
    const row = matrix[i]
    if (row) row[0] = i
  }
  for (let j = 0; j <= b.length; j += 1) {
    const row = matrix[0]
    if (row) row[j] = j
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const rowI = matrix[i]
      const rowIPrev = matrix[i - 1]
      if (!rowI || !rowIPrev) continue
      const up = (rowIPrev[j] ?? 0) + 1
      const left = (rowI[j - 1] ?? 0) + 1
      const diag = (rowIPrev[j - 1] ?? 0) + cost
      rowI[j] = Math.min(up, left, diag)
    }
  }
  const lastRow = matrix[a.length]
  return lastRow?.[b.length] ?? Math.max(a.length, b.length)
}

// Export interne pour tests
export const __internal = { levenshtein, RateLimiter, MemoryLruCache }
