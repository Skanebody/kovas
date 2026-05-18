import { Card, CardContent } from '@/components/ui/card'
import { Donut } from '@/components/ui/donut'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

interface StatTile {
  title: string
  value: number
  total: number
  color: 'navy' | 'blue' | 'green' | 'orange'
  subtitle: string
  trend: number | null
}

/**
 * 4 donuts cockpit semaine vs semaine précédente.
 * Mapping :
 *  - Missions actives : missions in_progress depuis 7j (vs 7j précédents)
 *  - Documents reçus : owner_documents uploaded 7j
 *  - Exports : missions status=exported 7j
 *  - Terminées : missions status=done 7j
 */
export async function StatsDonutGrid() {
  const { supabase, orgId } = await getCurrentUser()
  const now = new Date()
  const w0 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const w1 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    { count: activeNow },
    { count: activePrev },
    { count: docsNow },
    { count: docsPrev },
    { count: exportsNow },
    { count: exportsPrev },
    { count: doneNow },
    { count: donePrev },
  ] = await Promise.all([
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'in_progress'),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'in_progress')
      .lt('created_at', w0.toISOString()),
    supabase
      .from('owner_documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('uploaded_at', w0.toISOString()),
    supabase
      .from('owner_documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('uploaded_at', w1.toISOString())
      .lt('uploaded_at', w0.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'exported')
      .gte('completed_at', w0.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'exported')
      .gte('completed_at', w1.toISOString())
      .lt('completed_at', w0.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', w0.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', w1.toISOString())
      .lt('completed_at', w0.toISOString()),
  ])

  function trendPct(now: number, prev: number): number | null {
    if (prev === 0) return now > 0 ? 100 : null
    return Math.round(((now - prev) / prev) * 100)
  }

  const totalActive = (activeNow ?? 0) + (doneNow ?? 0) || 1
  const tiles: StatTile[] = [
    {
      title: 'Missions actives',
      value: activeNow ?? 0,
      total: totalActive,
      color: 'navy',
      subtitle: `sur ${totalActive}`,
      trend: trendPct(activeNow ?? 0, activePrev ?? 0),
    },
    {
      title: 'Documents reçus',
      value: docsNow ?? 0,
      total: Math.max((docsNow ?? 0) + (docsPrev ?? 0), 1),
      color: 'blue',
      subtitle: 'cette semaine',
      trend: trendPct(docsNow ?? 0, docsPrev ?? 0),
    },
    {
      title: 'Exports',
      value: exportsNow ?? 0,
      total: Math.max((exportsNow ?? 0) + (exportsPrev ?? 0), 1),
      color: 'orange',
      subtitle: 'cette semaine',
      trend: trendPct(exportsNow ?? 0, exportsPrev ?? 0),
    },
    {
      title: 'Missions terminées',
      value: doneNow ?? 0,
      total: Math.max((doneNow ?? 0) + (donePrev ?? 0), 1),
      color: 'green',
      subtitle: 'cette semaine',
      trend: trendPct(doneNow ?? 0, donePrev ?? 0),
    },
  ]

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tiles.map((t) => (
            <DonutTile key={t.title} tile={t} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DonutTile({ tile }: { tile: StatTile }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-2">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {tile.title}
      </div>
      <Donut value={tile.value} total={tile.total} color={tile.color} size={96} thickness={10} />
      <div className="text-[11px] text-muted-foreground">{tile.subtitle}</div>
      {tile.trend !== null ? (
        <div
          className={cn(
            'text-[11px] flex items-center gap-0.5',
            tile.trend >= 0 ? 'text-accent-green' : 'text-accent-red',
          )}
        >
          {tile.trend >= 0 ? (
            <TrendingUp className="size-3" />
          ) : (
            <TrendingDown className="size-3" />
          )}
          {Math.abs(tile.trend)}% vs S-1
        </div>
      ) : (
        <div className="text-[11px] text-muted-foreground">—</div>
      )}
    </div>
  )
}
