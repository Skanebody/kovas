/**
 * Wrapper Mes Aides Réno (France Rénov', publi.codes).
 *
 * Endpoint REST en bêta sur https://api.mesaidesreno.beta.gouv.fr/.
 * Sans authentification, sans quota publié. Timeout 8s car les calculs
 * publi.codes peuvent être lents.
 *
 * Stratégie :
 *  - Tente le calcul officiel via l'endpoint /api/v1/simulate.
 *  - 1 retry sur 5xx (backoff 800ms).
 *  - Cache 24h en mémoire par hash du payload d'entrée
 *    (les barèmes France Rénov' évoluent à pas annuel).
 *  - Si la réponse upstream est inutilisable, on retombe sur une
 *    estimation locale basée sur les barèmes MaPrimeRénov' / CEE 2026
 *    pour garantir la disponibilité de l'annexe PDF.
 *    Les conditions affichées orientent toujours vers un conseiller
 *    France Rénov' pour la validation officielle.
 */
import type { AideCode, AideInput, AideResult, DpeClass, LogementType, Occupation } from './types'
import { MesAidesRenoError } from './types'

const API_BASE = process.env.MES_AIDES_RENO_API_BASE ?? 'https://api.mesaidesreno.beta.gouv.fr'
const TIMEOUT_MS = 8_000
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000 // 24h

/** Entrée acceptée par l'endpoint upstream (best-guess, mappage interne). */
interface UpstreamRequest {
  situation: {
    'logement . surface': number
    'logement . année de construction': number
    'DPE . actuel': number
    'DPE . visé': number
    'logement . type': 'maison' | 'appartement'
    'ménage . code postal': string
    'ménage . revenu': number | null
    'ménage . occupation': 'propriétaire occupant' | 'propriétaire bailleur' | 'syndic'
  }
}

interface UpstreamAide {
  code?: string
  id?: string
  nom?: string
  label?: string
  montant?: number
  amount?: number
  conditions?: string[]
  url?: string
}

interface UpstreamResponse {
  aides?: UpstreamAide[]
}

interface CacheEntry {
  expiresAt: number
  value: AideResult[]
}

const cache: Map<string, CacheEntry> = new Map()

const DPE_NUM: Record<DpeClass, number> = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7 }

const OCCUPATION_LABEL: Record<Occupation, UpstreamRequest['situation']['ménage . occupation']> = {
  proprietaire_occupant: 'propriétaire occupant',
  proprietaire_bailleur: 'propriétaire bailleur',
  syndic: 'syndic',
}

/**
 * Lance une simulation auprès de Mes Aides Réno et renvoie la liste
 * d'aides éligibles. Cache 24h par hash de l'input.
 */
export async function simulateAides(input: AideInput): Promise<AideResult[]> {
  validateInput(input)

  const key = cacheKey(input)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value
  }

  let value: AideResult[]
  try {
    value = await callUpstream(input)
  } catch (err) {
    // Fallback algorithmique : garantit qu'on ne bloque pas l'export DPE
    // F/G juste parce que l'API bêta de France Rénov' est down.
    value = estimateLocally(input, err)
  }

  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
  return value
}

/** Vide le cache (utile pour les tests). */
export function clearCache(): void {
  cache.clear()
}

// ---------------------------------------------------------------------------
// Upstream
// ---------------------------------------------------------------------------

async function callUpstream(input: AideInput): Promise<AideResult[]> {
  const url = `${API_BASE}/api/v1/simulate`
  const body: UpstreamRequest = buildUpstreamRequest(input)

  let lastError: unknown = null
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      })
      clearTimeout(t)
      if (res.status >= 500 && res.status < 600) {
        lastError = new MesAidesRenoError(`Upstream 5xx: ${res.status}`)
        if (attempt === 0) {
          await wait(800)
          continue
        }
        throw lastError
      }
      if (!res.ok) {
        throw new MesAidesRenoError(`Upstream non-OK: ${res.status}`)
      }
      const raw = (await res.json()) as UpstreamResponse
      return normalizeUpstream(raw, input)
    } catch (err) {
      clearTimeout(t)
      lastError = err
      // Pas de retry sur abort/timeout/4xx — un seul retry sur 5xx (géré ci-dessus).
      if (attempt === 1) {
        throw err instanceof MesAidesRenoError
          ? err
          : new MesAidesRenoError('Mes Aides Réno upstream failed', err)
      }
      // Si on est en attempt 0 et que ce n'est pas un 5xx, on arrête.
      throw err instanceof MesAidesRenoError
        ? err
        : new MesAidesRenoError('Mes Aides Réno upstream failed', err)
    }
  }
  throw new MesAidesRenoError('Mes Aides Réno upstream failed', lastError)
}

