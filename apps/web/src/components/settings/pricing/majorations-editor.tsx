/**
 * KOVAS — MajorationsEditor
 *
 * 3 inputs simples : urgence < 48h, weekend, soirée (€ HT forfait).
 * PUT /api/pricing/majorations au submit.
 */

'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import type { MajorationsConfig } from '@/lib/pricing/pricing-templates'
import { Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

interface MajorationsEditorProps {
  initial: MajorationsConfig
}

function toNumber(raw: string, fallback: number): number {
  const n = Number(raw.replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

export function MajorationsEditor({ initial }: MajorationsEditorProps) {
  const [urgency, setUrgency] = useState<string>(String(initial.urgency48h))
  const [weekend, setWeekend] = useState<string>(String(initial.weekend))
  const [evening, setEvening] = useState<string>(String(initial.evening))
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    const payload = {
      urgency48h: toNumber(urgency, initial.urgency48h),
      weekend: toNumber(weekend, initial.weekend),
      evening: toNumber(evening, initial.evening),
    }
    startTransition(async () => {
      const res = await fetch('/api/pricing/majorations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string }
        toast.error(error ?? 'Erreur enregistrement')
        return
      }
      toast.success('Majorations enregistrées')
    })
  }

  return (
    <Card variant="opaque" padding="default" className="space-y-5">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
          Majorations
        </p>
        <h3 className="text-[16px] font-semibold text-ink mt-1">Surcoûts ponctuels</h3>
        <p className="text-[12px] text-ink-mute mt-1">
          Forfaits HT cumulables ajoutés au prix indicatif selon le contexte.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField
          label="Urgence (< 48h)"
          htmlFor="majo-urgency"
          hint="Intervention sous 48h ouvrées"
        >
          <EuroInput id="majo-urgency" value={urgency} onChange={setUrgency} />
        </FormField>
        <FormField label="Weekend" htmlFor="majo-weekend" hint="Samedi ou dimanche">
          <EuroInput id="majo-weekend" value={weekend} onChange={setWeekend} />
        </FormField>
        <FormField label="Soirée" htmlFor="majo-evening" hint="Après 18h en semaine">
          <EuroInput id="majo-evening" value={evening} onChange={setEvening} />
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

function EuroInput({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-8"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-mute">€</span>
    </div>
  )
}
