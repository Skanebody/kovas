// ============================================
// KOVAS Annuaire — Edge Function : cross-validate-sirene
//
// Mission : enrichir les fiches diagnosticians depuis l'API Sirene INSEE
//   (raison sociale, forme juridique, capital, effectif, date de creation,
//   etat administratif) et basculer le validation_status en consequence.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron quotidien (batch 200) + appels admin manuels (single).
//
// Pipeline (par fiche) :
//   1. GET /siret/${siret} avec Bearer OAuth2 INSEE
//   2. Parse etablissement.uniteLegale → mapping vers colonnes sirene_*
//   3. UPDATE diagnostician + sirene_last_synced_at
//   4. Bascule validation_status :
//        - 'F' (radie)   → 'ceased'
//        - 'A' (actif)   → 'verified' si activity_score >= 70 ET status non-suspended/non-ceased
//   5. Log diagnostician_cross_validation_logs (source='SIRENE')
//
// Tolerance pannes :
//   - 401 token expire   → refresh + retry 1x
//   - 404 SIRET inconnu  → sirene_state='unknown', outcome='not_found'
//   - 429 rate limited   → sleep 5s + retry max 3x
//   - 5xx                → outcome='error', skip
//
// Specifications INSEE :
//   - Base URL : https://api.insee.fr/entreprises/sirene/V3.11
//   - Token URL: https://api.insee.fr/token (OAuth2 client_credentials)
//   - Rate     : 30 req/min sandbox, 500/min prod → throttle 2s par defaut
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Types
// ============================================
interface InseeUniteLegale {
  denominationUniteLegale: string | null
  categorieJuridiqueUniteLegale: string | null
  capitalSocialUniteLegale: string | null
  prenom1UniteLegale: string | null
  nomUniteLegale: string | null
}

interface InseeEtablissement {
  siret: string
  etatAdministratifEtablissement: 'A' | 'F' | null
  dateCreationEtablissement: string | null
  trancheEffectifsEtablissement: string | null
  uniteLegale: InseeUniteLegale
}

interface InseeSiretResponse {
  etablissement: InseeEtablissement
}

interface InseeTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface DiagnosticianRow {
  id: string
  sirene_siret: string | null
  activity_score: number | null
  validation_status: string
}

interface BatchStats {
  ok: boolean
  processed: number
  matched: number
  ceased: number
  notFound: number
  errors: number
  durationMs: number
}

interface RequestBody {
  mode?: 'batch' | 'single'
  limit?: number
  diagnostician_id?: string
}

interface SireneUpdatePayload {
  sirene_denomination: string | null
  sirene_legal_form: string | null
  sirene_capital_eur: number | null
  sirene_employee_range: string | null
  sirene_creation_date: string | null
  sirene_state: 'active' | 'ceased' | 'unknown'
  sirene_last_synced_at: string
}

