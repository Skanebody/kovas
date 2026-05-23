// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
// ============================================
// KOVAS Anti-Fraude — Edge Function : verify-sirene
//
// Mission VAL-3 : valider l'existence légale et l'activité d'une entreprise
// diagnostiqueur via l'API INSEE Sirene V3.11.
//
// Pipeline :
//   1. Validation algorithme Luhn sur SIRET (14 chiffres + checksum)
//   2. Appel API INSEE Sirene authentifié (OAuth2 client_credentials, cache token 50min)
//   3. Parse réponse → raison sociale, forme juridique, code APE, date création,
//      dirigeants
//   4. Validation code APE : doit être un code éligible activité diagnostic
//      ('71.20B', '74.90B', '43.99B', 'M71.20B', etc.)
//   5. Validation statut entreprise :
//        - etablissement.etatAdministratifEtablissement = 'F' → 'radiated' + alert critical
//        - liquidation judiciaire (categorie juridique 1990) → 'liquidation' + alert critical
//   6. UPDATE diagnostician_verification_status (sirene_*)
//   7. INSERT verification_checks_log (type='sirene_initial')
//
// Différence vs cross-validate-sirene existante : VAL-3 cible la table
// diagnostician_verification_status (1 ligne / 4 phases), non plus
// diagnosticians annuaire. C'est l'onboarding du diagnostiqueur claim.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Env & constantes
// ============================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const INSEE_CLIENT_ID = Deno.env.get('INSEE_CLIENT_ID') ?? ''
const INSEE_CLIENT_SECRET = Deno.env.get('INSEE_CLIENT_SECRET') ?? ''
const INSEE_TOKEN_URL = Deno.env.get('INSEE_TOKEN_URL') ?? 'https://api.insee.fr/token'
const INSEE_API_BASE =
  Deno.env.get('INSEE_API_BASE') ?? 'https://api.insee.fr/entreprises/sirene/V3.11'

const RATE_LIMIT_PER_HOUR = 3
const EXTERNAL_API_TIMEOUT_MS = 30_000

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
}

// Codes APE acceptés pour activité diagnostic immobilier
const ACCEPTED_APE_CODES = [
  '71.20B', // Analyses, essais et inspections techniques (le plus fréquent)
  '7120B',
  'M71.20B',
  '74.90B', // Activités spécialisées scientifiques diverses
  '7490B',
  'M74.90B',
  '43.99B', // Travaux d'étanchéité (parfois utilisé)
  '4399B',
  '71.12B', // Ingénierie études techniques
  '7112B',
  '68.32A', // Administration biens immobiliers (rare mais accepté)
  '6832A',
]

// Catégories juridiques INSEE signalant liquidation / cessation
const LIQUIDATION_CATEGORIES = ['1990']

// ============================================
// Types
// ============================================
interface RequestBody {
  diagnostician_id: string
  siret: string
}

interface InseeTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface InseeUniteLegale {
  denominationUniteLegale: string | null
  denominationUsuelle1UniteLegale: string | null
  categorieJuridiqueUniteLegale: string | null
  prenom1UniteLegale: string | null
  nomUniteLegale: string | null
  prenomUsuelUniteLegale: string | null
  activitePrincipaleUniteLegale: string | null
}

interface InseePeriodeEtablissement {
  activitePrincipaleEtablissement: string | null
  etatAdministratifEtablissement: 'A' | 'F' | null
  dateDebut: string | null
  dateFin: string | null
}

interface InseeEtablissement {
  siret: string
  etatAdministratifEtablissement: 'A' | 'F' | null
  dateCreationEtablissement: string | null
  uniteLegale: InseeUniteLegale
  periodesEtablissement?: InseePeriodeEtablissement[]
}

interface InseeSiretResponse {
  etablissement: InseeEtablissement
}

type SireneStatus = 'pending' | 'in_review' | 'verified' | 'rejected' | 'radiated' | 'liquidation'

interface OutputResponse {
  status: SireneStatus
  company_name: string | null
  legal_form: string | null
  ape_code: string | null
  director_name: string | null
  created_at: string | null
  manual_review_required: boolean
  rejection_reason?: string
}

// ============================================
// Helpers
// ============================================
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

