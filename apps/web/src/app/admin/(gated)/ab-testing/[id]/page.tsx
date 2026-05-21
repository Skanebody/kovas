import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getAbAdminClient } from '@/lib/ab-testing/admin-client'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { type VariantStat, approxPValueChiSquare, computeLiftPct, formatPValue } from '../stats'
import { ExperimentActions } from './experiment-actions'
import { TimeSeriesChart } from './time-series-chart'

export const metadata: Metadata = { title: 'Détail expérience — KOVAS Admin' }
export const dynamic = 'force-dynamic'

interface ExperimentDetailRow {
  id: string
  experiment_key: string
  description: string
  hypothesis: string | null
  status: 'draft' | 'running' | 'paused' | 'completed' | 'aborted'
  primary_metric: string | null
  started_at: string | null
  ended_at: string | null
  winner_variant: string | null
  variants: unknown
}

export default async function ExperimentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await getCurrentUser()
  const { id } = await params

  const supabase = getAbAdminClient()

  const { data: experiment } = await supabase
    .from('ab_experiments')
    .select(
      'id, experiment_key, description, hypothesis, status, primary_metric, started_at, ended_at, winner_variant, variants',
    )
    .eq('id', id)
    .maybeSingle()

  if (!experiment) notFound()
  const exp = experiment as ExperimentDetailRow

  const { data: results } = await supabase
    .from('ab_experiment_results')
    .select('variant_assigned, exposures, conversions, clicks, submits, conversion_rate_pct')
    .eq('experiment_id', id)

  const variantStats: VariantStat[] = (results ?? []).map((r) => ({
    variant: r.variant_assigned,
    exposures: r.exposures ?? 0,
    conversions: r.conversions ?? 0,
    conversionRatePct: r.conversion_rate_pct,
  }))
  const control = variantStats.find((s) => s.variant === 'control') ?? variantStats[0]

  // Série temporelle 30j (exposures + conversions / jour / variant)
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const { data: events } = await supabase
    .from('ab_events')
    .select('event_type, variant_assigned, created_at')
    .eq('experiment_id', id)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <nav className="text-[11px] text-ink-mute">
        <Link href="/admin/ab-testing" className="hover:text-ink">
          A/B testing
        </Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{exp.experiment_key}</span>
      </nav>

      <header className="flex items-start justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-[24px] font-display font-bold text-ink">{exp.experiment_key}</h1>
            <StatusBadge status={exp.status} />
            {exp.winner_variant ? (
              <Badge variant="green">Gagnant : {exp.winner_variant}</Badge>
            ) : null}
          </div>
          <p className="text-[13px] text-ink leading-relaxed">{exp.description}</p>
          {exp.hypothesis ? (
            <p className="text-[12px] text-ink-mute italic mt-1">Hypothèse : {exp.hypothesis}</p>
          ) : null}
          <div className="flex gap-4 mt-3 text-[11px] text-ink-mute font-mono uppercase tracking-wider">
            {exp.primary_metric ? <span>metric: {exp.primary_metric}</span> : null}
            {exp.started_at ? <span>start: {formatDate(exp.started_at)}</span> : null}
            {exp.ended_at ? <span>end: {formatDate(exp.ended_at)}</span> : null}
          </div>
        </div>
        <ExperimentActions
          experimentId={exp.id}
          status={exp.status}
          variants={variantStats.map((s) => s.variant)}
        />
      </header>

      <Card variant="opaque" padding="default">
        <h2 className="text-[14px] font-display font-semibold text-ink mb-4">
          Résultats par variant
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-rule text-[10px] font-mono uppercase tracking-wider text-ink-mute">
                <th className="text-left py-2 pr-4">Variant</th>
                <th className="text-right py-2 px-4">Exposures</th>
                <th className="text-right py-2 px-4">Conversions</th>
                <th className="text-right py-2 px-4">Taux</th>
                <th className="text-right py-2 px-4">Lift vs control</th>
                <th className="text-right py-2 pl-4">p-value</th>
              </tr>
            </thead>
            <tbody>
              {variantStats.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-ink-mute italic">
                    Aucune donnée encore — l'expérience doit être en cours et exposée.
                  </td>
                </tr>
              ) : (
                variantStats.map((s) => {
                  const isControl = s.variant === control?.variant
                  const lift = control && !isControl ? computeLiftPct(control, s) : null
                  const p = control && !isControl ? approxPValueChiSquare(control, s) : null
                  return (
                    <tr key={s.variant} className="border-b border-rule/50">
                      <td className="py-3 pr-4">
                        <span className="font-display font-medium text-ink">{s.variant}</span>
                        {isControl ? (
                          <span className="ml-2 text-[10px] font-mono uppercase text-ink-mute">
                            (référence)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">{s.exposures}</td>
                      <td className="py-3 px-4 text-right font-mono">{s.conversions}</td>
                      <td className="py-3 px-4 text-right font-display font-semibold">
                        {s.conversionRatePct?.toFixed(2) ?? '0.00'}%
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono ${
                          lift !== null
                            ? lift > 0
                              ? 'text-[#2D4015]'
                              : lift < 0
                                ? 'text-[#8B1414]'
                                : 'text-ink-mute'
                            : 'text-ink-mute'
                        }`}
                      >
                        {lift !== null ? `${lift > 0 ? '+' : ''}${lift.toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-3 pl-4 text-right font-mono text-ink-mute">
                        {formatPValue(p)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card variant="opaque" padding="default">
        <h2 className="text-[14px] font-display font-semibold text-ink mb-4">Évolution 30 jours</h2>
        <TimeSeriesChart events={events ?? []} />
      </Card>
    </div>
  )
}

function StatusBadge({ status }: { status: ExperimentDetailRow['status'] }) {
  const map: Record<
    ExperimentDetailRow['status'],
    { variant: 'muted' | 'green' | 'yellow' | 'blue' | 'red'; label: string }
  > = {
    draft: { variant: 'muted', label: 'Brouillon' },
    running: { variant: 'green', label: 'En cours' },
    paused: { variant: 'yellow', label: 'En pause' },
    completed: { variant: 'blue', label: 'Terminée' },
    aborted: { variant: 'red', label: 'Abandonnée' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
