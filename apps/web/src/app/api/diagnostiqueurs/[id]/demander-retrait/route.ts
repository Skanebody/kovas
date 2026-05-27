/**
 * POST /api/diagnostiqueurs/[id]/demander-retrait
 *
 * Endpoint public (pas d'auth) pour qu'un diagnostiqueur demande le retrait
 * de sa fiche. Marque withdrawal_requested=true et dépublie immédiatement.
 *
 * Cf. CLAUDE.md §14 (RGPD article 17 — droit à l'effacement).
 */

import { sendEmail } from '@/lib/email/send'
import { formatLegalMentions } from '@/lib/legal/company-identity'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params

  let body: { reason?: unknown } = {}
  try {
    body = (await req.json()) as { reason?: unknown }
  } catch {
    // Body vide accepté
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : null

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Récupérer le diag pour l'email de confirmation
  const { data: diag, error: fetchErr } = await admin
    .from('diagnosticians')
    .select('id, first_name, last_name, email, withdrawal_requested')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr || !diag) {
    return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
  }

  // Idempotent : déjà demandé → success
  if (diag.withdrawal_requested) {
    return NextResponse.json({ ok: true, already: true })
  }

  const now = new Date().toISOString()
  const updatePayload: Record<string, unknown> = {
    withdrawal_requested: true,
    withdrawal_requested_at: now,
    is_published: false,
    unsubscribed: true,
    unsubscribed_at: now,
  }
  if (reason) {
    updatePayload.withdrawal_reason = reason
  }

  const { error: updateErr } = await admin.from('diagnosticians').update(updatePayload).eq('id', id)
  if (updateErr) {
    console.error(`[demander-retrait] Update failed: ${updateErr.message}`)
    return NextResponse.json({ error: 'Erreur enregistrement, réessayez.' }, { status: 500 })
  }

  // Notification admin
  await sendEmail({
    to: 'contact@kovas.fr',
    subject: `Demande de retrait — ${diag.first_name} ${diag.last_name}`,
    text: `Demande de retrait reçue :

Diagnostiqueur : ${diag.first_name} ${diag.last_name}
ID : ${diag.id}
Email : ${diag.email}
Motif : ${reason ?? '(non précisé)'}

Action : la fiche a été dépubliée automatiquement. Procéder à la suppression définitive sous 72h
conformément à l'article 17 du RGPD.

Admin : /admin/diagnostiqueurs/${diag.id}`,
    category: 'alert',
  })

  // Confirmation au diagnostiqueur si email présent
  if (diag.email) {
    await sendEmail({
      to: diag.email,
      subject: 'Confirmation — retrait de votre fiche KOVAS',
      text: `Bonjour ${diag.first_name},

Nous avons bien enregistré votre demande de retrait. Voici ce qui va se passer :

- Votre fiche est dès à présent dépubliée et n'est plus visible publiquement.
- Vos données seront définitivement supprimées de nos systèmes sous 72 heures.
- Vous ne recevrez plus aucune communication de notre part.

Cette action est conforme à votre droit à l'effacement (article 17 du RGPD).

Si vous avez des questions, vous pouvez répondre directement à cet email.

Cordialement,
Benjamin Bel
Fondateur · KOVAS

—
${formatLegalMentions()}`,
      category: 'transactional',
      from: 'KOVAS · Benjamin Bel <contact@kovas.fr>',
      replyTo: 'contact@kovas.fr',
    })
  }

  return NextResponse.json({ ok: true })
}
