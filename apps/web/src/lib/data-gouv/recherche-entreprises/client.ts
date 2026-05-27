/**
 * KOVAS — Wrapper API Recherche d'Entreprises (api.gouv.fr).
 *
 * Documentation officielle : https://recherche-entreprises.api.gouv.fr/docs/
 * Endpoint : https://recherche-entreprises.api.gouv.fr/search
 *
 * Caractéristiques :
 *   - 100% ouverte, sans clé d'API, sans inscription.
 *   - Couvre tous les établissements actifs du registre SIRENE INSEE.
 *   - Retourne identité, état administratif (A/C), code NAF, forme juridique.
 *
 * Utilité KOVAS :
 *   - Remplace la validation Luhn V1 (qui valide n'importe quel SIRET fictif
 *     mathématiquement valide) par une vérification réelle d'existence et
 *     d'activité.
 *   - Anti-abus essai gratuit 30j (cf. CLAUDE.md §6).
 *   - Badge "Activité diagnostic immobilier vérifiée" sur l'annuaire public.
 *
 * Cache : 7 jours via la table `sirene_check_cache` (Supabase). Les codes NAF
 * et états administratifs INSEE bougent peu, on évite la pression sur l'API
 * publique tout en restant frais.
 *
 * Stratégie de robustesse :
 *   - Timeout 5s avec AbortController.
 *   - 1 retry sur 5xx (jitter exponentiel court).
 *   - Échec → result.found=false avec error explicite — JAMAIS de throw.
 *     Le caller décide quoi faire (bloquer signup ou laisser passer en flag).
 *
 * Authority : CLAUDE.md §6, docs/data-gouv-opportunities.md §2.5.
 */

import { getNafLabel, isDiagnosticNAF, normalizeNafCode } from './naf-codes'

const DEFAULT_BASE_URL = 'https://recherche-entreprises.api.gouv.fr'
const DEFAULT_TIMEOUT_MS = 5_000
const MAX_RETRIES = 1

export type VerificationError = 'not_found' | 'network' | 'rate_limit' | 'parse'

export interface VerificationResult {
  /** SIRET tel que passé en entrée (14 chiffres, après nettoyage). */
  siret: string
  /** Établissement trouvé dans l'API. */
  found: boolean
  /** etat_administratif === 'A' (actif au registre SIRENE). */
  isActive: boolean
  /** Code NAF reconnu comme activité diagnostic (71.20B ou 71.12B). */
  isDiagnosticNAF: boolean
  /** Code NAF normalisé (`"71.20B"`) ou null si non trouvé / non parsable. */
  nafCode: string | null
  /** Libellé humain lisible du code NAF (ou null si NAF inconnu). */
  nafLabel: string | null
  /** Nom complet de l'entreprise / établissement (`nom_complet` API). */
  companyName: string | null
  /** Catégorie juridique (forme légale — `categorie_juridique` API). */
  legalForm: string | null
  /** En cas d'échec, code d'erreur normalisé. */
  error?: VerificationError
}

interface RawApiMatchingEtablissement {
  siret?: string
  etat_administratif?: string
  activite_principale?: string
  libelle_activite_principale?: string
}

interface RawApiResult {
  siren?: string
  nom_complet?: string
  nom_raison_sociale?: string
  etat_administratif?: string
  activite_principale?: string
  libelle_activite_principale?: string
  nature_juridique?: string
  matching_etablissements?: RawApiMatchingEtablissement[]
  siege?: {
    siret?: string
    etat_administratif?: string
    activite_principale?: string
  }
}

interface RawApiResponse {
  results?: RawApiResult[]
  total_results?: number
}

export interface VerifyOptions {
  /** Override base URL (tests). */
  baseUrl?: string
  /** Timeout en ms (défaut 5000). */
  timeoutMs?: number
  /** Active le retry sur 5xx (défaut true). */
  enableRetry?: boolean
  /** Signal d'annulation externe (optionnel). */
  signal?: AbortSignal
  /** Custom fetch (tests). */
  fetchFn?: typeof fetch
}

/**
 * Vérifie qu'un SIRET correspond à un établissement actif au registre SIRENE
 * et identifie son activité diagnostic immobilier.
 *
 * Ne throw jamais — toute erreur réseau / 5xx / 429 est traduite en
 * `result.found=false` + `error` explicite.
 */
