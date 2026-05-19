import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

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

const MINUTES_SAVED_PER_MISSION = 90 // CLAUDE.md §2 : 1h30 par DPE typique
const EUROS_PER_HOUR_PRODUCTIVITY = 50 // hypothèse productivité libérée

/**
 * Gain Tracker — Design System v2 (2026-05-19).
 * Card pleine navy avec glow ambre subtle en background, chiffre hero
 * Instrument Serif italic 120px, microcopy productivité euros.
 * CTA glass discret bottom-right vers /app/gain (drill-down V1.5).
 *
 * Estimation basée sur missions terminées × 1h30 (CLAUDE.md §2).
 * Tracking détaillé V1.5.
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
  const eurosProductivity = Math.round((totalMinutesSaved / 60) * EUROS_PER_HOUR_PRODUCTIVITY)
  const yearlyProjection = Math.round((hoursSaved + remainderMinutes / 60) * 12)

  return (
    <Card
      variant="accent"
      className="relative overflow-hidden p-8 md:p-10 h-full flex flex-col justify-between"
    >
      {/* Glow ambre radial en background (signature v2) */}
      <div
        aria-hidden
        className="absolute -top-20 -right-20 size-72 rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, hsl(var(--accent-warm) / 0.18) 0%, transparent 70%)',
        }}
      />

      <div className="relative">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-card-accent-foreground/65 mb-4">
          Vous avez gagné ce mois
        </p>

        {count > 0 ? (
          <p className="font-serif italic font-normal text-card-accent-foreground leading-[0.9] tracking-tight text-7xl md:text-8xl mb-4">
            {hoursSaved}h {String(remainderMinutes).padStart(2, '0')}
          </p>
        ) : (
          <p className="font-serif italic font-normal text-card-accent-foreground/40 leading-[0.9] tracking-tight text-6xl md:text-7xl mb-4">
            —
          </p>
        )}

        {count > 0 ? (
          <p className="text-base text-card-accent-foreground/80 max-w-sm">
            Soit{' '}
            <span className="font-semibold text-card-accent-foreground">
              {eurosProductivity.toLocaleString('fr-FR')}€
            </span>{' '}
            de productivité libérée sur{' '}
            <span className="font-semibold text-card-accent-foreground">{count}</span> mission
            {count > 1 ? 's' : ''}. À ce rythme,{' '}
            <span className="font-semibold text-card-accent-foreground">
              {yearlyProjection}h
            </span>{' '}
            sur l&apos;année.
          </p>
        ) : (
          <p className="text-base text-card-accent-foreground/70 max-w-sm">
            Terminez votre première mission ce mois pour voir votre gain de temps cumulé.
          </p>
        )}
      </div>

      <Link
        href="/app/gain"
        className="relative inline-flex items-center gap-2 self-start rounded-pill border border-card-accent-foreground/20 bg-card-accent-foreground/10 backdrop-blur-md px-4 py-2 text-sm font-semibold text-card-accent-foreground transition-all hover:bg-card-accent-foreground/18 hover:-translate-y-px mt-6"
      >
        Voir le détail <ArrowRight className="size-4" />
      </Link>
    </Card>
  )
}
