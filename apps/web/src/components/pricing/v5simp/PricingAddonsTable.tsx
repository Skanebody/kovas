/**
 * KOVAS — Tableau add-ons super sobre.
 *
 * Pas de bordures épaisses, alignement texte / prix simple. 4 modules.
 */

import { ADDON_MODULES } from '@/lib/pricing-plans'
import { formatPriceEurCompact } from '@/lib/format/price'

export function PricingAddonsTable() {
  return (
    <div className="rounded-2xl bg-white border border-[#0B1D33]/[0.06] overflow-hidden max-w-[720px] mx-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.14em] text-[#0B1D33]/55 font-mono">
            <th className="text-left font-medium px-5 sm:px-6 py-3 border-b border-[#0B1D33]/[0.06]">
              Module
            </th>
            <th className="text-right font-medium px-5 sm:px-6 py-3 border-b border-[#0B1D33]/[0.06]">
              Tarif
            </th>
          </tr>
        </thead>
        <tbody>
          {ADDON_MODULES.map((addon) => (
            <tr
              key={addon.code}
              className="border-b border-[#0B1D33]/[0.04] last:border-b-0"
            >
              <td className="px-5 sm:px-6 py-4">
                <p className="text-[14px] text-[#0B1D33] font-medium">
                  {addon.name}
                </p>
                <p className="text-[12px] text-[#0B1D33]/55 mt-0.5">
                  {addon.description}
                </p>
              </td>
              <td className="px-5 sm:px-6 py-4 text-right font-mono text-[14px] text-[#0B1D33] tabular-nums whitespace-nowrap">
                {formatPriceEurCompact(addon.monthlyPrice)}
                <span className="text-[#0B1D33]/55"> / mois</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
