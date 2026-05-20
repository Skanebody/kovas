/**
 * KOVAS — TravelFeesEditor
 *
 * Édite les 3 paramètres de frais de déplacement :
 *   - includedRadiusKm     : rayon inclus dans le tarif de base (km)
 *   - pricePerKmBeyond     : € HT / km au-delà
 *   - capAmount            : plafond global € HT
 *
 * PUT /api/pricing/travel-fees au submit.
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import type { TravelFeesConfig } from '@/lib/pricing/pricing-templates'
import { Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

interface TravelFeesEditorProps {
  initial: TravelFeesConfig
}

function toNumber(raw: string, fallback: number): number {
  const n = Number(raw.replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function TravelFeesEditor({ initial }: TravelFeesEditorProps) {
  const [includedRadius, setIncludedRadius] = useState<string>(String(initial.includedRadiusKm))
  const [pricePerKm, setPricePerKm] = useState<string>(String(initial.pricePerKmBeyond))
  const [cap, setCap] = useState<string>(String(initial.capAmount))
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    const payload = {
      includedRadiusKm: toNumber(includedRadius, initial.includedRadiusKm),
      pricePerKmBeyond: toNumber(pricePerKm, initial.pricePerKmBeyond),
      capAmount: toNumber(cap, initial.capAmount),
    }
    startTransition(async () => {
      const res = await fetch('/api/pricing/travel-fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur enregistrement')
        return
      }
      toast.success('Frais de déplacement enregistrés')
    })
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          Déplacement
        </p>
        <h3 className="text-[16px] font-semibold text-ink mt-1">Frais kilométriques</h3>
        <p className="text-[12px] text-ink-mute mt-1">
          Zone incluse dans le tarif de base, puis facturation au km au-delà avec plafond global.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          label="Rayon inclus"
          htmlFor="travel-radius"
          hint="km depuis ton point de départ"
        >
          <div className="relative">
            <Input
              id="travel-radius"
              type="text"
              inputMode="decimal"
              value={includedRadius}
              onChange={(e) => setIncludedRadius(e.target.value)}
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">
              km
            </span>
          </div>
        </FormField>

        <FormField label="Prix au km" htmlFor="travel-price" hint="€ HT par km au-delà">
          <div className="relative">
            <Input
              id="travel-price"
              type="text"
              inputMode="decimal"
              value={pricePerKm}
              onChange={(e) => setPricePerKm(e.target.value)}
              className="pr-14"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">
              € /km
            </span>
          </div>
        </FormField>

        <FormField label="Plafond" htmlFor="travel-cap" hint="€ HT max total déplacement">
          <div className="relative">
            <Input
              id="travel-cap"
              type="text"
              inputMode="decimal"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">
              €
            </span>
          </div>
        </FormField>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSubmit} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </Card>
  )
}
