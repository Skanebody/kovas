/**
 * KOVAS — PriceAdjustmentModal
 *
 * Modal Radix Dialog permettant d'overrider ponctuellement le prix HT de
 * chaque ligne `PriceLineItem` (ainsi que travel fees et majorations).
 * N'écrit RIEN en base — les overrides sont remontés via `onApply` à
 * l'appelant qui décidera de l'usage (devis ponctuel, snapshot...).
 */

'use client'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { PriceLineItem } from '@/lib/pricing/pricing-calculator'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'

const DIAGNOSTIC_LABEL: Record<string, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb (CREP)',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Carrez',
  BOUTIN: 'Boutin',
  ERP: 'ERP',
}

export interface PriceAdjustmentOverrides {
  itemizedOverrides: Record<string, number>
  travelFeesOverride: number | null
  majorationsOverride: number | null
}

interface PriceAdjustmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemizedPrices: PriceLineItem[]
  travelFeesHt: number
  majorationsHt: number
  /** Overrides initiaux (édition d'une session existante). Optionnel. */
  initialOverrides?: PriceAdjustmentOverrides
  /** Callback déclenché au clic "Appliquer". */
  onApply: (overrides: PriceAdjustmentOverrides) => void | Promise<void>
}

function parseNumber(raw: string, fallback: number): number {
  const cleaned = raw.replace(',', '.').trim()
  if (cleaned === '') return fallback
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function PriceAdjustmentModal({
  open,
  onOpenChange,
  itemizedPrices,
  travelFeesHt,
  majorationsHt,
  initialOverrides,
  onApply,
}: PriceAdjustmentModalProps) {
  // Map diag → string (état contrôlé, virgule autorisée FR).
  const [items, setItems] = useState<Record<string, string>>({})
  const [travel, setTravel] = useState<string>('')
  const [majo, setMajo] = useState<string>('')
  const [busy, setBusy] = useState(false)

  // Rehydrate à chaque ouverture pour repartir des valeurs courantes.
  useEffect(() => {
    if (!open) return
    const initialItems: Record<string, string> = {}
    for (const line of itemizedPrices) {
      const override = initialOverrides?.itemizedOverrides[line.diagnostic]
      initialItems[line.diagnostic] = String(override ?? line.priceHt)
    }
    setItems(initialItems)
    setTravel(String(initialOverrides?.travelFeesOverride ?? travelFeesHt))
    setMajo(String(initialOverrides?.majorationsOverride ?? majorationsHt))
    setBusy(false)
  }, [open, itemizedPrices, travelFeesHt, majorationsHt, initialOverrides])

  function handleApply() {
    const itemizedOverrides: Record<string, number> = {}
    for (const line of itemizedPrices) {
      itemizedOverrides[line.diagnostic] = parseNumber(items[line.diagnostic] ?? '', line.priceHt)
    }
    const payload: PriceAdjustmentOverrides = {
      itemizedOverrides,
      travelFeesOverride: parseNumber(travel, travelFeesHt),
      majorationsOverride: parseNumber(majo, majorationsHt),
    }

    const result = onApply(payload)
    if (result && typeof (result as Promise<void>).then === 'function') {
      setBusy(true)
      ;(result as Promise<void>).then(() => onOpenChange(false)).finally(() => setBusy(false))
    } else {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajuster le prix indicatif</DialogTitle>
          <DialogDescription>
            Override ponctuel — ne modifie pas ta grille tarifaire.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-[55vh] overflow-y-auto py-2">
          {/* Diagnostics itemized */}
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
              Diagnostics
            </p>
            {itemizedPrices.map((line) => (
              <div key={line.diagnostic} className="grid grid-cols-[1fr,auto] items-center gap-3">
                <Label htmlFor={`adj-${line.diagnostic}`} className="text-[13px]">
                  {DIAGNOSTIC_LABEL[line.diagnostic] ?? line.diagnostic}
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`adj-${line.diagnostic}`}
                    type="text"
                    inputMode="decimal"
                    value={items[line.diagnostic] ?? ''}
                    onChange={(e) =>
                      setItems((prev) => ({ ...prev, [line.diagnostic]: e.target.value }))
                    }
                    className="w-24 text-right font-mono text-[12px]"
                  />
                  <span className="text-[11px] text-ink-mute">€ HT</span>
                </div>
              </div>
            ))}
          </div>

          {/* Travel fees */}
          <div className="grid grid-cols-[1fr,auto] items-center gap-3 pt-3 border-t border-rule/60">
            <Label htmlFor="adj-travel" className="text-[13px]">
              Déplacement
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="adj-travel"
                type="text"
                inputMode="decimal"
                value={travel}
                onChange={(e) => setTravel(e.target.value)}
                className="w-24 text-right font-mono text-[12px]"
              />
              <span className="text-[11px] text-ink-mute">€ HT</span>
            </div>
          </div>

          {/* Majorations */}
          <div className="grid grid-cols-[1fr,auto] items-center gap-3">
            <Label htmlFor="adj-majo" className="text-[13px]">
              Majorations
            </Label>
            <div className="flex items-center gap-1.5">
              <Input
                id="adj-majo"
                type="text"
                inputMode="decimal"
                value={majo}
                onChange={(e) => setMajo(e.target.value)}
                className="w-24 text-right font-mono text-[12px]"
              />
              <span className="text-[11px] text-ink-mute">€ HT</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={busy}>
            Annuler
          </Button>
          <Button variant="default" size="sm" onClick={handleApply} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Appliquer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
