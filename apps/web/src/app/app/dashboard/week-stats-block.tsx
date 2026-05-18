import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { TrendingDown, TrendingUp } from 'lucide-react'

/**
 * Lundi 00:00 Europe/Paris à partir d'une date.
 */
function weekStartParis(ref: Date): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = fmt.formatToParts(ref)
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon'
  const ymd = `${parts.find((p) => p.type === 'year')?.value}-${parts.find((p) => p.type === 'month')?.value}-${parts.find((p) => p.type === 'day')?.value}`
  const offsetByDay: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  }
  const offset = offsetByDay[wd] ?? 0
  const base = new Date(`${ymd}T00:00:00+02:00`)
  base.setDate(base.getDate() - offset)
  return base
}

export async function WeekStatsBlock() {
  const { supabase, orgId } = await getCurrentUser()
  const now = new Date()
  const thisWeekStart = weekStartParis(now)
  const lastWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    { count: missionsThisWeek },
    { count: missionsLastWeek },
    { count: dossiersThisWeek },
    { count: clientsThisWeek },
  ] = await Promise.all([
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', thisWeekStart.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', lastWeekStart.toISOString())
      .lt('completed_at', thisWeekStart.toISOString()),
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', thisWeekStart.toISOString()),
    supabase
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('created_at', thisWeekStart.toISOString()),
  ])

  const thisCount = missionsThisWeek ?? 0
  const lastCount = missionsLastWeek ?? 0
  let delta: { value: number; up: boolean } | null = null
  if (lastCount > 0) {
    const pct = Math.round(((thisCount - lastCount) / lastCount) * 100)
    delta = { value: Math.abs(pct), up: pct >= 0 }
  } else if (thisCount > 0) {
    delta = { value: 100, up: true }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cette semaine</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-3 gap-4">
        <Stat label="Missions terminées" value={thisCount} delta={delta} />
        <Stat label="Nouveaux dossiers" value={dossiersThisWeek ?? 0} />
        <Stat label="Nouveaux clients" value={clientsThisWeek ?? 0} />
      </CardContent>
    </Card>
  )
}

function Stat({
  label,
  value,
  delta,
}: {
  label: string
  value: number
  delta?: { value: number; up: boolean } | null
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
        {delta && (
          <span
            className={`text-xs flex items-center gap-0.5 ${
              delta.up ? 'text-accent-green' : 'text-accent-red'
            }`}
          >
            {delta.up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {delta.value}%
          </span>
        )}
      </div>
    </div>
  )
}
