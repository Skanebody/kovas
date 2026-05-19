import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'
import { ArrowRight, Clock, Target, TrendingUp } from 'lucide-react'

/**
 * Bornes du mois courant en timezone Paris.
 */
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

const MONTHLY_TARGET = 30
const MINUTES_SAVED_PER_MISSION = 90 // CLAUDE.md §2 : 1h30 par DPE typique

/**
 * Gain Tracker — SHELL V1 (CLAUDE.md §21bis prévoit V1.5 sprints 15-17).
 * Estimation basée sur le nombre de missions terminées × 1h30 par mission
 * (promesse mesurable CLAUDE.md §2). Pas de tracking détaillé jusqu'à V1.5.
 */
export async function GainTrackerCard() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, nextIso } = monthBoundsParis()

  const { count: missionsThisMonth } = await supabase
    .from('missions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('status', ['done', 'exported'])
    .gte('completed_at', startIso)
    .lt('completed_at', nextIso)

  const count = missionsThisMonth ?? 0
  const totalMinutesSaved = count * MINUTES_SAVED_PER_MISSION
  const hoursSaved = Math.floor(totalMinutesSaved / 60)
  const remainderMinutes = totalMinutesSaved % 60
  const targetPct = Math.min(Math.round((count / MONTHLY_TARGET) * 100), 100)

  const monthLabel = new Date().toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <Card variant="accent" className="p-6 space-y-4 h-full flex flex-col">
      <div>
        <p className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
          Votre gain ce mois
        </p>
        <p className="text-xs opacity-50 capitalize">{monthLabel}</p>
      </div>

      <div className="space-y-3 flex-1">
        <Metric
          icon={Clock}
          value={count > 0 ? `${hoursSaved}h ${String(remainderMinutes).padStart(2, '0')}min` : '—'}
          label="Temps économisé estimé"
        />
        <div className="h-px bg-card-accent-foreground/15" />
        <Metric
          icon={TrendingUp}
          value={`${count}`}
          label={`mission${count > 1 ? 's' : ''} terminée${count > 1 ? 's' : ''}`}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5">
            <Target className="size-3.5" /> Objectif {MONTHLY_TARGET}
          </span>
          <span className="tabular-nums">{targetPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-card-accent-foreground/15 overflow-hidden">
          <div
            className="h-full bg-card-accent-foreground transition-all"
            style={{ width: `${targetPct}%` }}
          />
        </div>
      </div>

      <p className="text-[10px] opacity-60 leading-tight">
        Estimation 1h30/mission (CLAUDE.md §2). Tracking détaillé V1.5.
      </p>

      <button
        type="button"
        className={cn(
          'flex items-center justify-between text-xs font-medium',
          'border-t border-card-accent-foreground/15 pt-3',
          'hover:opacity-80 transition-opacity',
        )}
      >
        Voir mon activité <ArrowRight className="size-3.5" />
      </button>
    </Card>
  )
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string
  label: string
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="size-5 opacity-70" />
      <div>
        <div className="text-xl font-bold tracking-tight tabular-nums">{value}</div>
        <div className="text-[11px] opacity-70">{label}</div>
      </div>
    </div>
  )
}
