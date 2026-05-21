'use client'

import {
  FEATURE_MATRIX,
  PRICING_PLANS,
  type FeatureRow,
  type PricingPlanCode,
} from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { Check, Minus } from 'lucide-react'
import { useMemo } from 'react'

/**
 * Matrice features × forfaits — affichée sur /pricing/compare.
 *
 * Lignes groupées par catégorie. Cellule = ✓ chartreuse / — gris / texte court
 * (limite quotas / mention "2€ / sig"). Lignes alternées sage / blanc.
 *
 * Mobile : table devient stack vertical par catégorie (chaque feature affiche
 * inline les 5 plans en mini-pills).
 */
export function PlanFeatureMatrix() {
  const grouped = useMemo(() => {
    const map = new Map<string, FeatureRow[]>()
    for (const row of FEATURE_MATRIX) {
      const list = map.get(row.category) ?? []
      list.push(row)
      map.set(row.category, list)
    }
    return Array.from(map.entries())
  }, [])

  return (
    <div className="overflow-x-auto rounded-[24px] border border-[#0F1419]/[0.08] bg-white">
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr className="border-b border-[#0F1419]/[0.08]">
            <th
              scope="col"
              className="sticky left-0 bg-white text-left px-5 py-5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold min-w-[220px]"
            >
              Fonctionnalité
            </th>
            {PRICING_PLANS.map((plan) => (
              <th
                key={plan.code}
                scope="col"
                className={cn(
                  'px-3 py-5 text-center min-w-[110px]',
                  plan.featured && 'bg-[#0F1419]/[0.03]',
                )}
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/55 font-semibold mb-1">
                  {plan.featured ? 'Recommandé' : ' '}
                </div>
                <div className="font-semibold text-[#0F1419] text-[14px]">{plan.name}</div>
                <div className="font-serif italic text-[22px] leading-none mt-1 text-[#0F1419]">
                  {plan.monthlyPrice} €
                </div>
                <div className="text-[10px] text-[#0F1419]/55">HT / mois</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map(([category, rows]) => (
            <tbody key={category} className="contents">
              <tr>
                <th
                  colSpan={1 + PRICING_PLANS.length}
                  scope="colgroup"
                  className="bg-[#F5F7F4] text-left px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/72 font-semibold border-t border-[#0F1419]/[0.08]"
                >
                  {category}
                </th>
              </tr>
              {rows.map((row, idx) => (
                <tr
                  key={row.feature}
                  className={cn(
                    'border-t border-[#0F1419]/[0.04]',
                    idx % 2 === 0 ? 'bg-white' : 'bg-[#F5F7F4]/40',
                  )}
                >
                  <td className="sticky left-0 bg-inherit px-5 py-3.5 text-[#0F1419] font-medium">
                    {row.feature}
                  </td>
                  {PRICING_PLANS.map((plan) => (
                    <td
                      key={plan.code}
                      className={cn(
                        'px-3 py-3.5 text-center',
                        plan.featured && 'bg-[#0F1419]/[0.03]',
                      )}
                    >
                      <Cell value={row.plans[plan.code as PricingPlanCode]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Cell({ value }: { value: boolean | string }) {
  if (value === true) {
    return (
      <span
        aria-label="Inclus"
        className="inline-flex items-center justify-center size-6 rounded-full bg-chartreuse text-[#0F1419]"
      >
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    )
  }
  if (value === false) {
    return (
      <span
        aria-label="Non inclus"
        className="inline-flex items-center justify-center size-6 rounded-full bg-[#0F1419]/[0.04] text-[#0F1419]/35"
      >
        <Minus className="size-3.5" />
      </span>
    )
  }
  // string : valeur limitée ou contextuelle
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#0F1419]/[0.06] text-[#0F1419]/80 tabular-nums">
      {value}
    </span>
  )
}
