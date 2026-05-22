import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiHero } from '@/components/ui/kpi-hero'
import { StatusPill } from '@/components/ui/status-pill'
import type { QualityDashboardData } from '@/lib/admin/quality-data'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  ExternalLink,
  Gauge,
  Search,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'

type SectionProps = {
  title: string
  description?: string
  children: React.ReactNode
}

function Section({ title, description, children }: SectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-sans text-[20px] font-semibold tracking-tight text-ink">{title}</h2>
          {description ? <p className="text-[13px] text-ink-mute mt-0.5">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-rule/40 border-dashed bg-paper/40 p-4 text-[12px] font-mono uppercase tracking-[0.08em] text-ink-mute opacity-40">
      {label} · indisponible (mock)
    </div>
  )
}

type CellProps = {
  label: string
  value: string | number
  hint?: string
  mono?: boolean
  className?: string
}

function Cell({ label, value, hint, mono, className }: CellProps) {
  return (
    <div className={cn('rounded-lg border border-rule/60 bg-paper/60 p-4', className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">{label}</p>
      <p
        className={cn(
          'mt-2 tracking-tight text-ink',
          mono ? 'font-mono text-[22px]' : 'font-semibold text-[26px]',
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-[12px] text-ink-mute">{hint}</p> : null}
    </div>
  )
}

export type QualityDashboardProps = {
  data: QualityDashboardData
}

export function QualityDashboard({ data }: QualityDashboardProps) {
  const { lighthouse, sentry, uptime, coverage, seo, business, alerts, snyk } = data

  return (
    <div className="space-y-10">
      {/* Section : Indicateurs temps réel */}
      <Section
        title="Indicateurs temps réel"
        description="Santé technique de la plateforme — mise à jour à chaque chargement."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {lighthouse ? (
            <KpiHero
              value={lighthouse.score}
              label="Lighthouse score"
              hint={lighthouse.category}
              trend={lighthouse.trend ?? null}
            />
          ) : (
            <Placeholder label="Lighthouse" />
          )}
          {sentry ? (
            <KpiHero
              value={sentry.errors24h}
              label="Erreurs 24h (Sentry)"
              hint={`${sentry.uniqueIssues} issues uniques`}
              trend={sentry.trend ?? null}
            />
          ) : (
            <Placeholder label="Sentry" />
          )}
          {uptime ? (
            <KpiHero
              value={`${uptime.percent.toFixed(2)}%`}
              label="Uptime 30j"
              hint={uptime.incidents > 0 ? `${uptime.incidents} incidents` : 'Aucun incident'}
              trend={null}
            />
          ) : (
            <Placeholder label="Uptime" />
          )}
          {coverage ? (
            <KpiHero
              value={`${coverage.statements}%`}
              label="Coverage tests"
              hint={`Branches ${coverage.branches}% · Lines ${coverage.lines}%`}
              trend={null}
            />
          ) : (
            <Placeholder label="Coverage" />
          )}
        </div>
      </Section>

      {/* Section : SEO */}
      <Section
        title="SEO"
        description="Visibilité organique — Google Search Console & audits Lighthouse."
      >
        <Card variant="flat" padding="default">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Search className="size-4 text-ink-mute" aria-hidden />
              Google Search Console
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {seo ? (
                <>
                  <Cell label="Pages indexées" value={seo.indexedPages} mono />
                  <Cell
                    label="Erreurs exploration"
                    value={seo.crawlErrors}
                    mono
                    hint={seo.crawlErrors === 0 ? 'Aucune erreur' : 'À traiter'}
                  />
                  <Cell
                    label="Position moyenne"
                    value={seo.averagePosition.toFixed(1)}
                    mono
                    hint={`${seo.impressions.toLocaleString('fr-FR')} impressions`}
                  />
                  <Cell
                    label="Pages low score"
                    value={seo.lowScorePages}
                    mono
                    hint="Lighthouse < 85"
                  />
                </>
              ) : (
                <Placeholder label="Search Console" />
              )}
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Section : Business */}
      <Section title="Business" description="Indicateurs économiques agrégés — PostHog + Stripe.">
        <Card variant="flat" padding="default">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-4 text-ink-mute" aria-hidden />
              Métriques du mois
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {business ? (
                <>
                  <Cell
                    label="MRR"
                    value={`${business.mrrEuros.toLocaleString('fr-FR')} €`}
                    mono
                    hint={
                      business.mrrTrendPct != null
                        ? `${business.mrrTrendPct >= 0 ? '+' : ''}${business.mrrTrendPct}% vs M-1`
                        : undefined
                    }
                  />
                  <Cell
                    label="Signups 7j"
                    value={business.signups7d}
                    mono
                    hint={`Essais actifs : ${business.activeTrials}`}
                  />
                  <Cell
                    label="Conversion essai→payant"
                    value={`${business.trialConversionPct.toFixed(1)}%`}
                    mono
                    hint="Cible : 22-28%"
                  />
                  <Cell
                    label="Churn 30j"
                    value={`${business.churnPct.toFixed(2)}%`}
                    mono
                    hint={business.churnPct < 5 ? 'Sous cible 5%' : 'Au-dessus cible'}
                  />
                </>
              ) : (
                <Placeholder label="Business metrics" />
              )}
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Section : Sécurité (Snyk + audit deps) */}
      <Section
        title="Sécurité"
        description="Vulnérabilités dépendances + audit Snyk + headers HTTP."
      >
        <Card variant="flat" padding="default">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-ink-mute" aria-hidden />
              Posture sécurité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {snyk ? (
                <>
                  <Cell
                    label="Score Snyk"
                    value={`${snyk.score}/100`}
                    mono
                    hint={snyk.score >= 90 ? 'Excellent' : 'À surveiller'}
                  />
                  <Cell
                    label="Vulnérabilités hautes"
                    value={snyk.highSeverity}
                    mono
                    hint={snyk.highSeverity === 0 ? 'Aucune' : 'À patcher'}
                  />
                  <Cell label="Vulnérabilités moyennes" value={snyk.mediumSeverity} mono />
                  <Cell
                    label="Dernier scan"
                    value={snyk.lastScanRelative}
                    hint={snyk.lastScanIso}
                  />
                </>
              ) : (
                <Placeholder label="Snyk" />
              )}
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* Section : Alertes actives */}
      <Section
        title="Alertes actives"
        description="Incidents en cours + tickets prioritaires support."
      >
        <Card variant="flat" padding="default">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-ink-mute" aria-hidden />
              {alerts.activeIncidents.length === 0 && alerts.priorityTickets.length === 0
                ? 'Aucune alerte active'
                : 'Items à traiter'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {alerts.activeIncidents.length === 0 && alerts.priorityTickets.length === 0 ? (
              <p className="flex items-center gap-2 text-[13px] text-ink-mute">
                <CheckCircle2 className="size-4 text-accent-green" aria-hidden />
                Plateforme nominale. Aucune intervention requise.
              </p>
            ) : (
              <ul className="divide-y divide-rule/40">
                {alerts.activeIncidents.map((inc) => (
                  <li key={inc.id} className="py-3 flex items-start gap-3">
                    <StatusPill
                      variant={
                        inc.severity === 'P1' ? 'coral' : inc.severity === 'P2' ? 'amber' : 'blue'
                      }
                      label={inc.severity}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-ink truncate">{inc.title}</p>
                      <p className="text-[12px] text-ink-mute mt-0.5">
                        Ouvert {inc.openedRelative} · {inc.source}
                      </p>
                    </div>
                    {inc.url ? (
                      <a
                        href={inc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] text-ink-mute hover:text-ink inline-flex items-center gap-1"
                      >
                        Détail
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null}
                  </li>
                ))}
                {alerts.priorityTickets.map((tkt) => (
                  <li key={tkt.id} className="py-3 flex items-start gap-3">
                    <Bug className="size-4 mt-1 text-ink-mute shrink-0" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-medium text-ink truncate">{tkt.title}</p>
                      <p className="text-[12px] text-ink-mute mt-0.5">
                        Ticket #{tkt.id} · {tkt.openedRelative} · {tkt.priority}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </Section>

      {/* Pied de page admin */}
      <footer className="pt-6 border-t border-rule/40 text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
        <Gauge className="size-3.5" aria-hidden />
        Données agrégées · Refresh à chaque navigation
      </footer>
    </div>
  )
}
