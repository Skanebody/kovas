// ============================================
// KOVAS Annuaire — Edge Function : cross-validate-inpi
//
// Mission : enrichir les fiches diagnosticians depuis l'API RNE (Registre
//   National des Entreprises) de l'INPI :
//     - capital libere (montantCapital)
//     - representants legaux (dirigeants : President / Gerant / DG / Associe Unique)
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron quotidien (batch 200) + appels admin manuels (single).
//
// Pipeline (par fiche) :
//   1. SIRET (14) → SIREN (9 premiers)
//   2. GET /api/companies/${siren} avec Bearer token INPI
//   3. Parse formality.content.personneMorale → mapping vers colonnes inpi_*
//   4. UPDATE diagnostician + inpi_last_synced_at
//   5. Log diagnostician_cross_validation_logs (source='INPI')
//
// Auth INPI :
//   - POST /api/sso/login {username, password} → { token }
//   - Token TTL non documente → cache 30min par prudence
//   - 401 sur API → re-login + retry 1x
//
// Rate limit conservateur : 5 req/s par defaut (INPI_THROTTLE_MS=250).
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Types INPI RNE
// ============================================
interface InpiCapital {
  montantCapital: number | null
  deviseCapital: string | null
}

interface InpiPouvoir {
  qualite?: string | null
  dateDeNomination?: string | null
  individu?: {
    descriptionPersonne?: {
      nom?: string | null
      prenoms?: string[] | null
      prenomUsuel?: string | null
    } | null
  } | null
  entreprise?: {
    denomination?: string | null
  } | null
}

interface InpiPersonneMorale {
  identite?: {
    entreprise?: {
      capital?: InpiCapital | null
    } | null
  } | null
  composition?: {
    pouvoirs?: InpiPouvoir[] | null
  } | null
}

interface InpiFormalityContent {
  personneMorale?: InpiPersonneMorale | null
}

interface InpiFormality {
  content?: InpiFormalityContent | null
}

interface InpiCompanyResponse {
  formality?: InpiFormality | null
  // Autres champs ignores (siren, denomination, etc.)
}

interface InpiLoginResponse {
  token: string
}

interface DiagnosticianRow {
  id: string
  sirene_siret: string | null
}

interface LegalRepresentative {
  fullName: string
  role: string
  since: string | null
}

interface BatchStats {
  ok: boolean
  processed: number
  matched: number
  notFound: number
  errors: number
  durationMs: number
}

interface RequestBody {
  mode?: 'batch' | 'single'
  limit?: number
  diagnostician_id?: string
}

interface InpiUpdatePayload {
  inpi_legal_representatives: LegalRepresentative[]
  inpi_share_capital_paid: number | null
  inpi_last_synced_at: string
}

// ============================================
// Roles dirigeants a extraire (filtre strict)
// L'API RNE renvoie tous les pouvoirs (commissaire aux comptes, etc.) ;
// on garde uniquement les roles cles pour l'identification du representant.
// ============================================
const DIRECTOR_ROLE_KEYWORDS = [
  'PRESIDENT',
  'DIRECTEUR GENERAL',
  'DIRECTRICE GENERALE',
  'GERANT',
  'GERANTE',
  'ASSOCIE UNIQUE',
  'ASSOCIEE UNIQUE',
]

function normalizeRole(role: string): string {
  return role
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
}

function isDirectorRole(role: string | null | undefined): boolean {
  if (!role) return false
  const up = normalizeRole(role)
  return DIRECTOR_ROLE_KEYWORDS.some((kw) => up.includes(kw))
}