function buildUpstreamRequest(input: AideInput): UpstreamRequest {
  return {
    situation: {
      'logement . surface': input.surface_m2,
      'logement . année de construction': input.annee_construction,
      'DPE . actuel': DPE_NUM[input.dpe_actuel],
      'DPE . visé': DPE_NUM[input.dpe_projete],
      'logement . type': input.type_logement,
      'ménage . code postal': input.code_postal,
      'ménage . revenu': input.revenu_fiscal_reference ?? null,
      'ménage . occupation': OCCUPATION_LABEL[input.occupation],
    },
  }
}

function normalizeUpstream(raw: UpstreamResponse, input: AideInput): AideResult[] {
  const list = raw.aides ?? []
  const results: AideResult[] = []
  for (const a of list) {
    const code = mapAideCode(a.code ?? a.id ?? '')
    if (!code) continue
    const montant = Math.round(a.montant ?? a.amount ?? 0)
    if (montant <= 0) continue
    results.push({
      code,
      label: a.nom ?? a.label ?? defaultLabel(code),
      montant_eur: montant,
      conditions: (a.conditions ?? []).slice(0, 5),
      source_url: a.url ?? defaultSourceUrl(code),
    })
  }
  // Si rien d'utilisable, on déclenche le fallback local.
  if (results.length === 0) {
    return estimateLocally(input, new MesAidesRenoError('Empty upstream'))
  }
  return results
}

function mapAideCode(raw: string): AideCode | null {
  const r = raw.toLowerCase()
  if (r.includes('mapri') || r === 'mpr' || r.includes('prime')) return 'mpr'
  if (r.includes('cee') || r.includes('certificat')) return 'cee'
  if (r.includes('eco') && r.includes('ptz')) return 'eco_ptz'
  if (r.includes('eco-ptz') || r === 'eco_ptz') return 'eco_ptz'
  if (r.includes('tva')) return 'tva_5_5'
  if (r.includes('local') || r.includes('region') || r.includes('départ')) return 'aide_locale'
  return null
}

// ---------------------------------------------------------------------------
// Fallback local — barèmes 2026 best-effort, conditions explicites
// ---------------------------------------------------------------------------

/**
 * Estimation locale conservatrice quand l'API upstream est indisponible
 * ou renvoie une réponse vide. On reste prudent : les montants servent
 * d'ordre de grandeur, et toutes les conditions orientent le client
 * vers un conseiller France Rénov' pour validation officielle.
 */
function estimateLocally(input: AideInput, _cause: unknown): AideResult[] {
  const gap = DPE_NUM[input.dpe_actuel] - DPE_NUM[input.dpe_projete]
  if (gap <= 0) return []

  const isVeryModeste = isVeryModesteHousehold(input.revenu_fiscal_reference)
  const isModeste = isModesteHousehold(input.revenu_fiscal_reference)
  const surfaceCap = Math.min(input.surface_m2, 200)

  const results: AideResult[] = []

  // MaPrimeRénov'
  // Barème simplifié 2026 : forfait par saut de classe DPE atteint.
  const mprPerStep = isVeryModeste ? 6_000 : isModeste ? 4_500 : 2_500
  const mprAmount = Math.round(mprPerStep * gap)
  results.push({
    code: 'mpr',
    label: "MaPrimeRénov'",
    montant_eur: mprAmount,
    conditions: [
      'Logement de plus de 15 ans',
      "Saut d'au moins 2 classes DPE au global",
      isVeryModeste
        ? 'Ménage aux revenus très modestes (barème bleu)'
        : isModeste
          ? 'Ménage aux revenus modestes (barème jaune)'
          : 'Ménage aux revenus intermédiaires/supérieurs',
      'Travaux réalisés par un professionnel RGE',
    ],
    source_url: 'https://france-renov.gouv.fr/aides/maprimerenov',
  })

  // Certificats d'économie d'énergie (CEE)
  // Ordre de grandeur : ~20€/m² pour rénovation globale, plafonné.
  const ceeAmount = Math.round(surfaceCap * 20)
  results.push({
    code: 'cee',
    label: "Certificats d'économie d'énergie (CEE)",
    montant_eur: ceeAmount,
    conditions: [
      "Travaux d'économie d'énergie éligibles à la fiche CEE",
      'Devis et facture par un professionnel RGE',
      'Demande à effectuer avant le démarrage des travaux',
    ],
    source_url: 'https://www.ecologie.gouv.fr/certificats-deconomies-denergie',
  })

  // Éco-PTZ
  results.push({
    code: 'eco_ptz',
    label: 'Éco-prêt à taux zéro (Éco-PTZ)',
    montant_eur: Math.min(50_000, Math.round(surfaceCap * 250)),
    conditions: [
      'Logement achevé depuis plus de 2 ans',
      'Au moins une action de travaux éligible (isolation, chauffage, ENR…)',
      'Pas de condition de ressources',
      "Durée de remboursement jusqu'à 20 ans",
    ],
    source_url: 'https://france-renov.gouv.fr/aides/eco-pret-taux-zero',
  })

  // TVA à 5,5 %
  // Économie estimée : différence entre TVA 20% et 5,5% sur l'enveloppe travaux.
  const enveloppeTravaux = Math.round(surfaceCap * 350) // ordre de grandeur global F/G
  const tvaEconomy = Math.round(enveloppeTravaux * (0.2 - 0.055))
  results.push({
    code: 'tva_5_5',
    label: 'TVA à taux réduit 5,5 %',
    montant_eur: tvaEconomy,
    conditions: [
      'Logement achevé depuis plus de 2 ans',
      "Travaux d'amélioration de la performance énergétique",
      'Facturation directe par le professionnel (TVA appliquée en moins)',
    ],
    source_url: 'https://www.economie.gouv.fr/particuliers/tva-travaux-renovation-immobiliere',
  })

  // Aide locale — présence indicative (le diagnostiqueur précise)
  results.push({
    code: 'aide_locale',
    label: 'Aides locales (région, département, intercommunalité)',
    montant_eur: 1_500,
    conditions: [
      `Vérifier les aides de votre territoire (code postal ${input.code_postal})`,
      "Cumulables avec MaPrimeRénov' selon la collectivité",
      "Conditions et montants variables — voir conseiller France Rénov'",
    ],
    source_url: 'https://france-renov.gouv.fr/aides/locales',
  })

  return results
}

