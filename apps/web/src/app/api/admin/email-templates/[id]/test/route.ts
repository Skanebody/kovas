/**
 * POST /api/admin/email-templates/[id]/test
 *
 * Envoie un email de test à l'admin courant en utilisant le template + des
 * variables fournies (ou values factices). Audit log obligatoire.
 *
 * Body : { vars?: Record<string, string> }
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { EmailTemplateRow } from '@/lib/admin/broadcasts-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { sendEmail } from '@/lib/email/send'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface Body {
  vars?: Record<string, string>
}

interface FetchResult {
  data: EmailTemplateRow | null
  error: { message: string } | null
}

function substitute(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}

export async function POST(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  // Narrowing local pour la closure (access.user nullé après checks).
  const adminUser = access.user
  const { id } = await params
  let body: Body
  try {
    body = (await request.json().catch(() => ({}))) as Body
  } catch {
    body = {}
  }

  const supabase = createAdminClient()
  const { data: template, error } = await (
    supabase.from('email_templates') as unknown as {
      select: (cols: string) => {
        eq: (
          col: string,
          val: string,
        ) => {
          maybeSingle: () => Promise<FetchResult>
        }
      }
    }
  )
    .select(
      'id, key, name, subject, body_html, body_text, variables, active, created_at, updated_at',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !template) {
    return NextResponse.json({ error: 'Template introuvable' }, { status: 404 })
  }

  const vars = body.vars ?? {}
  const subject = substitute(template.subject, vars)
  const html = substitute(template.body_html, vars)
  const text = template.body_text ? substitute(template.body_text, vars) : undefined

  let resultId: string | undefined
  await withAuditWrapper(
    {
      adminUserId: adminUser.id,
      actionType: 'email_template_tested',
      targetType: 'email_template',
      targetId: template.id,
      targetLabel: template.name,
      payload: { vars, recipient: adminUser.email },
    },
    async () => {
      const r = await sendEmail({
        to: adminUser.email,
        subject,
        html,
        text,
        category: 'product',
      })
      if (!r.success) throw new Error(r.error ?? 'send failed')
      resultId = r.id
    },
  )

  return NextResponse.json({ ok: true, message_id: resultId ?? null })
}
