// @ts-nocheck — Deno runtime (Supabase Edge Functions). Non compilé par tsc Node workspace.
/* eslint-disable */
// ============================================
// KOVAS — Edge Function : verify-identity-kyc
//
// Mission : pattern Doctolib KYC pour le claim flow `/reclamer-ma-fiche/[id]`.
// Étape 3 obligatoire après SIRET (étape 1) + SMS OTP (étape 2).
//
// Pipeline :
//   1. Téléchargement images CNI/passeport (front + back optionnel) depuis
//      bucket `claim-identity-documents`.
//   2. Claude Vision (sonnet-4-6) vérifie cohérence :
//        - Document est bien une CNI/passeport français valide ?
//        - Date d'expiration ≥ aujourd'hui ?
//        - Nom sur CNI = nom DHUP de la fiche ?
//        - Pas de signe de falsification visible (overlays, polices, etc.) ?
//        - Score 0..100 + raisons structurées
//   3. UPDATE claim_requests :
//        - identity_kyc_score
//        - identity_kyc_reasons (jsonb)
//        - status='review_pending' (transition depuis 'identity_uploaded')
//   4. Notifie admin par email Resend si score < 70 (priorité review).
//
// Authentification : Bearer SUPABASE_SERVICE_ROLE_KEY (appelé server-side
// par la route Next.js /api/diagnosticians/[id]/claim/upload-identity).
//
// Body :
// {
//   "claimId": "uuid",
//   "documentPath": "diag_id/claim_id/front.jpg",        // path bucket
//   "documentPathBack": "diag_id/claim_id/back.jpg"      // optionnel
// }
// ============================================

/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ============================================
// Constantes & env
// ============================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const ADMIN_NOTIFICATION_EMAIL = Deno.env.get('KOVAS_ADMIN_EMAIL') ?? 'contact@kovas.fr'
const SITE_URL = Deno.env.get('SITE_URL') ?? 'https://kovas.fr'

const CLAUDE_MODEL = 'claude-sonnet-4-6'
const STORAGE_BUCKET = 'claim-identity-documents'
const EXTERNAL_API_TIMEOUT_MS = 45_000
const PRIORITY_REVIEW_THRESHOLD = 70

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info',
  'Access-Control-Max-Age': '86400',
}

// ============================================
// Types
// ============================================
interface RequestBody {
  claimId: string
  documentPath: string
  documentPathBack?: string | null
}

interface KycVisionResult {
  is_id_document: boolean
  doc_type: 'cni_recto' | 'cni_verso' | 'passport' | 'other' | 'unreadable'
  doc_country: string | null // 'FR' ideal
  expiry_date: string | null // ISO YYYY-MM-DD
  expiry_ok: boolean
  full_name_detected: string | null
  first_name_detected: string | null
  last_name_detected: string | null
  name_match_score: number // 0..1 fuzzy contre full_name DHUP
  falsification_signs: string[] // ['fonts_inconsistent', 'overlay_seam', ...]
  no_falsification_detected: boolean
  overall_confidence: number // 0..1
  reasons: string[]
  recommendation: 'auto_approve_high_confidence' | 'human_review' | 'auto_reject_falsification'
}

interface FinalDecision {
  score: number // 0..100
  reasons: string[]
  recommendation: KycVisionResult['recommendation']
  flags: {
    is_id_document: boolean
    doc_type: KycVisionResult['doc_type']
    expiry_ok: boolean
    name_match_score: number
    no_falsification_detected: boolean
    full_name_detected: string | null
  }
}

interface OutputResponse {
  ok: boolean
  score: number
  reasons: string[]
  recommendation: KycVisionResult['recommendation']
  priority_review: boolean
  error?: string
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

function normalizeName(s: string | null | undefined): string {
  return (s ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fuzzyNameMatch(dhupFullName: string | null, detectedFullName: string | null): number {
  const a = normalizeName(dhupFullName)
  const b = normalizeName(detectedFullName)
  if (!a || !b) return 0
  if (a === b) return 1
  // Tokens intersect (last+first names dans n'importe quel ordre)
  const tokensA = a.split(' ').filter((t) => t.length >= 2)
  const tokensB = b.split(' ').filter((t) => t.length >= 2)
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  const matching = tokensA.filter((t) => tokensB.includes(t))
  return matching.length / Math.max(tokensA.length, tokensB.length)
}

async function downloadAsBase64(
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
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + chunkSize) as unknown as number[],
    )
  }
  const base64 = btoa(binary)
  const lower = storagePath.toLowerCase()
  const mediaType = lower.endsWith('.pdf')
    ? 'application/pdf'
    : lower.endsWith('.png')
      ? 'image/png'
      : lower.endsWith('.webp')
        ? 'image/webp'
        : lower.endsWith('.heic')
          ? 'image/heic'
          : 'image/jpeg'
  return { base64, mediaType }
}

