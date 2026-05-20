/**
 * KOVAS — Refonte page dossier : GET /api/dossiers/[id]/progression
 *
 * Retourne la `ProgressionData` consolidée d'un dossier (diagnostics, pièces,
 * champs, buckets critiques, manquants critiques, résumé global).
 *
 * Authority : CLAUDE.md §3 features 5+7 + refonte UI dossier (Partition B).
 *
 * RLS : `dossiers` est filtré par `public.is_member_of(organization_id)` —
 * `.eq('organization_id', orgId)` est défense en profondeur supplémentaire.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { calculateProgression } from '@/lib/dossier/progression-calculator'
import type { ProgressionData } from '@/lib/dossier/types'

export const runtime = 'nodejs'

interface ErrorBody {
  error: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ProgressionData | ErrorBody>> {
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

  // Garde-fou : vérifie que le dossier appartient bien à l'org (RLS + .eq()).
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

  try {
    const data = await calculateProgression(supabase, id)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'progression calculation failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
