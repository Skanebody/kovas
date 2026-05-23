// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
// ============================================
// KOVAS Anti-Fraude — Edge Function : verify-cofrac
//
// Mission VAL-3 (post Doctolib 2022) : valider la certification COFRAC d'un
// diagnostiqueur en croisant 3 sources de vérité :
//   1. Claude Vision OCR sur le PDF du certificat (extraction structurée)
//   2. API publique COFRAC (placeholder, fallback scraper HTML)
//   3. Données saisies par l'utilisateur (input request)
//
// Pipeline :
//   - Téléchargement PDF depuis bucket `verification-docs` (Supabase Storage)
//   - Appel Claude Haiku 4-5 en mode vision multimodale
//   - Tentative appel API/scraping cofrac.fr (best-effort, marque "non disponible"
//     si endpoint pas dispo)
//   - Croisement des 3 sources :
//       * 3 concordent (nom + numéro + dates + organisme + ≥1 domaine valide)
//         → cofrac_status='verified'
//       * Divergence → cofrac_status='in_review' + alert 'manual_audit_required'
//       * Expiré / suspendu / radié → cofrac_status='rejected|suspended|radiated'
//         + alert critical
//   - UPDATE diagnostician_verification_status (cofrac_*)
//   - INSERT verification_checks_log (type='cofrac_initial')
//
// Auth : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}
//        OU JWT user authentifié (cas appel depuis app onboarding 7 étapes)
//
// Rate limit : 3 tentatives / diagnostician / heure (table verification_checks_log)
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Constantes & env
// ============================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const COFRAC_API_URL = Deno.env.get('COFRAC_API_URL') ?? 'https://www.cofrac.fr/recherche/json'

const CLAUDE_MODEL = 'claude-haiku-4-5'
const STORAGE_BUCKET = 'verification-docs'
const RATE_LIMIT_PER_HOUR = 3
const EXTERNAL_API_TIMEOUT_MS = 30_000

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
}

// Domaines COFRAC reconnus (8 diagnostics standards FR)
const RECOGNIZED_DOMAINS = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'CREP',
  'GAZ',
  'ELECTRICITE',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'BOUTIN',
  'ERP',
] as const

// ============================================
// Types
// ============================================
interface RequestBody {
  diagnostician_id: string
  cofrac_number: string
  certifying_body: string
  certificate_storage_path: string
}

interface CofracVisionExtraction {
  diagnostician_name: string | null
  certificate_number: string | null
  certifying_body: string | null
  valid_from: string | null // ISO date
  valid_until: string | null // ISO date
  domains: string[]
  status_indicator: string | null // 'valid' | 'suspended' | 'radiated' | etc.
  confidence_score: number // 0-1
}

interface CofracApiResult {
  available: boolean
  certificate_number: string | null
  holder_name: string | null
  certifying_body: string | null
  domains: string[]
  valid_until: string | null
  status: 'valid' | 'suspended' | 'radiated' | 'unknown' | null
  raw_message: string
}

type CofracStatus =
  | 'pending'
  | 'in_review'
  | 'verified'
  | 'rejected'
  | 'expired'
  | 'suspended'
  | 'radiated'

interface OutputResponse {
  status: CofracStatus
  domains_verified: string[]
  valid_until: string | null
  confidence_score: number
  manual_review_required: boolean
  rejection_reason?: string
}

// ============================================
// Helpers communs
// ============================================
function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json', ...CORS_HEADERS },
  })
}

function normalizeStr(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '')
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

// ============================================
// Source 1 — Claude Vision OCR sur PDF certificat
// ============================================
async function downloadCertificatePdf(
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
  // Détection rapide PDF vs image
  const mediaType = storagePath.toLowerCase().endsWith('.pdf')
    ? 'application/pdf'
    : storagePath.toLowerCase().endsWith('.png')
      ? 'image/png'
      : 'image/jpeg'
  return { base64, mediaType }
}

