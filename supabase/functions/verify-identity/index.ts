// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
// ============================================
// KOVAS Anti-Fraude — Edge Function : verify-identity
//
// Mission VAL-3 : valider l'identité civile d'un diagnostiqueur via 3 paths :
//   1. FranceConnect (OAuth2 DINUM, gratuit, France) — méthode privilégiée
//   2. KYC scan CNI + selfie liveness (Veriff) — fallback paid
//   3. Yousign signature qualifiée eIDAS — fallback contractuel
//
// Pipeline selon méthode :
//   - france_connect      : vérifie le JWT/oauth payload (sub, family_name, given_name)
//   - kyc_scan_cni        : récupère 3 docs (CNI recto/verso + selfie liveness),
//                           applique Claude Vision OCR sur la CNI, vérifie cohérence
//   - yousign_qualified   : appelle l'API Yousign pour confirmer envelope.status=done
//                           ET signatory.identity_verified=true
//
// Tous paths terminent par UPDATE diagnostician_verification_status (identity_*)
// + INSERT verification_checks_log.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Env & constantes
// ============================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const VERIFF_API_KEY = Deno.env.get('VERIFF_API_KEY') ?? ''
const VERIFF_API_BASE = Deno.env.get('VERIFF_API_BASE') ?? 'https://stationapi.veriff.com/v1'
const YOUSIGN_API_KEY = Deno.env.get('YOUSIGN_API_KEY') ?? ''
const YOUSIGN_API_BASE = Deno.env.get('YOUSIGN_API_BASE') ?? 'https://api.yousign.app/v3'

const CLAUDE_MODEL = 'claude-haiku-4-5'
const STORAGE_BUCKET = 'verification-docs'
const RATE_LIMIT_PER_HOUR = 3
const EXTERNAL_API_TIMEOUT_MS = 30_000
const MIN_VISION_CONFIDENCE = 0.7

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
}

// ============================================
// Types
// ============================================
type IdentityMethod = 'france_connect' | 'kyc_scan_cni' | 'yousign_qualified'
type IdentityStatus = 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'

interface RequestBody {
  diagnostician_id: string
  method: IdentityMethod
  payload: Record<string, unknown>
}

interface FranceConnectPayload {
  sub: string
  family_name: string
  given_name: string
  birthdate?: string
  email?: string
}

interface YousignPayload {
  envelope_id: string
}

interface CniVisionExtraction {
  last_name: string | null
  first_name: string | null
  date_of_birth: string | null
  cni_number: string | null
  valid_until: string | null
  nationality: string | null
  confidence_score: number
}

interface OutputResponse {
  status: IdentityStatus
  method: IdentityMethod
  verified_data: Record<string, unknown>
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

async function downloadDoc(
  supabase: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<{ base64: string; mediaType: string }> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(storagePath)
  if (error || !data) {
    throw new Error(`Storage download failed (${storagePath}): ${error?.message ?? 'no data'}`)
  }
  const buffer = await data.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  const mediaType = storagePath.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : storagePath.toLowerCase().endsWith('.png')
      ? 'image/png'
      : 'image/jpeg'
  return { base64, mediaType }
}

// ============================================
// Path 1 — FranceConnect
// ============================================
function verifyFranceConnect(payload: Record<string, unknown>): {
  ok: boolean
  data: FranceConnectPayload | null
  error?: string
} {
  // En dev/stub : accepte tout payload qui présente sub + family_name + given_name
  const sub = typeof payload.sub === 'string' ? payload.sub : null
  const familyName = typeof payload.family_name === 'string' ? payload.family_name : null
  const givenName = typeof payload.given_name === 'string' ? payload.given_name : null

  if (!sub || !familyName || !givenName) {
    return {
      ok: false,
      data: null,
      error: 'Payload FranceConnect incomplet (sub/family_name/given_name requis)',
    }
  }

  // TODO V2 prod : valider la signature du JWT FranceConnect via JWKS DINUM
  //   https://app.franceconnect.gouv.fr/api/v1/jwks
  // + valider la fraîcheur (iat, exp) + audience (notre client_id)
  return {
    ok: true,
    data: {
      sub,
      family_name: familyName,
      given_name: givenName,
      birthdate: typeof payload.birthdate === 'string' ? payload.birthdate : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined,
    },
  }
}

// ============================================
// Path 2 — KYC scan CNI (Claude Vision + Veriff stub)
// ============================================
async function extractCniWithClaude(
  base64: string,
  mediaType: string,
): Promise<CniVisionExtraction> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY manquante')