function withTimeout<T>(promise: Promise<T>, ms: number, label = 'op'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${label} (${ms}ms)`)), ms)
    promise.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

function truncatePayload(payload: unknown, maxBytes = 4096): unknown {
  const json = JSON.stringify(payload)
  if (json.length <= maxBytes) return payload
  return { _truncated: true, _preview: json.substring(0, maxBytes - 40) + '...' }
}

/** Algorithme Luhn pour valider un SIRET 14 chiffres. */
function validateSiretLuhn(siret: string): boolean {
  const digits = siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let n = parseInt(digits[i], 10)
    // Position paire (depuis la droite) = double
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

function normalizeApeCode(code: string | null): string {
  if (!code) return ''
  return code.replace(/[\s.]/g, '').toUpperCase()
}

function isAcceptedApe(code: string | null): boolean {
  if (!code) return false
  const norm = normalizeApeCode(code)
  return ACCEPTED_APE_CODES.some((accepted) => normalizeApeCode(accepted) === norm)
}

// ============================================
// Token cache 50min
// ============================================
interface CachedToken {
  token: string
  expiresAt: number
}
let cachedToken: CachedToken | null = null

async function getInseeToken(force = false): Promise<string> {
  const now = Date.now()
  if (!force && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token
  }
  if (!INSEE_CLIENT_ID || !INSEE_CLIENT_SECRET) {
    throw new Error('INSEE_CLIENT_ID ou INSEE_CLIENT_SECRET manquant')
  }
  const basic = btoa(`${INSEE_CLIENT_ID}:${INSEE_CLIENT_SECRET}`)
  const res = await withTimeout(
    fetch(INSEE_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    }),
    EXTERNAL_API_TIMEOUT_MS,
    'insee-token',
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`INSEE token error ${res.status}: ${text.substring(0, 200)}`)
  }
  const data = (await res.json()) as InseeTokenResponse
  cachedToken = {
    token: data.access_token,
    expiresAt: now + Math.min(50 * 60 * 1000, (data.expires_in ?? 3000) * 1000 - 60_000),
  }
  return cachedToken.token
}

// ============================================
// Appel SIRET INSEE
// ============================================
async function fetchSiret(siret: string, retryCount = 0): Promise<InseeSiretResponse> {
  const token = await getInseeToken()
  const url = `${INSEE_API_BASE.replace(/\/$/, '')}/siret/${encodeURIComponent(siret)}`
  const res = await withTimeout(
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }),
    EXTERNAL_API_TIMEOUT_MS,
    'insee-siret',
  )

  if (res.status === 401 && retryCount === 0) {
    cachedToken = null
    await getInseeToken(true)
    return fetchSiret(siret, retryCount + 1)
  }
  if (res.status === 404) {
    throw new Error('SIRET_NOT_FOUND')
  }
  if (res.status === 429 && retryCount < 2) {
    await new Promise((r) => setTimeout(r, 5000))
    return fetchSiret(siret, retryCount + 1)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`INSEE HTTP ${res.status}: ${text.substring(0, 200)}`)
  }
  return (await res.json()) as InseeSiretResponse
}

// ============================================
// Décision
// ============================================
interface SireneDecision {
  status: SireneStatus
  companyName: string | null
  legalForm: string | null
  apeCode: string | null
  directorName: string | null
  createdAt: string | null
  manual_review_required: boolean
  rejection_reason?: string
  alertType?: 'sirene_radiated' | 'sirene_liquidation'
}

function decideSireneStatus(response: InseeSiretResponse): SireneDecision {
  const etab = response.etablissement
  const ul = etab.uniteLegale

  // Nom dirigeant principal (si personne physique)
  const directorName =
    [ul.prenom1UniteLegale ?? ul.prenomUsuelUniteLegale, ul.nomUniteLegale]
      .filter(Boolean)
      .join(' ')
      .trim() || null

  const companyName =
    ul.denominationUniteLegale ?? ul.denominationUsuelle1UniteLegale ?? directorName

  // APE etablissement prioritaire sinon unité légale
  const apeFromPeriode =
    etab.periodesEtablissement?.find((p) => p.dateFin === null || p.dateFin === '')
      ?.activitePrincipaleEtablissement ?? null
  const apeCode = apeFromPeriode ?? ul.activitePrincipaleUniteLegale ?? null

  const legalForm = ul.categorieJuridiqueUniteLegale

  const base = {
    companyName,
    legalForm,
    apeCode,
    directorName,
    createdAt: etab.dateCreationEtablissement,
  }

  // 1. Radié
  if (etab.etatAdministratifEtablissement === 'F') {
    return {
      ...base,
      status: 'radiated',
      manual_review_required: false,
      rejection_reason: 'INSEE état administratif F (établissement radié)',
      alertType: 'sirene_radiated',
    }
  }

  // 2. Liquidation
  if (legalForm && LIQUIDATION_CATEGORIES.includes(legalForm)) {
    return {
      ...base,
      status: 'liquidation',
      manual_review_required: false,
      rejection_reason: `Catégorie juridique ${legalForm} indique une liquidation`,
      alertType: 'sirene_liquidation',
    }
  }

  // 3. Code APE non éligible
  if (!isAcceptedApe(apeCode)) {
    return {
      ...base,
      status: 'in_review',
      manual_review_required: true,
      rejection_reason: `Code APE atypique pour diagnostiqueur : ${apeCode ?? '(absent)'}`,
    }
  }

  // 4. OK
  return {
    ...base,
    status: 'verified',
    manual_review_required: false,
  }
}

// ============================================
// Rate limit
// ============================================
async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  diagnosticianId: string,
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error } = await supabase
    .from('verification_checks_log')
    .select('*', { count: 'exact', head: true })
    .eq('diagnostician_id', diagnosticianId)
    .eq('check_type', 'sirene_initial')
    .gte('performed_at', oneHourAgo)
  if (error) {
    console.warn('Rate limit check failed:', error.message)
    return true
  }
  return (count ?? 0) < RATE_LIMIT_PER_HOUR
}

// ============================================
// Handler
// ============================================
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'supabase env missing' }, 500)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_json_body' }, 400)
  }

  if (!body.diagnostician_id || !body.siret) {
    return jsonResponse({ error: 'missing_required_fields' }, 400)
  }

  // 1. Validation Luhn locale (avant appel API)
  const siretClean = body.siret.replace(/\s/g, '')
  if (!validateSiretLuhn(siretClean)) {
    // Log + reject sans rate limit (validation locale)
    await supabase.from('verification_checks_log').insert({
      diagnostician_id: body.diagnostician_id,
      check_type: 'sirene_initial',
      check_source: 'sirene_api',
      status: 'warning',
      duration_ms: 0,
      result: { error: 'invalid_luhn', siret: siretClean },
      triggered_by: 'system',
    })
    await supabase.from('diagnostician_verification_status').upsert(
      {
        diagnostician_id: body.diagnostician_id,
        sirene_status: 'rejected',
        sirene_siret: siretClean,
        sirene_rejection_reason: 'SIRET invalide (checksum Luhn KO)',
        sirene_last_api_check: new Date().toISOString(),
      },
      { onConflict: 'diagnostician_id' },
    )
    return jsonResponse(
      {
        status: 'rejected' as SireneStatus,
        company_name: null,
        legal_form: null,
        ape_code: null,
        director_name: null,
        created_at: null,
        manual_review_required: false,
        rejection_reason: 'SIRET invalide (checksum Luhn KO)',
      } satisfies OutputResponse,
      200,
    )
  }

  const allowed = await checkRateLimit(supabase, body.diagnostician_id)
  if (!allowed) {
    return jsonResponse(
      { error: 'rate_limited', message: `Max ${RATE_LIMIT_PER_HOUR} tentatives/heure` },
      429,
    )
  }

  const t0 = Date.now()
  let logStatus: 'success' | 'warning' | 'failure' | 'timeout' = 'success'
  let logResult: Record<string, unknown> = {}
  let output: OutputResponse

  try {
    const inseeData = await fetchSiret(siretClean)
    const decision = decideSireneStatus(inseeData)

    // UPDATE verification_status
    const updatePayload: Record<string, unknown> = {
      sirene_status: decision.status,
      sirene_siret: siretClean,
      sirene_company_name: decision.companyName,
      sirene_legal_form: decision.legalForm,
      sirene_ape_code: decision.apeCode,
      sirene_director_name: decision.directorName,
      sirene_company_created_at: decision.createdAt,
      sirene_last_api_check: new Date().toISOString(),
      sirene_rejection_reason: decision.rejection_reason ?? null,
    }
    if (decision.status === 'verified') {
      updatePayload.sirene_verified_at = new Date().toISOString()
    }

    const { error: upsertErr } = await supabase
      .from('diagnostician_verification_status')
      .upsert(
        { diagnostician_id: body.diagnostician_id, ...updatePayload },
        { onConflict: 'diagnostician_id' },
      )
    if (upsertErr) throw new Error(`upsert verification_status: ${upsertErr.message}`)

    // Alert
    if (decision.alertType) {
      await supabase
        .from('verification_alerts_queue')
        .insert({
          diagnostician_id: body.diagnostician_id,
          alert_type: decision.alertType,
          severity: 'critical',
        })
        .then(({ error }) => {
          if (error && !error.message.includes('uq_vaq_pending_unique')) {
            console.warn('alert insert failed:', error.message)
          }
        })
    }
    if (decision.manual_review_required) {
      await supabase
        .from('verification_alerts_queue')
        .insert({
          diagnostician_id: body.diagnostician_id,
          alert_type: 'manual_audit_required',
          severity: 'warning',
        })
        .then(({ error }) => {
          if (error && !error.message.includes('uq_vaq_pending_unique')) {
            console.warn('alert insert failed:', error.message)
          }
        })
    }

    logStatus = decision.status === 'verified' ? 'success' : 'warning'
    logResult = {
      insee_payload: truncatePayload(inseeData),
      decision: truncatePayload(decision),
    }

    output = {
      status: decision.status,
      company_name: decision.companyName,
      legal_form: decision.legalForm,
      ape_code: decision.apeCode,
      director_name: decision.directorName,
      created_at: decision.createdAt,
      manual_review_required: decision.manual_review_required,
      rejection_reason: decision.rejection_reason,
    }
  } catch (err) {
    const message = (err as Error).message
    if (message === 'SIRET_NOT_FOUND') {
      logStatus = 'warning'
      logResult = { http_status: 404, siret: siretClean }
      await supabase.from('diagnostician_verification_status').upsert(
        {
          diagnostician_id: body.diagnostician_id,
          sirene_status: 'rejected',
          sirene_siret: siretClean,
          sirene_rejection_reason: 'SIRET inconnu INSEE Sirene',
          sirene_last_api_check: new Date().toISOString(),
        },
        { onConflict: 'diagnostician_id' },
      )
      output = {
        status: 'rejected',
        company_name: null,
        legal_form: null,
        ape_code: null,
        director_name: null,
        created_at: null,
        manual_review_required: false,
        rejection_reason: 'SIRET inconnu INSEE Sirene',
      }
    } else {
      logStatus = message.includes('timeout') ? 'timeout' : 'failure'
      logResult = { error: message, stack: (err as Error).stack?.substring(0, 1000) }
      output = {
        status: 'in_review',
        company_name: null,
        legal_form: null,
        ape_code: null,
        director_name: null,
        created_at: null,
        manual_review_required: true,
        rejection_reason: `Pipeline error: ${message}`,
      }
    }
  }

  await supabase.from('verification_checks_log').insert({
    diagnostician_id: body.diagnostician_id,
    check_type: 'sirene_initial',
    check_source: 'sirene_api',
    status: logStatus,
    duration_ms: Date.now() - t0,
    result: logResult,
    triggered_by: 'system',
  })

  return jsonResponse(output, logStatus === 'failure' || logStatus === 'timeout' ? 502 : 200)
})

// ============================================
// TODOs V2
//   - Cron annuel : re-validate tous les SIRET pour détecter cessations
//     intervenues entre 2 abonnements (table dvs.sirene_last_api_check > 1an)
//   - Croiser BODACC pour procédures collectives en cours
//   - Croiser INPI pour gérants et bénéficiaires effectifs (cf. fonction
//     cross-validate-inpi existante)
// ============================================
