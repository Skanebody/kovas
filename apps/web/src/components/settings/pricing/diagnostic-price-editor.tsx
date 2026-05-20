/**
 * KOVAS — DiagnosticPriceEditor
 *
 * Éditeur pour UN type de diagnostic :
 *   - basePrice (€ HT)
 *   - 5 modulations (studio / appartement / grandAppartement / maison / grandeMaison)
 *
 * Preview HT + TTC inline pour la modulation `appartement` (= 1.0x pivot).
 * PUT /api/pricing/diagnostic-prices avec updates partiel ciblé sur ce diag.
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import type {
  DiagnosticModulations,
  DiagnosticPricing,
  PricingDiagnosticType,
} from '@/lib/pricing/pricing-templates'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

const DIAGNOSTIC_META: Record<PricingDiagnosticType, { label: string; pastel: string }> = {
  DPE: { label: 'DPE', pastel: 'bg-orange-mist' },
  AMIANTE: { label: 'Amiante', pastel: 'bg-coral-mist' },
  PLOMB: { label: 'Plomb (CREP)', pastel: 'bg-coral-mist' },
  GAZ: { label: 'Gaz', pastel: 'bg-blue-mist' },
  ELEC: { label: 'Électricité', pastel: 'bg-lime-mist' },
  TERMITES: { label: 'Termites', pastel: 'bg-coral-mist' },
  CARREZ: { label: 'Carrez', pastel: 'bg-blue-mist' },
  BOUTIN: { label: 'Boutin', pastel: 'bg-blue-mist' },
  ERP: { label: 'ERP', pastel: 'bg-orange-mist' },
}

const MODULATION_LABELS: { key: keyof DiagnosticModulations; label: string; hint: string }[] = [
  { key: 'studio', label: 'Studio', hint: '< 30 m²' },
  { key: 'appartement', label: 'Appartement', hint: '30–80 m² (pivot 1×)' },
  { key: 'grandAppartement', label: 'Grand apt', hint: '80–130 m²' },
  { key: 'maison', label: 'Maison', hint: 'jusqu’à ~150 m²' },
  { key: 'grandeMaison', label: 'Grande maison', hint: '> 150 m²' },
]

interface DiagnosticPriceEditorProps {
  diagnostic: PricingDiagnosticType
  initial: DiagnosticPricing
  vatRate: number
  vatApplicable: boolean
}

function toNumber(raw: string, fallback: number): number {
  const n = Number(raw.replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function formatEur(n: number): string {
  if (Number.isInteger(n)) return `${n} €`
  return `${n.toFixed(2).replace('.', ',')} €`
}

export function DiagnosticPriceEditor({
  diagnostic,
  initial,
  vatRate,
  vatApplicable,
}: DiagnosticPriceEditorProps) {
  const meta = DIAGNOSTIC_META[diagnostic]
  const [basePrice, setBasePrice] = useState<string>(String(initial.basePrice))
  const [modulations, setModulations] = useState<Record<keyof DiagnosticModulations, string>>({
    studio: String(initial.modulations.studio),
    appartement: String(initial.modulations.appartement),
    grandAppartement: String(initial.modulations.grandAppartement),
    maison: String(initial.modulations.maison),
    grandeMaison: String(initial.modulations.grandeMaison),
  })
  const [pending, startTransition] = useTransition()

  const numericBase = toNumber(basePrice, initial.basePrice)
  const previewHt = numericBase * toNumber(modulations.appartement, initial.modulations.appartement)
  const previewTtc = vatApplicable ? previewHt * (1 + vatRate) : previewHt

  function handleSubmit() {
    const parsedMods: DiagnosticModulations = {
      studio: toNumber(modulations.studio, initial.modulations.studio),
      appartement: toNumber(modulations.appartement, initial.modulations.appartement),
      grandAppartement: toNumber(
        modulations.grandAppartement,
        initial.modulations.grandAppartement,
      ),
      maison: toNumber(modulations.maison, initial.modulations.maison),
      grandeMaison: toNumber(modulations.grandeMaison, initial.modulations.grandeMaison),
    }
    const payload = {
      updates: {
        [diagnostic]: {
          basePrice: numericBase,
          modulations: parsedMods,
        },
      },
    }
    startTransition(async () => {
      const res = await fetch('/api/pricing/diagnostic-prices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur enregistrement')
        return
      }
      toast.success(`${meta.label} — tarif enregistré`)
    })
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-semibold font-mono uppercase tracking-[0.05em] text-ink',
              meta.pastel,
            )}
          >
            {meta.label}
          </span>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
            Aperçu apt. type
          </p>
          <p className="text-[13px] font-mono tabular-nums text-ink">
            {formatEur(previewHt)} HT
            {vatApplicable && (
              <>
                <span className="text-ink-faint"> · </span>
                {formatEur(previewTtc)} TTC
              </>
            )}
          </p>
        </div>
      </div>

      <FormField
        label="Prix de base"
        htmlFor={`base-${diagnostic}`}
        hint="€ HT, sur appartement standard 30-80 m²"
      >
        <div className="relative max-w-[180px]">
          <Input
            id={`base-${diagnostic}`}
            type="text"
            inputMode="decimal"
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            className="pr-10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">
            € HT
          </span>
        </div>
      </FormField>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
          Modulations (multiplicateurs)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {MODULATION_LABELS.map(({ key, label, hint }) => (
            <div key={key} className="space-y-1">
              <label
                htmlFor={`mod-${diagnostic}-${key}`}
                className="block text-[11px] font-semibold text-ink"
              >
                {label}
              </label>
              <Input
                id={`mod-${diagnostic}-${key}`}
                type="text"
                inputMode="decimal"
                value={modulations[key]}
                onChange={(e) => setModulations((prev) => ({ ...prev, [key]: e.target.value }))}
                className="text-center font-mono text-[12px]"
              />
              <p className="text-[10px] text-ink-faint">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={handleSubmit} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </Card>
  )
}