// ============================================
// Mapping categorie juridique INSEE → libelle court
// Source : https://www.insee.fr/fr/information/2028129
// Subset des formes les plus frequentes pour diagnostiqueurs independants.
// Tout code non liste retombe sur le code brut (ex: "5499").
// ============================================
const LEGAL_FORM_LABELS: Record<string, string> = {
  '1000': 'Entrepreneur individuel',
  '1100': 'Artisan-commercant',
  '1200': 'Commercant',
  '1300': 'Artisan',
  '1400': 'Officier public',
  '1500': 'Profession liberale',
  '1600': 'Exploitant agricole',
  '5202': 'SNC',
  '5306': 'SCS',
  '5308': 'SCA',
  '5410': 'SARL nationale',
  '5415': 'SARL d economie mixte',
  '5422': 'SARL immobiliere de copropriete',
  '5426': 'SARL unipersonnelle d economie mixte',
  '5430': 'SARL d attribution',
  '5431': 'SARL cooperative de construction',
  '5432': 'SARL cooperative de consommation',
  '5442': 'SARL cooperative artisanale',
  '5443': 'SARL cooperative d interet maritime',
  '5451': 'SARL cooperative ouvriere de production',
  '5453': 'SARL union de societes cooperatives',
  '5454': 'Autre SARL cooperative',
  '5455': 'SARL a capital variable',
  '5458': 'SARL unipersonnelle (EURL)',
  '5459': 'SARL unipersonnelle a capital variable',
  '5460': 'Autre SARL',
  '5470': 'SARL de presse',
  '5485': 'SARL d economie mixte',
  '5498': 'EURL (SARL unipersonnelle)',
  '5499': 'SARL',
  '5505': 'SA a participation ouvriere a CA',
  '5510': 'SA nationale a CA',
  '5515': 'SA d economie mixte a CA',
  '5520': 'Fonds a forme societaire a CA',
  '5522': 'SA cooperative d interet collectif (CA)',
  '5530': 'SA d attribution a CA',
  '5531': 'SA cooperative de construction a CA',
  '5532': 'SA HLM a CA',
  '5547': 'SA cooperative de commercants a CA',
  '5548': 'SA cooperative artisanale a CA',
  '5551': 'SA cooperative ouvriere de production a CA',
  '5552': 'SA cooperative de consommation a CA',
  '5553': 'SA cooperative agricole a CA',
  '5554': 'SA cooperative d interet maritime a CA',
  '5555': 'SA cooperative de transport a CA',
  '5558': 'SA cooperative ouvriere de production a directoire',
  '5559': 'SA union de societes cooperatives a CA',
  '5560': 'Autre SA a CA',
  '5585': 'Societe d epargne forestiere a CA',
  '5599': 'SA a CA',
  '5605': 'SA a participation ouvriere a directoire',
  '5610': 'SA nationale a directoire',
  '5615': 'SA d economie mixte a directoire',
  '5620': 'Fonds a forme societaire a directoire',
  '5622': 'SA cooperative d interet collectif (directoire)',
  '5630': 'SA d attribution a directoire',
  '5631': 'SA cooperative de construction a directoire',
  '5632': 'SA HLM a directoire',
  '5642': 'SA cooperative de production de credit mutuel',
  '5643': 'SA cooperative d interet maritime',
  '5647': 'SA cooperative de commercants a directoire',
  '5648': 'SA cooperative artisanale a directoire',
  '5651': 'SA cooperative ouvriere de production a directoire',
  '5652': 'SA cooperative de consommation a directoire',
  '5653': 'SA cooperative agricole a directoire',
  '5655': 'SA cooperative de transport a directoire',
  '5659': 'SA union de societes cooperatives a directoire',
  '5660': 'Autre SA a directoire',
  '5685': 'Societe d epargne forestiere a directoire',
  '5699': 'SA a directoire',
  '5710': 'SAS unipersonnelle (SASU)',
  '5720': 'SAS a capital variable',
  '5785': 'Societe d exercice liberal par actions simplifiee (SELAS)',
  '5800': 'SE (Societe europeenne)',
  '6100': 'Caisse d epargne et de prevoyance',
  '6210': 'GEIE',
  '6220': 'GIE',
  '6316': 'Cooperative d utilisation de materiel agricole en commun',
  '6317': 'SICA',
  '6318': 'Societe cooperative agricole',
  '6411': 'Societe d assurance a forme mutuelle',
  '6511': 'SCPI',
  '6532': 'SICAV (organisme de placement collectif)',
  '6533': 'Societe civile d epargne forestiere',
  '6534': 'Societe civile immobiliere',
  '6535': 'Societe civile immobiliere d accession progressive',
  '6536': 'Societe civile immobiliere de construction-vente',
  '6537': 'SCP (Societe civile professionnelle)',
  '6538': 'SCM (Societe civile de moyens)',
  '6539': 'Societe civile laitiere',
  '6540': 'Societe civile profession liberale',
  '6541': 'SCEA',
  '6542': 'EARL',
  '6543': 'GAEC',
  '6544': 'GFA',
  '6551': 'Caisse locale de credit mutuel',
  '6558': 'Societe civile d attribution',
  '6560': 'Autre societe civile',
  '6585': 'Societe d epargne forestiere',
  '6589': 'Societe civile',
  '6595': 'Caisse (locale) de credit agricole mutuel',
  '6596': 'Caisse d epargne et de prevoyance',
  '6597': 'Societe de caution mutuelle',
  '6598': 'Autre societe civile',
  '6599': 'Societe civile',
  '8290': 'Association de droit local (Alsace-Moselle)',
  '9220': 'Association declaree',
}

function legalFormLabel(code: string | null): string | null {
  if (!code) return null
  return LEGAL_FORM_LABELS[code] ?? code
}

