/**
 * KOVAS — Wrapper Géorisques (georisques.gouv.fr).
 *
 * Documentation officielle : https://www.georisques.gouv.fr/doc-api
 * Base URL : https://www.georisques.gouv.fr/api/v1
 * Coût : gratuit, sans clé.
 * Rate limit : ~5 req/s (soft).
 *
 * Endpoints utilisés (V1) :
 *   - /gaspar/risques?code_insee=...     → risques naturels/technologiques par commune
 *   - /gaspar/ppr?code_insee=...         → plans de prévention des risques (PPRI/PPRT)
 *   - /radon?code_insee=...              → potentiel radon (niveau 1/2/3)
 *   - /retrait-gonflement-argile?lat&lng → aléa argile (faible/moyen/fort)
 *   - /cavites?lat&lng&rayon             → cavités souterraines connues dans rayon (max 1000m)
 *   - /sismique?code_insee=...           → zone sismique 1-5
 *
 * Utilité KOVAS : alimentation automatique du diagnostic ERP (État des Risques
 *                 et Pollutions, ex-ERNMT), arrêtés préfectoraux applicables.
 *
 * Points de cassure connus :
 *   - L'API renvoie 404 pour les communes < 50 habitants (non documenté).
 *   - Le payload retrait-gonflement varie selon la disponibilité cartographique.
 *
 * Authority : CLAUDE.md §3 #3 (Géorisques ERP) + open-data-enrichments.
 *             docs/data-gouv-opportunities.md §3 Top #3 (Géorisques étendu).
 */

const GEORISQUES_DEFAULT_BASE_URL = 'https://www.georisques.gouv.fr/api/v1'

/** Source canonique affichée côté UI client. */
export const GEORISQUES_SOURCE_LABEL = 'georisques.gouv.fr' as const
export type GeorisquesSource = typeof GEORISQUES_SOURCE_LABEL

/** Timeout standard pour les requêtes Géorisques (5s, retry 1x autorisé). */
const DEFAULT_TIMEOUT_MS = 5000
const DEFAULT_RETRY_COUNT = 1

export interface GeorisquesPayload {
  code_insee: string
  risques_naturels: unknown[]
  risques_technologiques: unknown[]
  zone_sismique: number | null
  potentiel_radon: number | null
  alea_argile: string | null
  ppr_applicables: unknown[]
  arretes_recents: unknown[]
  raw: Record<string, unknown>
}

export interface GeorisquesFetchOptions {
  baseUrl?: string
  signal?: AbortSignal
  timeoutMs?: number
}

interface GenericObj {
  data?: unknown[]
  results?: unknown[]
}

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) return process.env[key]
  return undefined
}

function getBaseUrl(opts?: GeorisquesFetchOptions): string {
  return opts?.baseUrl ?? getEnv('GEORISQUES_API_BASE_URL') ?? GEORISQUES_DEFAULT_BASE_URL
}

async function safeFetchJson(
  url: string,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function arrayOf(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const o = v as GenericObj
    if (Array.isArray(o.data)) return o.data
    if (Array.isArray(o.results)) return o.results
  }
  return []
}

/**
 * Variante avec timeout + retry exponentiel léger (1 retry, backoff 250ms).
 * Renvoie `null` si toutes les tentatives échouent (network, 4xx, 5xx, timeout).
 */
async function safeFetchJsonWithRetry(
  url: string,
  timeoutMs: number,
  retries: number,
  externalSignal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  let attempt = 0
  while (attempt <= retries) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    // Si l'appelant fournit son propre signal, on s'aligne dessus aussi.
    const onExternalAbort = () => controller.abort()
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort()
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
    }
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store',
      })
      if (res.ok) {
        return (await res.json()) as Record<string, unknown>
      }
      // 4xx considéré non-retryable (ex: 404 commune absente)
      if (res.status >= 400 && res.status < 500) return null
    } catch {
      // network / timeout → retry si autorisé
    } finally {
      clearTimeout(id)
      if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort)
    }
    attempt += 1
    if (attempt <= retries) {
      await new Promise((r) => setTimeout(r, 250 * attempt))
    }
  }
  return null
}

