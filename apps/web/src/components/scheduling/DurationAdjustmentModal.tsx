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
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { useEffect, useState } from 'react'

const MIN_DURATION_MIN = 15
const MAX_DURATION_MIN = 480

interface DurationAdjustmentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Durée actuelle (forcée ou estimée). */
  currentMinutes: number
  /** Estimation auto sous-jacente — utilisée par "Réinitialiser". */
  autoEstimateMinutes: number
  /** Confirmé : null = revenir à l'auto, number = force. */
  onConfirm: (forcedMinutes: number | null) => void
}

/**
 * Modal de réajustement manuel de la durée d'une mission.
 *
 * Cas d'usage : l'utilisateur sait que cette copro est exceptionnelle (cave
 * partagée, accès difficile) et veut forcer 2h30 au lieu des 1h45 estimées.
 * Le `forced_duration_min` écrase `estimated_duration_min` côté DB.
 *
 * "Réinitialiser" repasse à `null` (auto-estimation à chaque submit).
 */
export function DurationAdjustmentModal({
  open,
  onOpenChange,
  currentMinutes,
  autoEstimateMinutes,
  onConfirm,
}: DurationAdjustmentModalProps) {
  const [value, setValue] = useState<string>(String(currentMinutes))

  // Re-sync quand on rouvre le modal (la durée a peut-être bougé entre temps)
  useEffect(() => {
    if (open) setValue(String(currentMinutes))
  }, [open, currentMinutes])

  function handleConfirm() {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isFinite(parsed)) return
    const clamped = Math.max(MIN_DURATION_MIN, Math.min(MAX_DURATION_MIN, parsed))
    onConfirm(clamped)
    onOpenChange(false)
  }

  function handleReset() {
    onConfirm(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ajuster la durée manuellement</DialogTitle>
          <DialogDescription>
            La durée forcée remplace l&apos;estimation automatique pour ce dossier uniquement.
            Estimation auto : <span className="font-mono">{autoEstimateMinutes} min</span>.
          </DialogDescription>
        </DialogHeader>

        <FormField
          label="Durée totale (minutes)"
          htmlFor="forced-duration"
          hint={`Min ${MIN_DURATION_MIN} min, max ${MAX_DURATION_MIN / 60}h`}
        >
          <Input
            id="forced-duration"
            type="number"
            inputMode="numeric"
            min={MIN_DURATION_MIN}
            max={MAX_DURATION_MIN}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </FormField>

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
            Réinitialiser
          </Button>
          <Button type="button" variant="accent" size="sm" onClick={handleConfirm}>
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
