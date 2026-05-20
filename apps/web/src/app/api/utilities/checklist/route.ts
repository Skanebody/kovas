/**
 * KOVAS — POST /api/utilities/checklist
 *
 * Génère la checklist "avant de partir" à partir des diagnostics actifs +
 * des champs déjà remplis + des sujets photo détectés.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { DIAGNOSTIC_TYPES, type DiagnosticType } from '@/lib/mission/types'
import {
  type ChecklistInput,
  type ChecklistItem,
  generateChecklist,
} from '@/lib/utilities/pre-departure-checklist'
import { trackUtilityUsage } from '@/lib/utilities/usage-tracker'

export const runtime = 'nodejs'

interface ErrorBody {
  error: string
}

interface ChecklistResponse {
  items: ChecklistItem[]
}

function parseInput(body: unknown): ChecklistInput | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object'
  const b = body as Record<string, unknown>

  if (!Array.isArray(b.activeDiagnostics)) return 'activeDiagnostics: array required'
  const active: DiagnosticType[] = []
  for (const d of b.activeDiagnostics) {
    if (typeof d !== 'string' || !DIAGNOSTIC_TYPES.includes(d as DiagnosticType)) {
      return `activeDiagnostics: each must be one of ${DIAGNOSTIC_TYPES.join('|')}`
    }
    active.push(d as DiagnosticType)
  }

  let filledFieldPaths: string[] | undefined
  if (b.filledFieldPaths !== undefined) {
    if (
      !Array.isArray(b.filledFieldPaths) ||
      !b.filledFieldPaths.every((s) => typeof s === 'string')
    ) {
      return 'filledFieldPaths must be string[]'
    }
    filledFieldPaths = b.filledFieldPaths as string[]
  }

  let photoSubjects: string[] | undefined
  if (b.photoSubjects !== undefined) {
    if (!Array.isArray(b.photoSubjects) || !b.photoSubjects.every((s) => typeof s === 'string')) {
      return 'photoSubjects must be string[]'
    }
    photoSubjects = b.photoSubjects as string[]
  }

  return { activeDiagnostics: active, filledFieldPaths, photoSubjects }
}

export async function POST(request: Request): Promise<NextResponse<ChecklistResponse | ErrorBody>> {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let bodyJson: unknown
  try {
    bodyJson = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const parsed = parseInput(bodyJson)
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 })
  }

  const items = generateChecklist(parsed)

  trackUtilityUsage({
    supabase: user.supabase,
    userId: user.user.id,
    organizationId: user.orgId,
    utility: 'pre_departure_checklist',
    context: {
      diagnostics: parsed.activeDiagnostics,
      criticalCount: items.filter((i) => i.importance === 'critical').length,
    },
  })

  return NextResponse.json({ items })
}
