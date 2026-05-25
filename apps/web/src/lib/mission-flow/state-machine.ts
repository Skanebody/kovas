/**
 * KOVAS — GC2 Mission flow continu : state machine helper.
 *
 * Pure-fn TypeScript qui décrit la machine à états du flow mission. Source
 * de vérité côté code pour les transitions valides + UI hints.
 *
 * Consommée par :
 *   - L'UI tchat (composant continu, futur)
 *   - L'admin pour debug + override
 *   - Les tests Vitest
 *
 * Le storage est dans la table mission_flow_states + transition atomique
 * via la RPC `mission_flow_transition`.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.2.
 */

export type MissionFlowPhase =
  | 'preparation'
  | 'capture_terrain'
  | 'verification'
  | 'pre_export'
  | 'sent'

export type CaptureStep = 'photos' | 'voix' | 'mesures' | 'reserves' | null
export type VerificationStep = 'checklist' | 'anomalies' | 'photos_review' | null
export type PreExportStep = 'conformity_score' | 'documents' | 'partage' | null

export type MissionFlowStep = CaptureStep | VerificationStep | PreExportStep | null

export interface FlowTransition {
  from: MissionFlowPhase
  to: MissionFlowPhase
  /** Si true, transition possible uniquement quand certains pré-requis sont satisfaits */
  conditional: boolean
  /** Phrase humaine décrivant la transition */
  label: string
}

/**
 * Toutes les transitions autorisées dans le DAG du flow.
 *
 * Le flow est principalement linéaire (preparation → capture → verification →
 * pre_export → sent), avec quelques retours en arrière permis pour corriger
 * (verification → capture par exemple).
 *
 * La transition `* → sent` est terminale et n'est plus modifiable.
 */
export const ALLOWED_TRANSITIONS: ReadonlyArray<FlowTransition> = [
  // Forward path
  {
    from: 'preparation',
    to: 'capture_terrain',
    conditional: false,
    label: 'Démarrer la mission terrain',
  },
  {
    from: 'capture_terrain',
    to: 'verification',
    conditional: true,
    label: 'Tout est capturé — passer à la vérification',
  },
  {
    from: 'verification',
    to: 'pre_export',
    conditional: true,
    label: 'Vérification OK — pré-export',
  },
  {
    from: 'pre_export',
    to: 'sent',
    conditional: true,
    label: 'Partager le rapport (terminal)',
  },

  // Backward path (corrections)
  {
    from: 'verification',
    to: 'capture_terrain',
    conditional: false,
    label: 'Compléter la capture',
  },
  {
    from: 'pre_export',
    to: 'verification',
    conditional: false,
    label: 'Revenir à la vérification',
  },
  {
    from: 'pre_export',
    to: 'capture_terrain',
    conditional: false,
    label: 'Capturer un élément manquant',
  },
]

/**
 * Sous-étapes par phase. L'ordre dans le tableau définit l'ordre suggéré UI.
 */
export const STEPS_BY_PHASE: Record<MissionFlowPhase, ReadonlyArray<string>> = {
  preparation: ['briefing', 'documents_amont'],
  capture_terrain: ['photos', 'voix', 'mesures', 'reserves'],
  verification: ['checklist', 'anomalies', 'photos_review'],
  pre_export: ['conformity_score', 'documents', 'partage'],
  sent: [],
}

/**
 * Vérifie si une transition est autorisée par la machine.
 * Pure fn — pas d'IO. Les pré-requis conditionnels (photos prises, etc.)
 * sont check côté caller via `checkTransitionPreconditions`.
 */
export function isTransitionAllowed(from: MissionFlowPhase, to: MissionFlowPhase): boolean {
  // Self-transition autorisée (changement de step dans la même phase)
  if (from === to) return true
  return ALLOWED_TRANSITIONS.some((t) => t.from === from && t.to === to)
}

/**
 * Liste les transitions sortantes possibles depuis une phase donnée.
 */
export function nextPossibleTransitions(from: MissionFlowPhase): FlowTransition[] {
  return ALLOWED_TRANSITIONS.filter((t) => t.from === from)
}

/**
 * Pré-conditions par transition forward.
 */
export interface TransitionPreconditions {
  /** Au moins 1 photo prise */
  has_at_least_one_photo: boolean
  /** Surface saisie pour les diags Carrez/Boutin */
  has_surface_declared: boolean
  /** Au moins 1 pièce avec données capturées */
  has_at_least_one_room_completed: boolean
  /** Score conformité A1.3.3 calculé et accepté */
  conformity_score_computed: boolean
  /** Toutes les anomalies critical sont justifiées ou résolues */
  no_unresolved_critical_anomalies: boolean
}

export interface PreconditionCheckResult {
  /** Si false, transition refusée */
  satisfied: boolean
  /** Raisons précises de l'échec (si satisfied=false) */
  missing: ReadonlyArray<{ code: string; human_message: string }>
}

/**
 * Vérifie les pré-conditions pour une transition forward donnée.
 * Pure fn. Le caller fournit les flags depuis sa logique métier.
 */
export function checkTransitionPreconditions(
  from: MissionFlowPhase,
  to: MissionFlowPhase,
  flags: TransitionPreconditions,
): PreconditionCheckResult {
  const missing: Array<{ code: string; human_message: string }> = []

  if (from === 'capture_terrain' && to === 'verification') {
    if (!flags.has_at_least_one_photo) {
      missing.push({
        code: 'NO_PHOTO',
        human_message: 'Au moins une photo doit être prise avant la vérification.',
      })
    }
    if (!flags.has_at_least_one_room_completed) {
      missing.push({
        code: 'NO_ROOM_COMPLETED',
        human_message: 'Au moins une pièce doit être complétée.',
      })
    }
  }

  if (from === 'verification' && to === 'pre_export') {
    if (!flags.has_surface_declared) {
      missing.push({
        code: 'SURFACE_MISSING',
        human_message: 'La surface doit être déclarée pour le pré-export.',
      })
    }
  }

  if (from === 'pre_export' && to === 'sent') {
    if (!flags.conformity_score_computed) {
      missing.push({
        code: 'SCORE_NOT_COMPUTED',
        human_message: 'Le score de conformité doit être calculé avant envoi.',
      })
    }
    if (!flags.no_unresolved_critical_anomalies) {
      missing.push({
        code: 'CRITICAL_ANOMALIES',
        human_message: 'Des anomalies critiques doivent être résolues avant envoi.',
      })
    }
  }

  return { satisfied: missing.length === 0, missing }
}

/**
 * Phrase humaine UI pour la phase courante (sobre, vouvoiement).
 */
export function phaseLabel(phase: MissionFlowPhase): string {
  switch (phase) {
    case 'preparation':
      return 'Préparation'
    case 'capture_terrain':
      return 'Capture terrain'
    case 'verification':
      return 'Vérification'
    case 'pre_export':
      return 'Pré-export'
    case 'sent':
      return 'Envoyé'
  }
}

/**
 * Progress percent calculé linéairement sur la position dans le DAG.
 */
export function progressPercent(phase: MissionFlowPhase): number {
  const order: MissionFlowPhase[] = [
    'preparation',
    'capture_terrain',
    'verification',
    'pre_export',
    'sent',
  ]
  const idx = order.indexOf(phase)
  if (idx < 0) return 0
  return Math.round((idx / (order.length - 1)) * 100)
}
