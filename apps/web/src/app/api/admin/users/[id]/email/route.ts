/**
 * POST /api/admin/users/[id]/email
 *
 * Envoie un email custom au user via Resend.
 * Body : { template: 'custom', subject: string, body: string } (V1 minimal)
 *
 * V1 : si RESEND_API_KEY absente OU package non installé → stub (juste audit log).
 * V2 : intégration Resend complète + templates React Email.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface Body {
  template?: string
  subject?: string
  body?: string
  vars?: Record<string, unknown>
}

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: userId } = await params
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const subject = (body.subject ?? '').trim()
  const emailBody = (body.body ?? '').trim()
  const template = (body.template ?? 'custom').trim()

  if (!subject || !emailBody) {
    return NextResponse.json({ error: 'subject and body required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', userId)
    .maybeSingle<{ id: string; email: string; full_name: string | null }>()

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const sendingMode = resendKey ? 'live' : 'stubbed_v1'

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'user_custom_email_sent',
      targetType: 'user',
      targetId: userId,
      targetLabel: profile.email,
      payload: {
        template,
        subject,
        body_preview: emailBody.slice(0, 200),
        vars: body.vars ?? {},
        mode: sendingMode,
      },
    },
    async () => {
      if (!resendKey) return // stub V1

      // Appel HTTP brut Resend (pas de SDK requis)
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM ?? 'KOVAS <contact@kovas.fr>',
          to: [profile.email],
          subject,
          text: emailBody,
        }),
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(`Resend ${res.status}: ${errText.slice(0, 200)}`)
      }
    },
  )

  return NextResponse.json({ ok: true, mode: sendingMode })
}