export async function verifyDiagnosticActivity(
  siret: string,
  opts: VerifyOptions = {},
): Promise<VerificationResult> {
  const cleanedSiret = siret.replace(/\s/g, '')
  const base: VerificationResult = {
    siret: cleanedSiret,
    found: false,
    isActive: false,
    isDiagnosticNAF: false,
    nafCode: null,
    nafLabel: null,
    companyName: null,
    legalForm: null,
  }

  if (!/^\d{14}$/.test(cleanedSiret)) {
    return { ...base, error: 'parse' }
  }

  const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const enableRetry = opts.enableRetry !== false
  const fetchFn = opts.fetchFn ?? fetch

  const url = new URL('/search', baseUrl)
  url.searchParams.set('q', cleanedSiret)
  // `minimal=true` réduit le payload (on n'a pas besoin des dirigeants etc.)
  url.searchParams.set('minimal', 'true')
  // `include=matching_etablissements` pour récupérer le SIRET exact (pas le siège).
  url.searchParams.set('include', 'matching_etablissements')
  url.searchParams.set('page', '1')
  url.searchParams.set('per_page', '1')

  const maxAttempts = enableRetry ? 1 + MAX_RETRIES : 1

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // Combine external signal si fourni
    if (opts.signal) {
      if (opts.signal.aborted) {
        clearTimeout(timer)
        return { ...base, error: 'network' }
      }
      opts.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    try {
      const res = await fetchFn(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      })

      if (res.status === 429) {
        // Pas de retry agressif sur rate-limit — on remonte
        clearTimeout(timer)
        return { ...base, error: 'rate_limit' }
      }

      if (res.status >= 500 && res.status <= 599) {
        clearTimeout(timer)
        // Continue boucle pour retry sur 5xx
        if (attempt < maxAttempts - 1) {
          await delay(150 * (attempt + 1))
          continue
        }
        return { ...base, error: 'network' }
      }

      if (!res.ok) {
        clearTimeout(timer)
        return { ...base, error: 'parse' }
      }

      const raw = (await res.json().catch(() => null)) as RawApiResponse | null
      clearTimeout(timer)

      if (!raw || !Array.isArray(raw.results) || raw.results.length === 0) {
        return { ...base, error: 'not_found' }
      }

      return parseApiResult(raw.results[0]!, cleanedSiret)
    } catch {
      clearTimeout(timer)
      // AbortError ou erreur réseau bas niveau
      if (attempt < maxAttempts - 1) {
        await delay(150 * (attempt + 1))
        continue
      }
      return { ...base, error: 'network' }
    }
  }

  // Boucle épuisée sans return — théoriquement inatteignable.
  return { ...base, error: 'network' }
}

function parseApiResult(raw: RawApiResult, cleanedSiret: string): VerificationResult {
  // Si l'API ramène plusieurs établissements (uniteLegale multi-établissements),
  // on cherche l'établissement qui matche le SIRET demandé. Sinon fallback siège.
  const match: RawApiMatchingEtablissement | null = Array.isArray(raw.matching_etablissements)
    ? (raw.matching_etablissements.find((e) => e?.siret === cleanedSiret) ??
      raw.matching_etablissements[0] ??
      null)
    : null

  const etatAdm =
    match?.etat_administratif ?? raw.etat_administratif ?? raw.siege?.etat_administratif ?? null
  const nafRaw =
    match?.activite_principale ?? raw.activite_principale ?? raw.siege?.activite_principale ?? null
  const nafCode = normalizeNafCode(nafRaw)
  const nafLabel = match?.libelle_activite_principale ?? raw.libelle_activite_principale ?? null

  return {
    siret: cleanedSiret,
    found: true,
    isActive: etatAdm === 'A',
    isDiagnosticNAF: isDiagnosticNAF(nafRaw),
    nafCode,
    // Si l'API ne renvoie pas de libellé, on retombe sur notre table NAF maison.
    nafLabel: nafLabel ?? getNafLabel(nafRaw),
    companyName: raw.nom_complet ?? raw.nom_raison_sociale ?? null,
    legalForm: raw.nature_juridique ?? null,
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
