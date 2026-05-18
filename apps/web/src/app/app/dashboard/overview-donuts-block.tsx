import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Donut } from '@/components/ui/donut'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'

function monthBoundsParis(): { startIso: string; endIso: string } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const start = new Date(`${year}-${month}-01T00:00:00+02:00`)
  // Premier jour du mois suivant
  const end = new Date(start)
  end.setMonth(end.getMonth() + 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

const TYPE_COLORS: Array<'blue' | 'green' | 'orange' | 'red'> = ['blue', 'green', 'orange', 'red']

export async function OverviewDonutsBlock() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = monthBoundsParis()

  // Toutes les missions du mois en cours
  const { data: monthMissions } = await supabase
    .from('missions')
    .select('id, type, status')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('created_at', startIso)
    .lt('created_at', endIso)

  const all = monthMissions ?? []
  const total = all.length
  const done = all.filter((m) => m.status === 'done' || m.status === 'exported').length

  // Répartition par type (top 4 + autres)
  const byType = new Map<string, number>()
  for (const m of all) {
    byType.set(m.type, (byType.get(m.type) ?? 0) + 1)
  }
  const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span>Vue d'ensemble</span>
          <span className="text-xs font-normal text-muted-foreground capitalize">{monthLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="flex flex-col items-center space-y-3">
          <Donut value={done} total={Math.max(total, 1)} label="Terminées" color="green" />
          <div className="text-sm text-center">
            <div className="font-semibold">{total === 0 ? '—' : `${done} / ${total} missions`}</div>
            <div className="text-xs text-muted-foreground">Progression ce mois</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Répartition par type
          </div>
          {topTypes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Pas encore de missions ce mois.</p>
          ) : (
            <ul className="space-y-2">
              {topTypes.map(([type, count], idx) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                const color = TYPE_COLORS[idx] ?? 'blue'
                return (
                  <li key={type} className="flex items-center gap-3">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ background: `hsl(var(--accent-${color}))` }}
                      aria-hidden
                    />
                    <span className="text-sm flex-1 min-w-0 truncate">
                      {MISSION_TYPE_LABELS[type] ?? type}
                    </span>
                    <span className="text-sm tabular-nums font-medium">{count}</span>
                    <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                      {pct}%
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