// ============================================
// Claude Vision — extraction structurée
// ============================================
async function extractKycWithClaude(opts: {
  frontBase64: string
  frontMediaType: string
  backBase64: string | null
  backMediaType: string | null
  expectedFullName: string | null
}): Promise<KycVisionResult> {
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY manquante')

  const systemPrompt = `Tu es un expert KYC (Know Your Customer) pour la vérification de pièces d'identité françaises (carte nationale d'identité ou passeport).

Analyse l'image (ou les 2 images : recto + verso) et extrais les informations suivantes au format JSON STRICTEMENT VALIDE (pas de markdown, pas de commentaire) :

{
  "is_id_document": boolean,                  // Est-ce vraiment une pièce d'identité officielle française ?
  "doc_type": "cni_recto" | "cni_verso" | "passport" | "other" | "unreadable",
  "doc_country": "FR" | autre code ISO | null,
  "expiry_date": "YYYY-MM-DD" | null,         // Date de fin de validité
  "expiry_ok": boolean,                       // expiry_date >= 2026-05-27 (aujourd'hui)
  "full_name_detected": "PRENOM NOM" | null,  // Nom complet lu sur le document
  "first_name_detected": "PRENOM" | null,
  "last_name_detected": "NOM" | null,
  "name_match_score": number,                 // 0.0..1.0 — laisse 0 si pas d'expected_full_name fourni
  "falsification_signs": [],                  // ['fonts_inconsistent','overlay_seam','blur_intentional','photo_pasted', ...]
  "no_falsification_detected": boolean,
  "overall_confidence": number,               // 0.0..1.0
  "reasons": ["Document valide CNI", "Date d'expiration 2030-12-31 OK", "Nom détecté correspond"],
  "recommendation": "auto_approve_high_confidence" | "human_review" | "auto_reject_falsification"
}

CRITÈRES RECOMMANDATION :
- auto_approve_high_confidence : is_id_document=true ET expiry_ok=true ET no_falsification_detected=true ET name_match_score>=0.8 ET overall_confidence>=0.9
- auto_reject_falsification : falsification_signs.length > 0 OU is_id_document=false (document non-officiel, sélfie, papier divers)
- human_review : tous autres cas (qualité image dégradée, name_match faible, expiry illisible)

CRITÈRES STRICTS :
- Date d'expiration > 2026-05-27 obligatoire (sauf passeport, où on peut tolérer expiré ≤ 5 ans pour FR — mais lever doute).
- Le nom sur le document doit correspondre au nom attendu (case-insensitive, sans accents). Si expected_full_name non fourni, mets name_match_score=0 et laisse le pré-rempli.
- Signes de falsification courants à détecter : polices inhabituelles, contours flous d'incrustation, MRZ (machine readable zone) absente ou tronquée sur CNI/passeport, photo recadrée/collée, motifs sécurité (hologramme, micro-impressions) absents si visible.

Réponds UNIQUEMENT avec le JSON, rien d'autre.`

  const userText = opts.expectedFullName
    ? `Nom attendu sur le document (DHUP) : "${opts.expectedFullName}". Vérifie la cohérence du nom détecté avec ce nom attendu pour name_match_score.`
    : `Pas de nom attendu fourni — laisse name_match_score à 0.`

  // biome-ignore lint/suspicious/noExplicitAny: payload Anthropic typed loosely
  const contentBlocks: any[] = [
    {
      type: 'image',
      source: { type: 'base64', media_type: opts.frontMediaType, data: opts.frontBase64 },
    },
  ]
  if (opts.backBase64 && opts.backMediaType) {
    contentBlocks.push({
      type: 'image',
      source: { type: 'base64', media_type: opts.backMediaType, data: opts.backBase64 },
    })
  }
  contentBlocks.push({ type: 'text', text: userText })

  const requestBody = {
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: contentBlocks,
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
      },
      body: JSON.stringify(requestBody),
    }),
    EXTERNAL_API_TIMEOUT_MS,
    'claude-vision-kyc',
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

  let parsed: KycVisionResult
  try {
    parsed = JSON.parse(cleaned) as KycVisionResult
  } catch (err) {
    throw new Error(`Claude Vision JSON parse failed: ${(err as Error).message}`)
  }

  // Normalisations défensives
  parsed.is_id_document = Boolean(parsed.is_id_document)
  parsed.expiry_ok = Boolean(parsed.expiry_ok)
  parsed.no_falsification_detected = Boolean(parsed.no_falsification_detected)
  parsed.overall_confidence =
    typeof parsed.overall_confidence === 'number' ? parsed.overall_confidence : 0
  parsed.name_match_score =
    typeof parsed.name_match_score === 'number' ? parsed.name_match_score : 0
  parsed.falsification_signs = Array.isArray(parsed.falsification_signs)
    ? parsed.falsification_signs
    : []
  parsed.reasons = Array.isArray(parsed.reasons) ? parsed.reasons : []

  return parsed
}

