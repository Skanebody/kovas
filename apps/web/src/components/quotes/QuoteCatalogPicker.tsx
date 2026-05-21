'use client'

/**
 * KOVAS — Dropdown intelligent pour ajouter une prestation au wizard devis.
 *
 * 3 sous-menus :
 *   1. Diagnostics à l'unité (depuis pricing_config.diagnostics)
 *   2. Packs custom de l'user (depuis user_pricing_packs)
 *   3. Ligne libre (modal saisie manuelle)
 *
 * Si pricing_config n'est pas renseigné, le diagnostic est ajouté à 0 €
 * et l'user édite manuellement.
 */

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  buildCustomLine,
  buildDiagnosticLine,
  buildPackLine,
} from '@/lib/quotes/build-pricing-line'
import type {
  DiagnosticPricing,
  PricingDiagnosticType,
  PropertyType,
} from '@/lib/pricing/pricing-templates'
import {
  QUOTE_DIAGNOSTIC_LABELS,
  type QuoteDiagnosticType,
  type QuoteLineItem,
} from '@/lib/quotes/types'
import { Plus } from 'lucide-react'
import { useState } from 'react'

export interface PricingPackOption {
  id: string
  name: string
  diagnostics: PricingDiagnosticType[]
  priceHt: number
}

export interface QuoteCatalogPickerProps {
  /** Map des prix configurés par diagnostic (depuis pricing_config.diagnostics). */
  diagnosticsPricing: Partial<Record<QuoteDiagnosticType, DiagnosticPricing>>
  /** Packs de l'user. */
  packs: PricingPackOption[]
  /** Type bien sélectionné dans le wizard (pour modulation). */
  propertyType: PropertyType | null
  /** Surface bien (pour modulation). */
  surface: number | null
  /** Taux TVA applicable (depuis pricing_config). */
  tvaRate: number
  /** Callback à l'ajout. */
  onAdd: (line: QuoteLineItem) => void
}

const ALL_DIAGNOSTICS: QuoteDiagnosticType[] = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'BOUTIN',
  'ERP',
]

export function QuoteCatalogPicker({
  diagnosticsPricing,
  packs,
  propertyType,
  surface,
  tvaRate,
  onAdd,
}: QuoteCatalogPickerProps) {
  const [customOpen, setCustomOpen] = useState(false)
  const [customForm, setCustomForm] = useState({
    designation: '',
    quantity: '1',
    unitPriceHt: '0',
    tvaRate: String(tvaRate),
  })

  function addDiagnostic(diag: QuoteDiagnosticType) {
    const pricing = diagnosticsPricing[diag] ?? null
    onAdd(
      buildDiagnosticLine({
        diagnostic: diag,
        pricing,
        propertyType,
        surface,
        tvaRate,
      }),
    )
  }

  function addPack(pack: PricingPackOption) {
    onAdd(
      buildPackLine({
        packId: pack.id,
        packName: pack.name,
        packDiagnostics: pack.diagnostics,
        packPriceHt: pack.priceHt,
        tvaRate,
      }),
    )
  }

  function submitCustom() {
    const qty = Number.parseFloat(customForm.quantity.replace(',', '.'))
    const pu = Number.parseFloat(customForm.unitPriceHt.replace(',', '.'))
    const tva = Number.parseFloat(customForm.tvaRate.replace(',', '.'))
    if (!customForm.designation.trim() || !Number.isFinite(qty) || !Number.isFinite(pu)) {
      return
    }
    onAdd(
      buildCustomLine({
        designation: customForm.designation.trim(),
        quantity: qty,
        unitPriceHt: pu,
        tvaRate: Number.isFinite(tva) ? tva : tvaRate,
      }),
    )
    setCustomForm({
      designation: '',
      quantity: '1',
      unitPriceHt: '0',
      tvaRate: String(tvaRate),
    })
    setCustomOpen(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="accent" size="sm" type="button">
            <Plus className="size-4" />
            Ajouter une prestation
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 max-h-[420px] overflow-y-auto">
          <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
            Diagnostics à l&apos;unité
          </DropdownMenuLabel>
          {ALL_DIAGNOSTICS.map((diag) => {
            const pricing = diagnosticsPricing[diag]
            const priceLabel = pricing
              ? `${pricing.basePrice} € HT`
              : 'à configurer'
            return (
              <DropdownMenuItem
                key={diag}
                onSelect={() => addDiagnostic(diag)}
                className="flex items-center justify-between"
              >
                <span>{QUOTE_DIAGNOSTIC_LABELS[diag]}</span>
                <span className="font-mono text-[10px] text-ink-mute">{priceLabel}</span>
              </DropdownMenuItem>
            )
          })}

          {packs.length > 0 ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-wider text-ink-mute">
                Vos packs
              </DropdownMenuLabel>
              {packs.map((pack) => (
                <DropdownMenuItem
                  key={pack.id}
                  onSelect={() => addPack(pack)}
                  className="flex items-center justify-between"
                >
                  <span className="truncate">{pack.name}</span>
                  <span className="font-mono text-[10px] text-ink-mute shrink-0">
                    {pack.priceHt} € HT
                  </span>
                </DropdownMenuItem>
              ))}
            </>
          ) : null}

          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCustomOpen(true)}>
            <span>Ligne libre…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligne libre</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="custom-designation">Désignation</Label>
              <Input
                id="custom-designation"
                value={customForm.designation}
                onChange={(e) =>
                  setCustomForm((prev) => ({ ...prev, designation: e.target.value }))
                }
                placeholder="ex : Métré complémentaire"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="custom-qty">Quantité</Label>
                <Input
                  id="custom-qty"
                  type="number"
                  min={1}
                  value={customForm.quantity}
                  onChange={(e) =>
                    setCustomForm((prev) => ({ ...prev, quantity: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-pu">PU HT (€)</Label>
                <Input
                  id="custom-pu"
                  type="text"
                  inputMode="decimal"
                  value={customForm.unitPriceHt}
                  onChange={(e) =>
                    setCustomForm((prev) => ({ ...prev, unitPriceHt: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="custom-tva">TVA (%)</Label>
                <Input
                  id="custom-tva"
                  type="text"
                  inputMode="decimal"
                  value={customForm.tvaRate}
                  onChange={(e) =>
                    setCustomForm((prev) => ({ ...prev, tvaRate: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setCustomOpen(false)}>
              Annuler
            </Button>
            <Button type="button" variant="accent" onClick={submitCustom}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
