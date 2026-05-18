import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'

/**
 * Couleurs par type diagnostic (cf. spec dashboard cockpit).
 * Stockées en HSL custom : on les pose en inline style pour éviter
 * d'ajouter des tokens supplémentaires juste pour ce bloc.
 */
const TYPE_COLORS: Record<string, string> = {
  dpe_vente: '#3B82F6',
  dpe_location: '#3B82F6',
  copropriete: '#3B82F6',
  amiante_vente: '#EF4444',
  amiante_avant_travaux: '#EF4444',
  plomb_crep: '#F59E0B',
  gaz: '#10B981',
  electricite: '#8B5CF6',
  termites: '#EC4899',
  carrez_boutin: '#14B8A6',
  erp: '#6366F1',
}

function monthBoundsParis(): { startIso: string; nextIso: string } {
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
  const next = new Date(start)
  next.setMonth(next.getMonth() + 1)
  return { startIso: start.toISOString(), nextIso: next.toISOString() }
}

export async function DiagnosticsBreakdown() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, nextIso } = monthBoundsParis()

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
      color: TYPE_COLORS[type] ?? '#6B7280',
    }))
    .sort((a, b) => b.count - a.count)

  const monthLabel = new Date().toLocaleDateString('fr-FR', { month: 'long' })

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground capitalize">
          Répartition diagnostics · {monthLabel}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-1">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Pas encore de mission ce mois.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.type} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium truncate">{r.label}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">
                    {r.count} · {r.pct}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{ width: `${r.pct}%`, background: r.color }}
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
