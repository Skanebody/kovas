import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { MISSION_PASTEL_CLASS } from '@/lib/mission-pastels'
import { cn } from '@/lib/utils'
import type { MissionType } from '@kovas/shared'
import { Users } from 'lucide-react'
import { CATEGORY_COLORS, CategoryMiniCard, CategorySection } from './category-section'

export interface CabinetData {
  /** Diagnostics par type (counts bruts) — utilisé pour le breakdown. */
  diagnosticsByType: Array<{ type: string; count: number }>
  /** Nombre de clients distincts actifs sur la période. */
  activeClients: number
  /** Nombre de prescripteurs distincts ayant généré >= 1 mission sur la période. */
  activePrescribers: number
}

/**
 * Section Cabinet — accent violet Apple Sleep #AF52DE.
 *
 * Layout asymétrique :
 *  - 2 cards mini (clients actifs, prescripteurs actifs) col span 1
 *  - 1 card breakdown diagnostics col span 2 (top 5 types avec barres pastel)
 *
 * Le breakdown utilise les pastels MISSION_PASTEL_CLASS pour rester
 * cohérent avec le reste de l'app (chips diagnostics).
 */
export function CabinetSection({ data }: { data: CabinetData }) {
  return (
    <CategorySection
      category="cabinet"
      icon={Users}
      title="Cabinet"
      seeAllHref="/dashboard/clients"
    >
      <CategoryMiniCard
        category="cabinet"
        label="Clients actifs"
        value={String(data.activeClients)}
        unit={data.activeClients > 1 ? 'comptes' : 'compte'}
        hint="≥ 1 mission période"
      />
      <CategoryMiniCard
        category="cabinet"
        label="Prescripteurs actifs"
        value={String(data.activePrescribers)}
        unit={data.activePrescribers > 1 ? 'sources' : 'source'}
        hint="agents / notaires"
      />
      <DiagnosticsBreakdownCard rows={data.diagnosticsByType} />
    </CategorySection>
  )
}

function DiagnosticsBreakdownCard({
  rows,
}: {
  rows: Array<{ type: string; count: number }>
}) {
  const color = CATEGORY_COLORS.cabinet
  const total = rows.reduce((s, r) => s + r.count, 0)
  const top = [...rows]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div
      className="rounded-[16px] bg-paper p-5 border border-rule/60 relative overflow-hidden"
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink-mute">
          Répartition diagnostics
        </p>
        <p className="font-mono text-[10px] text-ink-mute/80 tabular-nums">
          {total} mission{total > 1 ? 's' : ''}
        </p>
      </div>

      {top.length === 0 ? (
        <p className="font-mono text-[11px] text-ink-mute py-2">
          Pas de diagnostic sur la période.
        </p>
      ) : (
        <ul className="space-y-2">
          {top.map((r) => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0
            const barClass = MISSION_PASTEL_CLASS[r.type as MissionType] ?? 'bg-rule/60'
            const label = MISSION_TYPE_LABELS[r.type] ?? r.type
            return (
              <li key={r.type} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="font-medium text-ink truncate">{label}</span>
                  <span className="font-mono text-[10px] text-ink-mute tabular-nums shrink-0">
                    {r.count} · {pct}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-rule/40 overflow-hidden">
                  <div
                    className={cn('h-full transition-all', barClass)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
