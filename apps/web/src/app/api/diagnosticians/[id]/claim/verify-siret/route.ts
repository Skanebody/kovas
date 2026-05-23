import { checkClaimRateLimit, extractIpFromRequest } from '@/lib/diagnosticians/rate-limit'
import { validateSiret } from '@/lib/validation/siret'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * POST /api/diagnosticians/[id]/claim/verify-siret
 *
 * Public (anon). Vérifie qu'un SIRET saisi correspond au sirene_siret
 * stocké sur la fiche. Match exact = vérification.
 *
 * Rate-limit : 5 demandes/h/IP, 10/h/diag.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

const bodySchema = z.object({
  siret: z.string().min(14).max(20),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: diagnosticianId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(diagnosticianId)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const cleanedSiret = body.siret.replace(/\s/g, '')

  // 1. Validation Luhn (avant DB lookup)
  const siretCheck = validateSiret(cleanedSiret)
  if (!siretCheck.valid) {
    return NextResponse.json(
      { error: 'SIRET invalide (format ou somme de contrôle).' },
      { status: 400 },
    )
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

  const admin = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge A1+A4
  const adminAny = admin as any

  const { data: diag, error: diagErr } = await adminAny
    .from('diagnosticians')
    .select('id, sirene_siret, claim_status')
    .eq('id', diagnosticianId)
    .maybeSingle()

  if (diagErr || !diag) {
    return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
  }
  if (diag.claim_status !== 'unclaimed') {
    return NextResponse.json({ error: 'Cette fiche a déjà été réclamée.' }, { status: 409 })
  }
  if (!diag.sirene_siret) {
    return NextResponse.json(
      { error: 'Pas de SIRET enregistré pour cette fiche.' },
      { status: 422 },
    )
  }

  // 2. Comparaison exacte
  const storedSiret = String(diag.sirene_siret).replace(/\s/g, '')
  const matches = storedSiret === cleanedSiret

  // Audit log dans tous les cas (succès ET échec)
  const { data: claim, error: insertErr } = await adminAny
    .from('claim_requests')
    .insert({
      diagnostician_id: diagnosticianId,
      method: 'siret_match',
      status: matches ? 'verified' : 'rejected',
      contact_siret: cleanedSiret,
      ip_address: ip,
      user_agent: userAgent,
      verified_at: matches ? new Date().toISOString() : null,
      rejected_reason: matches ? null : 'siret_mismatch',
    })
    .select('id')
    .single()

  if (insertErr || !claim) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  if (!matches) {
    return NextResponse.json(
      { error: 'Le SIRET ne correspond pas à cette fiche.' },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    claimId: claim.id,
    redirect: `/signup?claim_id=${claim.id}&siret=${cleanedSiret}`,
  })
}
