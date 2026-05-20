/**
 * ClusteringAdoptionStats — KpiCard avec progress bar du taux d'adoption.
 *
 * Compte les jours-users avec ≥ 2 missions où toutes les missions sont dans
 * un rayon de 5 km comme "suggestion acceptée" (proxy V1).
 */

import { Card } from '@/components/ui/card'
import type { ClusteringAdoption } from '@/lib/admin/scheduling-metrics'

export interface ClusteringAdoptionStatsProps {
  clustering: ClusteringAdoption
}

export function ClusteringAdoptionStats({ clustering }: ClusteringAdoptionStatsProps) {
  const ratePct = Math.min(100, Math.max(0, clustering.rate))

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Adoption clustering · 30 jours
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Regroupements.</h2>
      </header>

      <div className="space-y-4">
        <div className="flex items-baseline gap-3">
          <p className="font-serif italic font-normal text-5xl text-ink leading-none">
            {clustering.rate.toFixed(0)}%
          </p>
          <p className="text-sm text-ink-mute">taux d'adoption estimé</p>
        </div>

        <div
          className="w-full h-2 bg-ink/5 rounded-full overflow-hidden"
          role="progressbar"
          tabIndex={0}
          aria-valuenow={ratePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Taux d'adoption clustering : ${ratePct}%`}
        >
          <div
            className="h-full bg-chartreuse transition-all duration-base ease-spring"
            style={{ width: `${ratePct}%` }}
          />
        </div>

        <dl className="grid grid-cols-3 gap-3 pt-3 border-t border-rule/40">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Suggérés
            </dt>
            <dd className="font-mono text-[15px] text-ink mt-0.5">{clustering.suggested}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Acceptés
            </dt>
            <dd className="font-mono text-[15px] text-ink mt-0.5">{clustering.accepted}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
              Économie
            </dt>
            <dd className="font-mono text-[15px] text-ink mt-0.5">{clustering.savingsMin} min</dd>
          </div>
        </dl>
      </div>
    </Card>
  )
}
