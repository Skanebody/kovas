/**
 * POST /api/diagnostiqueurs/[id]/corriger
 *
 * Endpoint public (pas d'auth) pour qu'un diagnostiqueur propose des corrections
 * sur sa fiche. Insère dans diagnostician_corrections_pending pour review manuel,
 * envoie une notification à contact@kovas.fr.
 */

import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { sendEmail } from '@/lib/email/send'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

interface CorrectionBody {
  current_values?: Record<string, unknown>
  proposed_changes?: Record<string, unknown>
  message?: string | null
  contact_email?: string | null
}

export async function POST(req: Request, context: RouteContext) {
  const { id } = await context.params

  let body: CorrectionBody = {}
  try {
    body = (await req.json()) as CorrectionBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const currentValues =
    body.current_values && typeof body.current_values === 'object' ? body.current_values : {}
  const proposedChanges =
    body.proposed_changes && typeof body.proposed_changes === 'object' ? body.proposed_changes : {}
  const message =
    typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : null
  const contactEmail =
    typeof body.contact_email === 'string' ? body.contact_email.trim().slice(0, 200) : null

  // Validation : au moins un changement ou un message
  if (Object.keys(proposedChanges).length === 0 && !message) {
    return NextResponse.json(
      { error: 'Aucune modification ou message fourni.' },
      { status: 400 },
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const admin = createAdminClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Vérifier que le diagnostiqueur existe
  const { data: diag, error: fetchErr } = await admin
    .from('diagnosticians')
    .select('id, first_name, last_name')
    .eq('id', id)
    .maybeSingle()
  if (fetchErr || !diag) {
    return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
  }

  // Capter IP / UA pour anti-abus
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) ?? null

  const { error: insertErr } = await admin
    .from('diagnostician_corrections_pending')
    .insert({
      diagnostician_id: id,
      current_values: currentValues,
      proposed_changes: proposedChanges,
      message,
      contact_email: contactEmail,
      submitter_ip: ipAddress,
      submitter_user_agent: userAgent,
    })

  if (insertErr) {
    console.error(`[corriger] Insert failed: ${insertErr.message}`)
    return NextResponse.json({ error: 'Erreur enregistrement, réessayez.' }, { status: 500 })
  }

  // Notification admin
  const changesSummary = Object.keys(proposedChanges).length
    ? Object.entries(proposedChanges)
        .map(([k, v]) => `  ${k} : ${String(v).slice(0, 120)}`)
        .join('\n')
    : '(aucun champ modifié — message libre uniquement)'

  await sendEmail({
    to: 'contact@kovas.fr',
    subject: `Correction proposée — ${diag.first_name} ${diag.last_name}`,
    text: `Correction proposée pour la fiche ${diag.first_name} ${diag.last_name} :

Champs modifiés :
${changesSummary}

Message :
${message ?? '(aucun message)'}

Contact : ${contactEmail ?? '(non précisé)'}
IP : ${ipAddress ?? 'n/a'}

Review : /admin/diagnostiqueurs/${diag.id}/corrections`,
    category: 'alert',
  })

  return NextResponse.json({ ok: true })
}
