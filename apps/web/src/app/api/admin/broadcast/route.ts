/**
 * POST /api/admin/broadcast
 *
 * Crée puis envoie un broadcast à une audience filtrée.
 * Body :
 *   {
 *     subject: string,
 *     body_html: string,
 *     body_text?: string,
 *     audience: BroadcastAudienceFilter,
 *     test_to_self?: boolean,            // envoie uniquement à l'admin courant
 *     confirm_large?: boolean            // requis si recipients_count > 50
 *   }
 *
 * Réponse :
 *   { ok: true, broadcast_id: string, recipients: number, sent: number, errors: number }
 *
 * V1 :
 * - Envoi séquentiel (max BROADCAST_MAX_RECIPIENTS = 100 destinataires).
 * - Audit log via withAuditWrapper.
 * - Pas de tracking opens/clicks (V2 : pixel + redirect tracker).
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import {
  BROADCAST_CONFIRM_THRESHOLD,
  BROADCAST_MAX_RECIPIENTS,
  type BroadcastAudienceFilter,
  type BroadcastAudiencePlan,
  type BroadcastAudienceStatus,
  type BroadcastCustomSegment,
} from '@/lib/admin/broadcasts-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { sendEmail } from '@/lib/email/send'
import { NextResponse } from 'next/server'

interface Body {
  subject?: string
  body_html?: string
  body_text?: string
  audience?: Partial<BroadcastAudienceFilter>
  test_to_self?: boolean
  confirm_large?: boolean
}

interface RecipientRow {
  email: string
  full_name: string | null
  plan: string
  plan_status: string
  last_active_at: string | null
}

const ALLOWED_PLANS: BroadcastAudiencePlan[] = [
  'all',
  'decouverte',
  'standard',
  'volume',
  'founder',
  'cabinet',
]

const ALLOWED_STATUSES: BroadcastAudienceStatus[] = ['all', 'active', 'trialing', 'cancelled']

const ALLOWED_SEGMENTS: BroadcastCustomSegment[] = [
  'top_ai_consumers',
  'no_mission_30d',
  'past_due',
  'recent_signup_7d',
]

function normalizeAudience(
  audience: Partial<BroadcastAudienceFilter> | undefined,
): BroadcastAudienceFilter {
  const plans = (audience?.plans ?? ['all']).filter((p): p is BroadcastAudiencePlan =>
    ALLOWED_PLANS.includes(p),
  )
  const statuses = (audience?.statuses ?? ['all']).filter((s): s is BroadcastAudienceStatus =>
    ALLOWED_STATUSES.includes(s),
  )
  const custom_segments = (audience?.custom_segments ?? []).filter(
    (s): s is BroadcastCustomSegment => ALLOWED_SEGMENTS.includes(s),
  )
  return {
    plans: plans.length ? plans : ['all'],
    statuses: statuses.length ? statuses : ['all'],
    custom_segments,
  }
}

/**
 * Calcule la liste des destinataires d'après le filtre d'audience.
 * V1 : requête simple sur profiles + memberships + organizations (mêmes
 * jointures que /admin/users). Segments custom = heuristiques rapides.
 */
async function resolveRecipients(audience: BroadcastAudienceFilter): Promise<RecipientRow[]> {
  const supabase = createAdminClient()

  interface MembershipNested {
    organization_id: string
    organizations: { plan: string; plan_status: string; suspended_at: string | null } | null
  }

  const { data } = await supabase.from('profiles').select(
    `email, full_name, last_active_at,
       memberships:memberships!user_id (
         organization_id,
         organizations:organizations ( plan, plan_status, suspended_at )
       )`,
  )

  const rows = (data ?? []) as unknown as Array<{
    email: string
    full_name: string | null
    last_active_at: string | null
    memberships: MembershipNested[]
  }>

  const includeAllPlans = audience.plans.includes('all')
  const includeAllStatuses = audience.statuses.includes('all')

  const now = Date.now()
  const recipients: RecipientRow[] = []
  for (const row of rows) {
    if (!row.email) continue
    const primary = row.memberships.find((m) => m.organizations !== null)?.organizations ?? null
    const plan = primary?.plan ?? 'decouverte'
    const status = primary?.plan_status ?? 'trialing'

    if (!includeAllPlans && !audience.plans.includes(plan as BroadcastAudiencePlan)) continue
    if (!includeAllStatuses && !audience.statuses.includes(status as BroadcastAudienceStatus))
      continue

    // Segments custom — pré-filtrage léger
    if (audience.custom_segments.includes('past_due') && status !== 'past_due') continue
    if (audience.custom_segments.includes('no_mission_30d')) {
      const last = row.last_active_at ? Date.parse(row.last_active_at) : 0
      if (now - last < 30 * 24 * 60 * 60 * 1000) continue
    }
    if (audience.custom_segments.includes('recent_signup_7d')) {
      const last = row.last_active_at ? Date.parse(row.last_active_at) : 0
      if (now - last > 7 * 24 * 60 * 60 * 1000) continue
    }

    recipients.push({
      email: row.email,
      full_name: row.full_name,
      plan,
      plan_status: status,
      last_active_at: row.last_active_at,
    })
  }

  // Top AI consumers — V1 simplifié : tri par last_active_at desc puis top 10%.
  // V2 : jointure ai_costs avec aggrégation par organization_id sur le mois courant.
  if (audience.custom_segments.includes('top_ai_consumers')) {
    const sorted = [...recipients].sort((a, b) => {
      const aTs = a.last_active_at ? Date.parse(a.last_active_at) : 0
      const bTs = b.last_active_at ? Date.parse(b.last_active_at) : 0
      return bTs - aTs
    })
    const topCount = Math.max(1, Math.floor(sorted.length * 0.1))
    return sorted.slice(0, Math.min(topCount, BROADCAST_MAX_RECIPIENTS))
  }

  return recipients.slice(0, BROADCAST_MAX_RECIPIENTS)
}

