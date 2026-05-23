/**
 * KOVAS — Endpoint /api/dossiers/next-mission (FIX-JJ).
 *
 * Retourne l'id du prochain dossier "éligible mode mission" pour l'utilisateur :
 *   - Priorité 1 : mission en cours (status='on_site') — résolveur immédiat
 *   - Priorité 2 : RDV planifié aujourd'hui le plus proche dans le futur
 *   - Priorité 3 : RDV planifié demain le plus tôt
 *
 * Utilisé par :
 *   - `<MissionFabMobile>` (FAB mobile bottom-right)
 *   - Command Palette action "Démarrer la mission" (Cmd+M)
 *   - Pourra être étendu pour le widget desktop "Action du jour"
 *
 * Authority : FIX-JJ multi-accès points #5 et #6.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Success {
  ok: true
  dossierId: string
  status: 'on_site' | 'scheduled'
  scheduledAt: string | null
}

interface NoMission {
  ok: true
  dossierId: null
}

interface ErrorBody {
  ok: false
  error: string
}

type SupabaseLike = Awaited<ReturnType<typeof getCurrentUser>>['supabase']

export async function GET(): Promise<NextResponse<Success | NoMission | ErrorBody>> {
  let supabase: SupabaseLike
  let orgId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    orgId = u.orgId
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // 1) Mission EN COURS
  const { data: onSite } = await supabase
    .from('dossiers')
    .select('id, scheduled_at, started_at')
    .eq('organization_id', orgId)
    .eq('status', 'on_site')
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  if (onSite && onSite.length > 0 && onSite[0]) {
    return NextResponse.json({
      ok: true,
      dossierId: onSite[0].id,
      status: 'on_site',
      scheduledAt: onSite[0].scheduled_at,
    })
  }

  // 2) RDV planifié dans les 48h prochaines, le plus proche
  const now = new Date().toISOString()
  const in48h = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: upcoming } = await supabase
    .from('dossiers')
    .select('id, scheduled_at')
    .eq('organization_id', orgId)
    .eq('status', 'scheduled')
    .is('deleted_at', null)
    .gte('scheduled_at', now)
    .lte('scheduled_at', in48h)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  if (upcoming && upcoming.length > 0 && upcoming[0]) {
    return NextResponse.json({
      ok: true,
      dossierId: upcoming[0].id,
      status: 'scheduled',
      scheduledAt: upcoming[0].scheduled_at,
    })
  }

  // 3) Aucune mission
  return NextResponse.json({ ok: true, dossierId: null })
}