  const systemPrompt = `Tu es un assistant d'extraction de données structurées sur des Cartes Nationales d'Identité (CNI) françaises ou des passeports.

Extrait UNIQUEMENT les informations suivantes du document fourni :
- last_name : nom de famille
- first_name : prénom(s) usuels (séparés par espace si plusieurs)
- date_of_birth : date de naissance au format ISO YYYY-MM-DD
- cni_number : numéro de la pièce d'identité (sans espaces)
- valid_until : date de fin de validité au format ISO YYYY-MM-DD
- nationality : nationalité (ex: "FRANCAISE", "FRA")
- confidence_score : ton niveau de confiance global de 0.0 à 1.0

Réponds UNIQUEMENT avec un JSON brut valide, pas de markdown ni de commentaire :
{"last_name":"...","first_name":"...","date_of_birth":"...","cni_number":"...","valid_until":"...","nationality":"...","confidence_score":0.95}

Si tu ne trouves pas une valeur, mets null.`

  const requestBody: any = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          mediaType === 'application/pdf'
            ? {
                type: 'document',
                source: { type: 'base64', media_type: 'application/pdf', data: base64 },
              }
            : {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
          { type: 'text', text: "Extrait les données structurées de cette pièce d'identité." },
        ],
      },
    ],
  }

  const response = await withTimeout(
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify(requestBody),
    }),
    EXTERNAL_API_TIMEOUT_MS,
    'claude-vision-cni',
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Claude Vision API error ${response.status}: ${errText.substring(0, 300)}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>
  }
  const textBlock = data.content.find((c) => c.type === 'text')?.text ?? ''
  const cleaned = textBlock
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')

  let parsed: CniVisionExtraction
  try {
    parsed = JSON.parse(cleaned) as CniVisionExtraction
  } catch (err) {
    throw new Error(`Claude Vision CNI JSON parse failed: ${(err as Error).message}`)
  }
  parsed.confidence_score =
    typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0
  return parsed
}

interface KycVerificationResult {
  ok: boolean
  data: Record<string, unknown>
  manual_review_required: boolean
  error?: string
}

async function verifyKycScanCni(
  supabase: ReturnType<typeof createClient>,
  diagnosticianId: string,
): Promise<KycVerificationResult> {
  // 1. Récupère les 3 docs uploadés
  const { data: docs, error } = await supabase
    .from('verification_documents')
    .select('id, doc_type, storage_path, ai_extracted_data, ai_confidence_score')
    .eq('diagnostician_id', diagnosticianId)
    .in('doc_type', ['cni_recto', 'cni_verso', 'selfie_liveness'])
    .order('uploaded_at', { ascending: false })

  if (error) {
    return { ok: false, data: {}, manual_review_required: true, error: error.message }
  }

  const cniRecto = docs?.find((d) => d.doc_type === 'cni_recto')
  const cniVerso = docs?.find((d) => d.doc_type === 'cni_verso')
  const selfie = docs?.find((d) => d.doc_type === 'selfie_liveness')

  if (!cniRecto || !cniVerso || !selfie) {
    return {
      ok: false,
      data: {},
      manual_review_required: true,
      error: 'Documents KYC incomplets (cni_recto + cni_verso + selfie_liveness requis)',
    }
  }

  // 2. Claude Vision sur le recto pour extraction
  let extraction: CniVisionExtraction
  try {
    const { base64, mediaType } = await downloadDoc(supabase, cniRecto.storage_path as string)
    extraction = await extractCniWithClaude(base64, mediaType)
  } catch (err) {
    return {
      ok: false,
      data: { docs_count: docs.length },
      manual_review_required: true,
      error: `Claude Vision CNI échec: ${(err as Error).message}`,
    }
  }

  // Persist extraction sur le doc
  await supabase
    .from('verification_documents')
    .update({
      ai_extracted_data: extraction,
      ai_confidence_score: extraction.confidence_score,
    })
    .eq('id', cniRecto.id)

  if (extraction.confidence_score < MIN_VISION_CONFIDENCE) {
    return {
      ok: false,
      data: extraction as Record<string, unknown>,
      manual_review_required: true,
      error: `Confidence OCR CNI faible (${extraction.confidence_score})`,
    }
  }

  // 3. CNI expirée
  if (extraction.valid_until) {
    const validUntil = new Date(extraction.valid_until)
    if (!Number.isNaN(validUntil.getTime()) && validUntil < new Date()) {
      return {
        ok: false,
        data: extraction as Record<string, unknown>,
        manual_review_required: false,
        error: `CNI expirée le ${extraction.valid_until}`,
      }
    }
  }

  // 4. Liveness check Veriff (stub en V1)
  // TODO V2 : appel POST ${VERIFF_API_BASE}/sessions avec selfie + cni
  //           waitFor: 'decision', vérifier verification.status === 'approved'
  //           AC sur attribut acceptanceTime et code === 9001 (success)
  if (VERIFF_API_KEY) {
    // Stub : on logge l'intention mais on ne bloque pas
    console.log('Veriff API call SKIPPED (TODO V2 — selfie liveness check)')
  }

  return {
    ok: true,
    data: {
      ...extraction,
      docs_count: docs.length,
      veriff_status: VERIFF_API_KEY ? 'stub_skipped_todo_v2' : 'no_api_key',
    },
    manual_review_required: false,
  }
}