// ============================================
// Token cache in-memory (30min TTL)
// ============================================
interface CachedToken {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

async function getInpiToken(force = false): Promise<string> {
  const now = Date.now()
  if (!force && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token
  }

  const username = Deno.env.get('INPI_USERNAME')
  const password = Deno.env.get('INPI_PASSWORD')
  const apiBase =
    Deno.env.get('INPI_API_BASE') ?? 'https://registre-national-entreprises.inpi.fr/api'

  if (!username || !password) {
    throw new Error('INPI_USERNAME ou INPI_PASSWORD manquant')
  }

  const res = await fetch(`${apiBase.replace(/\/$/, '')}/sso/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`INPI login error ${res.status}: ${text.substring(0, 200)}`)
  }

  const data = (await res.json()) as InpiLoginResponse
  if (!data.token) {
    throw new Error('INPI login : token manquant dans la reponse')
  }

  cachedToken = {
    token: data.token,
    expiresAt: now + 30 * 60 * 1000, // 30 minutes
  }
  return cachedToken.token
}

// ============================================
// Helpers
// ============================================
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function truncatePayload(payload: unknown, maxBytes = 4096): unknown {
  const json = JSON.stringify(payload)
  if (json.length <= maxBytes) return payload
  return { _truncated: true, _preview: json.substring(0, maxBytes - 40) + '...' }
}

function siretToSiren(siret: string): string | null {
  const digits = siret.replace(/\D/g, '')
  if (digits.length < 9) return null
  return digits.substring(0, 9)
}

function buildFullName(pouvoir: InpiPouvoir): string | null {
  // Cas personne physique
  const descr = pouvoir.individu?.descriptionPersonne
  if (descr) {
    const prenoms =
      descr.prenomUsuel ||
      (Array.isArray(descr.prenoms) ? descr.prenoms.join(' ') : null) ||
      ''
    const nom = descr.nom ?? ''
    const full = `${prenoms} ${nom}`.trim()
    return full.length > 0 ? full : null
  }
  // Cas personne morale (cabinet dirigeant)
  if (pouvoir.entreprise?.denomination) {
    return pouvoir.entreprise.denomination
  }
  return null
}

function extractRepresentatives(
  pouvoirs: InpiPouvoir[] | null | undefined,
): LegalRepresentative[] {
  if (!pouvoirs || pouvoirs.length === 0) return []
  const reps: LegalRepresentative[] = []
  for (const p of pouvoirs) {
    if (!isDirectorRole(p.qualite)) continue
    const fullName = buildFullName(p)
    if (!fullName) continue
    reps.push({
      fullName,
      role: p.qualite ?? '',
      since: p.dateDeNomination ?? null,
    })
  }
  return reps
}

function extractCapital(content: InpiFormalityContent | null | undefined): number | null {
  const cap = content?.personneMorale?.identite?.entreprise?.capital
  if (!cap || typeof cap.montantCapital !== 'number') return null
  return cap.montantCapital
}

// ============================================
// Fetch company avec retry sur 401
// ============================================
type FetchOutcome =
  | { ok: true; data: InpiCompanyResponse; status: number }
  | { ok: false; status: number; notFound: boolean; message: string }

async function fetchCompany(
  siren: string,
  apiBase: string,
  retryCount = 0,
): Promise<FetchOutcome> {
  const token = await getInpiToken()
  const url = `${apiBase.replace(/\/$/, '')}/companies/${encodeURIComponent(siren)}`

  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
  } catch (err) {
    return { ok: false, status: 0, notFound: false, message: (err as Error).message }
  }

  if (res.status === 401 && retryCount === 0) {
    cachedToken = null
    await getInpiToken(true)
    return fetchCompany(siren, apiBase, retryCount + 1)
  }

  if (res.status === 404) {
    return { ok: false, status: 404, notFound: true, message: 'SIREN inconnu RNE' }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return {
      ok: false,
      status: res.status,
      notFound: false,
      message: `HTTP ${res.status}: ${text.substring(0, 200)}`,
    }
  }

  // L'API RNE renvoie parfois un tableau au lieu d'un objet selon les versions :
  // on tente les deux formes en toute defensive (typage strict).
  const json = (await res.json()) as InpiCompanyResponse | InpiCompanyResponse[]
  const data: InpiCompanyResponse = Array.isArray(json) ? json[0] ?? {} : json
  return { ok: true, data, status: res.status }
}

// ============================================
// Traitement d'une fiche
// ============================================
type DiagOutcome = 'matched' | 'not_found' | 'error'

interface ProcessResult {
  outcome: DiagOutcome
  errorMessage: string | null
  payload: unknown
  latencyMs: number
  isMatched: boolean
}

async function processDiagnostician(
  supabase: ReturnType<typeof createClient>,
  diag: DiagnosticianRow,
  apiBase: string,
): Promise<ProcessResult> {
  const t0 = Date.now()

  if (!diag.sirene_siret) {
    return {
      outcome: 'error',
      errorMessage: 'sirene_siret absent',
      payload: null,
      latencyMs: Date.now() - t0,
      isMatched: false,
    }
  }

  const siren = siretToSiren(diag.sirene_siret)
  if (!siren) {
    return {
      outcome: 'error',
      errorMessage: `SIRET invalide: ${diag.sirene_siret}`,
      payload: null,
      latencyMs: Date.now() - t0,
      isMatched: false,
    }
  }

  const result = await fetchCompany(siren, apiBase)
  const latencyMs = Date.now() - t0

  if (!result.ok) {
    if (result.notFound) {
      return {
        outcome: 'not_found',
        errorMessage: null,
        payload: { siren, http_status: 404 },
        latencyMs,
        isMatched: false,
      }
    }
    return {
      outcome: 'error',
      errorMessage: result.message,
      payload: { siren, http_status: result.status },
      latencyMs,
      isMatched: false,
    }
  }

  const content = result.data.formality?.content ?? null
  const capital = extractCapital(content)
  const representatives = extractRepresentatives(content?.personneMorale?.composition?.pouvoirs)

  const update: InpiUpdatePayload = {
    inpi_legal_representatives: representatives,
    inpi_share_capital_paid: capital,
    inpi_last_synced_at: new Date().toISOString(),
  }

  const { error: updateErr } = await supabase
    .from('diagnosticians')
    .update(update)
    .eq('id', diag.id)

  if (updateErr) {
    return {
      outcome: 'error',
      errorMessage: `update inpi fields: ${updateErr.message}`,
      payload: truncatePayload(result.data),
      latencyMs,
      isMatched: false,
    }
  }

  return {
    outcome: 'matched',
    errorMessage: null,
    payload: truncatePayload(result.data),
    latencyMs,
    isMatched: true,
  }
}

// ============================================
// Handler principal
// ============================================
Deno.serve(async (req) => {
  const t0 = Date.now()

  // --- Auth : service_role OU x-cron-secret ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`
  const isCron = cronSecret && cronSecretHeader === cronSecret
  if (!isServiceRole && !isCron) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // --- Parse body ---
  let body: RequestBody = {}
  try {
    const raw = await req.text()
    if (raw) body = JSON.parse(raw) as RequestBody
  } catch {
    return new Response(JSON.stringify({ error: 'invalid json body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const mode: 'batch' | 'single' = body.mode ?? 'batch'
  const limit = Math.max(1, Math.min(body.limit ?? 200, 500))
  const throttleMs = Number.parseInt(Deno.env.get('INPI_THROTTLE_MS') ?? '250', 10)
  const apiBase =
    Deno.env.get('INPI_API_BASE') ?? 'https://registre-national-entreprises.inpi.fr/api'

  // --- Supabase admin client ---
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ error: 'missing supabase env (SUPABASE_URL/SERVICE_ROLE_KEY)' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Selection des fiches a traiter ---
  let diagnosticians: DiagnosticianRow[] = []

  if (mode === 'single') {
    if (!body.diagnostician_id) {
      return new Response(
        JSON.stringify({ error: 'diagnostician_id requis en mode single' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const { data, error } = await supabase
      .from('diagnosticians')
      .select('id, sirene_siret')
      .eq('id', body.diagnostician_id)
      .maybeSingle()
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    if (!data) {
      return new Response(JSON.stringify({ error: 'diagnostician introuvable' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    diagnosticians = [data as DiagnosticianRow]
  } else {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('diagnosticians')
      .select('id, sirene_siret')
      .not('sirene_siret', 'is', null)
      .or(`inpi_last_synced_at.is.null,inpi_last_synced_at.lt.${ninetyDaysAgo}`)
      .limit(limit)
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    diagnosticians = (data ?? []) as DiagnosticianRow[]
  }

  // --- Boucle de traitement ---
  const stats: BatchStats = {
    ok: true,
    processed: 0,
    matched: 0,
    notFound: 0,
    errors: 0,
    durationMs: 0,
  }

  for (const diag of diagnosticians) {
    try {
      const result = await processDiagnostician(supabase, diag, apiBase)
      stats.processed += 1
      if (result.isMatched) stats.matched += 1
      if (result.outcome === 'not_found') stats.notFound += 1
      if (result.outcome === 'error') stats.errors += 1

      // Log d'audit
      await supabase.from('diagnostician_cross_validation_logs').insert({
        diagnostician_id: diag.id,
        source: 'INPI',
        outcome: result.outcome,
        payload: result.payload ?? null,
        error_message: result.errorMessage,
        latency_ms: result.latencyMs,
      })
    } catch (err) {
      stats.processed += 1
      stats.errors += 1
      await supabase.from('diagnostician_cross_validation_logs').insert({
        diagnostician_id: diag.id,
        source: 'INPI',
        outcome: 'error',
        payload: null,
        error_message: (err as Error).message,
        latency_ms: null,
      })
    }

    // Throttle conservateur (defaut 250ms = 4 req/s)
    if (throttleMs > 0) await sleep(throttleMs)
  }

  stats.durationMs = Date.now() - t0

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})

// ============================================
// Setup cron quotidien (a executer une fois cote SQL) :
//
//   SELECT cron.schedule(
//     'cross-validate-inpi-daily',
//     '30 2 * * *',  -- 02:30 UTC chaque jour (decale Sirene de 30min)
//     $$
//     SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/cross-validate-inpi',
//       headers := jsonb_build_object('x-cron-secret', current_setting('app.cron_secret', true)),
//       body := jsonb_build_object('mode', 'batch', 'limit', 200)
//     );
//     $$
//   );
// ============================================
