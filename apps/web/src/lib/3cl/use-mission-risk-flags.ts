/**
 * KOVAS — Hook React useMissionRiskFlags (lot MISSION-C).
 *
 * Calcule en temps réel les "champs à risque" d'une mission DPE — c'est-à-dire
 * les champs `required=true` qui possèdent un `defaultValuePitfall` documenté
 * et ne sont pas encore renseignés.
 *
 * Sert à :
 *   1. Afficher un badge ambre sur la sidebar pièces pour les pièces incomplètes
 *   2. Alimenter la section "Champs à risque" du récap visuel
 *   3. Empêcher l'export tant qu'il reste des risques majeurs
 *
 * Authority : CLAUDE.md §3 feature 5 + spec MISSION-C.
 */

'use client'

import { useMemo } from 'react'
import { CHECK_ITEMS_3CL, type CheckItem, getRequiredCheckItems } from './checklist'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

/** Snapshot des champs renseignés (key → valeur brute). */
export type FilledFieldsMap = Readonly<Record<string, unknown>>

/** Représente un champ à risque (required + pitfall + non rempli). */
export interface RiskFlag {
  /** Clef technique du champ. */
  key: string
  /** Libellé FR. */
  label: string
  /** Catégorie 3CL. */
  category: string
  /** Description du piège méthode 3CL. */
  pitfall: string
  /** Item complet (pour navigation). */
  item: CheckItem
}

/** Résultat du hook : agrégat de risques globaux + par pièce. */
export interface MissionRiskFlagsResult {
  /** Tous les risk flags actifs. */
  flags: RiskFlag[]
  /** Risques globaux (non scoped à une pièce). */
  globalFlags: RiskFlag[]
  /** Risques par pièce (roomId → flags applicables). */
  flagsByRoomId: Record<string, RiskFlag[]>
  /** Compteurs par catégorie pour le récap. */
  countByCategory: Record<string, number>
  /** Total risks (toutes catégories). */
  total: number
}

interface UseMissionRiskFlagsInput {
  /** Champs globaux renseignés (key 3CL → valeur). */
  globalFields: FilledFieldsMap
  /** Champs par pièce (roomId → { roomType, fields }). */
  roomFields: Readonly<
    Record<
      string,
      {
        roomType: string
        fields: FilledFieldsMap
      }
    >
  >
}

// -----------------------------------------------------------------------------
// Hook principal
// -----------------------------------------------------------------------------

/**
 * Détermine si une valeur "compte" comme renseignée (non null/undefined/'').
 */
function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number') return !Number.isNaN(value)
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function useMissionRiskFlags({
  globalFields,
  roomFields,
}: UseMissionRiskFlagsInput): MissionRiskFlagsResult {
  return useMemo(() => {
    // 1. Items obligatoires avec piège documenté
    const dangerousItems = getRequiredCheckItems().filter((it) => Boolean(it.defaultValuePitfall))

    // 2. Split global vs scoped
    const globalDangerous = dangerousItems.filter((it) => !it.applicableTo)
    const scopedDangerous = dangerousItems.filter((it) => it.applicableTo)

    // 3. Flags globaux
    const globalFlags: RiskFlag[] = globalDangerous
      .filter((it) => !isFilled(globalFields[it.key]))
      .map((it) => ({
        key: it.key,
        label: it.label,
        category: it.category,
        pitfall: it.defaultValuePitfall ?? '',
        item: it,
      }))

    // 4. Flags par pièce
    const flagsByRoomId: Record<string, RiskFlag[]> = {}
    for (const [roomId, room] of Object.entries(roomFields)) {
      const applicable = scopedDangerous.filter(
        (it) => it.applicableTo?.includes(room.roomType as never) ?? false,
      )
      const missing = applicable
        .filter((it) => !isFilled(room.fields[it.key]))
        .map((it) => ({
          key: it.key,
          label: it.label,
          category: it.category,
          pitfall: it.defaultValuePitfall ?? '',
          item: it,
        }))
      if (missing.length > 0) flagsByRoomId[roomId] = missing
    }

    // 5. Aggregate
    const allFlags: RiskFlag[] = [...globalFlags, ...Object.values(flagsByRoomId).flat()]

    // 6. Count by category
    const countByCategory: Record<string, number> = {}
    for (const flag of allFlags) {
      countByCategory[flag.category] = (countByCategory[flag.category] ?? 0) + 1
    }

    return {
      flags: allFlags,
      globalFlags,
      flagsByRoomId,
      countByCategory,
      total: allFlags.length,
    }
  }, [globalFields, roomFields])
}

// -----------------------------------------------------------------------------
// Helpers complétude globale (utiles aussi côté server pour calcul progression)
// -----------------------------------------------------------------------------

/** Compte total des champs 3CL applicables (global + par pièce). */
export function countApplicableFields(roomTypes: readonly string[]): number {
  const globals = CHECK_ITEMS_3CL.filter((it) => !it.applicableTo).length
  const scoped = CHECK_ITEMS_3CL.filter((it) => it.applicableTo).reduce((sum, it) => {
    const applicableRoomCount = roomTypes.filter((rt) =>
      it.applicableTo?.includes(rt as never),
    ).length
    return sum + applicableRoomCount
  }, 0)
  return globals + scoped
}

/** Compte total des champs renseignés (global + par pièce). */
export function countFilledFields(
  globalFields: FilledFieldsMap,
  roomFields: Readonly<Record<string, { roomType: string; fields: FilledFieldsMap }>>,
): number {
  const globalFilled = Object.values(globalFields).filter(isFilled).length
  const roomsFilled = Object.values(roomFields).reduce(
    (sum, r) => sum + Object.values(r.fields).filter(isFilled).length,
    0,
  )
  return globalFilled + roomsFilled
}

/** Calcul progression % (clamped 0-100). */
export function computeMissionCompletionPct(
  globalFields: FilledFieldsMap,
  roomFields: Readonly<Record<string, { roomType: string; fields: FilledFieldsMap }>>,
): number {
  const roomTypes = Object.values(roomFields).map((r) => r.roomType)
  const applicable = countApplicableFields(roomTypes)
  if (applicable === 0) return 0
  const filled = countFilledFields(globalFields, roomFields)
  return Math.min(100, Math.max(0, Math.round((filled / applicable) * 100)))
}
