/**
 * KOVAS — Route smart `/dashboard/capture` (FIX-JJ multi-accès #2 sidebar Capture).
 *
 * Le bouton "Capture" de la sidebar pointe désormais vers cette route, qui
 * redirige intelligemment selon l'état utilisateur :
 *
 *   1. Si une mission est en cours (`status='on_site'`) → reprend la mission
 *      via `/dashboard/dossiers/[id]/mission/tchat`
 *   2. Si un RDV est imminent (< 60min) → démarre directement cette mission
 *      via `/dashboard/dossiers/[id]/mission/tchat` (auto-start côté page tchat)
 *   3. Sinon → wizard `/dashboard/dossiers/new`
 *
 * Server component pur — pas d'UI, juste un redirect 307.
 *
 * Authority : CLAUDE.md §3 features 1-10 + FIX-JJ multi-accès point #2.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CaptureSmartRedirect() {
  const { supabase, orgId } = await getCurrentUser()
  const now = new Date()

  // 1) Mission en cours
  const { data: onSiteList } = await supabase
    .from('dossiers')
    .select('id')
    .eq('organization_id', orgId)
    .eq('status', 'on_site')
    .is('deleted_at', null)
    .order('started_at', { ascending: false })
    .limit(1)

  const onSite = onSiteList?.[0]
  if (onSite?.id) {
    redirect(`/dashboard/dossiers/${onSite.id}/mission/tchat`)
  }

  // 2) RDV imminent (< 60min)
  const in60min = new Date(now.getTime() + 60 * 60 * 1000).toISOString()
  const { data: imminentList } = await supabase
    .from('dossiers')
    .select('id, scheduled_at')
    .eq('organization_id', orgId)
    .eq('status', 'scheduled')
    .is('deleted_at', null)
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', in60min)
    .order('scheduled_at', { ascending: true })
    .limit(1)

  const imminent = imminentList?.[0]
  if (imminent?.id) {
    redirect(`/dashboard/dossiers/${imminent.id}/mission/tchat`)
  }

  // 3) Fallback — wizard nouveau dossier
  redirect('/dashboard/dossiers/new')
}
