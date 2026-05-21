'use client'

import { Card } from '@/components/ui/card'
// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import { ADDON_MODULES, type AddonModule } from '@/lib/pricing-plans'

/**
 * Sélecteur add-ons — refonte V3 dual track 2026-05-21.
 *
 * Passe de 9 add-ons + 3 packs (modèle E2c) à **4 add-ons indépendants**
 * (Spec §5) sans packs : les Bundles couvrent désormais l'économie côté tracks.
 *
 * Add-ons V3 :
 *   - `addon_signatures_eidas` 19€/mo (10 sigs + 4€/sig overage)
 *   - `addon_pennylane_sync` 9€/mo (illimité)
 *   - `addon_sms_reminders` 9€/mo (50 SMS + 0,25€/SMS overage)
 *   - `addon_community_pro` 9€/mo (illimité)
 *
 * Add-ons retirés du modèle V3 : `bilingual_reports`, `facturx_ppf` (intégré
 * Cabinet/Enterprise), `analytics_advanced` (intégré Cabinet), `regulatory_watch`,
 * `cockpit_ademe_m2`.
 */
export function AddonPicker() {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold tracking-tight">
          Add-ons à la carte
        </h3>
        <p className="text-sm text-ink-mute max-w-2xl mx-auto">
          Modules optionnels souscriptibles depuis n'importe quel tier payant Annuaire ou
          KOVAS 360. Désactivables à tout moment depuis Réglages → Modules.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {ADDON_MODULES.map((addon: AddonModule) => (
          <AddonCard key={addon.code} addon={addon} />
        ))}
      </div>
    </div>
  )
}

function AddonCard({ addon }: { addon: AddonModule }) {
  const euros = Math.round(addon.monthlyPrice / 100)
  const overageDisplay = formatOverage(addon)
  const includedDisplay = formatIncluded(addon)
  return (
    <Card variant="opaque" padding="sm" className="border-rule/60 space-y-2">
      <h4 className="text-sm font-semibold leading-tight">{addon.name}</h4>
      <p className="text-xs text-ink-mute leading-relaxed">{addon.description}</p>
      <div className="pt-1 flex items-baseline gap-2">
        <span className="text-lg font-extrabold tracking-tight">{euros}€</span>
        <span className="text-[10px] text-ink-mute uppercase tracking-wider">HT / mois</span>
      </div>
      {includedDisplay && <p className="text-[11px] text-ink-mute">{includedDisplay}</p>}
      {overageDisplay && <p className="text-[11px] text-ink-faint">{overageDisplay}</p>}
    </Card>
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