// ============================================
// Token cache in-memory (50min TTL — INSEE renvoie expires_in=604800s
// soit 7j en prod, mais on rafraichit toutes les 50min par prudence)
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

  const clientId = Deno.env.get('INSEE_CLIENT_ID')
  const clientSecret = Deno.env.get('INSEE_CLIENT_SECRET')
  const tokenUrl = Deno.env.get('INSEE_TOKEN_URL') ?? 'https://api.insee.fr/token'

  if (!clientId || !clientSecret) {
    throw new Error('INSEE_CLIENT_ID ou INSEE_CLIENT_SECRET manquant')
  }

  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`INSEE token error ${res.status}: ${text.substring(0, 200)}`)
  }

  const data = (await res.json()) as InseeTokenResponse
  cachedToken = {
    token: data.access_token,
    // 50 minutes ou expires_in (le plus court)
    expiresAt: now + Math.min(50 * 60 * 1000, (data.expires_in ?? 3000) * 1000 - 60_000),
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

function parseCapital(raw: string | null): number | null {
  if (!raw) return null
  const num = Number.parseFloat(raw)
  return Number.isFinite(num) ? num : null
}

function mapEtatAdministratif(etat: 'A' | 'F' | null): 'active' | 'ceased' | 'unknown' {
  if (etat === 'A') return 'active'
  if (etat === 'F') return 'ceased'
  return 'unknown'
}

// ============================================
// Fetch SIRET avec retry sur 401/429
// ============================================
type FetchOutcome =
  | { ok: true; data: InseeSiretResponse; status: number }
  | { ok: false; status: number; notFound: boolean; message: string }

async function fetchSiret(siret: string, apiBase: string, retryCount = 0): Promise<FetchOutcome> {
  const token = await getInseeToken()
  const url = `${apiBase.replace(/\/$/, '')}/siret/${encodeURIComponent(siret)}`

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
    // Token expire, on force le refresh et on retry 1x
    cachedToken = null
    await getInseeToken(true)
    return fetchSiret(siret, apiBase, retryCount + 1)
  }

  if (res.status === 404) {
    return { ok: false, status: 404, notFound: true, message: 'SIRET inconnu INSEE' }
  }

  if (res.status === 429 && retryCount < 3) {
    await sleep(5000)
    return fetchSiret(siret, apiBase, retryCount + 1)
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

  const data = (await res.json()) as InseeSiretResponse
  return { ok: true, data, status: res.status }
}

// ============================================
// Traitement d'une fiche
// ============================================
type DiagOutcome = 'matched' | 'not_found' | 'error' | 'rate_limited'

interface ProcessResult {
  outcome: DiagOutcome
  errorMessage: string | null
  payload: unknown
  latencyMs: number
  /** True si Sirene a renvoye 'F' radie. */
  isCeased: boolean
  /** Indique si la fiche existe dans Sirene (impacte stats matched). */
  isMatched: boolean
}

async function processDiagnostician(
  // Client Supabase typage minimal sans introduire any
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
      isCeased: false,
      isMatched: false,
    }
  }

  const result = await fetchSiret(diag.sirene_siret, apiBase)
  const latencyMs = Date.now() - t0

  if (!result.ok) {
    if (result.notFound) {
      // Marquer sirene_state='unknown' + outcome='not_found'
      const payload: SireneUpdatePayload = {
        sirene_denomination: null,
        sirene_legal_form: null,
        sirene_capital_eur: null,
        sirene_employee_range: null,
        sirene_creation_date: null,
        sirene_state: 'unknown',
        sirene_last_synced_at: new Date().toISOString(),
      }
      await supabase.from('diagnosticians').update(payload).eq('id', diag.id)

      return {
        outcome: 'not_found',
        errorMessage: null,
        payload: { siret: diag.sirene_siret, http_status: 404 },
        latencyMs,
        isCeased: false,
        isMatched: false,
      }
    }

    return {
      outcome: result.status === 429 ? 'rate_limited' : 'error',
      errorMessage: result.message,
      payload: { http_status: result.status },
      latencyMs,
      isCeased: false,
      isMatched: false,
    }
  }

  const etab = result.data.etablissement
  const unite = etab.uniteLegale
  const etatA = etab.etatAdministratifEtablissement
  const sireneState = mapEtatAdministratif(etatA)

  const update: SireneUpdatePayload = {
    sirene_denomination: unite.denominationUniteLegale ?? null,
    sirene_legal_form: legalFormLabel(unite.categorieJuridiqueUniteLegale),
    sirene_capital_eur: parseCapital(unite.capitalSocialUniteLegale),
    sirene_employee_range: etab.trancheEffectifsEtablissement ?? null,
    sirene_creation_date: etab.dateCreationEtablissement ?? null,
    sirene_state: sireneState,
    sirene_last_synced_at: new Date().toISOString(),
  }

  const { error: updateErr } = await supabase
    .from('diagnosticians')
    .update(update)
    .eq('id', diag.id)

  if (updateErr) {
    return {
      outcome: 'error',
      errorMessage: `update sirene fields: ${updateErr.message}`,
      payload: truncatePayload(result.data),
      latencyMs,
      isCeased: false,
      isMatched: false,
    }
  }

  // Bascule validation_status (regles metier)
  const nowIso = new Date().toISOString()
  if (sireneState === 'ceased') {
    // Etat 'F' radie → force validation_status='ceased' (ecrasement OK,
    // c'est un signal officiel terminal)
    await supabase
      .from('diagnosticians')
      .update({
        validation_status: 'ceased',
        validation_status_reason: 'INSEE etat administratif F (radie)',
        validation_status_changed_at: nowIso,
      })
      .eq('id', diag.id)

    return {
      outcome: 'matched',
      errorMessage: null,
      payload: truncatePayload(result.data),
      latencyMs,
      isCeased: true,
      isMatched: true,
    }
  }

  if (
    sireneState === 'active' &&
    typeof diag.activity_score === 'number' &&
    diag.activity_score >= 70 &&
    diag.validation_status !== 'suspended' &&
    diag.validation_status !== 'ceased'
  ) {
    // Promouvoir vers 'verified' uniquement si pas deja suspendu ou radie
    await supabase
      .from('diagnosticians')
      .update({
        validation_status: 'verified',
        validation_status_reason: 'INSEE etat=A + activity_score >= 70 (recoupement Sirene OK)',
        validation_status_changed_at: nowIso,
      })
      .eq('id', diag.id)
  }

  return {
    outcome: 'matched',
    errorMessage: null,
    payload: truncatePayload(result.data),
    latencyMs,
    isCeased: false,
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
  const throttleMs = Number.parseInt(Deno.env.get('INSEE_THROTTLE_MS') ?? '2000', 10)
  const apiBase = Deno.env.get('INSEE_API_BASE') ?? 'https://api.insee.fr/entreprises/sirene/V3.11'

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
      return new Response(JSON.stringify({ error: 'diagnostician_id requis en mode single' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { data, error } = await supabase
      .from('diagnosticians')
      .select('id, sirene_siret, activity_score, validation_status')
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
      .select('id, sirene_siret, activity_score, validation_status')
      .not('sirene_siret', 'is', null)
      .or(`sirene_last_synced_at.is.null,sirene_last_synced_at.lt.${ninetyDaysAgo}`)
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
    ceased: 0,
    notFound: 0,
    errors: 0,
    durationMs: 0,
  }

  for (const diag of diagnosticians) {
    try {
      const result = await processDiagnostician(supabase, diag, apiBase)
      stats.processed += 1
      if (result.isMatched) stats.matched += 1
      if (result.isCeased) stats.ceased += 1
      if (result.outcome === 'not_found') stats.notFound += 1
      if (result.outcome === 'error' || result.outcome === 'rate_limited') {
        stats.errors += 1
      }

      // Log d'audit
      await supabase.from('diagnostician_cross_validation_logs').insert({
        diagnostician_id: diag.id,
        source: 'SIRENE',
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
        source: 'SIRENE',
        outcome: 'error',
        payload: null,
        error_message: (err as Error).message,
        latency_ms: null,
      })
    }

    // Throttle (defaut 2s/req, override INSEE_THROTTLE_MS)
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
//     'cross-validate-sirene-daily',
//     '0 2 * * *',  -- 02:00 UTC chaque jour
//     $$
//     SELECT net.http_post(
//       url := 'https://<project-ref>.supabase.co/functions/v1/cross-validate-sirene',
//       headers := jsonb_build_object('x-cron-secret', current_setting('app.cron_secret', true)),
//       body := jsonb_build_object('mode', 'batch', 'limit', 200)
//     );
//     $$
//   );
// ============================================
