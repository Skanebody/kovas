import { requireAdmin } from '@/lib/auth/require-admin'
import { sendEmail } from '@/lib/email/send'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'

/**
 * POST /api/admin/claims/[id]/review
 *
 * Réservé admin (allowlist email — `requireAdmin()`).
 *
 * Tranche un claim KYC (refonte Doctolib 2026-05-27) :
 *   - `decision: 'approved' | 'rejected'`
 *   - `notes: string | null`
 *
 * Pipeline :
 *   1. Garde admin
 *   2. UPDATE claim_requests :
 *        kyc_decision = approved/rejected
 *        kyc_reviewed_at = now()
 *        kyc_review_notes = notes
 *        kyc_reviewer_user_id = current admin id
 *      Le trigger `claim_kyc_apply_decision` bascule status='approved'|'rejected'
 *      et pose verified_at en cohérence.
 *   3. Envoie email au diag (template décision)
 */
export const runtime = 'nodejs'
export const maxDuration = 30

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

const bodySchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  notes: z.string().max(2000).nullable(),
  diagnosticianId: z.string().uuid().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: claimId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimId)) {
    return NextResponse.json({ error: 'claimId invalide' }, { status: 400 })
  }

  // Garde admin server-side
  const admin = await requireAdmin()

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })
  }

  const supabase = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validées
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validées
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending
  const supabaseAny = supabase as any

  // Récupère le claim pour avoir les infos de notification
  const { data: claim, error: claimErr } = await supabaseAny
    .from('claim_requests')
    .select('id, diagnostician_id, contact_email, kyc_decision, status')
    .eq('id', claimId)
    .maybeSingle()

  if (claimErr || !claim) {
    return NextResponse.json({ error: 'Claim introuvable' }, { status: 404 })
  }
  if (claim.kyc_decision === body.decision) {
    return NextResponse.json({ error: 'Décision déjà appliquée.' }, { status: 409 })
  }

  // UPDATE — le trigger DB applique le status final automatiquement
  const { error: updErr } = await supabaseAny
    .from('claim_requests')
    .update({
      kyc_decision: body.decision,
      kyc_reviewed_at: new Date().toISOString(),
      kyc_review_notes: body.notes,
      kyc_reviewer_user_id: admin.userId,
    })
    .eq('id', claimId)

  if (updErr) {
    return NextResponse.json(
      { error: 'Erreur DB update.', detail: updErr.message },
      { status: 500 },
    )
  }

  // Charge diag pour l'email (nom + email officiel)
  const { data: diag } = await supabaseAny
    .from('diagnosticians')
    .select('id, full_name, first_name, last_name, email')
    .eq('id', claim.diagnostician_id)
    .maybeSingle()

  const recipient = (diag?.email as string | null) ?? claim.contact_email
  if (recipient) {
    const diagName =
      ((diag?.full_name as string | null) ??
        `${(diag?.first_name ?? '').trim()} ${(diag?.last_name ?? '').trim()}`.trim()) ||
      'Diagnostiqueur'

    if (body.decision === 'approved') {
      await sendEmail({
        to: recipient,
        subject: 'KOVAS — Votre réclamation est approuvée',
        text: `Bonjour ${diagName},

Votre demande de réclamation de fiche professionnelle KOVAS a été approuvée.

Vous pouvez maintenant créer votre compte pour reprendre la main sur votre fiche publique :
${SITE_URL}/signup?claim_id=${claimId}

${body.notes ? `\nNotes de l'équipe : ${body.notes}\n` : ''}
Cordialement,
L'équipe KOVAS
contact@kovas.fr
`,
        category: 'transactional',
      })
    } else {
      await sendEmail({
        to: recipient,
        subject: "KOVAS — Votre réclamation n'a pas pu être validée",
        text: `Bonjour ${diagName},

Nous n'avons pas pu valider votre demande de réclamation de fiche professionnelle KOVAS.

${body.notes ? `Raison communiquée :\n${body.notes}\n\n` : ''}Si vous pensez qu'il s'agit d'une erreur ou souhaitez fournir de nouveaux éléments, écrivez-nous à contact@kovas.fr en citant la référence ${claimId}.

Cordialement,
L'équipe KOVAS
contact@kovas.fr
`,
        category: 'transactional',
      })
    }
  }

  return NextResponse.json({ ok: true, claimId, decision: body.decision })
}
