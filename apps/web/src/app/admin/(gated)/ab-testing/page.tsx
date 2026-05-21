import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getAbAdminClient } from '@/lib/ab-testing/admin-client'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import Link from 'next/link'
import { type VariantStat, computeLiftPct } from './stats'

export const metadata: Metadata = { title: 'A/B testing — KOVAS Admin' }

export const dynamic = 'force-dynamic'

interface ExperimentListRow {
  id: string
  experiment_key: string
  description: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'aborted'
  primary_metric: string | null
  started_at: string | null
}

type ResultRow = {
  experiment_id: string
  variant_assigned: string
  exposures: number | null
  conversions: number | null
  conversion_rate_pct: number | null
}

export default async function AbTestingDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await getCurrentUser()

  const params = await searchParams
  const filter = (params.status ?? 'all').toLowerCase()

  const supabase = getAbAdminClient()
  const { data: experiments } = await supabase
    .from('ab_experiments')
    .select('id, experiment_key, description, status, primary_metric, started_at')
    .order('created_at', { ascending: false })

  const { data: results } = await supabase
    .from('ab_experiment_results')
    .select('experiment_id, variant_assigned, exposures, conversions, conversion_rate_pct')

  const filtered = (experiments ?? []).filter((e: ExperimentListRow) =>
    filter === 'all' ? true : e.status === filter,
  )

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-display font-bold text-ink leading-tight">A/B testing</h1>
          <p className="text-[13px] text-ink-mute mt-1">
            {filtered.length} expérience{filtered.length > 1 ? 's' : ''} — assignation déterministe
            par session_id.
          </p>
        </div>
        <Link
          href="/admin/ab-testing/new"
          className="inline-flex items-center px-4 py-2 rounded-pill bg-navy text-paper text-[12px] font-medium shadow-accent hover:bg-navy-deep transition-colors"
        >
          + Nouvelle expérience
        </Link>
      </header>

      <FilterBar current={filter} />

      {filtered.length === 0 ? (
        <Card variant="opaque" padding="lg">
          <p className="text-[13px] text-ink-mute">
            Aucune expérience pour ce filtre. Lancer le seed
            <code className="font-mono text-[11px] mx-1 px-1 py-0.5 bg-cream-deep rounded">
              supabase/seed/ab-experiments-initial.sql
            </code>
            pour en créer 5 par défaut.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((exp: ExperimentListRow) => {
            const expResults = (results ?? []).filter((r: ResultRow) => r.experiment_id === exp.id)
            const stats: VariantStat[] = expResults.map((r) => ({
              variant: r.variant_assigned,
              exposures: r.exposures ?? 0,
              conversions: r.conversions ?? 0,
              conversionRatePct: r.conversion_rate_pct,
            }))
            const control = stats.find((s) => s.variant === 'control') ?? stats[0]
            return (
              <Link key={exp.id} href={`/admin/ab-testing/${exp.id}`} className="block">
                <Card
                  variant="opaque"
                  padding="default"
                  className="hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-[15px] font-display font-semibold text-ink truncate">
                          {exp.experiment_key}
                        </h2>
                        <StatusBadge status={exp.status} />
                        {exp.primary_metric ? (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">
                            {exp.primary_metric}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[12px] text-ink-mute leading-relaxed">{exp.description}</p>
                    </div>
                    {stats.length > 0 ? (
                      <div className="flex gap-3 shrink-0 text-right">
                        {stats.map((s) => {
                          const lift = control ? computeLiftPct(control, s) : null
                          return (
                            <div key={s.variant} className="min-w-[88px]">
                              <div className="text-[10px] font-mono uppercase tracking-wider text-ink-mute">
                                {s.variant}
                              </div>
                              <div className="text-[15px] font-display font-semibold text-ink">
                                {s.conversionRatePct?.toFixed(1) ?? '0.0'}%
                              </div>
                              <div className="text-[10px] text-ink-mute">
                                {s.exposures} / {s.conversions}
                                {lift !== null && s.variant !== control?.variant ? (
                                  <span
                                    className={`ml-1 font-medium ${
                                      lift > 0 ? 'text-[#2D4015]' : lift < 0 ? 'text-[#8B1414]' : ''
                                    }`}
                                  >
                                    {lift > 0 ? '+' : ''}
                                    {lift.toFixed(1)}%
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="text-[11px] text-ink-mute italic">Aucune donnée</div>
                    )}
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <FootNote />
    </div>
  )
}

// ---------------------------------------------------------------
// Sub-composants
// ---------------------------------------------------------------

function FilterBar({ current }: { current: string }) {
  const filters: { key: string; label: string }[] = [
    { key: 'all', label: 'Toutes' },
    { key: 'draft', label: 'Brouillons' },
    { key: 'running', label: 'En cours' },
    { key: 'paused', label: 'En pause' },
    { key: 'completed', label: 'Terminées' },
    { key: 'aborted', label: 'Abandonnées' },
  ]
  return (
    <div className="flex gap-1 text-[12px]">
      {filters.map((f) => {
        const active = current === f.key
        const href = f.key === 'all' ? '/admin/ab-testing' : `/admin/ab-testing?status=${f.key}`
        return (
          <Link
            key={f.key}
            href={href}
            className={`px-3 py-1.5 rounded-pill transition-colors ${
              active
                ? 'bg-navy text-paper'
                : 'bg-paper border border-rule text-ink-mute hover:text-ink'
            }`}
          >
            {f.label}
          </Link>
        )
      })}
    </div>
  )
}

function StatusBadge({ status }: { status: ExperimentListRow['status'] }) {
  const map: Record<
    ExperimentListRow['status'],
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

function FootNote() {
  return (
    <Card variant="opaque" padding="sm" className="text-[11px] text-ink-mute">
      <p className="leading-relaxed">
        <strong className="text-ink">Note V1.5 :</strong> la significance statistique est approximée
        via un chi-square 2×2 simplifié (cf. <code className="font-mono">stats.ts</code>). Pour des
        décisions critiques, valider manuellement avec un test exact (Fisher) ou un outil dédié.
      </p>
    </Card>
  )
}
