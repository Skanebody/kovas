'use client'

/**
 * KOVAS — <CreateFollowUpDialog>
 *
 * Dialog réutilisable pour créer une séquence de relance depuis :
 *   - /app/devis/[id] (target = quote)
 *   - /app/factures/[id] (target = invoice)
 *   - /app/dossiers/[id] (target = mission post-DPE F/G, V1.5+)
 *
 * 3 presets : Standard / Soft / Insistant.
 * Submit → createFollowUpSequenceAction → toast + router.refresh.
 *
 * DS v5 : Card opaque radius 24 implicit via Dialog, font-mono pour références,
 * font-serif italic pour titre, ton SOBRE professionnel.
 */

import { createFollowUpSequenceAction } from '@/app/dashboard/relances/actions'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

export type FollowUpDialogTargetType = 'quote' | 'invoice' | 'mission'
export type FollowUpDialogPreset = 'standard' | 'soft' | 'insistant'

interface PresetInfo {
  key: FollowUpDialogPreset
  label: string
  cadence: string
  description: string
}

const PRESETS_QUOTE: PresetInfo[] = [
  {
    key: 'standard',
    label: 'Standard',
    cadence: 'J+7 · J+14 · J+21',
    description: 'Cadence équilibrée pour relancer un devis envoyé sans réponse.',
  },
  {
    key: 'soft',
    label: 'Soft',
    cadence: 'J+10 · J+20 · J+30',
    description: 'Rythme plus espacé — prospects exigeants, B2B grandes structures.',
  },
  {
    key: 'insistant',
    label: 'Insistant',
    cadence: 'J+3 · J+7 · J+14',
    description: 'Cadence resserrée — opportunités chaudes à transformer rapidement.',
  },
]

const PRESETS_INVOICE: PresetInfo[] = [
  {
    key: 'standard',
    label: 'Standard',
    cadence: 'J+7 · J+15 · J+30',
    description: 'Relance amiable progressive avant mise en demeure éventuelle.',
  },
  {
    key: 'soft',
    label: 'Soft',
    cadence: 'J+10 · J+20 · J+30',
    description: 'Pour clients de confiance — ton conciliant.',
  },
  {
    key: 'insistant',
    label: 'Insistant',
    cadence: 'J+3 · J+7 · J+14',
    description: 'Pré-mise en demeure pour facture en retard avéré.',
  },
]

const PRESETS_MISSION: PresetInfo[] = [
  {
    key: 'standard',
    label: 'Standard',
    cadence: 'J+14 · J+90',
    description: 'Suivi opportunité travaux post-DPE F/G — cadence sobre.',
  },
  {
    key: 'soft',
    label: 'Soft',
    cadence: 'J+21 · J+90',
    description: 'Rythme très espacé — respect du temps de réflexion client.',
  },
  {
    key: 'insistant',
    label: 'Insistant',
    cadence: 'J+7 · J+21 · J+51',
    description: 'Opportunité chaude à convertir rapidement (ex. F/G + travaux urgents).',
  },
]

function getPresets(target: FollowUpDialogTargetType): PresetInfo[] {
  switch (target) {
    case 'quote':
      return PRESETS_QUOTE
    case 'invoice':
      return PRESETS_INVOICE
    case 'mission':
      return PRESETS_MISSION
  }
}

function targetLabel(target: FollowUpDialogTargetType): string {
  switch (target) {
    case 'quote':
      return 'le devis'
    case 'invoice':
      return 'la facture'
    case 'mission':
      return 'la mission'
  }
}

export interface CreateFollowUpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetType: FollowUpDialogTargetType
  targetId: string
  targetReference: string
}

export function CreateFollowUpDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetReference,
}: CreateFollowUpDialogProps) {
  const router = useRouter()
  const [preset, setPreset] = useState<FollowUpDialogPreset>('standard')
  const [isPending, startTransition] = useTransition()
  const presets = getPresets(targetType)

  function handleSubmit() {
    startTransition(async () => {
      const result = await createFollowUpSequenceAction({
        targetType,
        targetId,
        preset,
      })
      if (!result.success) {
        toast.error(result.error ?? 'Création impossible.')
        return
      }
      const nextDate = result.nextActionAt
        ? new Date(result.nextActionAt).toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: 'long',
          })
        : null
      toast.success(
        nextDate
          ? `Séquence de relance créée — premier envoi le ${nextDate}.`
          : 'Séquence de relance créée.',
      )
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-serif italic font-normal text-2xl">
            Activer une séquence de relance
          </DialogTitle>
          <DialogDescription>
            Pour {targetLabel(targetType)}{' '}
            <span className="font-mono text-ink">{targetReference}</span>. Choisis la cadence
            appropriée — tu pourras mettre en pause ou annuler à tout moment depuis{' '}
            <span className="text-ink">Tes relances</span>.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="sr-only">Choisir un preset de séquence</legend>
          {presets.map((p) => {
            const selected = preset === p.key
            return (
              <label
                key={p.key}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors',
                  selected
                    ? 'border-navy bg-navy/[0.04] ring-2 ring-navy/30'
                    : 'border-rule/60 hover:border-rule hover:bg-ink/[0.02]',
                )}
              >
                <input
                  type="radio"
                  name="followup-preset"
                  value={p.key}
                  checked={selected}
                  onChange={() => setPreset(p.key)}
                  className="mt-0.5 size-4 accent-navy"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="font-semibold text-ink">{p.label}</p>
                    <span className="font-mono text-[11px] uppercase tracking-wide text-ink-mute">
                      {p.cadence}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-soft mt-1">{p.description}</p>
                </div>
              </label>
            )
          })}
        </fieldset>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPending}>
            Annuler
          </Button>
          <Button variant="accent" onClick={handleSubmit} disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Activer la séquence
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