interface BroadcastInsertRow {
  subject: string
  body_html: string
  body_text: string | null
  audience_filter: BroadcastAudienceFilter
  recipients_count: number
  status: 'draft' | 'sending' | 'sent' | 'failed' | 'cancelled'
  sent_at: string | null
  delivered_count: number
  error_count: number
  created_by: string
}

interface BroadcastInsertResult {
  data: { id: string } | null
  error: { message: string } | null
}

interface BroadcastUpdateResult {
  error: { message: string } | null
}

export async function POST(request: Request) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const subject = (body.subject ?? '').trim()
  const html = (body.body_html ?? '').trim()
  const text = body.body_text?.trim() ?? null
  if (!subject || !html) {
    return NextResponse.json({ error: 'subject and body_html required' }, { status: 400 })
  }

  const audience = normalizeAudience(body.audience)
  const testToSelf = Boolean(body.test_to_self)

  let recipients: RecipientRow[]
  if (testToSelf) {
    recipients = [
      {
        email: access.user.email,
        full_name: null,
        plan: '—',
        plan_status: '—',
        last_active_at: null,
      },
    ]
  } else {
    recipients = await resolveRecipients(audience)
  }

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'Aucun destinataire ne correspond' }, { status: 400 })
  }

  if (!testToSelf && recipients.length > BROADCAST_CONFIRM_THRESHOLD && !body.confirm_large) {
    return NextResponse.json(
      {
        error: `Confirmation requise : ${recipients.length} destinataires (> ${BROADCAST_CONFIRM_THRESHOLD})`,
        retry_with_confirmation: true,
        recipients_count: recipients.length,
      },
      { status: 409 },
    )
  }

  const supabase = createAdminClient()
  const insertRow: BroadcastInsertRow = {
    subject,
    body_html: html,
    body_text: text,
    audience_filter: audience,
    recipients_count: recipients.length,
    status: 'sending',
    sent_at: null,
    delivered_count: 0,
    error_count: 0,
    created_by: access.user.id,
  }

  // INSERT initial (status=sending). broadcast_history absent du Database type.
  const { data: inserted, error: insertErr } = await (
    supabase.from('broadcast_history') as unknown as {
      insert: (row: BroadcastInsertRow) => {
        select: (cols: string) => { single: () => Promise<BroadcastInsertResult> }
      }
    }
  )
    .insert(insertRow)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    console.error('[api/admin/broadcast] insert failed', insertErr)
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 })
  }
  const broadcastId = inserted.id

  let delivered = 0
  let errors = 0

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: testToSelf ? 'broadcast_test_sent' : 'broadcast_sent',
      targetType: 'broadcast',
      targetId: broadcastId,
      targetLabel: subject.slice(0, 200),
      payload: {
        recipients_count: recipients.length,
        audience,
        test_to_self: testToSelf,
      },
    },
    async () => {
      // Envoi séquentiel (V1 max 100). V2 : queue + batch.
      for (const r of recipients) {
        const personalizedHtml = html
          .replace(/\{\{name\}\}/g, r.full_name ?? r.email)
          .replace(/\{\{email\}\}/g, r.email)
          .replace(/\{\{plan\}\}/g, r.plan)
        const personalizedText = text
          ? text
              .replace(/\{\{name\}\}/g, r.full_name ?? r.email)
              .replace(/\{\{email\}\}/g, r.email)
              .replace(/\{\{plan\}\}/g, r.plan)
          : undefined

        const result = await sendEmail({
          to: r.email,
          subject,
          html: personalizedHtml,
          text: personalizedText,
          category: 'product',
        })

        if (result.success) delivered += 1
        else errors += 1
      }
    },
  )

  const finalStatus = errors === 0 ? 'sent' : delivered === 0 ? 'failed' : 'sent'

  interface BroadcastUpdate {
    status: typeof finalStatus
    sent_at: string
    delivered_count: number
    error_count: number
  }

  const updateRow: BroadcastUpdate = {
    status: finalStatus,
    sent_at: new Date().toISOString(),
    delivered_count: delivered,
    error_count: errors,
  }

  await (
    supabase.from('broadcast_history') as unknown as {
      update: (row: BroadcastUpdate) => {
        eq: (col: string, val: string) => Promise<BroadcastUpdateResult>
      }
    }
  )
    .update(updateRow)
    .eq('id', broadcastId)

  return NextResponse.json({
    ok: true,
    broadcast_id: broadcastId,
    recipients: recipients.length,
    sent: delivered,
    errors,
  })
}
