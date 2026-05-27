import { checkClaimRateLimit, extractIpFromRequest } from '@/lib/diagnosticians/rate-limit'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/diagnosticians/[id]/claim/upload-identity
 *
 * Doctolib pattern — étape 3 KYC (refonte 2026-05-27).
 *
 * Public (anon). Accepte un multipart FormData :
 *   - front : File (image CNI recto ou passeport) — required, ≤ 5 Mo
 *   - back  : File (image CNI verso) — optionnel, ≤ 5 Mo
 *   - claimId : uuid — required (claim créé aux étapes 1/2)
 *
 * Pipeline :
 * 1. Vérifie que claimId existe + appartient à diagnosticianId + status='phone_verified'
 *    (gate strict, contrairement au manual flow V1).
 * 2. Upload images dans bucket privé `claim-identity-documents/{diag_id}/{claim_id}/front.jpg`
 *    (et back.jpg si fourni).
 * 3. UPDATE claim_requests : identity_doc_path + identity_uploaded_at +
 *    status='identity_uploaded'.
 * 4. Trigger asynchrone Edge Function `verify-identity-kyc` (fire-and-forget
 *    pour ne pas bloquer l'UI ; le client poll ensuite ou est notifié email).
 * 5. Renvoie { ok, claimId, status:'identity_uploaded' } immédiatement.
 *
 * Rate-limit : 5 demandes/h/IP, 10/h/diag.
 */
export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_BYTES_PER_FILE = 5 * 1024 * 1024 // 5 Mo (briefé strict)
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
])
const STORAGE_BUCKET = 'claim-identity-documents'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: diagnosticianId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(diagnosticianId)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  const ip = extractIpFromRequest(request)
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) ?? null

  // Rate-limit Upstash anti-spam upload KYC : 3 uploads / 15 min / IP
  // (limite les attaques par flood + protège bucket Storage).
  const upstashRl = await checkRateLimit('auth_strict', `claim_kyc_upload:${ip ?? 'unknown'}`)
  if (!upstashRl.success) {
    const retryAfter = Math.max(0, Math.ceil((upstashRl.reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Trop de demandes. Réessaie dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  const rl = await checkClaimRateLimit({ ipAddress: ip, diagnosticianId })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de demandes. Réessaie dans une heure.' },
      {
        status: 429,
        headers: rl.retryAfterSec ? { 'Retry-After': String(rl.retryAfterSec) } : undefined,
      },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Format multipart attendu' }, { status: 400 })
  }

  const front = formData.get('front') as File | null
  const back = formData.get('back') as File | null
  const claimId = (formData.get('claimId') as string | null)?.trim() ?? null

  if (!front) {
    return NextResponse.json({ error: "Recto de la pièce d'identité requis." }, { status: 400 })
  }
  if (
    !claimId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)
  ) {
    return NextResponse.json({ error: 'claimId invalide.' }, { status: 400 })
  }

  for (const file of [front, back].filter((f): f is File => f !== null)) {
    if (file.size > MAX_BYTES_PER_FILE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max 5 Mo) : ${file.name}` },
        { status: 413 },
      )
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json(
        {
          error: `Type de fichier non autorisé : ${file.type}. JPEG / PNG / WebP / HEIC / PDF acceptés.`,
        },
        { status: 415 },
      )
    }
  }

  const admin = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validées au boot
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validées au boot
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending
  const adminAny = admin as any

  // 1. Vérifie l'existence du claim + status attendu
  const { data: claim, error: claimErr } = await adminAny
    .from('claim_requests')
    .select('id, diagnostician_id, status, flow_version, phone_verified_at, siret_verified_at')
    .eq('id', claimId)
    .maybeSingle()

  if (claimErr || !claim) {
    return NextResponse.json({ error: 'Demande de claim introuvable.' }, { status: 404 })
  }
  if (claim.diagnostician_id !== diagnosticianId) {
    return NextResponse.json({ error: 'Claim non lié à cette fiche.' }, { status: 403 })
  }
  if (!claim.siret_verified_at || !claim.phone_verified_at) {
    return NextResponse.json(
      { error: "Étapes 1 (SIRET) et 2 (SMS) requises avant l'upload identité." },
      { status: 409 },
    )
  }

  // 2. Upload Storage — bucket claim-identity-documents
  const frontPath = await uploadFile({
    admin,
    file: front,
    diagId: diagnosticianId,
    claimId,
    side: 'front',
  })
  if (!frontPath) {
    return NextResponse.json({ error: "Échec d'upload Storage (recto)." }, { status: 500 })
  }

  let backPath: string | null = null
  if (back) {
    backPath = await uploadFile({
      admin,
      file: back,
      diagId: diagnosticianId,
      claimId,
      side: 'back',
    })
    if (!backPath) {
      // Rollback front + erreur explicite
      await admin.storage.from(STORAGE_BUCKET).remove([frontPath])
      return NextResponse.json({ error: "Échec d'upload Storage (verso)." }, { status: 500 })
    }
  }

  // 3. UPDATE claim — status='identity_uploaded'
  const { error: updErr } = await adminAny
    .from('claim_requests')
    .update({
      identity_doc_path: frontPath,
      identity_uploaded_at: new Date().toISOString(),
      status: 'identity_uploaded',
      flow_version: 'v2_doctolib',
      ip_address: ip,
      user_agent: userAgent,
    })
    .eq('id', claimId)

  if (updErr) {
    return NextResponse.json(
      { error: 'Erreur DB update claim.', detail: updErr.message },
      { status: 500 },
    )
  }

  // 4. Trigger Edge Function verify-identity-kyc (fire-and-forget)
  triggerKycVerification({ claimId, documentPath: frontPath, documentPathBack: backPath }).catch(
    (err) => {
      console.error('[upload-identity] kyc trigger failed (non-blocking):', err)
    },
  )

  return NextResponse.json({
    ok: true,
    claimId,
    status: 'identity_uploaded',
    message:
      "Pièce d'identité reçue. Vérification automatique + revue humaine sous 24 à 48 heures.",
  })
}

async function uploadFile(opts: {
  // biome-ignore lint/suspicious/noExplicitAny: client loosely typed
  admin: any
  file: File
  diagId: string
  claimId: string
  side: 'front' | 'back'
}): Promise<string | null> {
  const { admin, file, diagId, claimId, side } = opts
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().slice(0, 5)
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'jpg'
  const path = `${diagId}/${claimId}/${side}-${Date.now()}.${safeExt}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    console.error(`claim-identity upload ${side} failed:`, error.message)
    return null
  }
  return path
}

async function triggerKycVerification(opts: {
  claimId: string
  documentPath: string
  documentPathBack: string | null
}): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.warn('[upload-identity] Supabase env missing — KYC trigger skipped')
    return
  }
  try {
    await fetch(`${supabaseUrl}/functions/v1/verify-identity-kyc`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        claimId: opts.claimId,
        documentPath: opts.documentPath,
        documentPathBack: opts.documentPathBack,
      }),
    })
  } catch (err) {
    console.warn('[upload-identity] verify-identity-kyc invoke failed:', (err as Error).message)
  }
}
