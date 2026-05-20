/**
 * GET  /api/admin/email-templates — liste tous les templates actifs.
 * POST /api/admin/email-templates — crée un nouveau template (clé unique).
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { EmailTemplateInsert, EmailTemplateRow } from '@/lib/admin/broadcasts-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface ListResult {
  data: EmailTemplateRow[] | null
  error: { message: string } | null
}

interface SingleResult {
  data: { id: string } | null
  error: { message: string } | null
}

export async function GET() {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  const supabase = createAdminClient()
  const { data, error } = await (
    supabase.from('email_templates') as unknown as {
      select: (cols: string) => {
        order: (col: string, opts: { ascending: boolean }) => Promise<ListResult>
      }
    }
  )
    .select(
      'id, key, name, subject, body_html, body_text, variables, active, created_at, updated_at',
    )
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[api/admin/email-templates] list failed', error)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }

  return NextResponse.json({ items: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  let body: Partial<EmailTemplateInsert>
  try {
    body = (await request.json()) as Partial<EmailTemplateInsert>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const key = (body.key ?? '').trim()
  const name = (body.name ?? '').trim()
  const subject = (body.subject ?? '').trim()
  const html = (body.body_html ?? '').trim()
  if (!key || !name || !subject || !html) {
    return NextResponse.json({ error: 'key, name, subject, body_html requis' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const insertRow: EmailTemplateInsert = {
    key,
    name,
    subject,
    body_html: html,
    body_text: body.body_text ?? null,
    variables: body.variables ?? [],
    active: body.active ?? true,
  }

  let createdId = ''
  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'email_template_created',
      targetType: 'email_template',
      targetId: key,
      targetLabel: name,
      payload: { key, name, subject_preview: subject.slice(0, 100) },
    },
    async () => {
      const { data, error } = await (
        supabase.from('email_templates') as unknown as {
          insert: (row: EmailTemplateInsert) => {
            select: (cols: string) => { single: () => Promise<SingleResult> }
          }
        }
      )
        .insert(insertRow)
        .select('id')
        .single()
      if (error || !data) {
        throw new Error(error?.message ?? 'Insert failed')
      }
      createdId = data.id
    },
  )

  return NextResponse.json({ ok: true, id: createdId })
}
