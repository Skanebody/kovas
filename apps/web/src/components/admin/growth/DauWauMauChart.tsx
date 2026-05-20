import { Card } from '@/components/ui/card'
import type { DauWauMau } from '@/lib/admin/growth-analytics'
import { cn } from '@/lib/utils'

export interface DauWauMauChartProps {
  metrics: DauWauMau
}

/**
 * V1 simple : 3 barres horizontales DAU / WAU / MAU + sticky ratio.
 *
 * Pas de série temporelle pour V1 (nécessiterait un snapshot quotidien ou
 * une fenêtre glissante par jour). Le composant porte le nom "Chart" pour
 * cohérence avec la spec ; à terme migrer vers Recharts AreaChart avec 3
 * séries empilées dès qu'on aura des snapshots.
 */
export function DauWauMauChart({ metrics }: DauWauMauChartProps) {
  const max = Math.max(metrics.dau, metrics.wau, metrics.mau, 1)
  const sticky = metrics.stickyRatio
  const stickyPct = sticky * 100
  const stickyGood = sticky >= 0.2

  const bars: Array<{ key: keyof DauWauMau; label: string; hint: string }> = [
    { key: 'dau', label: 'DAU', hint: 'Actifs aujourd’hui' },
    { key: 'wau', label: 'WAU', hint: '7 derniers jours' },
    { key: 'mau', label: 'MAU', hint: '30 derniers jours' },
  ]

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Engagement · DAU / WAU / MAU
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Utilisateurs distincts ayant produit (dossier, mission, photo, voix)
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em]',
            stickyGood
              ? 'bg-success/10 text-success'
              : sticky >= 0.1
                ? 'bg-warning/10 text-warning'
                : 'bg-accent-red/10 text-accent-red',
          )}
          title="Sticky ratio = DAU / MAU · cible ≥ 0.2"
        >
          Sticky {stickyPct.toFixed(1)}%
        </span>
      </div>

      <ul className="space-y-3">
        {bars.map((bar) => {
          const value = metrics[bar.key] as number
          const widthPct = (value / max) * 100
          return (
            <li key={bar.key} className="space-y-1">
              <div className="flex items-center justify-between text-[12px]">
                <p className="text-ink font-medium">
                  {bar.label} <span className="text-ink-mute">· {bar.hint}</span>
                </p>
                <span className="font-mono text-[13px] font-semibold text-ink tabular-nums">
                  {value}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-ink/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-ink transition-all duration-300"
                  style={{ width: `${Math.max(2, widthPct)}%` }}
                  aria-hidden
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
