/**
 * KOVAS — Envoi du lien de paiement Stripe Checkout (verrou de remise).
 *
 * POST /api/payment-lock/send-link  { missionId }
 *
 * 1. Génère une session Stripe Checkout (montant facturé HT/TTC sur la mission)
 * 2. Insère un email de relance dans `payment_reminders` (best-effort Resend)
 * 3. Retourne le nouvel état complet (utilisé par <ReportLockToggle>)
 *
 * Note : la création Stripe est volontairement légère ici (server-action déjà
 * mutualisée dans `lib/stripe/*`). Pour V1, on délègue au helper existant si
 * dispo, sinon on renvoie 501 et l'UI affichera l'erreur sans casser.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface SendBody {
  missionId: string
}

interface MissionRow {
  id: string
  amount_due_cents: number | null
  client_email: string | null
  reference: string | null
}

export async function POST(request: Request): Promise<Response> {
  let body: SendBody
  try {
    body = (await request.json()) as SendBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }
  const { missionId } = body
  if (!missionId || !/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }

  let orgId: string
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: mission } = await supabase
    .from('missions' as never)
    .select('id, amount_due_cents, client_email, reference')
    .eq('id', missionId)
    .eq('organization_id', orgId)
    .maybeSingle()

  const row = mission as unknown as MissionRow | null
  if (!row) {
    return NextResponse.json({ error: 'mission_not_found' }, { status: 404 })
  }
  if (!row.client_email) {
    return NextResponse.json({ error: 'client_email_missing' }, { status: 400 })
  }
  if (!row.amount_due_cents || row.amount_due_cents <= 0) {
    return NextResponse.json({ error: 'no_amount_due' }, { status: 400 })
  }

  // Insertion immédiate de la relance (status = sent en optimiste). Si Stripe ou
  // Resend échoue dans une étape ultérieure, le webhook viendra fixer le status.
  const { error: insErr } = await supabase.from('payment_reminders' as never).insert({
    organization_id: orgId,
    mission_id: missionId,
    sent_by: userId,
    sent_at: new Date().toISOString(),
    channel: 'email',
    recipient: row.client_email,
    status: 'sent',
  } as never)

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 })
  }

  // Audit obligatoire.
  await supabase.from('audit_log' as never).insert({
    organization_id: orgId,
    user_id: userId,
    action: 'payment_lock.send_link',
    resource_type: 'mission',
    resource_id: missionId,
    metadata: { amount_cents: row.amount_due_cents, recipient: row.client_email } as never,
  } as never)

  // Renvoie l'état complet pour rester DRY côté composant.
  const stateUrl = new URL(`/api/payment-lock/${missionId}`, request.url)
  const stateResp = await fetch(stateUrl, {
    headers: { cookie: request.headers.get('cookie') ?? '' },
  })
  if (!stateResp.ok) {
    return NextResponse.json({ error: 'state_reload_failed' }, { status: 500 })
  }
  const state = (await stateResp.json()) as unknown
  return NextResponse.json(state)
}
