/**
 * POST /api/admin/users/[id]/note
 *
 * Ajoute une note interne admin sur un user.
 * Body : { note: string }
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface Body {
  note?: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

interface AdminNoteInsertRow {
  user_id: string
  note: string
  created_by: string
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

  const note = (body.note ?? '').trim()
  if (!note) {
    return NextResponse.json({ error: 'note required' }, { status: 400 })
  }
  if (note.length > 5000) {
    return NextResponse.json({ error: 'note too long (max 5000 chars)' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const adminUserId = access.user.id

  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'user_note_added',
      targetType: 'user',
      targetId: userId,
      payload: { note_preview: note.slice(0, 200), note_length: note.length },
    },
    async () => {
      // admin_notes absente du Database type généré (migration 2026-05-21 170000).
      // Cast typé pour éviter `any`.
      const row: AdminNoteInsertRow = {
        user_id: userId,
        note,
        created_by: adminUserId,
      }
      const { error } = await (
        supabase.from('admin_notes') as unknown as {
          insert: (r: AdminNoteInsertRow) => Promise<{ error: { message: string } | null }>
        }
      ).insert(row)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath(`/admin/users/${userId}`)

  return NextResponse.json({ ok: true })
}
