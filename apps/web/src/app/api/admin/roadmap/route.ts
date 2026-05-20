/**
 * GET  /api/admin/roadmap   → liste roadmap items (priority DESC, created_at DESC)
 * POST /api/admin/roadmap   → create item
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { loadRoadmapItems } from '@/lib/admin/milestones-calculator'
import type { RoadmapCategory, RoadmapItemRow, RoadmapStatus } from '@/lib/admin/milestones-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface CreateBody {
  title?: string
  description?: string | null
  category?: RoadmapCategory | null
  status?: RoadmapStatus
  priority?: number
  target_version?: string | null
  estimated_days?: number | null
}

interface RoadmapInsertRow {
  title: string
  description: string | null
  category: RoadmapCategory | null
  status: RoadmapStatus
  priority: number
  target_version: string | null
  estimated_days: number | null
  created_by: string
}

interface RoadmapInsertBuilder {
  insert: (row: RoadmapInsertRow) => {
    select: (cols: string) => {
      maybeSingle: () => Promise<{
        data: RoadmapItemRow | null
        error: { message: string } | null
      }>
    }
  }
}

const ALLOWED_STATUS: RoadmapStatus[] = [
  'planned',
  'in_progress',
  'completed',
  'shipped',
  'cancelled',
]
const ALLOWED_CATEGORIES: RoadmapCategory[] = ['feature', 'bug', 'tech_debt', 'ux', 'business']

export async function GET() {
  const access = await verifyAdminAccess()
  if (!access.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  const supabase = createAdminClient()
  try {
    const data = await loadRoadmapItems(supabase)
    return NextResponse.json({ items: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[api/admin/roadmap] GET failed', err)
    return NextResponse.json({ error: 'Query failed' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: '2FA required' }, { status: 401 })
  }

  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = body.title?.trim()
  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }
  const status = body.status ?? 'planned'
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }
  let category: RoadmapCategory | null = null
  if (body.category) {
    if (!ALLOWED_CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    category = body.category
  }

  const supabase = createAdminClient()
  const adminUserId = access.user.id
  let createdId = ''

  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'roadmap_item_created',
      targetType: 'roadmap_item',
      targetId: 'pending',
      targetLabel: title,
      payload: { status, category, target_version: body.target_version ?? null },
    },
    async () => {
      const row: RoadmapInsertRow = {
        title,
        description: body.description ?? null,
        category,
        status,
        priority: Number.isFinite(body.priority) ? Number(body.priority) : 0,
        target_version: body.target_version?.trim() || null,
        estimated_days:
          typeof body.estimated_days === 'number' && body.estimated_days >= 0
            ? body.estimated_days
            : null,
        created_by: adminUserId,
      }
      const { data, error } = await (
        supabase.from('roadmap_items') as unknown as RoadmapInsertBuilder
      )
        .insert(row)
        .select('*')
        .maybeSingle()
      if (error) throw new Error(error.message)
      createdId = data?.id ?? ''
    },
  )

  return NextResponse.json({ ok: true, id: createdId })
}
