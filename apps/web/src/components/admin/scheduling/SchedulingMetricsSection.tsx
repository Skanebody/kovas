/**
 * SchedulingMetricsSection — section "Scheduling overview" sur la home admin.
 *
 * Affiche 4 metric cards :
 *   1. Précision estimations (avg diff_min 30j)
 *   2. Conflits détectés (count alerts)
 *   3. DPE quota — top 3 users à surveiller
 *   4. Trajets économisés via clustering (sum savingsMin)
 *
 * Composant server : reçoit le snapshot déjà calculé.
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Card } from '@/components/ui/card'
import type {
  ClusteringAdoption,
  ConflictCount,
  DpeQuotaUserRow,
  DurationAccuracySummary,
} from '@/lib/admin/scheduling-metrics'
import { AlertTriangle, Gauge, MapPin, ShieldAlert } from 'lucide-react'

export interface SchedulingMetricsSectionProps {
  durationAccuracy: DurationAccuracySummary
  conflicts: ConflictCount
  dpeQuotaTop: DpeQuotaUserRow[]
  clustering: ClusteringAdoption
}

function formatDiff(min: number): string {
  if (min === 0) return '0 min'
  const sign = min > 0 ? '+' : ''
  return `${sign}${min.toFixed(0)} min`
}

function emailShort(email: string | null, fallback: string): string {
  if (!email) return fallback
  const at = email.indexOf('@')
  return at === -1 ? email : email.slice(0, Math.min(at, 22))
}

const SEVERITY_DOT: Record<DpeQuotaUserRow['severity'], string> = {
  critical: 'bg-accent-red',
  warning: 'bg-warning',
  info: 'bg-amber',
  ok: 'bg-ink-faint',
}

export function SchedulingMetricsSection({
  durationAccuracy,
  conflicts,
  dpeQuotaTop,
  clustering,
}: SchedulingMetricsSectionProps) {
  const top3 = dpeQuotaTop.slice(0, 3)
  const sampleHint =
    durationAccuracy.sampleSize > 0
      ? `${durationAccuracy.sampleSize} missions analysées`
      : 'Aucune mission complétée'

  return (
    <section className="space-y-4" aria-label="Scheduling overview">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          📅 Scheduling overview
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          fenêtre 30 jours
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          eyebrow="Précision estimations"
          value={formatDiff(durationAccuracy.avgDiffMin30d)}
          hint={sampleHint}
          icon={Gauge}
        />
        <AdminMetricCard
          eyebrow="Conflits détectés"
          value={String(conflicts.detected)}
          hint={`dont ${conflicts.resolved} résolus`}
          icon={AlertTriangle}
        />
        <Card variant="opaque" padding="default" className="relative">
          <div className="flex items-start justify-between gap-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
              DPE quota · top 3 surveillés
            </p>
            <ShieldAlert className="size-4 text-ink-faint" aria-hidden />
          </div>
          {top3.length === 0 ? (
            <p className="mt-3 text-sm text-ink-mute">Aucun user au-dessus du seuil 80%.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {top3.map((row, idx) => (
                <li key={row.userId} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-ink truncate">
                    <span
                      aria-hidden
                      className={`size-2 rounded-full shrink-0 ${SEVERITY_DOT[row.severity]}`}
                    />
                    <span className="truncate">
                      {emailShort(row.userEmail, `User #${idx + 1}`)}
                    </span>
                  </span>
                  <span className="font-mono text-[12px] text-ink shrink-0">
                    {row.dpeCount}/1000
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <AdminMetricCard
          eyebrow="Trajets économisés"
          value={`${clustering.savingsMin} min`}
          hint={`${clustering.accepted} missions regroupées`}
          icon={MapPin}
        />
      </div>
    </section>
  )
}