// ============================================
// Décision : agrégation score 0..100
// ============================================
function computeFinalDecision(
  vision: KycVisionResult,
  expectedFullName: string | null,
): FinalDecision {
  const reasons: string[] = [...vision.reasons]

  // Crochet de cohérence côté serveur : on recalcule name_match_score si Claude
  // n'a pas pu (passé 0 pour vouvoyer un edge case) → on prend le max des deux.
  const serverNameMatch = expectedFullName
    ? fuzzyNameMatch(expectedFullName, vision.full_name_detected)
    : 0
  const nameMatchScore = Math.max(vision.name_match_score, serverNameMatch)

  // Score 0..100 selon 5 facteurs pondérés
  let score = 0
  if (vision.is_id_document) score += 30
  else reasons.push('Document non identifié comme CNI / passeport officiel')

  if (vision.expiry_ok) score += 20
  else reasons.push("Date d'expiration invalide ou non lisible")

  if (vision.no_falsification_detected && vision.falsification_signs.length === 0) score += 25
  else {
    score += 5
    reasons.push(`Signes de falsification détectés : ${vision.falsification_signs.join(', ')}`)
  }

  if (nameMatchScore >= 0.8) score += 15
  else if (nameMatchScore >= 0.5) {
    score += 8
    reasons.push(`Concordance nom partielle (${(nameMatchScore * 100).toFixed(0)}%)`)
  } else {
    reasons.push(`Concordance nom faible (${(nameMatchScore * 100).toFixed(0)}%)`)
  }

  score += Math.round(vision.overall_confidence * 10)

  // Clamp 0..100
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Recommandation finale (override si flags critiques)
  let recommendation: KycVisionResult['recommendation'] = vision.recommendation
  if (vision.falsification_signs.length > 0 || !vision.is_id_document) {
    recommendation = 'auto_reject_falsification'
  } else if (
    score >= 85 &&
    vision.expiry_ok &&
    vision.no_falsification_detected &&
    nameMatchScore >= 0.8
  ) {
    recommendation = 'auto_approve_high_confidence'
  } else {
    recommendation = 'human_review'
  }

  return {
    score,
    reasons,
    recommendation,
    flags: {
      is_id_document: vision.is_id_document,
      doc_type: vision.doc_type,
      expiry_ok: vision.expiry_ok,
      name_match_score: nameMatchScore,
      no_falsification_detected: vision.no_falsification_detected,
      full_name_detected: vision.full_name_detected,
    },
  }
}

