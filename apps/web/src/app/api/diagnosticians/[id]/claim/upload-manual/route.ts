import { buildClaimAdminNotification } from '@/lib/diagnosticians/claim-templates'
import { checkClaimRateLimit, extractIpFromRequest } from '@/lib/diagnosticians/rate-limit'
import { sendEmail } from '@/lib/email/send'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/diagnosticians/[id]/claim/upload-manual
 *
 * Public (anon). Upload 2 justificatifs (CNI + attestation cert) pour
 * une revue manuelle par l'admin (24-48h SLA).
 *
 * Multipart form-data :
 *   - idDocument : File (CNI / passeport)
 *   - certDocument : File (attestation certification)
 *   - contactEmail : string (pour rappel admin)
 *   - contactPhone? : string (optionnel)
 *
 * Rate-limit : 5 demandes/h/IP, 10/h/diag.
 */
export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_BYTES_PER_FILE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
])

const ADMIN_NOTIFICATION_EMAIL = process.env.KOVAS_ADMIN_EMAIL ?? 'contact@kovas.fr'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: diagnosticianId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(diagnosticianId)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  const ip = extractIpFromRequest(request)
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) ?? null

  const rl = await checkClaimRateLimit({ ipAddress: ip, diagnosticianId })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans une heure.' },
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

  const idDocument = formData.get('idDocument') as File | null
  const certDocument = formData.get('certDocument') as File | null
  const contactEmail = (formData.get('contactEmail') as string | null)?.slice(0, 200) ?? null
  const contactPhone = (formData.get('contactPhone') as string | null)?.slice(0, 30) ?? null

  if (!idDocument || !certDocument) {
    return NextResponse.json(
      { error: 'Les deux justificatifs sont requis (CNI + attestation).' },
      { status: 400 },
    )
  }
  if (!contactEmail || !contactEmail.includes('@')) {
    return NextResponse.json({ error: 'Email de contact requis.' }, { status: 400 })
  }

  for (const file of [idDocument, certDocument]) {
    if (file.size > MAX_BYTES_PER_FILE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max 10 Mo) : ${file.name}` },
        { status: 413 },
      )
    }
    if (!ALLOWED_MIMES.has(file.type)) {
      return NextResponse.json(
        { error: `Type de fichier non autorisé : ${file.type}` },
        { status: 415 },
      )
    }
  }

  const admin = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge A1+A4
  const adminAny = admin as any

  // Charge le diag
  // FIX-FF (mai 2026) : colonnes consolidées (full_name au lieu de display_name)
  const { data: diag, error: diagErr } = await adminAny
    .from('diagnosticians')
    .select('id, full_name, first_name, last_name, claim_status')
    .eq('id', diagnosticianId)
    .maybeSingle()

  if (diagErr || !diag) {
    return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
  }
  if (diag.claim_status !== 'unclaimed') {
    return NextResponse.json({ error: 'Cette fiche a déjà été réclamée.' }, { status: 409 })
  }

  // Crée la claim (status='pending' = en attente revue admin)
  const { data: claim, error: insertErr } = await adminAny
    .from('claim_requests')
    .insert({
      diagnostician_id: diagnosticianId,
      method: 'manual_id_upload',
      status: 'pending',
      contact_email: contactEmail,
      contact_phone: contactPhone,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (insertErr || !claim) {
    return NextResponse.json({ error: 'Impossible de créer la demande.' }, { status: 500 })
  }

  // Upload Storage — bucket claim-id-uploads
  const idPath = await uploadFile({
    admin,
    file: idDocument,
    claimId: claim.id,
    prefix: 'id',
  })
  const certPath = await uploadFile({
    admin,
    file: certDocument,
    claimId: claim.id,
    prefix: 'cert',
  })

  if (!idPath || !certPath) {
    // Rollback : supprime claim + tout fichier uploadé partiellement
    await adminAny.from('claim_requests').delete().eq('id', claim.id)
    if (idPath) await admin.storage.from('claim-id-uploads').remove([idPath])
    if (certPath) await admin.storage.from('claim-id-uploads').remove([certPath])
    return NextResponse.json({ error: "Échec d'upload Storage." }, { status: 500 })
  }

  // Update claim avec les paths
  const { error: updErr } = await adminAny
    .from('claim_requests')
    .update({
      id_upload_path: idPath,
      cert_upload_path: certPath,
    })
    .eq('id', claim.id)

  if (updErr) {
    // Non bloquant — fichiers uploadés, claim créée
    console.error('claim_requests update paths failed:', updErr)
  }

  // Notification admin
  const diagDisplayName =
    diag.full_name?.trim() ||
    `${(diag.first_name ?? '').trim()} ${(diag.last_name ?? '').trim()}`.trim() ||
    'Diagnostiqueur'
  const notif = buildClaimAdminNotification({
    diagnosticianName: diagDisplayName,
    claimId: claim.id,
    contactEmail,
    contactPhone,
  })
  await sendEmail({
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: notif.subject,
    text: notif.text,
    category: 'alert',
  })

  return NextResponse.json({
    ok: true,
    claimId: claim.id,
    message: 'Vérification en cours. Vous recevrez une réponse sous 24-48h par email.',
  })
}

async function uploadFile(opts: {
  // biome-ignore lint/suspicious/noExplicitAny: client typed loosely
  admin: any
  file: File
  claimId: string
  prefix: 'id' | 'cert'
}): Promise<string | null> {
  const { admin, file, claimId, prefix } = opts
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase().slice(0, 5)
  const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : 'bin'
  const path = `${claimId}/${prefix}-${Date.now()}.${safeExt}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error } = await admin.storage.from('claim-id-uploads').upload(path, buffer, {
    contentType: file.type,
    cacheControl: '3600',
    upsert: false,
  })

  if (error) {
    console.error(`claim upload ${prefix} failed:`, error.message)
    return null
  }
  return path
}
