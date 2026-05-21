'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import { ADDON_MODULES, type AddonModule } from '@/lib/pricing-plans'

/**
 * Grille des 4 add-ons KOVAS V3 (Spec §5).
 *
 * - `addon_signatures_eidas` — 19€/mo + 4€/sig overage
 * - `addon_pennylane_sync` — 9€/mo
 * - `addon_sms_reminders` — 9€/mo + 0,25€/SMS overage
 * - `addon_community_pro` — 9€/mo
 *
 * Souscriptibles depuis n'importe quel tier payant (Annuaire ou Logiciel).
 * Mobile-first : 1 col → sm:2 cols → lg:4 cols.
 */
export function AddonsGrid() {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {ADDON_MODULES.map((addon) => (
        <AddonCard key={addon.code} addon={addon} />
      ))}
    </ul>
  )
}

function AddonCard({ addon }: { addon: AddonModule }) {
  const monthlyEuros = Math.round(addon.monthlyPrice / 100)
  const includedDisplay = formatIncluded(addon)
  const overageDisplay = formatOverage(addon)

  return (
    <li className="rounded-[20px] border border-[#0F1419]/[0.08] bg-white p-5 hover:border-[#0F1419]/35 transition-colors flex flex-col">
      <p className="text-[15px] font-semibold text-[#0F1419] leading-snug mb-2">
        {addon.name}
      </p>
      <p className="text-[13px] text-[#0F1419]/72 leading-relaxed mb-4 min-h-[60px] flex-1">
        {addon.description}
      </p>
      <div className="pt-3 border-t border-[#0F1419]/[0.04] space-y-1">
        <p className="font-semibold text-[14px] tabular-nums text-[#0F1419]">
          {monthlyEuros} €{' '}
          <span className="font-normal text-[#0F1419]/55">/ mois</span>
        </p>
        {includedDisplay && (
          <p className="text-[11px] text-[#0F1419]/72">{includedDisplay}</p>
        )}
        {overageDisplay && (
          <p className="text-[11px] text-[#0F1419]/55">{overageDisplay}</p>
        )}
      </div>
    </li>
  )
}

function formatIncluded(addon: AddonModule): string | null {
  if (addon.includedQuantity === null) return 'Usage illimité inclus'
  if (addon.includedQuantity === 0) return null
  const unit = addon.overageUnit ?? 'unité'
  return `${addon.includedQuantity} ${unit}${addon.includedQuantity > 1 ? 's' : ''} inclus / mois`
}

function formatOverage(addon: AddonModule): string | null {
  if (addon.overagePrice === null || addon.overageUnit === null) return null
  const euros = (addon.overagePrice / 100).toFixed(2).replace('.', ',')
  return `Au-delà : ${euros} € / ${addon.overageUnit}`
}
