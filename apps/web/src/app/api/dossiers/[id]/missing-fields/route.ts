/**
 * KOVAS — Refonte page dossier : GET /api/dossiers/[id]/missing-fields
 *
 * Retourne la liste des champs manquants critiques, groupés par diagnostic +
 * `criticalCount` (= nombre de champs requis manquants, utile bandeau UI).
 *
 * Authority : CLAUDE.md §3 (feature 5 — check-lists complétude) + Partition B.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { type MissingField, detectMissingFields } from '@/lib/dossier/missing-fields-detector'
import { missionTypesToActiveDiagnostics } from '@/lib/mission/diagnostic-mapper'
import { getDiagnosticSchema } from '@/lib/mission/diagnostic-schemas'
import type { DiagnosticType } from '@/lib/mission/types'

export const runtime = 'nodejs'

interface SuccessBody {
  missingFields: MissingField[]
  byDiagnostic: Partial<Record<DiagnosticType, MissingField[]>>
  criticalCount: number
}

interface ErrorBody {
  error: string
}

interface FieldValueRow {
  diagnostic_type: DiagnosticType
  field_path: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  const { id } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'dossierId must be a UUID' }, { status: 400 })
  }

  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let orgId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 1. Auth + ownership check
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (dossierErr) {
    return NextResponse.json({ error: `dossier query : ${dossierErr.message}` }, { status: 500 })
  }
  if (!dossier) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // 2. Diagnostics actifs
  const { data: missionsRaw, error: missionsErr } = await supabase
    .from('missions')
    .select('type')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (missionsErr) {
    return NextResponse.json({ error: `missions query : ${missionsErr.message}` }, { status: 500 })
  }
  const activeDiagnostics = missionTypesToActiveDiagnostics(
    (missionsRaw ?? []).map((m) => m.type as string),
  )

  // 3. dossier_field_values collectés
  // diagnostic_type / field_path issus de la migration capture_first, typés as never.
  const { data: collectedRaw, error: collectedErr } = await supabase
    .from('dossier_field_values' as never)
    .select('diagnostic_type, field_path')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)

  if (collectedErr) {
    return NextResponse.json(
      { error: `dossier_field_values query : ${collectedErr.message}` },
      { status: 500 },
    )
  }
  const collected = (collectedRaw ?? []) as unknown as FieldValueRow[]

  // 4. Pour chaque diagnostic actif → applique le détecteur (synchrone)
  const allMissing: MissingField[] = []
  const byDiagnostic: Partial<Record<DiagnosticType, MissingField[]>> = {}

  for (const diag of activeDiagnostics) {
    const schema = getDiagnosticSchema(diag)
    const collectedForDiag = collected
      .filter((r) => r.diagnostic_type === diag)
      .map((r) => ({ field_path: r.field_path, value: null }))

    const missingForDiag = detectMissingFields(schema, collectedForDiag)
    if (missingForDiag.length > 0) {
      byDiagnostic[diag] = missingForDiag
      allMissing.push(...missingForDiag)
    }
  }

  // 5. criticalCount = nombre total de champs requis manquants
  const criticalCount = allMissing.length

  return NextResponse.json({
    missingFields: allMissing,
    byDiagnostic,
    criticalCount,
  })
}
