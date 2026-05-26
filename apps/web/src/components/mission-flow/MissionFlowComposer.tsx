'use client'

/**
 * KOVAS — GC2 Mission Flow Continu : composer racine (Lot B83 scaffold).
 *
 * Assemble <MissionFlowTimeline> + <MissionFlowTransitionPicker> + header
 * d'état métier dans un layout 2 colonnes (sticky right sidebar sur lg,
 * stacked sur mobile).
 *
 * Reçoit une server action pré-bindée pour déclencher les transitions via la
 * RPC `mission_flow_transition`.
 *
 * SCAFFOLD MINIMAL — pas d'animation des changements d'état, pas de
 * Realtime subscription. Le founder validera l'archi avant.
 *
 * Authority : CLAUDE.md Design System v5 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import type { MissionFlowPhase } from '@/lib/mission-flow/state-machine'
import {
  nextPossibleTransitions,
  phaseLabel,
  progressPercent,
} from '@/lib/mission-flow/state-machine'
import { cn } from '@/lib/utils'
import { type MissionFlowEvent, MissionFlowTimeline } from './MissionFlowTimeline'
import {
  type AvailableTransition,
  MissionFlowTransitionPicker,
} from './MissionFlowTransitionPicker'

interface MissionFlowComposerProps {
  /** ID de la mission (passé tel quel à la server action) */
  missionId: string
  /** Référence dossier affichée dans le header (ex: DOS-2026-001) */
  dossierReference?: string
  /** Phase courante chargée côté server */
  initialState: MissionFlowPhase
  /** Historique d'événements pré-chargé côté server */
  initialEventHistory: ReadonlyArray<MissionFlowEvent>
  /** Server action handler — appelée avec la phase d'arrivée */
  onTransition: (
    missionId: string,
    targetPhase: MissionFlowPhase,
  ) => Promise<{ success: boolean; error?: string }>
}

export function MissionFlowComposer({
  missionId,
  dossierReference,
  initialState,
  initialEventHistory,
  onTransition,
}: MissionFlowComposerProps) {
  // Calcule les transitions disponibles depuis l'état courant.
  // Pure-fn de state-machine.ts → pas de side effect.
  const transitions = nextPossibleTransitions(initialState)
  const availableTransitions: AvailableTransition[] = transitions.map((t) => ({
    event: t.to,
    label: t.label,
    targetState: t.to,
  }))

  const availableTransitionsCodes = availableTransitions.map((t) => t.event)
  const progress = progressPercent(initialState)

  async function handleTransition(event: string) {
    // L'event est la phase cible (cf. mapping ci-dessus).
    return onTransition(missionId, event as MissionFlowPhase)
  }

  return (
    <div className="space-y-6">
      {/* Header d'état métier — sobre, en haut */}
      <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-5 shadow-glass-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              {dossierReference ? `Dossier ${dossierReference}` : 'Mission'}
            </p>
            <h2 className="mt-1 text-xl font-medium text-[#0F1419]">
              Phase : <span className="font-serif italic">{phaseLabel(initialState)}</span>
            </h2>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              Progression
            </p>
            <p className="font-mono text-sm text-[#0F1419]">{progress}%</p>
          </div>
        </div>
        {/* Barre de progression sobre */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#0F1419]/[0.06]">
          <div
            className={cn('h-full rounded-full bg-chartreuse-deep transition-all duration-500')}
            style={{ width: `${progress}%` }}
            aria-hidden
          />
        </div>
      </div>

      {/* Layout 2 colonnes : timeline (gauche) + picker (droite sticky sur lg) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <div className="min-w-0">
          <MissionFlowTimeline
            currentState={initialState}
            availableTransitions={availableTransitionsCodes}
            eventHistory={initialEventHistory}
          />
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <MissionFlowTransitionPicker
            currentState={initialState}
            availableTransitions={availableTransitions}
            onTransition={handleTransition}
          />
        </aside>
      </div>
    </div>
  )
}
