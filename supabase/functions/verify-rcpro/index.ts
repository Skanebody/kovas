// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
// ============================================
// KOVAS Anti-Fraude — Edge Function : verify-rcpro
//
// Mission VAL-3 : valider l'attestation Responsabilité Civile Professionnelle
// (RC Pro) d'un diagnostiqueur immobilier.
//
// Pipeline :
//   1. Téléchargement PDF attestation depuis bucket `verification-docs`
//   2. Claude Vision OCR — extraction structurée (assureur, n° police, dates,
//      montants par sinistre / par an)
//   3. Validation contre liste assureurs reconnus (fuzzy match normalisé)
//   4. Validation montants minimums obligatoires métier diagnostic :
//        - amount_per_claim_eur >= 300 000 €
//        - amount_per_year_eur  >= 1 000 000 €
//   5. Validation date d'expiration : doit être > now()
//      Si < 60j restant → INSERT alert rcpro_expiry_60 (puis _30 / _7 selon)
//   6. UPDATE diagnostician_verification_status (rcpro_*)
//   7. INSERT verification_checks_log (type='rcpro_initial')
//
// Source légale : Art. L271-6 du CCH (Code de la construction et de l'habitation)
// impose RC Pro pour diagnostiqueurs immobiliers FR.
// ============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Constantes & env
// ============================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CLAUDE_MODEL = 'claude-haiku-4-5'
const STORAGE_BUCKET = 'verification-docs'
const RATE_LIMIT_PER_HOUR = 3
const EXTERNAL_API_TIMEOUT_MS = 30_000

// Seuils règlementaires
const MIN_AMOUNT_PER_CLAIM_EUR = 300_000
const MIN_AMOUNT_PER_YEAR_EUR = 1_000_000

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
}

// Liste compagnies & courtiers FR reconnus pour le marché diagnostic immobilier
const RECOGNIZED_INSURERS: string[] = [
  // Compagnies grand public
  'AXA',
  'Allianz',
  'Generali',
  'MMA',
  'Groupama',
  'Macif',
  'Maif',
  'CNP Assurances',
  'Covea',
  'Aviva',
  'Crédit Agricole Assurances',
  "L'Olivier Assurance",
  'SMA BTP',
  'Albingia',
  'Hiscox',
  'Chubb',
  'Liberty Mutual',
  'Zurich',
  'Helvetia',
  'Swiss Life',
  // Courtiers spécialisés diagnostic / BTP
  'Verspieren',
  'Diot-Siaci',
  'Marsh',
  'Aon',
  'Gras Savoye',
  'Verlingue',
  'Aoste Assurances',
  'CGPA',
  'MIC Insurance',
  'AssurOne',
  'AssurDiag',
  'Assurdiag',
  'April Entreprise',
  'April Pro',
  'Generali IARD',
  'Mutuelle des Architectes Français',
  'MAF',
  'CGI Bâtiment',
  'GMF',
  'MACSF',
  'Bessé',
  'Filhet-Allard',
  'Henner',
  'Sham',
  'Relyens',
  'WTW',
  'Willis Towers Watson',
  "Bureau Européen d'Assurances",
  'B2EA',
  'Eurofiscalys',
  'Assurance Pour Tous',
  'Cogedis',
  'Carrara Assurances',
  'Galian',
]

// ============================================
// Types
// ============================================
interface RequestBody {
  diagnostician_id: string
  attestation_storage_path: string
}

interface RcproVisionExtraction {
  insurer_name: string | null
  policy_number: string | null
  valid_from: string | null // ISO YYYY-MM-DD
  valid_until: string | null // ISO YYYY-MM-DD
  amount_per_claim_eur: number | null
  amount_per_year_eur: number | null
  policyholder_name: string | null
  confidence_score: number
}

type RcproStatus = 'pending' | 'in_review' | 'verified' | 'rejected' | 'expired'

