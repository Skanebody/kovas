import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Database } from '@kovas/database/types'
import {
  checkVerificationCode,
  MAX_VERIFICATION_ATTEMPTS,
} from '@/lib/diagnosticians/verification-code'

/**
 * POST /api/diagnosticians/[id]/claim/verify-code
 *
 * Public (anon). Vérifie un code 6 chiffres saisi par l'utilisateur.
 * - OK → status='verified' → redirect /signup?claim_id=<id>
 * - KO 5 fois → status='expired' (force nouveau code)
 *
 * Pas de rate-limit en plus du compteur d'attempts (déjà borné par la DB).
 */
export const runtime = 'nodejs'
export const maxDuration = 30

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code 6 chiffres requis'),
  method: z.enum(['email_official', 'sms_official']),
  claimId: z.string().uuid('claimId requis').optional(),
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

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge A1+A4
  const adminAny = admin as any

  // Récupère la claim active la plus récente pour ce diag + méthode
  let query = adminAny
    .from('claim_requests')
    .select('id, status, verification_code, verification_code_expires_at, verification_attempts')
    .eq('diagnostician_id', diagnosticianId)
    .eq('method', body.method)
    .eq('status', 'code_sent')
    .order('created_at', { ascending: false })
    .limit(1)

  if (body.claimId) {
    query = query.eq('id', body.claimId)
  }

  const { data: claims, error: claimErr } = await query

  if (claimErr || !claims || claims.length === 0) {
    return NextResponse.json(
      { error: 'Aucun code actif. Demandez un nouveau code.' },
      { status: 404 },
    )
  }

  const claim = claims[0] as {
    id: string
    status: string
    verification_code: string | null
    verification_code_expires_at: string | null
    verification_attempts: number
  }

  // Incrément du compteur de tentatives AVANT vérification (anti-brute)
  await adminAny
    .from('claim_requests')
    .update({ verification_attempts: claim.verification_attempts + 1 })
    .eq('id', claim.id)

  const result = checkVerificationCode({
    submitted: body.code,
    stored: claim.verification_code,
    expiresAt: claim.verification_code_expires_at,
    attempts: claim.verification_attempts, // valeur AVANT incrément
  })

  if (!result.valid) {
    // Si > 5 tentatives → on expire la claim (force nouveau code)
    if (claim.verification_attempts + 1 >= MAX_VERIFICATION_ATTEMPTS) {
      await adminAny
        .from('claim_requests')
        .update({ status: 'expired' })
        .eq('id', claim.id)

      return NextResponse.json(
        { error: 'Trop de tentatives. Demandez un nouveau code.' },
        { status: 429 },
      )
    }

    const message =
      result.reason === 'expired'
        ? 'Code expiré. Demandez un nouveau code.'
        : 'Code invalide.'
    return NextResponse.json(
      {
        error: message,
        attemptsLeft: Math.max(MAX_VERIFICATION_ATTEMPTS - (claim.verification_attempts + 1), 0),
      },
      { status: 400 },
    )
  }

  // Code OK → marque verified + efface code (zero retention)
  const { error: updErr } = await adminAny
    .from('claim_requests')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verification_code: null,
    })
    .eq('id', claim.id)

  if (updErr) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    claimId: claim.id,
    redirect: `/signup?claim_id=${claim.id}`,
  })
}
