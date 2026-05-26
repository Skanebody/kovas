'use client'

/**
 * KOVAS — GC2 Mission Flow Continu : composant transition picker (Lot B83 scaffold).
 *
 * Liste les transitions sortantes possibles depuis la phase courante et permet
 * au diagnostiqueur de déclencher une transition. Toast success/error post-action.
 *
 * Consommé par <MissionFlowComposer>.
 *
 * SCAFFOLD MINIMAL — pas d'animation, pas de gestion d'erreur sophistiquée
 * (préconditions affichées brutes).
 *
 * Authority : CLAUDE.md Design System v5 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import { Button } from '@/components/ui/button'
import type { MissionFlowPhase } from '@/lib/mission-flow/state-machine'
import { phaseLabel } from '@/lib/mission-flow/state-machine'
import { cn } from '@/lib/utils'
import { ArrowRight, Loader2 } from 'lucide-react'
import { useTransition } from 'react'
import { toast } from 'sonner'

export interface AvailableTransition {
  /** Identifiant de la transition (ex: 'capture_terrain', sera passé à onTransition) */
  event: string
  /** Label humain affiché sur le bouton */
  label: string
  /** Phase d'arrivée (utilisé pour affichage UX seulement) */
  targetState: MissionFlowPhase
  /** Si true, désactivé visuellement (préconditions non satisfaites) */
  disabled?: boolean
}

interface MissionFlowTransitionPickerProps {
  /** Phase courante (affichage contextuel uniquement) */
  currentState: MissionFlowPhase
  /** Transitions sortantes possibles */
  availableTransitions: ReadonlyArray<AvailableTransition>
  /** Handler appelé avec l'event de la transition sélectionnée */
  onTransition: (event: string) => Promise<{ success: boolean; error?: string }>
  /** Si true, désactive tous les boutons (chargement externe) */
  loading?: boolean
}

export function MissionFlowTransitionPicker({
  currentState,
  availableTransitions,
  onTransition,
  loading = false,
}: MissionFlowTransitionPickerProps) {
  const [pending, startTransition] = useTransition()
  const isLoading = loading || pending

  function handleClick(event: string) {
    startTransition(async () => {
      const res = await onTransition(event)
      if (!res.success) {
        toast.error(res.error ?? 'Transition impossible.')
        return
      }
      toast.success('Phase mise à jour.')
    })
  }

  return (
    <section
      aria-label="Actions disponibles"
      className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 shadow-glass-sm"
    >
      <header className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
          Actions disponibles
        </p>
        <p className="mt-1 text-sm text-[#0F1419]/65">
          Depuis <span className="font-medium text-[#0F1419]">{phaseLabel(currentState)}</span>
        </p>
      </header>

      {availableTransitions.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#0F1419]/55">
          Aucune transition disponible depuis cette phase.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2">
          {availableTransitions.map((t) => (
            <li key={t.event}>
              <Button
                type="button"
                variant="outline"
                size="default"
                disabled={isLoading || t.disabled}
                onClick={() => handleClick(t.event)}
                className={cn('group w-full justify-between text-left', t.disabled && 'opacity-50')}
              >
                <span className="flex flex-col items-start gap-0.5">
                  <span className="text-[13px] font-medium text-[#0F1419]">{t.label}</span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                    → {phaseLabel(t.targetState)}
                  </span>
                </span>
                {isLoading ? (
                  <Loader2 aria-hidden className="size-4 animate-spin text-[#0F1419]/55" />
                ) : (
                  <ArrowRight
                    aria-hidden
                    className="size-4 text-[#0F1419]/55 transition-transform group-hover:translate-x-0.5"
                  />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
