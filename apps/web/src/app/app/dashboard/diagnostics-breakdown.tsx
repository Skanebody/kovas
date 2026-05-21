import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { MISSION_PASTEL_CLASS } from '@/lib/mission-pastels'
import type { MissionType } from '@kovas/shared'
import { parisMonthBounds } from '@/lib/paris-dates'
import { cn } from '@/lib/utils'

export async function DiagnosticsBreakdown() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, nextIso } = parisMonthBounds()

  const { data: missions } = await supabase
    .from('missions')
    .select('type')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('created_at', startIso)
    .lt('created_at', nextIso)

  const counts = new Map<string, number>()
  for (const m of missions ?? []) {
    counts.set(m.type, (counts.get(m.type) ?? 0) + 1)
  }
  const total = (missions ?? []).length
  const rows = [...counts.entries()]
    .map(([type, count]) => ({
      type,
      label: MISSION_TYPE_LABELS[type] ?? type,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
      barClass: MISSION_PASTEL_CLASS[type as MissionType] ?? 'bg-sage-alt',
    }))
    .sort((a, b) => b.count - a.count)

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' })

  return (
    <Card variant="opaque" padding="default" className="h-full flex flex-col">
      <CardHeader className="pb-3 space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute capitalize">
          {monthLabel}
        </p>
        <CardTitle className="font-serif italic text-xl text-ink leading-tight">
          Répartition diagnostics.
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {rows.length === 0 ? (
          <p className="text-sm text-ink-mute py-6 text-center">
            Pas encore de mission ce mois.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.type} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium truncate">{r.label}</span>
                  <span className="tabular-nums text-ink-mute shrink-0">
                    {r.count} · {r.pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-sage-alt overflow-hidden">
                  <div
                    className={cn('h-full transition-all', r.barClass)}
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
