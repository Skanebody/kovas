/**
 * 4 metric cards : Total / Échecs / Critical actions / Last 24h.
 */

import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import type { AuditStats } from '@/lib/admin/audit-types'
import { AlertOctagon, Clock, ScrollText, XCircle } from 'lucide-react'

interface AuditStatsPanelProps {
  stats: AuditStats
}

export function AuditStatsPanel({ stats }: AuditStatsPanelProps) {
  return (
    <section
      className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      aria-label="Statistiques audit"
    >
      <AdminMetricCard
        eyebrow="Total"
        value={String(stats.total)}
        hint="Entries dans la période"
        icon={ScrollText}
      />
      <AdminMetricCard
        eyebrow="Échecs"
        value={String(stats.failedTotal)}
        hint="succeeded = false"
        icon={XCircle}
      />
      <AdminMetricCard
        eyebrow="Critical actions"
        value={String(stats.criticalActionsTotal)}
        hint="Actions destructives"
        icon={AlertOctagon}
      />
      <AdminMetricCard
        eyebrow="Last 24h"
        value={String(stats.last24h)}
        hint="Sur les 24 dernières heures"
        icon={Clock}
      />
    </section>
  )
}
