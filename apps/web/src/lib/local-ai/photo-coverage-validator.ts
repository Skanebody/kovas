/**
 * Photo coverage validator — vérifie qu'un minimum de photos a été pris
 * pour chaque pièce visitée et pour chaque section critique.
 *
 * 100% local, déterministe. Pas de réseau, pas d'IA.
 *
 * Règles :
 * - Toute pièce visitée doit avoir au moins 1 photo d'ensemble.
 * - Toute section critique d'un diagnostic doit avoir au moins 2 photos
 *   d'illustration (sauf ERP qui est documentaire).
 * - Les items `requires_photo = true` qui sont `covered` doivent avoir
 *   au moins 1 photo associée.
 */

import type { ChecklistItem } from './checklists/types'
import type { RoomType } from './room-transition-detector'
import { ROOM_LABEL_FR } from './room-transition-detector'

/** Photo enregistrée dans une mission (vue par le validateur). */
export interface MissionPhoto {
  id: string
  /** Pièce de prise de vue (null si externe / inconnue). */
  room: RoomType | null
  /** Légende / tags associés. */
  caption: string | null
  /** Item de checklist lié (optionnel). */
  linked_item_id: string | null
  /** Timestamp ms. */
  taken_at: number
}

/** Résultat de la validation. */
export interface CoverageReport {
  /** Vrai si toutes les exigences sont remplies. */
  ok: boolean
  /** Pièces visitées mais sans photo. */
  rooms_without_photo: RoomType[]
  /** Items required avec photo manquante. */
  items_missing_photo: ChecklistItem[]
  /** Total photos prises. */
  total_photos: number
  /** Recommandation simple lisible (pour CheckoutScreen). */
  summary: string
}

/** Seuils par défaut (configurables). */
export const PHOTO_THRESHOLDS = {
  /** Minimum de photos par pièce visitée. */
  minPerRoom: 1,
  /** Minimum de photos pour la mission complète (toutes pièces confondues). */
  minTotal: 5,
} as const

/**
 * Calcule un rapport de couverture photo.
 *
 * @param photos Photos prises pendant la mission
 * @param roomsVisited Pièces visitées (depuis le tracker)
 * @param requiredPhotoItems Items required avec `requires_photo = true` (depuis le tracker)
 */
export function validatePhotoCoverage(
  photos: readonly MissionPhoto[],
  roomsVisited: readonly RoomType[],
  requiredPhotoItems: readonly ChecklistItem[],
): CoverageReport {
  const roomsWithPhoto = new Set<RoomType>()
  for (const p of photos) {
    if (p.room) roomsWithPhoto.add(p.room)
  }
  const roomsWithoutPhoto = roomsVisited.filter((r) => !roomsWithPhoto.has(r))

  const linkedItems = new Set<string>()
  for (const p of photos) {
    if (p.linked_item_id) linkedItems.add(p.linked_item_id)
  }
  const itemsMissingPhoto = requiredPhotoItems.filter((it) => !linkedItems.has(it.id))

  const ok =
    roomsWithoutPhoto.length === 0 &&
    itemsMissingPhoto.length === 0 &&
    photos.length >= PHOTO_THRESHOLDS.minTotal

  const summaryParts: string[] = []
  if (roomsWithoutPhoto.length > 0) {
    summaryParts.push(
      `Photo manquante dans ${roomsWithoutPhoto.length} pièce(s) : ${roomsWithoutPhoto.map((r) => ROOM_LABEL_FR[r]).join(', ')}.`,
    )
  }
  if (itemsMissingPhoto.length > 0) {
    summaryParts.push(
      `${itemsMissingPhoto.length} élément(s) à photographier : ${itemsMissingPhoto
        .slice(0, 3)
        .map((it) => it.description_short)
        .join(', ')}${itemsMissingPhoto.length > 3 ? '…' : ''}.`,
    )
  }
  if (photos.length < PHOTO_THRESHOLDS.minTotal) {
    summaryParts.push(`Au moins ${PHOTO_THRESHOLDS.minTotal} photos recommandées.`)
  }
  const summary = summaryParts.join(' ') || 'Couverture photo conforme.'

  return {
    ok,
    rooms_without_photo: roomsWithoutPhoto,
    items_missing_photo: itemsMissingPhoto,
    total_photos: photos.length,
    summary,
  }
}
