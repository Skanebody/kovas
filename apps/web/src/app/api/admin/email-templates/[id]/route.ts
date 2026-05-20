/**
 * PATCH /api/admin/email-templates/[id] — met à jour un template.
 * DELETE /api/admin/email-templates/[id] — soft delete (active=false).
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { EmailTemplateUpdate } from '@/lib/admin/broadcasts-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface UpdateResult {
  error: { message: string } | null
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  const { id } = await params
  let body: Partial<EmailTemplateUpdate>
  try {
    body = (await request.json()) as Partial<EmailTemplateUpdate>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: EmailTemplateUpdate = {}
  if (typeof body.name === 'string') update.name = body.name.trim()
  if (typeof body.subject === 'string') update.subject = body.subject.trim()
  if (typeof body.body_html === 'string') update.body_html = body.body_html.trim()
  if (typeof body.body_text === 'string' || body.body_text === null)
    update.body_text = body.body_text ?? null
  if (Array.isArray(body.variables)) update.variables = body.variables
  if (typeof body.active === 'boolean') update.active = body.active

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  const supabase = createAdminClient()

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'email_template_updated',
      targetType: 'email_template',
      targetId: id,
      targetLabel: update.name ?? null,
      payload: { fields: Object.keys(update) },
    },
    async () => {
      const { error } = await (
        supabase.from('email_templates') as unknown as {
          update: (row: EmailTemplateUpdate & { updated_at: string }) => {
            eq: (col: string, val: string) => Promise<UpdateResult>
          }
        }
      )
        .update({ ...update, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  )

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (access.needs2FA || access.hasNoSecret)
    return NextResponse.json({ error: '2FA required' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'email_template_deleted',
      targetType: 'email_template',
      targetId: id,
      targetLabel: null,
      payload: { soft_delete: true },
    },
    async () => {
      const { error } = await (
        supabase.from('email_templates') as unknown as {
          update: (row: { active: boolean; updated_at: string }) => {
            eq: (col: string, val: string) => Promise<UpdateResult>
          }
        }
      )
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  )

  return NextResponse.json({ ok: true })
}
