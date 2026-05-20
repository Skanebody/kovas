/**
 * KOVAS — VatSettingsEditor
 *
 * Édite le statut TVA (with_vat / franchise_vat) + taux + mode d'affichage.
 * PUT sur /api/pricing/vat-settings au submit.
 *
 * Preview live : montre 100 € HT → 120 € TTC (ou variant selon displayMode).
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

type VatStatus = 'with_vat' | 'franchise_vat'
type DisplayMode = 'ht_and_ttc' | 'ttc_only' | 'ht_only'

interface VatSettingsEditorProps {
  initial: {
    vatStatus: VatStatus
    vatRate: number
    displayMode: DisplayMode
  }
}

const DISPLAY_LABELS: Record<DisplayMode, string> = {
  ht_and_ttc: 'HT et TTC',
  ttc_only: 'TTC uniquement',
  ht_only: 'HT uniquement',
}

function formatEur(n: number): string {
  if (Number.isInteger(n)) return `${n} €`
  return `${n.toFixed(2).replace('.', ',')} €`
}

export function VatSettingsEditor({ initial }: VatSettingsEditorProps) {
  const [vatStatus, setVatStatus] = useState<VatStatus>(initial.vatStatus)
  const [vatRate, setVatRate] = useState<string>(String(Math.round(initial.vatRate * 100)))
  const [displayMode, setDisplayMode] = useState<DisplayMode>(initial.displayMode)
  const [pending, startTransition] = useTransition()

  // Preview : 100 € HT comme base normalisée
  const previewHt = 100
  const numericRate = (() => {
    const n = Number(vatRate.replace(',', '.').trim())
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : initial.vatRate
  })()
  const previewTtc = vatStatus === 'with_vat' ? previewHt * (1 + numericRate) : previewHt

  function handleSubmit() {
    const rateNumber = Number(vatRate.replace(',', '.').trim())
    if (!Number.isFinite(rateNumber) || rateNumber < 0 || rateNumber > 100) {
      toast.error('Taux TVA invalide (0–100)')
      return
    }
    startTransition(async () => {
      const res = await fetch('/api/pricing/vat-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vatStatus,
          vatRate: rateNumber / 100,
          displayMode,
        }),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur enregistrement')
        return
      }
      toast.success('Paramètres TVA enregistrés')
    })
  }

  const isWithVat = vatStatus === 'with_vat'

  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          TVA & affichage
        </p>
        <h3 className="text-[16px] font-semibold text-ink mt-1">Statut TVA</h3>
      </div>

      {/* Radios with_vat / franchise_vat */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setVatStatus('with_vat')}
          className={cn(
            'text-left rounded-lg border p-3 transition-all',
            isWithVat
              ? 'border-navy bg-navy/[0.04]'
              : 'border-rule/80 hover:border-rule bg-paper/60',
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'size-3.5 rounded-full border-2 flex items-center justify-center',
                isWithVat ? 'border-navy' : 'border-rule',
              )}
            >
              {isWithVat && <span className="size-1.5 rounded-full bg-navy" />}
            </span>
            <span className="text-[13px] font-semibold text-ink">Assujetti à la TVA</span>
          </div>
          <p className="text-[11px] text-ink-mute pl-5">Taux normal 20% par défaut.</p>
        </button>
        <button
          type="button"
          onClick={() => setVatStatus('franchise_vat')}
          className={cn(
            'text-left rounded-lg border p-3 transition-all',
            !isWithVat
              ? 'border-navy bg-navy/[0.04]'
              : 'border-rule/80 hover:border-rule bg-paper/60',
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span
              className={cn(
                'size-3.5 rounded-full border-2 flex items-center justify-center',
                !isWithVat ? 'border-navy' : 'border-rule',
              )}
            >
              {!isWithVat && <span className="size-1.5 rounded-full bg-navy" />}
            </span>
            <span className="text-[13px] font-semibold text-ink">Franchise en base</span>
          </div>
          <p className="text-[11px] text-ink-mute pl-5">Art. 293 B du CGI — TVA non applicable.</p>
        </button>
      </div>

      {/* Taux + display mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField
          label="Taux de TVA"
          htmlFor="vat-rate"
          hint={isWithVat ? 'En %. Standard FR : 20.' : 'Inutilisé en franchise.'}
        >
          <div className="relative">
            <Input
              id="vat-rate"
              type="text"
              inputMode="decimal"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              disabled={!isWithVat}
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">
              %
            </span>
          </div>
        </FormField>

        <FormField
          label="Mode d'affichage des prix"
          htmlFor="display-mode"
          hint="Comment afficher les estimations indicatives."
        >
          <Select
            id="display-mode"
            value={displayMode}
            onChange={(e) => setDisplayMode(e.target.value as DisplayMode)}
          >
            <option value="ht_and_ttc">{DISPLAY_LABELS.ht_and_ttc}</option>
            <option value="ttc_only">{DISPLAY_LABELS.ttc_only}</option>
            <option value="ht_only">{DISPLAY_LABELS.ht_only}</option>
          </Select>
        </FormField>
      </div>

      {/* Preview */}
      <div className="rounded-md bg-cream-deep/60 p-3 space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
          Aperçu sur un prix de référence
        </p>
        <p className="text-[13px] text-ink">
          {displayMode === 'ttc_only' && (
            <>
              <span className="font-mono font-semibold tabular-nums">{formatEur(previewTtc)}</span>{' '}
              <span className="text-ink-mute">TTC</span>
            </>
          )}
          {displayMode === 'ht_only' && (
            <>
              <span className="font-mono font-semibold tabular-nums">{formatEur(previewHt)}</span>{' '}
              <span className="text-ink-mute">HT</span>
            </>
          )}
          {displayMode === 'ht_and_ttc' && (
            <>
              <span className="font-mono font-semibold tabular-nums">{formatEur(previewHt)}</span>{' '}
              <span className="text-ink-mute">HT</span>
              {isWithVat && (
                <>
                  {' · '}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatEur(previewTtc)}
                  </span>{' '}
                  <span className="text-ink-mute">TTC</span>
                </>
              )}
            </>
          )}
        </p>
        {!isWithVat && (
          <p className="text-[11px] italic text-ink-mute">TVA non applicable, art. 293 B du CGI</p>
        )}
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
