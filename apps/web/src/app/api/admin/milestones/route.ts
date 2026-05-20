/**
 * GET  /api/admin/milestones    → liste auto-updated (avec progress)
 * POST /api/admin/milestones    → create
 *
 * Gate verifyAdminAccess() + service_role.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { loadMilestonesWithProgress } from '@/lib/admin/milestones-calculator'
import type { MilestoneCategory, MilestoneRow } from '@/lib/admin/milestones-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface CreateBody {
  category?: string
  name?: string
  description?: string | null
  target_value?: number
  unit?: string | null
  icon?: string | null
  display_order?: number
  current_value?: number
}

interface MilestoneInsertRow {
  category: MilestoneCategory
  name: string
  description: string | null
  target_value: number
  unit: string | null
  icon: string | null
  display_order: number
  current_value: number
  created_by: string
}

interface MilestoneInsertBuilder {
  insert: (row: MilestoneInsertRow) => {
    select: (cols: string) => {
      maybeSingle: () => Promise<{
        data: MilestoneRow | null
        error: { message: string } | null
      }>
    }
  }
}

const ALLOWED_CATEGORIES: MilestoneCategory[] = [
  'mrr',
  'users',
  'missions',
  'product',
  'business',
  'tech',
]

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
    const data = await loadMilestonesWithProgress(supabase)
    return NextResponse.json({ milestones: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[api/admin/milestones] GET failed', err)
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

  const category = body.category as MilestoneCategory | undefined
  const name = body.name?.trim()
  const target = body.target_value

  if (!category || !ALLOWED_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (!name) {
    return NextResponse.json({ error: 'name required' }, { status: 400 })
  }
  if (typeof target !== 'number' || target <= 0) {
    return NextResponse.json({ error: 'target_value must be > 0' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const adminUserId = access.user.id

  let createdId = ''
  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'milestone_created',
      targetType: 'milestone',
      targetId: 'pending',
      targetLabel: name,
      payload: { category, target_value: target, unit: body.unit ?? null },
    },
    async () => {
      const row: MilestoneInsertRow = {
        category,
        name,
        description: body.description ?? null,
        target_value: target,
        unit: body.unit ?? null,
        icon: body.icon ?? null,
        display_order: Number.isFinite(body.display_order) ? Number(body.display_order) : 0,
        current_value: Number.isFinite(body.current_value) ? Number(body.current_value) : 0,
        created_by: adminUserId,
      }
      const { data, error } = await (
        supabase.from('milestones') as unknown as MilestoneInsertBuilder
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
