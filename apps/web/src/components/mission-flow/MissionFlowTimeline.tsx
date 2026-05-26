'use client'

/**
 * KOVAS — GC2 Mission Flow Continu : composant timeline (Lot B92 polish).
 *
 * Affiche l'historique d'événements de transition du flow mission, avec un
 * highlight sur l'état courant. Pattern V5 sobre : card paper + bordure 0.08,
 * eyebrow mono uppercase, dot chartreuse pour l'état actif.
 *
 * Consommé par <MissionFlowComposer> dans /dashboard/dossiers/[id]/mission/flow.
 *
 * Lot B92 — animations framer-motion subtle :
 *   - Entrée fade-in + slide-from-left (0.4s ease-out) sur NOUVEAUX events
 *   - Respect prefers-reduced-motion (duration=0)
 *
 * Authority : CLAUDE.md Design System v5 + REFONTE-ACQUI-TARGET-V2 §6.2 (GC2).
 */

import type { MissionFlowPhase } from '@/lib/mission-flow/state-machine'
import { phaseLabel } from '@/lib/mission-flow/state-machine'
import { cn } from '@/lib/utils'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, CircleDot, Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface MissionFlowEvent {
  /** Type d'événement (ex: 'preparation→capture_terrain', 'mission_flow_transition') */
  eventType: string
  /** Payload arbitraire (trigger_payload de la table mission_flow_events) */
  payload: unknown
  /** Timestamp ISO 8601 (UTC) */
  timestamp: string
  /** Phase de départ (peut être null pour le premier event) */
  fromPhase?: MissionFlowPhase | null
  /** Phase d'arrivée */
  toPhase?: MissionFlowPhase | null
}

interface MissionFlowTimelineProps {
  /** Phase courante du flow (sera highlightée) */
  currentState: MissionFlowPhase
  /** Liste des transitions sortantes disponibles (utilisé pour preview, non rendu ici) */
  availableTransitions: ReadonlyArray<string>
  /** Historique des événements, ordre antéchronologique (plus récent en premier) */
  eventHistory: ReadonlyArray<MissionFlowEvent>
}

/**
 * Formate un timestamp en relatif sobre ("il y a 12 min", "il y a 3 h").
 * Garde les approximations brut — pas de localisation lourde pour un scaffold.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (diffSec < 60) return 'à l’instant'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  return `il y a ${diffD} j`
}

export function MissionFlowTimeline({
  currentState,
  availableTransitions,
  eventHistory,
}: MissionFlowTimelineProps) {
  const prefersReducedMotion = useReducedMotion()

  // Le scaffold rend simplement la liste des events + l'état actif. Les
  // transitions dispo sont passées en prop pour cohérence d'API mais affichées
  // par <MissionFlowTransitionPicker>, pas ici.
  void availableTransitions

  // Tracking des events déjà vus pour n'animer QUE les nouveaux arrivants
  // (Realtime). Au mount initial, tous les events existants sont considérés
  // comme "déjà vus" pour éviter l'animation du dump initial.
  const seenTimestamps = useRef<Set<string>>(new Set())
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    if (!hasMounted) {
      // Premier rendu : on marque tous les events comme déjà vus
      for (const evt of eventHistory) {
        seenTimestamps.current.add(`${evt.timestamp}-${evt.eventType}`)
      }
      setHasMounted(true)
    }
  }, [eventHistory, hasMounted])

  function isNewEvent(evt: MissionFlowEvent): boolean {
    if (!hasMounted) return false
    const key = `${evt.timestamp}-${evt.eventType}`
    const seen = seenTimestamps.current.has(key)
    if (!seen) seenTimestamps.current.add(key)
    return !seen
  }

  const enterDuration = prefersReducedMotion ? 0 : 0.4

  return (
    <section
      aria-label="Historique du flow"
      className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-5 py-4 shadow-glass-sm"
    >
      <header className="mb-4 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
          Historique du flow
        </p>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/45">
          {eventHistory.length} {eventHistory.length > 1 ? 'événements' : 'événement'}
        </span>
      </header>

      {/* État actif (toujours affiché en tête) */}
      <div
        className={cn(
          'mb-4 flex items-center gap-3 rounded-xl border border-chartreuse/40',
          'bg-chartreuse/10 px-4 py-3',
        )}
      >
        <CircleDot aria-hidden className="size-4 shrink-0 text-chartreuse-deep" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/55">
            État actuel
          </p>
          <p className="text-sm font-medium text-[#0F1419]">{phaseLabel(currentState)}</p>
        </div>
      </div>

      {/* Liste verticale des events — sobre, pas de couleur ostentatoire */}
      {eventHistory.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#0F1419]/55">
          Aucun événement enregistré pour le moment.
        </p>
      ) : (
        <ol className="space-y-3">
          <AnimatePresence initial={false}>
            {eventHistory.map((evt, idx) => {
              const isNew = isNewEvent(evt)
              return (
                <motion.li
                  key={`${evt.timestamp}-${idx}`}
                  layout
                  initial={isNew ? { opacity: 0, x: -12 } : false}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: enterDuration, ease: 'easeOut' }}
                  className="flex gap-3 border-l border-[#0F1419]/[0.08] pl-4"
                >
                  <Clock
                    aria-hidden
                    className="mt-0.5 size-3.5 shrink-0 text-[#0F1419]/45"
                    strokeWidth={1.5}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm text-[#0F1419]">
                      {evt.fromPhase ? (
                        <>
                          <span className="text-[#0F1419]/65">{phaseLabel(evt.fromPhase)}</span>
                          <ArrowRight
                            aria-hidden
                            className="size-3 text-[#0F1419]/45"
                            strokeWidth={1.5}
                          />
                        </>
                      ) : null}
                      <span className="font-medium">
                        {evt.toPhase ? phaseLabel(evt.toPhase) : evt.eventType}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-[#0F1419]/45">
                      {formatRelative(evt.timestamp)} · {evt.eventType}
                    </p>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}