/**
 * Récupère un agrégat Géorisques pour une commune (code INSEE) et un point
 * (lat, lng) pour les requêtes géographiques (argile). Best-effort, retourne
 * une structure même si certains sous-appels échouent.
 */
export async function fetchGeorisquesByLocation(
  codeInsee: string,
  latitude: number | null,
  longitude: number | null,
  opts: GeorisquesFetchOptions = {},
): Promise<GeorisquesPayload | null> {
  if (!codeInsee) return null
  const baseUrl = getBaseUrl(opts)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000)
  const signal = opts.signal ?? controller.signal

  try {
    const [gaspar, radon, sismique, argile] = await Promise.all([
      safeFetchJson(`${baseUrl}/gaspar/risques?code_insee=${codeInsee}`, signal),
      safeFetchJson(`${baseUrl}/radon?code_insee=${codeInsee}`, signal),
      safeFetchJson(`${baseUrl}/zonage_sismique?code_insee=${codeInsee}`, signal),
      latitude !== null && longitude !== null
        ? safeFetchJson(
            `${baseUrl}/retrait-gonflement-argile?latlon=${latitude},${longitude}`,
            signal,
          )
        : Promise.resolve(null),
    ])

    const risquesAll = arrayOf(gaspar?.['risques']) as Array<Record<string, unknown>>
    const risquesNaturels = risquesAll.filter((r) => r['type_risque'] === 'naturel')
    const risquesTechno = risquesAll.filter((r) => r['type_risque'] === 'technologique')
    const ppr = arrayOf(gaspar?.['ppr'])
    const arretes = arrayOf(gaspar?.['arretes_cat_nat']).slice(0, 10)

    return {
      code_insee: codeInsee,
      risques_naturels: risquesNaturels,
      risques_technologiques: risquesTechno,
      zone_sismique:
        typeof sismique?.['zone_sismicite'] === 'number'
          ? (sismique['zone_sismicite'] as number)
          : null,
      potentiel_radon:
        typeof radon?.['classe_potentiel'] === 'number'
          ? (radon['classe_potentiel'] as number)
          : null,
      alea_argile:
        typeof argile?.['exposition'] === 'string' ? (argile['exposition'] as string) : null,
      ppr_applicables: ppr,
      arretes_recents: arretes,
      raw: { gaspar, radon, sismique, argile },
    }
  } finally {
    clearTimeout(timeout)
  }
}

/* ──────────────────────────────────────────────────────────────────────── */
/* Extension Géorisques — Radon / PPRI / Argiles / Cavités (Lot data-gouv) */
/* ──────────────────────────────────────────────────────────────────────── */

/**
 * Classe radon (1, 2 ou 3) selon la nomenclature IRSN/Géorisques.
 *  - 1 : potentiel faible
 *  - 2 : potentiel moyen avec possibilité de localement plus élevé
 *  - 3 : significatif — **obligation Information Acquéreur/Locataire (IAL)**
 *
 * Référence : arrêté 27 juin 2018 + R125-23 CCH (IAL).
 */
export type RadonClasse = 1 | 2 | 3

export interface RadonRisk {
  codeInsee: string
  classe: RadonClasse
  /** `true` si classe 3 → IAL obligatoire et diagnostic radon recommandé. */
  obligationIAL: boolean
  source: GeorisquesSource
}

export interface PPRIResult {
  codeInsee: string
  /** Identifiant Gaspar (ex : "PPRI_DRN_76_001"). */
  id: string
  /** Libellé court du plan (ex : "PPRi de la vallée de la Seine"). */
  libelle: string
  /** "approuve" | "prescrit" | "annule" — laisse en TEXT côté DB pour évolution. */
  etat: string
  /** Date d'approbation au format ISO (YYYY-MM-DD) si dispo. */
  dateApprobation: string | null
  /** URL fiche officielle Géorisques si disponible. */
  url: string | null
  source: GeorisquesSource
}

export type ArgilesAlea = 'faible' | 'moyen' | 'fort'

export interface ArgilesRisk {
  lat: number
  lng: number
  alea: ArgilesAlea
  /** `true` si moyen/fort → IAL obligatoire (loi ELAN 2019). */
  obligationIAL: boolean
  source: GeorisquesSource
}