// ============================================
// Notification admin (Resend)
// ============================================
async function notifyAdmin(opts: {
  claimId: string
  diagnosticianName: string
  score: number
  recommendation: FinalDecision['recommendation']
  reasons: string[]
}): Promise<void> {
  if (!RESEND_API_KEY) return // dev/staging — pas bloquant

  const priorityTag = opts.score < PRIORITY_REVIEW_THRESHOLD ? '[PRIORITAIRE] ' : ''
  const subject = `${priorityTag}[KOVAS Admin] KYC claim — ${opts.diagnosticianName} (score ${opts.score}/100)`

  const text = `Nouvelle demande de claim KYC reçue.

Fiche : ${opts.diagnosticianName}
Claim ID : ${opts.claimId}
Score Vision IA : ${opts.score}/100
Recommandation : ${opts.recommendation}

Raisons :
${opts.reasons.map((r) => `- ${r}`).join('\n')}

Trancher la décision :
${SITE_URL}/app/dashboard/admin/claims/${opts.claimId}

SLA review : 24-48h.
`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'KOVAS <contact@kovas.fr>',
        to: [ADMIN_NOTIFICATION_EMAIL],
        subject,
        text,
        tags: [
          { name: 'category', value: 'alert' },
          { name: 'claim_id', value: opts.claimId },
          { name: 'recommendation', value: opts.recommendation },
        ],
      }),
    })
  } catch (err) {
    console.warn('admin notify resend failed:', (err as Error).message)
  }
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

  if (!body.claimId || !body.documentPath) {
    return jsonResponse({ error: 'missing_required_fields' }, 400)
  }

  // 1. Charge le claim + diag pour avoir le nom attendu (DHUP)
  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge
  const adminAny = supabase as any
  const { data: claim, error: claimErr } = await adminAny
    .from('claim_requests')
    .select('id, diagnostician_id, status, flow_version')
    .eq('id', body.claimId)
    .maybeSingle()

  if (claimErr || !claim) {
    return jsonResponse({ error: 'claim_not_found', detail: claimErr?.message }, 404)
  }

  const { data: diag } = await adminAny
    .from('diagnosticians')
    .select('id, full_name, first_name, last_name')
    .eq('id', claim.diagnostician_id)
    .maybeSingle()

  const fallbackName = `${(diag?.first_name ?? '').trim()} ${(diag?.last_name ?? '').trim()}`.trim()
  const fullNameRaw = (diag?.full_name as string | null) ?? fallbackName
  const expectedFullName: string | null = fullNameRaw.length > 0 ? fullNameRaw : null

  // 2. Téléchargement + Claude Vision
  let visionResult: KycVisionResult
  try {
    const front = await downloadAsBase64(supabase, body.documentPath)
    let back: { base64: string; mediaType: string } | null = null
    if (body.documentPathBack) {
      try {
        back = await downloadAsBase64(supabase, body.documentPathBack)
      } catch (err) {
        // Verso optionnel — on log et on continue avec recto uniquement
        console.warn('back image download failed (continuing front only):', (err as Error).message)
      }
    }

    visionResult = await extractKycWithClaude({
      frontBase64: front.base64,
      frontMediaType: front.mediaType,
      backBase64: back?.base64 ?? null,
      backMediaType: back?.mediaType ?? null,
      expectedFullName,
    })
  } catch (err) {
    const message = (err as Error).message
    console.error('verify-identity-kyc pipeline error:', message)

    // Persiste l'échec — review humaine forcée
    await adminAny
      .from('claim_requests')
      .update({
        identity_kyc_score: 0,
        identity_kyc_reasons: {
          error: message,
          recommendation: 'human_review',
          reasons: ['Échec pipeline Vision IA — review humaine obligatoire'],
        },
        status: 'review_pending',
      })
      .eq('id', body.claimId)

    return jsonResponse({
      ok: false,
      score: 0,
      reasons: ['Pipeline KYC échoué — review humaine'],
      recommendation: 'human_review',
      priority_review: true,
      error: message,
    } satisfies OutputResponse)
  }

  // 3. Décision finale
  const decision = computeFinalDecision(visionResult, expectedFullName)

  // 4. UPDATE claim
  const { error: updErr } = await adminAny
    .from('claim_requests')
    .update({
      identity_kyc_score: decision.score,
      identity_kyc_reasons: {
        recommendation: decision.recommendation,
        reasons: decision.reasons,
        flags: decision.flags,
        raw_vision: {
          doc_type: visionResult.doc_type,
          doc_country: visionResult.doc_country,
          expiry_date: visionResult.expiry_date,
          falsification_signs: visionResult.falsification_signs,
          overall_confidence: visionResult.overall_confidence,
        },
      },
      status: 'review_pending',
    })
    .eq('id', body.claimId)

  if (updErr) {
    return jsonResponse({ error: 'db_update_failed', detail: updErr.message }, 500)
  }

  // 5. Notification admin (priorité si score < 70)
  await notifyAdmin({
    claimId: body.claimId,
    diagnosticianName: expectedFullName ?? 'Diagnostiqueur',
    score: decision.score,
    recommendation: decision.recommendation,
    reasons: decision.reasons,
  })

  const output: OutputResponse = {
    ok: true,
    score: decision.score,
    reasons: decision.reasons,
    recommendation: decision.recommendation,
    priority_review: decision.score < PRIORITY_REVIEW_THRESHOLD,
  }
  return jsonResponse(output)
})
