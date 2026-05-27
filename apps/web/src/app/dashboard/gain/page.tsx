import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { parisMonthBounds } from '@/lib/paris-dates'
import { getOrgBaselineMinutes } from '@/lib/preferences/baseline-minutes'
import { ArrowRight, BarChart3, Calendar, Clock, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Gain de temps · KOVAS',
  description: 'Suivi de votre gain de temps libéré ce mois et tendance annuelle.',
}

const EUROS_PER_HOUR_PRODUCTIVITY = 50 // hypothèse productivité libérée

/**
 * Page "Gain" — détail du gain de temps cumulé mensuel + projection annuelle.
 *
 * Cible référencée depuis :
 *   - middleware.ts (auth gate)
 *   - dashboard/gain-tracker-card (lien "Voir le détail")
 *   - lib/reports/monthly-reports (email récap mensuel)
 *
 * V1 (cette page) : grille KPI minimaliste + CTA retour dashboard.
 * V1.5 (gain-tracker-system.md §2) : page "Mon activité" complète avec stats
 * cumulées toutes périodes, évolution mensuelle, répartition par diagnostic
 * et statuts professionnels (7 niveaux).
 */
export default async function GainPage() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, nextIso } = parisMonthBounds()

  const [{ count: missionsThisMonth }, { count: missionsAllTime }, baselineMinutes] =
    await Promise.all([
      supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .in('status', ['done', 'exported'])
        .gte('completed_at', startIso)
        .lt('completed_at', nextIso),
      supabase
        .from('missions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .in('status', ['done', 'exported']),
      getOrgBaselineMinutes(supabase, orgId),
    ])

  const monthCount = missionsThisMonth ?? 0
  const allTimeCount = missionsAllTime ?? 0

  const monthMinutes = monthCount * baselineMinutes
  const monthHours = Math.floor(monthMinutes / 60)
  const monthRemainder = monthMinutes % 60
  const monthEuros = Math.round((monthMinutes / 60) * EUROS_PER_HOUR_PRODUCTIVITY)

  const yearProjectionHours = Math.round((monthMinutes / 60) * 12)

  const allTimeMinutes = allTimeCount * baselineMinutes
  const allTimeHours = Math.floor(allTimeMinutes / 60)

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="space-y-3">
        <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
          Mon activité · Gain de temps
        </p>
        <h1
          className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
          style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
        >
          Ton temps <span className="font-serif italic font-normal">libéré</span>.
        </h1>
        <p className="text-[16px] text-[#0F1419]/72 max-w-2xl leading-relaxed">
          Suivi mensuel basé sur ton temps moyen avant KOVAS ({baselineMinutes} min /
          mission, modifiable dans{' '}
          <Link
            href="/dashboard/account"
            className="text-[#0F1419] underline underline-offset-2 hover:no-underline"
          >
            Paramètres
          </Link>
          ).
        </p>
      </header>

      {/* KPI hero */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card variant="accent" padding="default" className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 size-60 rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, hsl(var(--accent-warm) / 0.18) 0%, transparent 70%)',
            }}
          />
          <div className="relative space-y-2">
            <p className="font-mono uppercase tracking-wider text-[11px] text-card-accent-foreground/65">
              Ce mois
            </p>
            {monthCount > 0 ? (
              <p className="font-serif italic font-normal text-card-accent-foreground leading-[0.9] tracking-tight text-6xl">
                {monthHours}h {String(monthRemainder).padStart(2, '0')}
              </p>
            ) : (
              <p className="font-serif italic font-normal text-card-accent-foreground/40 leading-[0.9] tracking-tight text-5xl">
                —
              </p>
            )}
            {monthCount > 0 ? (
              <p className="text-sm text-card-accent-foreground/80">
                Sur{' '}
                <span className="font-semibold text-card-accent-foreground">{monthCount}</span>{' '}
                mission{monthCount > 1 ? 's' : ''} ·{' '}
                <span className="font-semibold text-card-accent-foreground">
                  {monthEuros.toLocaleString('fr-FR')}€
                </span>{' '}
                de productivité libérée
              </p>
            ) : (
              <p className="text-sm text-card-accent-foreground/70">
                Termine ta première mission ce mois pour voir ton gain cumulé.
              </p>
            )}
          </div>
        </Card>

        <Card variant="flat" padding="default" className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-[#0F1419]/65" aria-hidden />
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Projection annuelle
            </p>
          </div>
          <p className="font-serif italic text-5xl tracking-tight text-[#0F1419] leading-[0.9]">
            {yearProjectionHours}h
          </p>
          <p className="text-sm text-[#0F1419]/72">
            À ce rythme, sur 12 mois. Soit environ{' '}
            <span className="font-semibold text-[#0F1419]">
              {(yearProjectionHours * EUROS_PER_HOUR_PRODUCTIVITY).toLocaleString('fr-FR')}€
            </span>{' '}
            valorisés.
          </p>
        </Card>

        <Card variant="flat" padding="default" className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-[#0F1419]/65" aria-hidden />
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Cumul KOVAS
            </p>
          </div>
          <p className="font-serif italic text-5xl tracking-tight text-[#0F1419] leading-[0.9]">
            {allTimeHours}h
          </p>
          <p className="text-sm text-[#0F1419]/72">
            Depuis ton inscription. Sur{' '}
            <span className="font-semibold text-[#0F1419]">{allTimeCount}</span> mission
            {allTimeCount > 1 ? 's' : ''} terminée{allTimeCount > 1 ? 's' : ''}.
          </p>
        </Card>
      </div>

      {/* Stats détaillées V1.5 — placeholder */}
      <Card variant="flat" padding="default" className="space-y-4">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 text-[#0F1419]/55 shrink-0 mt-1" aria-hidden />
          <div className="space-y-1.5">
            <h2 className="font-sans font-semibold text-[18px] text-[#0F1419]">
              Statistiques détaillées · V1.5
            </h2>
            <p className="text-[13px] text-[#0F1419]/72 leading-relaxed max-w-2xl">
              Bientôt : évolution mensuelle sur 12 mois, répartition par type de diagnostic
              (DPE, Amiante, Plomb…), classement vs autres diagnostiqueurs de ta zone, et
              statuts professionnels débloqués. Roadmap{' '}
              <span className="font-mono text-[11px]">gain-tracker-system §2-4</span>.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link
            href="/dashboard/account/progression"
            className="inline-flex items-center gap-2 rounded-pill border border-[#0F1419]/[0.12] bg-paper px-4 py-2 text-sm font-medium text-[#0F1419] hover:bg-[#0F1419]/[0.04] transition-colors"
          >
            <BarChart3 className="size-4" aria-hidden />
            Voir ma progression
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          <Link
            href="/dashboard/dashboard"
            className="inline-flex items-center gap-2 rounded-pill border border-[#0F1419]/[0.12] bg-paper px-4 py-2 text-sm font-medium text-[#0F1419] hover:bg-[#0F1419]/[0.04] transition-colors"
          >
            Retour au tableau de bord
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </Card>
    </div>
  )
}