interface OutputResponse {
  status: RcproStatus
  insurer: string | null
  valid_until: string | null
  amount_per_claim_eur: number | null
  amount_per_year_eur: number | null
  confidence_score: number
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

function normalizeInsurer(s: string | null | undefined): string {
  return (s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '')
}

function fuzzyMatchInsurer(extracted: string | null): string | null {
  if (!extracted) return null
  const target = normalizeInsurer(extracted)
  if (!target) return null
  for (const known of RECOGNIZED_INSURERS) {
    const norm = normalizeInsurer(known)
    if (target === norm) return known
    if (target.includes(norm) || norm.includes(target)) return known
  }
  return null
}

function daysUntil(isoDate: string | null): number | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return null
  const diffMs = d.getTime() - Date.now()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

// ============================================
// Download + Claude Vision
// ============================================
async function downloadAttestationPdf(
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

async function extractRcproWithClaude(
  base64: string,
  mediaType: string,
): Promise<RcproVisionExtraction> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY manquante')

  const systemPrompt = `Tu es un assistant d'extraction de données structurées sur des attestations d'assurance Responsabilité Civile Professionnelle (RC Pro) pour diagnostiqueurs immobiliers français.

Extrait UNIQUEMENT les informations suivantes :
- insurer_name : nom de la compagnie d'assurance émettrice (ex: "AXA France IARD", "Allianz IARD", "Generali Assurances IARD")
- policy_number : numéro de police d'assurance (ex: "10-23456-AB", "FR-2026-987654")
- valid_from : date de début de couverture au format ISO YYYY-MM-DD
- valid_until : date de fin de couverture au format ISO YYYY-MM-DD
- amount_per_claim_eur : plafond de garantie par sinistre en EUROS (number, ex: 500000)
- amount_per_year_eur : plafond de garantie par année d'assurance en EUROS (number, ex: 1500000)
- policyholder_name : nom de l'assuré (diagnostiqueur ou société)
- confidence_score : ton niveau de confiance global de 0.0 à 1.0

Réponds UNIQUEMENT avec un JSON brut valide, pas de markdown ni de commentaire :
{"insurer_name":"...","policy_number":"...","valid_from":"...","valid_until":"...","amount_per_claim_eur":500000,"amount_per_year_eur":1500000,"policyholder_name":"...","confidence_score":0.92}

Si tu ne trouves pas une valeur, mets null. Pour les montants, convertis correctement (1.5 M€ = 1500000, 300k€ = 300000).`

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
          {
            type: 'text',
            text: 'Extrait les données structurées de cette attestation RC Pro.',
          },
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
    'claude-vision-rcpro',
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

  let parsed: RcproVisionExtraction
  try {
    parsed = JSON.parse(cleaned) as RcproVisionExtraction
  } catch (err) {
    throw new Error(`Claude Vision JSON parse failed: ${(err as Error).message}`)
  }

  // Normalisation
  parsed.amount_per_claim_eur =
    typeof parsed.amount_per_claim_eur === 'number' ? parsed.amount_per_claim_eur : null
  parsed.amount_per_year_eur =
    typeof parsed.amount_per_year_eur === 'number' ? parsed.amount_per_year_eur : null
  parsed.confidence_score =
    typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 0

  return parsed
}

// ============================================
// Décision
// ============================================
interface RcproDecision {
  status: RcproStatus
  insurer_canonical: string | null
  insurer_recognized: boolean
  manual_review_required: boolean
  rejection_reason?: string
  expiry_alert_type?: 'rcpro_expiry_60' | 'rcpro_expiry_30' | 'rcpro_expiry_7' | 'rcpro_expired'
}

function decideRcproStatus(vision: RcproVisionExtraction): RcproDecision {
  // 1. Validité dates obligatoire
  if (!vision.valid_until) {
    return {
      status: 'in_review',
      insurer_canonical: null,
      insurer_recognized: false,
      manual_review_required: true,
      rejection_reason: 'Date de fin de validité non lisible',
    }
  }
  const daysLeft = daysUntil(vision.valid_until)
  if (daysLeft === null) {
    return {
      status: 'in_review',
      insurer_canonical: null,
      insurer_recognized: false,
      manual_review_required: true,
      rejection_reason: 'Date de fin de validité illisible',
    }
  }
  if (daysLeft <= 0) {
    return {
      status: 'expired',
      insurer_canonical: null,
      insurer_recognized: false,
      manual_review_required: false,
      rejection_reason: `Attestation expirée le ${vision.valid_until}`,
      expiry_alert_type: 'rcpro_expired',
    }
  }

  // 2. Confiance
  if (vision.confidence_score < 0.7) {
    return {
      status: 'in_review',
      insurer_canonical: null,
      insurer_recognized: false,
      manual_review_required: true,
      rejection_reason: `Confidence OCR faible (${vision.confidence_score})`,
    }
  }

  // 3. Montants minimums
  const claim = vision.amount_per_claim_eur ?? 0
  const yearly = vision.amount_per_year_eur ?? 0
  if (claim < MIN_AMOUNT_PER_CLAIM_EUR || yearly < MIN_AMOUNT_PER_YEAR_EUR) {
    return {
      status: 'rejected',
      insurer_canonical: null,
      insurer_recognized: false,
      manual_review_required: false,
      rejection_reason: `Montants insuffisants : par sinistre ${claim}€ (min ${MIN_AMOUNT_PER_CLAIM_EUR}€), par an ${yearly}€ (min ${MIN_AMOUNT_PER_YEAR_EUR}€)`,
    }
  }

  // 4. Assureur reconnu
  const canonical = fuzzyMatchInsurer(vision.insurer_name)
  const insurerRecognized = canonical !== null

  // 5. Détermination alerte expiration
  let expiryAlert: RcproDecision['expiry_alert_type'] | undefined
  if (daysLeft <= 7) expiryAlert = 'rcpro_expiry_7'
  else if (daysLeft <= 30) expiryAlert = 'rcpro_expiry_30'
  else if (daysLeft <= 60) expiryAlert = 'rcpro_expiry_60'

  return {
    status: insurerRecognized ? 'verified' : 'in_review',
    insurer_canonical: canonical,
    insurer_recognized: insurerRecognized,
    manual_review_required: !insurerRecognized,
    rejection_reason: insurerRecognized
      ? undefined
      : `Assureur "${vision.insurer_name}" non listé — vérification manuelle requise`,
    expiry_alert_type: expiryAlert,
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
    .eq('check_type', 'rcpro_initial')
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

  if (!body.diagnostician_id || !body.attestation_storage_path) {
    return jsonResponse({ error: 'missing_required_fields' }, 400)
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
    const { base64, mediaType } = await downloadAttestationPdf(
      supabase,
      body.attestation_storage_path,
    )
    const vision = await extractRcproWithClaude(base64, mediaType)
    const decision = decideRcproStatus(vision)

    // UPDATE verification_status
    const updatePayload: Record<string, unknown> = {
      rcpro_status: decision.status,
      rcpro_insurer: decision.insurer_canonical ?? vision.insurer_name,
      rcpro_policy_number: vision.policy_number,
      rcpro_amount_per_claim_eur: vision.amount_per_claim_eur,
      rcpro_amount_per_year_eur: vision.amount_per_year_eur,
      rcpro_valid_from: vision.valid_from,
      rcpro_valid_until: vision.valid_until,
      rcpro_rejection_reason: decision.rejection_reason ?? null,
    }
    if (decision.status === 'verified') {
      updatePayload.rcpro_verified_at = new Date().toISOString()
    }

    const { error: upsertErr } = await supabase
      .from('diagnostician_verification_status')
      .upsert(
        { diagnostician_id: body.diagnostician_id, ...updatePayload },
        { onConflict: 'diagnostician_id' },
      )

    if (upsertErr) throw new Error(`upsert verification_status: ${upsertErr.message}`)

    // Alert expiration
    if (decision.expiry_alert_type) {
      const severity: 'info' | 'warning' | 'critical' =
        decision.expiry_alert_type === 'rcpro_expired'
          ? 'critical'
          : decision.expiry_alert_type === 'rcpro_expiry_7'
            ? 'warning'
            : decision.expiry_alert_type === 'rcpro_expiry_30'
              ? 'warning'
              : 'info'
      await supabase
        .from('verification_alerts_queue')
        .insert({
          diagnostician_id: body.diagnostician_id,
          alert_type: decision.expiry_alert_type,
          severity,
        })
        .then(({ error }) => {
          if (error && !error.message.includes('uq_vaq_pending_unique')) {
            console.warn('alert insert failed:', error.message)
          }
        })
    }

    // Alert manuel si in_review
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

    logStatus =
      decision.status === 'verified'
        ? 'success'
        : decision.status === 'rejected' || decision.status === 'expired'
          ? 'warning'
          : 'warning'
    logResult = {
      vision_extraction: truncatePayload(vision),
      decision: truncatePayload(decision),
    }

    output = {
      status: decision.status,
      insurer: decision.insurer_canonical ?? vision.insurer_name,
      valid_until: vision.valid_until,
      amount_per_claim_eur: vision.amount_per_claim_eur,
      amount_per_year_eur: vision.amount_per_year_eur,
      confidence_score: vision.confidence_score,
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
      insurer: null,
      valid_until: null,
      amount_per_claim_eur: null,
      amount_per_year_eur: null,
      confidence_score: 0,
      manual_review_required: true,
      rejection_reason: `Pipeline error: ${(err as Error).message}`,
    }
  }

  await supabase.from('verification_checks_log').insert({
    diagnostician_id: body.diagnostician_id,
    check_type: 'rcpro_initial',
    check_source: 'claude_vision',
    status: logStatus,
    duration_ms: Date.now() - t0,
    result: logResult,
    triggered_by: 'system',
  })

  return jsonResponse(output, logStatus === 'failure' || logStatus === 'timeout' ? 502 : 200)
})

// ============================================
// TODOs V2
//   - Intégrer API "Verif RC Pro" Bureau Européen d'Assurances (BEA) si dispo
//     pour cross-check niveau 2 (numero police -> compagnie réelle)
//   - Liste assureurs en config Supabase (table dédiée) au lieu du hardcode
//   - Crontab mensuel : ré-évaluer toutes les RC Pro pour détecter expiration
//     glissante (J-60 / J-30 / J-7 / expired)
// ============================================
