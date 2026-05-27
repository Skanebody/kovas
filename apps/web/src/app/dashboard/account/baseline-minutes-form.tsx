'use client'

import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import {
  DEFAULT_BASELINE_MINUTES_PER_MISSION,
  MAX_BASELINE_MINUTES,
  MIN_BASELINE_MINUTES,
} from '@/lib/preferences/baseline-minutes'
import { Loader2, Timer } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'
import { type FormState, updateBaselineMinutesAction } from './actions'

interface BaselineMinutesFormProps {
  /**
   * Valeur actuelle stockée (en minutes). Si null/undefined, on initialise au
   * default 90 — l'utilisateur peut alors le modifier pour coller à sa
   * réalité.
   */
  initialMinutes: number | null
}

/**
 * Form pour configurer le temps moyen qu'un diagnostiqueur passait sur une
 * mission AVANT KOVAS. Utilisé par le widget Gain Tracker pour calculer le
 * temps économisé personnalisé.
 *
 * Spec : KOVAS_TABLEAU_DE_BORD §préambule (paramétrage par défaut modifiable).
 */
export function BaselineMinutesForm({ initialMinutes }: BaselineMinutesFormProps) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    updateBaselineMinutesAction,
    undefined,
  )

  const startValue = initialMinutes ?? DEFAULT_BASELINE_MINUTES_PER_MISSION
  const [value, setValue] = useState<number>(startValue)

  useEffect(() => {
    if (state?.success) toast.success('Temps moyen mis à jour')
    else if (state?.error) toast.error(state.error)
  }, [state])

  const hours = Math.floor(value / 60)
  const minutes = value % 60
  const humanLabel =
    hours > 0
      ? `Soit ${hours} h ${minutes > 0 ? `${minutes.toString().padStart(2, '0')} min` : ''}`
      : `Soit ${minutes} min`

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-rule bg-sage p-4">
        <Timer className="size-5 text-ink-mute shrink-0 mt-0.5" aria-hidden />
        <div className="text-sm text-ink-soft leading-relaxed">
          <p className="font-medium text-ink mb-1">À quoi sert ce paramètre ?</p>
          <p>
            On l'utilise pour calculer ton temps économisé sur le tableau de bord. Mets le temps que
            tu passais en moyenne par mission <strong>avant</strong> KOVAS (terrain + ressaisie
            Liciel/ORIS/OBBC). Par défaut : 1 h 30. Modifiable à tout moment.
          </p>
        </div>
      </div>

      <FormField
        label="Temps moyen par mission (en minutes)"
        htmlFor="baseline_minutes_per_mission"
      >
        <div className="flex items-center gap-3">
          <Input
            id="baseline_minutes_per_mission"
            name="baseline_minutes_per_mission"
            type="number"
            inputMode="numeric"
            min={MIN_BASELINE_MINUTES}
            max={MAX_BASELINE_MINUTES}
            step={5}
            value={value}
            onChange={(e) => setValue(Number(e.target.value) || 0)}
            className="max-w-[140px] tabular-nums"
          />
          <span className="font-mono text-xs text-ink-mute">min</span>
          <span className="text-sm text-ink-soft">·</span>
          <span className="text-sm text-ink-soft font-medium tabular-nums">{humanLabel}</span>
        </div>
      </FormField>

      <p className="text-xs text-ink-faint">
        Plage acceptée : entre {MIN_BASELINE_MINUTES} min et {MAX_BASELINE_MINUTES} min (4 h).
      </p>

      <Button type="submit" disabled={pending || value === startValue}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </Button>
    </form>
  )
}
