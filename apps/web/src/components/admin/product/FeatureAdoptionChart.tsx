'use client'

/**
 * Adoption des features V1 — barres horizontales triées desc par adoption.
 *
 * Pas de Recharts ici : on dessine les barres en CSS pour rester sobre + parfait
 * contrôle de la largeur 0-100% sur des labels longs. Plus rapide à rendre
 * (pas de SVG calc) et aligné design system (sage / navy / chartreuse).
 */

import { Card } from '@/components/ui/card'
import type { FeatureAdoptionRow } from '@/lib/admin/product-analytics'

export interface FeatureAdoptionChartProps {
  rows: FeatureAdoptionRow[]
}

function pct(n: number, fractionDigits = 0): string {
  return `${n.toFixed(fractionDigits)}%`
}

export function FeatureAdoptionChart({ rows }: FeatureAdoptionChartProps) {
  const totalOrgs = rows[0]?.totalOrgs ?? 0

  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Adoption des features
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            % d&apos;orgs actives ce mois ayant utilisé chaque feature au moins une fois.
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          {totalOrgs} org{totalOrgs > 1 ? 's' : ''} actives
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune adoption à mesurer ce mois.</p>
      ) : (
        <ul className="space-y-3" aria-label="Adoption des features par organisation">
          {rows.map((row) => (
            <li key={row.feature} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-[13px]">
                <span className="text-ink truncate" title={row.label}>
                  {row.label}
                </span>
                <span
                  className="font-mono text-[12px] text-ink shrink-0"
                  title={`${row.activeOrgs} / ${row.totalOrgs}`}
                >
                  {pct(row.adoptionPct, 1)}
                </span>
              </div>
              <div
                className="h-2 rounded-pill bg-ink/5 overflow-hidden"
                aria-label={`${row.label} · ${pct(row.adoptionPct, 1)}`}
              >
                <div
                  className="h-full bg-chartreuse"
                  style={{ width: `${Math.max(2, Math.min(100, row.adoptionPct))}%` }}
                />
              </div>
              <p className="font-mono text-[10px] text-ink-faint">
                {row.activeOrgs} / {row.totalOrgs} org{row.totalOrgs > 1 ? 's' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
