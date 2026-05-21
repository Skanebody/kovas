'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  ADDON_MODULES,
  ADDON_PACKS,
  type AddonCode,
  type AddonModule,
  type AddonPack,
} from '@/lib/pricing-plans'
import { ChevronDown, Sparkles } from 'lucide-react'
import { useState } from 'react'

/**
 * Sélecteur add-ons + packs — page /pricing (+ flux conversion).
 * Stratification LIBRE : n’importe quel tier peut acheter n’importe quel add-on.
 * Cf. CLAUDE.md §4 — pricing finale 2026-06-02.
 */
export function AddonPicker() {
  const [showIndividual, setShowIndividual] = useState(false)

  return (
    <div className="space-y-8">
      <PackSection />

      <div className="text-center">
        <button
          type="button"
          onClick={() => setShowIndividual((prev) => !prev)}
          className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-ink transition-colors"
        >
          {showIndividual ? 'Masquer' : 'Voir tous les add-ons à l’unité'}
          <ChevronDown
            className={`size-4 transition-transform ${showIndividual ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {showIndividual && <IndividualAddonsSection />}
    </div>
  )
}

// ─────────────────────────────────────────────
// Packs
// ─────────────────────────────────────────────

function PackSection() {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <Badge variant="muted">Packs thématiques</Badge>
        <h3 className="text-xl font-semibold tracking-tight">
          Économisez avec un pack
        </h3>
        <p className="text-sm text-ink-mute">
          3 bouquets pensés pour les cas d’usage les plus fréquents.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {ADDON_PACKS.map((pack) => (
          <PackCard key={pack.code} pack={pack} />
        ))}
      </div>
    </div>
  )
}

function PackCard({ pack }: { pack: AddonPack }) {
  const euros = Math.floor(pack.monthlyPrice / 100)
  const isFeatured = pack.featured === true
  return (
    <Card
      variant="opaque"
      padding="default"
      className={
        isFeatured
          ? 'border-navy/30 shadow-accent relative space-y-3'
          : 'border-rule/70 relative space-y-3'
      }
    >
      {isFeatured && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1">
          <Sparkles className="size-3" />
          Recommandé
        </Badge>
      )}
      <div className="space-y-1">
        <h4 className="text-base font-semibold">{pack.name}</h4>
        <p className="text-xs text-ink-mute">{pack.description}</p>
      </div>
      <div className="pt-1">
        <div className="text-2xl font-extrabold tracking-tight">
          {euros}€
          <span className="text-xs font-normal text-ink-mute"> HT/mois</span>
        </div>
        {pack.savings > 0 && (
          <p className="text-[11px] text-accent-green font-medium pt-1">
            Économie de {pack.savings}€/mois vs add-ons à l’unité
          </p>
        )}
      </div>
      <ul className="space-y-1.5 text-xs border-t border-rule/40 pt-3">
        {pack.includedAddons.map((code) => {
          const addon = ADDON_MODULES.find((a) => a.code === code)
          const limit = pack.bundleLimits[code]
          if (!addon) return null
          return (
            <li key={code} className="flex justify-between gap-2">
              <span className="text-ink">{addon.name}</span>
              {limit !== undefined && (
                <span className="text-ink-mute">
                  {limit} {addon.overageUnit ?? 'inclus'}/mois
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

// ─────────────────────────────────────────────
// Add-ons individuels
// ─────────────────────────────────────────────

function IndividualAddonsSection() {
  return (
    <div className="space-y-4">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">Add-ons à l’unité</h3>
        <p className="text-sm text-ink-mute">
          Activables indépendamment, quelle que soit votre formule.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {ADDON_MODULES.map((addon) => (
          <AddonCard key={addon.code} addon={addon} />
        ))}
      </div>
    </div>
  )
}

function AddonCard({ addon }: { addon: AddonModule }) {
  const euros = Math.floor(addon.monthlyPrice / 100)
  const overageDisplay = formatOverage(addon)
  const includedDisplay = formatIncluded(addon)
  return (
    <Card variant="opaque" padding="sm" className="border-rule/60 space-y-2">
      <h4 className="text-sm font-semibold leading-tight">{addon.name}</h4>
      <p className="text-xs text-ink-mute leading-relaxed">{addon.description}</p>
      <div className="pt-1 flex items-baseline gap-2">
        <span className="text-lg font-extrabold tracking-tight">{euros}€</span>
        <span className="text-[10px] text-ink-mute uppercase tracking-wider">HT/mois</span>
      </div>
      {includedDisplay && (
        <p className="text-[11px] text-ink-mute">{includedDisplay}</p>
      )}
      {overageDisplay && (
        <p className="text-[11px] text-ink-faint">{overageDisplay}</p>
      )}
    </Card>
  )
}

function formatIncluded(addon: AddonModule): string | null {
  if (addon.includedQuantity === null) return 'Usage illimité inclus'
  const unit = addon.overageUnit ?? 'unité'
  return `${addon.includedQuantity} ${unit}${addon.includedQuantity > 1 ? 's' : ''} inclus/mois`
}

function formatOverage(addon: AddonModule): string | null {
  if (addon.overagePrice === null || addon.overageUnit === null) return null
  const euros = (addon.overagePrice / 100).toFixed(2).replace('.', ',')
  return `Au-delà : ${euros}€ / ${addon.overageUnit}`
}

// ─────────────────────────────────────────────
// Helper exporté pour des usages externes
// ─────────────────────────────────────────────

export function isAddonInPack(addonCode: AddonCode, pack: AddonPack): boolean {
  return pack.includedAddons.includes(addonCode)
}