export interface Cavite {
  /** Identifiant Géorisques (ex : "BRGM_CAV_76_00123"). */
  id: string
  type: string | null
  /** Libellé public (ex : "Ancienne carrière de craie"). */
  libelle: string | null
  /** Distance approximative au point central, en mètres. */
  distanceM: number | null
  source: GeorisquesSource
}

export interface GeorisquesExtFetchOptions extends GeorisquesFetchOptions {
  /** Nombre de retries supplémentaires (défaut 1). */
  retries?: number
}

/**
 * Normalise le libellé d'aléa argile retourné par Géorisques en valeur stricte.
 * L'API renvoie historiquement des chaînes comme "Faible", "Moyen", "Fort"
 * mais parfois aussi "moyen à fort" ou "élevé" — on s'aligne sur 3 paliers.
 */
function normalizeArgilesAlea(raw: unknown): ArgilesAlea | null {
  if (typeof raw !== 'string') return null
  const lower = raw.toLowerCase().trim()
  if (!lower) return null
  // Fort / élevé / très fort
  if (lower.includes('fort') || lower.includes('élev') || lower.includes('eleve')) return 'fort'
  // Moyen / modéré
  if (lower.includes('moyen') || lower.includes('moder')) return 'moyen'
  // Faible / nul
  if (lower.includes('faible') || lower.includes('nul')) return 'faible'
  return null
}

/**
 * Normalise une classe radon en entier 1, 2 ou 3.
 * Tolère les variations de payload selon l'endpoint (classe / niveau / classe_potentiel).
 */
function normalizeRadonClasse(raw: unknown): RadonClasse | null {
  let v: number | null = null
  if (typeof raw === 'number') v = raw
  else if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isNaN(parsed)) v = parsed
  }
  if (v === 1 || v === 2 || v === 3) return v
  return null
}

/**
 * Récupère le potentiel radon d'une commune via son code INSEE.
 *
 * @param codeInsee — code INSEE 5 caractères (ex : "76217" pour Dieppe)
 * @returns RadonRisk ou null si commune introuvable / payload incomplet.
 */
export async function getRadonRisk(
  codeInsee: string,
  opts: GeorisquesExtFetchOptions = {},
): Promise<RadonRisk | null> {
  if (!codeInsee) return null
  const baseUrl = getBaseUrl(opts)
  const url = `${baseUrl}/radon?code_insee=${encodeURIComponent(codeInsee)}`
  const data = await safeFetchJsonWithRetry(
    url,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.retries ?? DEFAULT_RETRY_COUNT,
    opts.signal,
  )
  if (!data) return null

  // Le payload peut être direct ou wrap dans { data: {...} } / { resultat: {...} }.
  const wrap =
    (data['data'] as Record<string, unknown> | undefined) ??
    (data['resultat'] as Record<string, unknown> | undefined) ??
    data
  const classe =
    normalizeRadonClasse(wrap['classe_potentiel']) ??
    normalizeRadonClasse(wrap['classe']) ??
    normalizeRadonClasse(wrap['niveau'])
  if (classe === null) return null
  return {
    codeInsee,
    classe,
    obligationIAL: classe === 3,
    source: GEORISQUES_SOURCE_LABEL,
  }
}

/**
 * Récupère la liste des Plans de Prévention des Risques Inondation (PPRI)
 * applicables à une commune. Inclut tous les plans connus de Géorisques —
 * filtré côté caller pour ne garder que les plans "approuvés" si besoin.
 */
