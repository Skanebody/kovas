/**
 * GET  /api/admin/okrs   → liste OKRs (tous statuts, ordre quarter DESC)
 * POST /api/admin/okrs   → create OKR
 */

import { withAuditWrapper } from '@/lib/admin/admin-actions-wrapper'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { loadOkrs } from '@/lib/admin/milestones-calculator'
import type { KeyResult, OkrRow, OkrStatus } from '@/lib/admin/milestones-types'
import { computeOkrProgress } from '@/lib/admin/milestones-types'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface CreateBody {
  quarter?: string
  objective?: string
  key_results?: KeyResult[]
  status?: OkrStatus
}

interface OkrInsertRow {
  quarter: string
  objective: string
  key_results: KeyResult[]
  status: OkrStatus
  progress: number
  started_at: string | null
  created_by: string
}

interface OkrInsertBuilder {
  insert: (row: OkrInsertRow) => {
    select: (cols: string) => {
      maybeSingle: () => Promise<{
        data: OkrRow | null
        error: { message: string } | null
      }>
    }
  }
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
    const data = await loadOkrs(supabase)
    return NextResponse.json({ okrs: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[api/admin/okrs] GET failed', err)
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

  const quarter = body.quarter?.trim()
  const objective = body.objective?.trim()
  const status = (body.status ?? 'draft') as OkrStatus

  if (!quarter || !/^\d{4}-Q[1-4]$/.test(quarter)) {
    return NextResponse.json({ error: 'Invalid quarter (expected YYYY-QN)' }, { status: 400 })
  }
  if (!objective) {
    return NextResponse.json({ error: 'objective required' }, { status: 400 })
  }
  if (!ALLOWED_STATUS.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const keyResults = validateKeyResults(body.key_results)
  const progress = computeOkrProgress(keyResults)
  const supabase = createAdminClient()
  const adminUserId = access.user.id
  let createdId = ''

  await withAuditWrapper(
    {
      adminUserId,
      actionType: 'okr_created',
      targetType: 'okr',
      targetId: 'pending',
      targetLabel: objective.slice(0, 100),
      payload: { quarter, status, key_results_count: keyResults.length },
    },
    async () => {
      const row: OkrInsertRow = {
        quarter,
        objective,
        key_results: keyResults,
        status,
        progress,
        started_at: status === 'active' ? new Date().toISOString() : null,
        created_by: adminUserId,
      }
      const { data, error } = await (supabase.from('okrs') as unknown as OkrInsertBuilder)
        .insert(row)
        .select('*')
        .maybeSingle()
      if (error) throw new Error(error.message)
      createdId = data?.id ?? ''
    },
  )

  return NextResponse.json({ ok: true, id: createdId })
}
