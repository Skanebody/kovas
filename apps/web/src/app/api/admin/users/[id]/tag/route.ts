/**
 * POST/DELETE /api/admin/users/[id]/tag
 *
 * Ajoute ou retire un tag admin sur un user (table user_admin_tags).
 * Body : { tag: string }
 *
 * Tags conventionnels :
 *   - 'a_appeler'   → utilisateur à recontacter (churn risk)
 *   - 'vip'         → power user, attention prioritaire
 *   - 'fragile'     → à surveiller
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface Body {
  tag?: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

interface UserAdminTagInsertRow {
  user_id: string
  tag: string
  created_by: string
}

interface UserAdminTagBuilder {
  insert: (r: UserAdminTagInsertRow) => Promise<{ error: { message: string } | null }>
  delete: () => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
    }
  }
}

const ALLOWED_TAGS = ['a_appeler', 'vip', 'fragile', 'churned']

async function readTag(request: Request): Promise<string | null> {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return null
  }
  const tag = (body.tag ?? '').trim()
  if (!tag || !ALLOWED_TAGS.includes(tag)) return null
  return tag
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
  const tag = await readTag(request)
  if (!tag) {
    return NextResponse.json(
      { error: `invalid tag — allowed: ${ALLOWED_TAGS.join(', ')}` },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  const adminUserId = access.user.id

  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'user_tag_added',
      targetType: 'user',
      targetId: userId,
      payload: { tag },
    },
    async () => {
      const row: UserAdminTagInsertRow = {
        user_id: userId,
        tag,
        created_by: adminUserId,
      }
      const { error } = await (
        supabase.from('user_admin_tags') as unknown as UserAdminTagBuilder
      ).insert(row)
      // Conflict (déjà taggé) : on ignore silencieusement — idempotent
      if (error && !error.message.toLowerCase().includes('duplicate')) {
        throw new Error(error.message)
      }
    },
  )

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/churn-risk')

  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id: userId } = await params
  const tag = await readTag(request)
  if (!tag) {
    return NextResponse.json(
      { error: `invalid tag — allowed: ${ALLOWED_TAGS.join(', ')}` },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()
  const adminUserId = access.user.id

  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'user_tag_removed',
      targetType: 'user',
      targetId: userId,
      payload: { tag },
    },
    async () => {
      const { error } = await (supabase.from('user_admin_tags') as unknown as UserAdminTagBuilder)
        .delete()
        .eq('user_id', userId)
        .eq('tag', tag)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/admin/churn-risk')

  return NextResponse.json({ ok: true })
}
