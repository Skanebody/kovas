/**
 * PATCH /api/admin/okrs/[id]
 *
 * Update OKR (objective, status, key_results) + recalc progress.
 * Audit log via withAuditWrapper.
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { KeyResult, OkrStatus } from '@/lib/admin/milestones-types'
import { computeOkrProgress } from '@/lib/admin/milestones-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

interface PatchBody {
  objective?: string
  status?: OkrStatus
  key_results?: KeyResult[]
  quarter?: string
}

interface OkrUpdateRow {
  objective?: string
  status?: OkrStatus
  key_results?: KeyResult[]
  quarter?: string
  progress?: number
  started_at?: string | null
  completed_at?: string | null
  updated_at?: string
}

interface OkrUpdateBuilder {
  update: (v: OkrUpdateRow) => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
}

interface RouteParams {
  params: Promise<{ id: string }>
}

const ALLOWED_STATUS: OkrStatus[] = ['draft', 'active', 'completed', 'cancelled']

function validateKeyResults(input: unknown): KeyResult[] {
  if (!Array.isArray(input)) return []
  const out: KeyResult[] = []
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) continue
    const obj = raw as Record<string, unknown>
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!name) continue
    const target = typeof obj.target === 'number' ? obj.target : 0
    const current = typeof obj.current === 'number' ? obj.current : 0
    const unit = typeof obj.unit === 'string' ? obj.unit.trim() || null : null
    out.push({ name, target, current, unit })
  }
  return out
}

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

  const update: OkrUpdateRow = { updated_at: new Date().toISOString() }

  if (typeof body.objective === 'string' && body.objective.trim().length > 0) {
    update.objective = body.objective.trim()
  }
  if (typeof body.quarter === 'string' && /^\d{4}-Q[1-4]$/.test(body.quarter.trim())) {
    update.quarter = body.quarter.trim()
  }
  if (body.status && ALLOWED_STATUS.includes(body.status)) {
    update.status = body.status
    if (body.status === 'active') {
      update.started_at = new Date().toISOString()
    } else if (body.status === 'completed') {
      update.completed_at = new Date().toISOString()
    }
  }
  if (Array.isArray(body.key_results)) {
    const krs = validateKeyResults(body.key_results)
    update.key_results = krs
    update.progress = computeOkrProgress(krs)
  }

  const keys = Object.keys(update).filter((k) => k !== 'updated_at')
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  await withAuditWrapper(
    {
      adminUserId: access.user.id,
      actionType: 'okr_updated',
      targetType: 'okr',
      targetId: id,
      payload: update as Record<string, unknown>,
    },
    async () => {
      const { error } = await (supabase.from('okrs') as unknown as OkrUpdateBuilder)
        .update(update)
        .eq('id', id)
      if (error) throw new Error(error.message)
    },
  )

  revalidatePath('/admin/paliers')

  return NextResponse.json({ ok: true })
}