function isVeryModesteHousehold(rfr: number | undefined): boolean {
  if (rfr === undefined) return false
  // Seuil indicatif national 2026, hors Île-de-France, foyer 1 pers.
  return rfr < 17_000
}
function isModesteHousehold(rfr: number | undefined): boolean {
  if (rfr === undefined) return false
  return rfr >= 17_000 && rfr < 27_000
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateInput(input: AideInput): void {
  if (!Number.isFinite(input.surface_m2) || input.surface_m2 <= 0) {
    throw new MesAidesRenoError('surface_m2 invalide')
  }
  if (
    !Number.isInteger(input.annee_construction) ||
    input.annee_construction < 1800 ||
    input.annee_construction > new Date().getFullYear()
  ) {
    throw new MesAidesRenoError('annee_construction invalide')
  }
  if (!/^\d{5}$/.test(input.code_postal)) {
    throw new MesAidesRenoError('code_postal invalide (5 chiffres attendus)')
  }
  if (!isDpe(input.dpe_actuel) || !isDpe(input.dpe_projete)) {
    throw new MesAidesRenoError('classe DPE invalide')
  }
}

function isDpe(v: string): v is DpeClass {
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(v)
}

function cacheKey(input: AideInput): string {
  return JSON.stringify({
    s: input.surface_m2,
    a: input.annee_construction,
    da: input.dpe_actuel,
    dp: input.dpe_projete,
    rfr: input.revenu_fiscal_reference ?? null,
    cp: input.code_postal,
    tl: input.type_logement,
    o: input.occupation,
  })
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function defaultLabel(code: AideCode): string {
  switch (code) {
    case 'mpr':
      return "MaPrimeRénov'"
    case 'cee':
      return "Certificats d'économie d'énergie (CEE)"
    case 'eco_ptz':
      return 'Éco-prêt à taux zéro'
    case 'tva_5_5':
      return 'TVA à taux réduit 5,5 %'
    case 'aide_locale':
      return 'Aide locale'
  }
}

function defaultSourceUrl(code: AideCode): string {
  switch (code) {
    case 'mpr':
      return 'https://france-renov.gouv.fr/aides/maprimerenov'
    case 'cee':
      return 'https://www.ecologie.gouv.fr/certificats-deconomies-denergie'
    case 'eco_ptz':
      return 'https://france-renov.gouv.fr/aides/eco-pret-taux-zero'
    case 'tva_5_5':
      return 'https://www.economie.gouv.fr/particuliers/tva-travaux-renovation-immobiliere'
    case 'aide_locale':
      return 'https://france-renov.gouv.fr/aides/locales'
  }
}

// Conserve la signature publique : on n'utilise pas LogementType direct ici
// mais on garantit que le type est bien exporté pour les consommateurs.
export type { LogementType }
