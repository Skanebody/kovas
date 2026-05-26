'use client'

/**
 * KOVAS — GC2 Mission Flow Continu : composer racine (Lot B92 polish complet).
 *
 * Assemble <MissionPicker> + <MissionFlowTimeline> + <MissionFlowTransitionPicker>
 * + header d'état métier dans un layout 2 colonnes (sticky right sidebar sur lg,
 * stacked sur mobile).
 *
 * Reçoit une server action pré-bindée pour déclencher les transitions via la
 * RPC `mission_flow_transition` avec optimistic concurrency (`expectedVersion`).
 *
 * Lot B92 — 3 axes de polish :
 *   1. Multi-mission selection : pic affichage du <MissionPicker> si > 1 mission
 *   2. Optimistic concurrency : passe `version` à la server action + handling
 *      version_mismatch via router.refresh() + toast warning
 *   3. Animations framer-motion subtle + respect prefers-reduced-motion :
 *      - Phase label fade-out/fade-in via AnimatePresence sur changement
 *      - Barre de progression transition width 0.6s ease-in-out
 *
 * Realtime (Lot B89) préservé : INSERT mission_flow_events + UPDATE
 * mission_flow_states, router.refresh() débouncé, indicateur connexion sobre.
 *
 * Authority : CLAUDE.md Design System v5 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import type { MissionFlowPhase } from '@/lib/mission-flow/state-machine'
import {
  isVersionMismatch,
  nextPossibleTransitions,
  phaseLabel,
  progressPercent,
} from '@/lib/mission-flow/state-machine'
import { useMissionFlowRealtime } from '@/lib/mission-flow/use-realtime'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { type MissionFlowEvent, MissionFlowTimeline } from './MissionFlowTimeline'
import {
  type AvailableTransition,
  MissionFlowTransitionPicker,
} from './MissionFlowTransitionPicker'
import { MissionPicker, type MissionPickerEntry } from './MissionPicker'

export interface MissionFlowTransitionResult {
  success: boolean
  error?: string
  code?: string
  currentVersion?: number
  newVersion?: number
}

interface MissionFlowComposerProps {
  /** ID du dossier (pour le picker multi-mission) */
  dossierId: string
  /** ID de la mission active (passé tel quel à la server action) */
  missionId: string
  /** Liste des missions du dossier (affiche le picker si > 1) */
  missions: ReadonlyArray<MissionPickerEntry>
  /** Référence dossier affichée dans le header (ex: DOS-2026-001) */
  dossierReference?: string
  /** Phase courante chargée côté server */
  initialState: MissionFlowPhase
  /** Version courante (optimistic concurrency) */
  initialVersion: number
  /** Historique d'événements pré-chargé côté server */
  initialEventHistory: ReadonlyArray<MissionFlowEvent>
  /** Server action handler — appelée avec mission, phase cible, version attendue */
  onTransition: (
    missionId: string,
    targetPhase: MissionFlowPhase,
    expectedVersion: number | null,
  ) => Promise<MissionFlowTransitionResult>
}

export function MissionFlowComposer({
  dossierId,
  missionId,
  missions,
  dossierReference,
  initialState,
  initialVersion,
  initialEventHistory,
  onTransition,
}: MissionFlowComposerProps) {
  const router = useRouter()
  const prefersReducedMotion = useReducedMotion()

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

  // Realtime subscription — INSERT mission_flow_events + UPDATE mission_flow_states.
  // Le router.refresh() débouncé est intégré au hook ; ici on récupère juste
  // l'état de connexion pour afficher un indicateur sobre.
  const { isConnected } = useMissionFlowRealtime(missionId)

  async function handleTransition(event: string): Promise<MissionFlowTransitionResult> {
    // L'event est la phase cible (cf. mapping ci-dessus).
    // On passe `initialVersion` comme `expectedVersion` pour permettre à la RPC
    // de détecter un version_mismatch (ex: autre user du cabinet a transitionné
    // depuis qu'on a chargé la page).
    const result = await onTransition(missionId, event as MissionFlowPhase, initialVersion)

    if (isVersionMismatch(result)) {
      toast.warning('Un autre utilisateur a modifié la mission. Mise à jour…')
      router.refresh()
      return result
    }

    return result
  }

  const animationDuration = prefersReducedMotion ? 0 : 0.3

  return (
    <div className="space-y-6">
      {/* Sélecteur multi-mission (n'apparaît que si > 1 mission) */}
      {missions.length > 1 ? (
        <MissionPicker dossierId={dossierId} missions={missions} currentMissionId={missionId} />
      ) : null}

      {/* Header d'état métier — sobre, en haut */}
      <div
        id="mission-flow-content"
        className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-5 shadow-glass-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
              {dossierReference ? `Dossier ${dossierReference}` : 'Mission'}
            </p>
            <h2 className="mt-1 text-xl font-medium text-[#0F1419]">
              Phase :{' '}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={initialState}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: animationDuration, ease: 'easeOut' }}
                  className="inline-block font-serif italic"
                >
                  {phaseLabel(initialState)}
                </motion.span>
              </AnimatePresence>
            </h2>
          </div>
          <div className="flex shrink-0 items-end gap-4">
            {/* Indicateur Realtime sobre — dot chartreuse si connecté, gris sinon */}
            <div
              className="flex items-center gap-1.5"
              title={
                isConnected
                  ? 'Synchronisation temps réel active'
                  : 'Synchronisation temps réel inactive'
              }
              aria-label={
                isConnected
                  ? 'Synchronisation temps réel active'
                  : 'Synchronisation temps réel inactive'
              }
            >
              <span
                aria-hidden
                className={cn(
                  'inline-block size-2 rounded-full transition-colors motion-reduce:transition-none',
                  isConnected
                    ? 'bg-chartreuse-deep shadow-[0_0_0_3px_rgba(212,245,66,0.25)]'
                    : 'bg-[#0F1419]/25',
                )}
              />
              <span className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                {isConnected ? 'Synchro live' : 'Hors ligne'}
              </span>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
                Progression
              </p>
              <p className="font-mono text-sm text-[#0F1419]">{progress}%</p>
            </div>
          </div>
        </div>
        {/* Barre de progression sobre — animée 600ms ease-in-out */}
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#0F1419]/[0.06]">
          <motion.div
            className="h-full rounded-full bg-chartreuse-deep"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: 'easeInOut' }}
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
