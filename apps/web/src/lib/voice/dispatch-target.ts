/**
 * Planning du dispatch : transforme un `VoiceParsedData` en actions concrètes
 * (UPDATE property / INSERT room / UPDATE mission.metadata) en tenant compte
 * du contexte courant (champs déjà remplis du bien, pièce et mission actives).
 *
 * Le plan est ensuite envoyé à `applyVoiceDispatchAction` (server) qui exécute
 * les mutations en s'assurant que tout passe par les RLS Supabase.
 *
 * Stratégie conflit : si parsed.surface_m2 diffère de property.surface_total
 * de plus de 5%, on émet un conflit (l'utilisateur tranche en UI).
 */

import type { VoiceParsedData } from '@/lib/voice-parser'

export type DispatchAction =
  | {
      entity: 'property'
      field:
        | 'surface_total'
        | 'year_built'
        | 'floor_number'
        | 'building_letter'
        | 'apartment_detail'
        | 'lot_number'
      value: string | number
    }
  | {
      entity: 'room'
      action: 'create'
      room_type: string
      name: string
    }
  | {
      entity: 'mission'
      missionId: string
      field: 'metadata.equipment'
      value: VoiceParsedData['equipment']
    }

export interface DispatchConflict {
  field: string
  existing: string | number
  suggested: string | number
  /**
   * Résolution choisie en UI :
   * - 'keep' : on garde l'existant (ignorer la suggestion)
   * - 'overwrite' : on écrase avec la suggestion
   * - 'edit' : l'utilisateur saisira une valeur custom
   * - null : pas encore résolu (par défaut on ignore au dispatch)
   */
  resolution: 'keep' | 'overwrite' | 'edit' | null
}

export interface DispatchPlan {
  actions: DispatchAction[]
  conflicts: DispatchConflict[]
}

export interface DispatchContext {
  property: {
    surface_total: number | null
    year_built: number | null
    floor_number: number | null
    building_letter: string | null
    apartment_detail: string | null
    lot_number: string | null
  }
  activeRoomId: string | null
  activeMissionId: string | null
}

/**
 * Tolérance pour les conflits numériques (5% de différence par défaut).
 */
const SURFACE_CONFLICT_THRESHOLD = 0.05

function hasSignificantNumericDiff(existing: number, suggested: number, threshold: number) {
  if (existing === 0) return suggested !== 0
  return Math.abs(existing - suggested) / existing > threshold
}

export function planDispatch(parsed: VoiceParsedData, context: DispatchContext): DispatchPlan {
  const actions: DispatchAction[] = []
  const conflicts: DispatchConflict[] = []

  // ----- Surface totale -----
  if (typeof parsed.surface_m2 === 'number') {
    if (context.property.surface_total === null) {
      actions.push({ entity: 'property', field: 'surface_total', value: parsed.surface_m2 })
    } else if (
      hasSignificantNumericDiff(
        context.property.surface_total,
        parsed.surface_m2,
        SURFACE_CONFLICT_THRESHOLD,
      )
    ) {
      conflicts.push({
        field: 'property.surface_total',
        existing: context.property.surface_total,
        suggested: parsed.surface_m2,
        resolution: null,
      })
    }
    // Sinon (différence < 5%) : ignoré silencieusement
  }

  // ----- Année construction -----
  if (typeof parsed.year_built === 'number') {
    if (context.property.year_built === null) {
      actions.push({ entity: 'property', field: 'year_built', value: parsed.year_built })
    } else if (context.property.year_built !== parsed.year_built) {
      conflicts.push({
        field: 'property.year_built',
        existing: context.property.year_built,
        suggested: parsed.year_built,
        resolution: null,
      })
    }
  }

  // ----- Equipements → mission active (si fournie) -----
  // On ne dispatch les équipements que si une mission active est sélectionnée,
  // sinon ils resteront accessibles via les voice_notes / chips affichés.
  if (context.activeMissionId && parsed.equipment.length > 0) {
    actions.push({
      entity: 'mission',
      missionId: context.activeMissionId,
      field: 'metadata.equipment',
      value: parsed.equipment,
    })
  }

  return { actions, conflicts }
}

/**
 * Applique les résolutions de conflit reçues de l'UI au plan : transforme
 * les conflits "overwrite" en actions concrètes property.*, drop les "keep",
 * ignore les "edit" (l'UI les a déjà appliqués via un input dédié).
 */
export function resolveConflicts(plan: DispatchPlan): DispatchAction[] {
  const extra: DispatchAction[] = []
  for (const c of plan.conflicts) {
    if (c.resolution !== 'overwrite') continue
    const [entity, field] = c.field.split('.')
    if (entity !== 'property' || !field) continue
    if (
      field === 'surface_total' ||
      field === 'year_built' ||
      field === 'floor_number' ||
      field === 'building_letter' ||
      field === 'apartment_detail' ||
      field === 'lot_number'
    ) {
      extra.push({ entity: 'property', field, value: c.suggested })
    }
  }
  return [...plan.actions, ...extra]
}
