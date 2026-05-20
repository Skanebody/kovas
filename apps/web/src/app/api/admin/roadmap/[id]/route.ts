/**
 * PATCH /api/admin/roadmap/[id]
 *
 * Update item (title, description, status, priority, target_version).
 * Ship transition (status=shipped) → set shipped_at automatiquement.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { RoadmapCategory, RoadmapStatus } from '@/lib/admin/milestones-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface PatchBody {
  title?: string
  description?: string | null
  category?: RoadmapCategory | null
  status?: RoadmapStatus
  priority?: number
  target_version?: string | null
  estimated_days?: number | null
}

interface RoadmapUpdateRow {
  title?: string
  description?: string | null
  category?: RoadmapCategory | null
  status?: RoadmapStatus
  priority?: number
  target_version?: string | null
  estimated_days?: number | null
  shipped_at?: string | null
  updated_at?: string
}

interface RoadmapUpdateBuilder {
  update: (v: RoadmapUpdateRow) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

const ALLOWED_STATUS: RoadmapStatus[] = [
  'planned',
  'in_progress',
  'completed',
  'shipped',
  'cancelled',
]
const ALLOWED_CATEGORIES: RoadmapCategory[] = ['feature', 'bug', 'tech_debt', 'ux', 'business']

export async function PATCH(request: Request, { params }: RouteParams) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const { id } = await params
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const update: RoadmapUpdateRow = { updated_at: new Date().toISOString() }

  if (typeof body.title === 'string' && body.title.trim().length > 0) {
    update.title = body.title.trim()
  }
  if (typeof body.description === 'string' || body.description === null) {
    update.description = body.description
  }
  if (body.category === null) {
    update.category = null
  } else if (body.category && ALLOWED_CATEGORIES.includes(body.category)) {
    update.category = body.category
  }
  if (body.status && ALLOWED_STATUS.includes(body.status)) {
    update.status = body.status
    if (body.status === 'shipped') {
      update.shipped_at = new Date().toISOString()
    }
  }
  if (typeof body.priority === 'number') {
    update.priority = body.priority
  }
  if (body.target_version === null) {
    update.target_version = null
  } else if (typeof body.target_version === 'string') {
    update.target_version = body.target_version.trim() || null
  }
  if (body.estimated_days === null) {
    update.estimated_days = null
  } else if (typeof body.estimated_days === 'number' && body.estimated_days >= 0) {
    update.estimated_days = body.estimated_days
  }

  const keys = Object.keys(update).filter((k) => k !== 'updated_at')
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: body.status === 'shipped' ? 'roadmap_item_shipped' : 'roadmap_item_updated',
      targetType: 'roadmap_item',
      targetId: id,
      payload: update as Record<string, unknown>,
    },
    async () => {
      const { error } = await (supabase.from('roadmap_items') as unknown as RoadmapUpdateBuilder)
        .update(update)
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath('/admin/paliers')

  return NextResponse.json({ ok: true })
}