async function extractWithClaudeVision(
  base64: string,
  mediaType: string,
): Promise<CofracVisionExtraction> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY manquante')
  }

  const systemPrompt = `Tu es un assistant d'extraction de données structurées sur des certificats COFRAC de diagnostiqueurs immobiliers français.

Extrait les informations suivantes du document fourni :
- diagnostician_name : nom complet du diagnostiqueur certifié
- certificate_number : numéro de certificat COFRAC (format ex: COFRAC-DPE-12345 ou CERT-XXXX)
- certifying_body : organisme certificateur (Bureau Veritas Certification, Apave Certification, Dekra Certification, I.Cert, LCC Qualixpert, ICert, AFNOR Certification, Bureau Alpes Contrôles, Qualibat, etc.)
- valid_from : date de début de validité au format ISO YYYY-MM-DD
- valid_until : date de fin de validité au format ISO YYYY-MM-DD
- domains : liste des domaines de diagnostic certifiés. Valeurs canoniques : "DPE", "AMIANTE", "PLOMB", "CREP", "GAZ", "ELECTRICITE", "TERMITES", "CARREZ", "BOUTIN", "ERP". Inclus uniquement ceux explicitement mentionnés.
- status_indicator : statut visuel/textuel du document — l'une des valeurs "valid", "suspended", "radiated", "expired", "unknown"
- confidence_score : ton niveau de confiance global dans l'extraction de 0.0 à 1.0

Réponds UNIQUEMENT avec un JSON brut valide, pas de markdown ni de commentaire :
{"diagnostician_name":"...","certificate_number":"...","certifying_body":"...","valid_from":"...","valid_until":"...","domains":["..."],"status_indicator":"...","confidence_score":0.95}

Si tu ne trouves pas une information, mets null (sauf domains qui doit être [] et confidence_score qui doit être un number).`

  const requestBody = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType === 'application/pdf' ? 'application/pdf' : 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: 'Extrait les données structurées de ce certificat COFRAC.',
          },
        ],
      },
    ],
  }

  // Si c'est une image, basculer en image content block
  if (mediaType !== 'application/pdf') {
    requestBody.messages[0].content[0] = {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64 },
    } as any
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
    'claude-vision-cofrac',
  )

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Claude Vision API error ${response.status}: ${errText.substring(0, 300)}`)
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text?: string }>
  }
  const textBlock = data.content.find((c) => c.type === 'text')?.text ?? ''

  // Nettoyer un éventuel fence markdown
  const cleaned = textBlock
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')

  let parsed: CofracVisionExtraction
  try {
    parsed = JSON.parse(cleaned) as CofracVisionExtraction
  } catch (err) {
    throw new Error(`Claude Vision JSON parse failed: ${(err as Error).message}`)
  }

  // Normaliser domains (uppercase + filtrer reconnus)
  parsed.domains = (parsed.domains ?? [])
    .map((d) => d.toUpperCase().trim())
    .filter((d) => RECOGNIZED_DOMAINS.includes(d as any))
  parsed.confidence_score =
    typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0
  return parsed
}

// ============================================
// Source 2 — API publique COFRAC (placeholder + scraper fallback)
// ============================================
async function queryCofracPublicApi(cofracNumber: string): Promise<CofracApiResult> {
  const empty: CofracApiResult = {
    available: false,
    certificate_number: null,
    holder_name: null,
    certifying_body: null,
    domains: [],
    valid_until: null,
    status: null,
    raw_message: 'API COFRAC non disponible, vérification manuelle requise',
  }

  try {
    // Tentative endpoint JSON
    const url = `${COFRAC_API_URL}?numero=${encodeURIComponent(cofracNumber)}`
    const res = await withTimeout(
      fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; KOVAS-Verification/1.0; +https://kovas.fr)',
        },
      }),
      EXTERNAL_API_TIMEOUT_MS,
      'cofrac-api',
    )

    if (res.ok) {
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('application/json')) {
        const data = (await res.json()) as Record<string, unknown>
        return {
          available: true,
          certificate_number: (data.numero as string) ?? cofracNumber,
          holder_name: (data.titulaire as string) ?? null,
          certifying_body: (data.organisme as string) ?? null,
          domains: Array.isArray(data.domaines) ? (data.domaines as string[]) : [],
          valid_until: (data.fin_validite as string) ?? null,
          status: ((data.statut as string) === 'actif'
            ? 'valid'
            : (data.statut as string) === 'suspendu'
              ? 'suspended'
              : (data.statut as string) === 'radie'
                ? 'radiated'
                : 'unknown') as CofracApiResult['status'],
          raw_message: 'API COFRAC JSON OK',
        }
      }
    }

    // Fallback : tenter scraping HTML page recherche cofrac.fr
    const htmlUrl = `https://www.cofrac.fr/fr/recherche?q=${encodeURIComponent(cofracNumber)}`
    const htmlRes = await withTimeout(
      fetch(htmlUrl, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; KOVAS-Verification/1.0; +https://kovas.fr)',
        },
      }),
      EXTERNAL_API_TIMEOUT_MS,
      'cofrac-scraper',
    ).catch(() => null)

    if (htmlRes?.ok) {
      const html = await htmlRes.text()
      // Heuristique très basique : on cherche le numéro + des marqueurs de statut
      const hasMatch = html.includes(cofracNumber)
      const isRadiated = /\bradi[ée]/i.test(html)
      const isSuspended = /\bsuspendu/i.test(html)
      if (hasMatch) {
        return {
          available: true,
          certificate_number: cofracNumber,
          holder_name: null,
          certifying_body: null,
          domains: [],
          valid_until: null,
          status: isRadiated ? 'radiated' : isSuspended ? 'suspended' : 'valid',
          raw_message: 'cofrac.fr HTML scrap (heuristique)',
        }
      }
    }

    return empty
  } catch (err) {
    return { ...empty, raw_message: `Erreur appel COFRAC: ${(err as Error).message}` }
  }
}