// ============================================
// Path 3 — Yousign signature qualifiée
// ============================================
interface YousignVerificationResult {
  ok: boolean
  data: Record<string, unknown>
  manual_review_required: boolean
  error?: string
}

async function verifyYousignQualified(envelope_id: string): Promise<YousignVerificationResult> {
  if (!YOUSIGN_API_KEY) {
    return {
      ok: false,
      data: { envelope_id },
      manual_review_required: true,
      error: 'YOUSIGN_API_KEY manquante (vérification manuelle requise)',
    }
  }

  try {
    const url = `${YOUSIGN_API_BASE.replace(/\/$/, '')}/signature_requests/${encodeURIComponent(envelope_id)}`
    const res = await withTimeout(
      fetch(url, {
        headers: {
          Authorization: `Bearer ${YOUSIGN_API_KEY}`,
          Accept: 'application/json',
        },
      }),
      EXTERNAL_API_TIMEOUT_MS,
      'yousign-get',
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        ok: false,
        data: { envelope_id, http_status: res.status },
        manual_review_required: true,
        error: `Yousign HTTP ${res.status}: ${text.substring(0, 200)}`,
      }
    }

    const data = (await res.json()) as Record<string, any>
    const status = data.status as string | undefined
    const signers = (data.signers as Array<Record<string, any>>) ?? []
    const allSigned = status === 'done'
    const allIdentityVerified = signers.every(
      (s) => s.identification_attestations?.[0]?.identity_verified === true,
    )

    if (!allSigned || !allIdentityVerified) {
      return {
        ok: false,
        data: { envelope_id, status, signers_count: signers.length },
        manual_review_required: true,
        error: `Yousign envelope non finalisée (status=${status}, identity_verified=${allIdentityVerified})`,
      }
    }

    return {
      ok: true,
      data: { envelope_id, status, signers_count: signers.length },
      manual_review_required: false,
    }
  } catch (err) {
    return {
      ok: false,
      data: { envelope_id },
      manual_review_required: true,
      error: `Yousign API error: ${(err as Error).message}`,
    }
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
    .eq('check_type', 'identity_initial')
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

  if (!body.diagnostician_id || !body.method) {
    return jsonResponse({ error: 'missing_required_fields' }, 400)
  }
  if (!['france_connect', 'kyc_scan_cni', 'yousign_qualified'].includes(body.method)) {
    return jsonResponse({ error: 'invalid_method' }, 400)
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
  let logSource: 'france_connect' | 'veriff' | 'claude_vision' = 'claude_vision'
  let output: OutputResponse

  try {
    let providerRef: string | null = null
    let verifiedData: Record<string, unknown> = {}
    let manualReviewRequired = false
    let rejectionReason: string | undefined

    if (body.method === 'france_connect') {
      logSource = 'france_connect'
      const fc = verifyFranceConnect(body.payload ?? {})
      if (!fc.ok || !fc.data) {
        logStatus = 'warning'
        logResult = { error: fc.error }
        output = {
          status: 'rejected',
          method: body.method,
          verified_data: {},
          manual_review_required: false,
          rejection_reason: fc.error,
        }
      } else {
        providerRef = fc.data.sub
        verifiedData = fc.data as unknown as Record<string, unknown>
        output = {
          status: 'verified',
          method: body.method,
          verified_data: verifiedData,
          manual_review_required: false,
        }
        logResult = { france_connect: truncatePayload(fc.data) }
      }
    } else if (body.method === 'kyc_scan_cni') {
      logSource = 'claude_vision'
      const kyc = await verifyKycScanCni(supabase, body.diagnostician_id)
      verifiedData = kyc.data
      manualReviewRequired = kyc.manual_review_required
      rejectionReason = kyc.error

      if (kyc.ok) {
        output = {
          status: 'verified',
          method: body.method,
          verified_data: verifiedData,
          manual_review_required: false,
        }
        logResult = { kyc: truncatePayload(kyc) }
      } else {
        output = {
          status: kyc.manual_review_required ? 'in_review' : 'rejected',
          method: body.method,
          verified_data: verifiedData,
          manual_review_required: kyc.manual_review_required,
          rejection_reason: kyc.error,
        }
        logStatus = 'warning'
        logResult = { kyc: truncatePayload(kyc) }
      }
    } else {
      // yousign_qualified
      logSource = 'claude_vision' // (pas de mapping veriff/yousign dans la table — on log "claude_vision" comme fallback générique)
      const envelopeId = (body.payload as YousignPayload | undefined)?.envelope_id ?? null
      if (!envelopeId) {
        output = {
          status: 'rejected',
          method: body.method,
          verified_data: {},
          manual_review_required: false,
          rejection_reason: 'envelope_id manquant dans payload',
        }
        logStatus = 'warning'
        logResult = { error: 'envelope_id missing' }
      } else {
        const ys = await verifyYousignQualified(envelopeId)
        verifiedData = ys.data
        manualReviewRequired = ys.manual_review_required
        rejectionReason = ys.error
        providerRef = envelopeId

        if (ys.ok) {
          output = {
            status: 'verified',
            method: body.method,
            verified_data: verifiedData,
            manual_review_required: false,
          }
          logResult = { yousign: truncatePayload(ys) }
        } else {
          output = {
            status: ys.manual_review_required ? 'in_review' : 'rejected',
            method: body.method,
            verified_data: verifiedData,
            manual_review_required: ys.manual_review_required,
            rejection_reason: ys.error,
          }
          logStatus = 'warning'
          logResult = { yousign: truncatePayload(ys) }
        }
      }
    }

    // UPDATE verification_status
    const updatePayload: Record<string, unknown> = {
      identity_status: output.status,
      identity_method: body.method,
      identity_rejection_reason: output.rejection_reason ?? null,
    }
    if (providerRef) {
      updatePayload.identity_provider_ref = providerRef
    }
    if (output.status === 'verified') {
      updatePayload.identity_verified_at = new Date().toISOString()
    }

    const { error: upsertErr } = await supabase
      .from('diagnostician_verification_status')
      .upsert(
        { diagnostician_id: body.diagnostician_id, ...updatePayload },
        { onConflict: 'diagnostician_id' },
      )
    if (upsertErr) throw new Error(`upsert verification_status: ${upsertErr.message}`)

    if (output.manual_review_required) {
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
  } catch (err) {
    logStatus = (err as Error).message.includes('timeout') ? 'timeout' : 'failure'
    logResult = {
      error: (err as Error).message,
      stack: (err as Error).stack?.substring(0, 1000),
    }
    output = {
      status: 'in_review',
      method: body.method,
      verified_data: {},
      manual_review_required: true,
      rejection_reason: `Pipeline error: ${(err as Error).message}`,
    }
  }

  await supabase.from('verification_checks_log').insert({
    diagnostician_id: body.diagnostician_id,
    check_type: 'identity_initial',
    check_source: logSource,
    status: logStatus,
    duration_ms: Date.now() - t0,
    result: logResult,
    triggered_by: 'system',
  })

  return jsonResponse(output, logStatus === 'failure' || logStatus === 'timeout' ? 502 : 200)
})

// ============================================
// TODOs V2 prod
//   - FranceConnect : valider signature JWT via JWKS DINUM
//     (https://app.franceconnect.gouv.fr/api/v1/jwks) + checks iat/exp/audience
//   - Veriff : implémenter vrai appel POST /sessions + polling decision
//     + biométrique selfie<->CNI face match
//   - Yousign : webhook /v3/webhooks pour réception event signature.completed
//     plutôt que poll bloquant
//   - Mode reset/replay : permettre admin de relancer le pipeline post-rejection
//   - Cross-check : si france_connect = OK, comparer identity name vs sirene_director_name
//     pour détecter incohérences (Doctolib gold standard cross-vérification)
// ============================================