export async function getPPRI(
  codeInsee: string,
  opts: GeorisquesExtFetchOptions = {},
): Promise<PPRIResult[]> {
  if (!codeInsee) return []
  const baseUrl = getBaseUrl(opts)
  // Endpoint canonique Gaspar PPR.
  const url = `${baseUrl}/gaspar/ppr?code_insee=${encodeURIComponent(codeInsee)}`
  const data = await safeFetchJsonWithRetry(
    url,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.retries ?? DEFAULT_RETRY_COUNT,
    opts.signal,
  )
  if (!data) return []

  const items = arrayOf(data['data']) as Array<Record<string, unknown>>
  // On ne retient que les plans inondation (PPRI / PPRn-i / PPRn type "inondation").
  const isPPRI = (row: Record<string, unknown>): boolean => {
    const typeRisque = String(row['type_risque'] ?? '').toLowerCase()
    const libelle = String(row['libelle'] ?? row['libelle_type'] ?? '').toLowerCase()
    const codeRisque = String(row['code_type_ppr'] ?? row['code_risque'] ?? '').toUpperCase()
    return (
      typeRisque.includes('inondation') ||
      libelle.includes('inondation') ||
      codeRisque.startsWith('PPRI') ||
      codeRisque === 'I'
    )
  }

  return items.filter(isPPRI).map<PPRIResult>((row) => ({
    codeInsee,
    id:
      String(row['id_gaspar'] ?? row['id'] ?? row['code_national_ppr'] ?? '') ||
      `${codeInsee}-${row['libelle'] ?? 'PPRI'}`,
    libelle: String(
      row['libelle'] ?? row['libelle_type'] ?? 'Plan de Prévention Risque Inondation',
    ),
    etat: String(row['etat'] ?? row['etat_avancement'] ?? 'inconnu').toLowerCase(),
    dateApprobation:
      typeof row['date_approbation'] === 'string' ? (row['date_approbation'] as string) : null,
    url: typeof row['url_fiche'] === 'string' ? (row['url_fiche'] as string) : null,
    source: GEORISQUES_SOURCE_LABEL,
  }))
}

/**
 * Récupère le niveau d'aléa retrait-gonflement des argiles (RGA) à une
 * coordonnée. Aléa moyen/fort → obligation IAL (Information Acquéreur/Locataire,
 * loi ELAN 23/11/2018 + arrêté 22/07/2020).
 */
export async function getArgilesRisk(
  lat: number,
  lng: number,
  opts: GeorisquesExtFetchOptions = {},
): Promise<ArgilesRisk | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const baseUrl = getBaseUrl(opts)
  // Endpoint historique : ?latlon=lat,lng
  const url = `${baseUrl}/retrait-gonflement-argile?latlon=${lat},${lng}`
  const data = await safeFetchJsonWithRetry(
    url,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.retries ?? DEFAULT_RETRY_COUNT,
    opts.signal,
  )
  if (!data) return null

  // Le payload peut être direct ou enveloppé.
  const wrap =
    (data['data'] as Record<string, unknown> | undefined) ??
    (data['resultat'] as Record<string, unknown> | undefined) ??
    data
  const alea =
    normalizeArgilesAlea(wrap['alea']) ??
    normalizeArgilesAlea(wrap['exposition']) ??
    normalizeArgilesAlea(wrap['niveau'])
  if (!alea) return null
  return {
    lat,
    lng,
    alea,
    obligationIAL: alea === 'moyen' || alea === 'fort',
    source: GEORISQUES_SOURCE_LABEL,
  }
}

/**
 * Récupère les cavités souterraines connues à proximité d'un point.
 *
 * @param rayonM — rayon en mètres (défaut 500, plafonné à 1000 par l'API).
 */
export async function getCavitesNearby(
  lat: number,
  lng: number,
  rayonM = 500,
  opts: GeorisquesExtFetchOptions = {},
): Promise<Cavite[]> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return []
  const safeRayon = Math.min(Math.max(Math.round(rayonM), 10), 1000)
  const baseUrl = getBaseUrl(opts)
  const url = `${baseUrl}/cavites?latlon=${lat},${lng}&rayon=${safeRayon}`
  const data = await safeFetchJsonWithRetry(
    url,
    opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    opts.retries ?? DEFAULT_RETRY_COUNT,
    opts.signal,
  )
  if (!data) return []

  const items = arrayOf(data['data']) as Array<Record<string, unknown>>
  return items.map<Cavite>((row) => ({
    id:
      String(row['id_cavite'] ?? row['id'] ?? row['code_national'] ?? '') ||
      `${lat.toFixed(5)},${lng.toFixed(5)}-${row['libelle'] ?? 'cavite'}`,
    type: typeof row['type'] === 'string' ? (row['type'] as string) : null,
    libelle: typeof row['libelle'] === 'string' ? (row['libelle'] as string) : null,
    distanceM:
      typeof row['distance_metres'] === 'number'
        ? (row['distance_metres'] as number)
        : typeof row['distance'] === 'number'
          ? (row['distance'] as number)
          : null,
    source: GEORISQUES_SOURCE_LABEL,
  }))
}