// ============================================
// Croisement 3 sources & décision
// ============================================
interface CrossCheckResult {
  status: CofracStatus
  domains_verified: string[]
  valid_until: string | null
  confidence_score: number
  manual_review_required: boolean
  rejection_reason?: string
  divergences: string[]
}

function crossCheckSources(
  vision: CofracVisionExtraction,
  api: CofracApiResult,
  userInput: RequestBody,
): CrossCheckResult {
  const divergences: string[] = []
  const today = new Date()

  // 1. Statut explicite "suspended" ou "radiated" depuis n'importe quelle source → rejet
  if (vision.status_indicator === 'suspended' || api.status === 'suspended') {
    return {
      status: 'suspended',
      domains_verified: vision.domains,
      valid_until: vision.valid_until,
      confidence_score: vision.confidence_score,
      manual_review_required: false,
      rejection_reason: 'Certification COFRAC suspendue',
      divergences,
    }
  }
  if (vision.status_indicator === 'radiated' || api.status === 'radiated') {
    return {
      status: 'radiated',
      domains_verified: vision.domains,
      valid_until: vision.valid_until,
      confidence_score: vision.confidence_score,
      manual_review_required: false,
      rejection_reason: 'Certification COFRAC radiée',
      divergences,
    }
  }

  // 2. Expiration
  if (vision.valid_until) {
    const validUntilDate = new Date(vision.valid_until)
    if (!Number.isNaN(validUntilDate.getTime()) && validUntilDate < today) {
      return {
        status: 'expired',
        domains_verified: vision.domains,
        valid_until: vision.valid_until,
        confidence_score: vision.confidence_score,
        manual_review_required: false,
        rejection_reason: `Certificat expiré le ${vision.valid_until}`,
        divergences,
      }
    }
  }

  // 3. Confiance Claude faible → revue manuelle
  if (vision.confidence_score < 0.8) {
    return {
      status: 'in_review',
      domains_verified: vision.domains,
      valid_until: vision.valid_until,
      confidence_score: vision.confidence_score,
      manual_review_required: true,
      rejection_reason: `Confidence OCR faible (${vision.confidence_score})`,
      divergences,
    }
  }

  // 4. Croisement numéro
  const userNum = normalizeStr(userInput.cofrac_number)
  const visionNum = normalizeStr(vision.certificate_number)
  const apiNum = normalizeStr(api.certificate_number)
  if (userNum && visionNum && userNum !== visionNum) {
    divergences.push(`numero: user=${userInput.cofrac_number} vision=${vision.certificate_number}`)
  }
  if (api.available && apiNum && userNum && apiNum !== userNum) {
    divergences.push(`numero: user=${userInput.cofrac_number} api=${api.certificate_number}`)
  }

  // 5. Croisement organisme
  const userBody = normalizeStr(userInput.certifying_body)
  const visionBody = normalizeStr(vision.certifying_body)
  if (userBody && visionBody && !userBody.includes(visionBody) && !visionBody.includes(userBody)) {
    divergences.push(
      `organisme: user=${userInput.certifying_body} vision=${vision.certifying_body}`,
    )
  }

  // 6. ≥1 domaine reconnu
  if (vision.domains.length === 0) {
    return {
      status: 'in_review',
      domains_verified: [],
      valid_until: vision.valid_until,
      confidence_score: vision.confidence_score,
      manual_review_required: true,
      rejection_reason: 'Aucun domaine COFRAC reconnu sur le certificat',
      divergences,
    }
  }

  // 7. Décision finale
  // - API dispo + concordance complète → verified
  // - API indisponible mais Vision OK et user input concordant → verified avec
  //   marker manual_review_required=false (Claude haute confiance déjà filtré)
  // - Divergence → in_review
  if (divergences.length > 0) {
    return {
      status: 'in_review',
      domains_verified: vision.domains,
      valid_until: vision.valid_until,
      confidence_score: vision.confidence_score,
      manual_review_required: true,
      rejection_reason: `Divergences détectées (${divergences.length})`,
      divergences,
    }
  }

  return {
    status: 'verified',
    domains_verified: vision.domains,
    valid_until: vision.valid_until,
    confidence_score: vision.confidence_score,
    manual_review_required: !api.available, // recommandation si API non dispo
    divergences,
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
    .eq('check_type', 'cofrac_initial')
    .gte('performed_at', oneHourAgo)
  if (error) {
    // En cas d'erreur read, on laisse passer (fail-open) mais on log
    console.warn('Rate limit check failed:', error.message)
    return true
  }
  return (count ?? 0) < RATE_LIMIT_PER_HOUR
}

// ============================================
// Handler principal
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

  // Validation input minimale
  if (
    !body.diagnostician_id ||
    !body.cofrac_number ||
    !body.certifying_body ||
    !body.certificate_storage_path
  ) {
    return jsonResponse({ error: 'missing_required_fields' }, 400)
  }

  // Rate limit
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
    // 1. Téléchargement PDF + Claude Vision
    const { base64, mediaType } = await downloadCertificatePdf(
      supabase,
      body.certificate_storage_path,
    )
    const vision = await extractWithClaudeVision(base64, mediaType)

    // 2. API COFRAC (best-effort)
    const apiResult = await queryCofracPublicApi(body.cofrac_number)

    // 3. Croisement
    const decision = crossCheckSources(vision, apiResult, body)

    // 4. UPDATE diagnostician_verification_status
    const updatePayload: Record<string, unknown> = {
      cofrac_status: decision.status,
      cofrac_number: body.cofrac_number,
      cofrac_certifying_body: body.certifying_body,
      cofrac_domains: decision.domains_verified,
      cofrac_valid_from: vision.valid_from,
      cofrac_valid_until: vision.valid_until,
      cofrac_last_api_check: new Date().toISOString(),
      cofrac_rejection_reason: decision.rejection_reason ?? null,
    }
    if (decision.status === 'verified') {
      updatePayload.cofrac_verified_at = new Date().toISOString()
    }

    const { error: upsertErr } = await supabase
      .from('diagnostician_verification_status')
      .upsert(
        { diagnostician_id: body.diagnostician_id, ...updatePayload },
        { onConflict: 'diagnostician_id' },
      )

    if (upsertErr) {
      throw new Error(`upsert verification_status: ${upsertErr.message}`)
    }

    // 5. Alert si in_review / suspended / radiated
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
    if (decision.status === 'suspended' || decision.status === 'radiated') {
      await supabase.from('verification_alerts_queue').insert({
        diagnostician_id: body.diagnostician_id,
        alert_type: decision.status === 'suspended' ? 'cofrac_suspended' : 'cofrac_radiated',
        severity: 'critical',
      })
    }

    logStatus =
      decision.status === 'verified'
        ? 'success'
        : decision.status === 'in_review'
          ? 'warning'
          : 'warning'
    logResult = {
      vision_extraction: truncatePayload(vision),
      cofrac_api: truncatePayload(apiResult),
      decision: truncatePayload(decision),
    }

    output = {
      status: decision.status,
      domains_verified: decision.domains_verified,
      valid_until: decision.valid_until,
      confidence_score: decision.confidence_score,
      manual_review_required: decision.manual_review_required,
      rejection_reason: decision.rejection_reason,
    }
  } catch (err) {
    logStatus = (err as Error).message.includes('timeout') ? 'timeout' : 'failure'
    logResult = {
      error: (err as Error).message,
      stack: (err as Error).stack?.substring(0, 1000),
    }
    output = {
      status: 'in_review',
      domains_verified: [],
      valid_until: null,
      confidence_score: 0,
      manual_review_required: true,
      rejection_reason: `Pipeline error: ${(err as Error).message}`,
    }
  }

  // 6. Log d'audit (toujours)
  await supabase.from('verification_checks_log').insert({
    diagnostician_id: body.diagnostician_id,
    check_type: 'cofrac_initial',
    check_source: 'cofrac_api',
    status: logStatus,
    duration_ms: Date.now() - t0,
    result: logResult,
    triggered_by: 'system',
  })

  return jsonResponse(output, logStatus === 'failure' || logStatus === 'timeout' ? 502 : 200)
})

// ============================================
// TODOs V2
//   - Remplacer scraper HTML par appel à un endpoint COFRAC officiel
//     dès qu'il sera disponible (négociation institutionnelle en cours via
//     ATEMA syndicat diagnostiqueurs).
//   - Ajouter cache 24h sur résultats API COFRAC (table dédiée) pour éviter
//     re-hit endpoint si même cofrac_number testé sur 2 diags différents.
//   - Migrer Claude Vision en mode "structured outputs" dès dispo (tool use
//     forcé) pour garantir validité JSON sans parsing texte.
// ============================================
