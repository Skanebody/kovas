/**
 * KOVAS — Helpers complétude pièces (mode mission, sidebar pièces).
 *
 * Référentiel ADEME 3CL-2021 : chaque type de pièce a une liste de champs
 * recommandés à renseigner pour un DPE certifié. Ce module fournit :
 *
 *   - Le mapping des champs requis par TYPE de pièce
 *   - Un helper `computeRoomStatus(filled, type)` qui retourne 'empty' / 'partial' / 'complete'
 *
 * Convention : on tolère 90% des champs renseignés pour passer en 'complete'
 * (champs comme "orientation" ou "volet_type" peuvent être absents si pièce
 * aveugle ou pas de volet).
 *
 * Authority : CLAUDE.md §3 feature 5 (check-lists par type de diagnostic).
 */

/** Types de pièces canoniques pour le mode mission KOVAS. */
export type RoomType =
  | 'living' // Salon, séjour
  | 'kitchen' // Cuisine (ouverte ou fermée)
  | 'bedroom' // Chambre adulte/enfant
  | 'bathroom' // Salle de bain ou salle d'eau (douche/baignoire)
  | 'office' // Bureau
  | 'wc' // WC séparé
  | 'corridor' // Couloir, dégagement, entrée
  | 'storage' // Cellier, débarras, dressing
  | 'basement' // Cave, sous-sol
  | 'attic' // Combles, grenier
  | 'garage' // Garage, parking couvert
  | 'other' // Autre (véranda, atelier, etc.)

/**
 * Champs requis par type de pièce pour un DPE 3CL-2021 complet.
 *
 * Les champs marqués `nb_*` sont des compteurs (nombre de fenêtres, etc.).
 * Les autres sont des choix textuels (type de menuiserie, etc.).
 */
export const REQUIRED_FIELDS_BY_ROOM_TYPE: Record<RoomType, readonly string[]> = {
  living: [
    'surface',
    'plafond_hauteur',
    'orientation',
    'nb_fenetres',
    'menuiserie_type',
    'vitrage_type',
    'volet_type',
    'sol_type',
    'chauffage_type',
    'eclairage_type',
    'parois_isolation',
  ],
  kitchen: [
    'surface',
    'plafond_hauteur',
    'nb_fenetres',
    'menuiserie_type',
    'vitrage_type',
    'sol_type',
    'plaque_type',
    'four_type',
    'hotte_extraction',
    'eau_chaude_source',
  ],
  bedroom: [
    'surface',
    'plafond_hauteur',
    'orientation',
    'nb_fenetres',
    'menuiserie_type',
    'vitrage_type',
    'volet_type',
    'sol_type',
    'chauffage_type',
  ],
  bathroom: [
    'surface',
    'plafond_hauteur',
    'nb_fenetres',
    'sol_type',
    'mur_revetement',
    'douche_baignoire',
    'ventilation_type',
    'chauffage_type',
  ],
  office: [
    'surface',
    'plafond_hauteur',
    'orientation',
    'nb_fenetres',
    'menuiserie_type',
    'vitrage_type',
    'sol_type',
    'chauffage_type',
    'eclairage_type',
  ],
  wc: ['surface', 'plafond_hauteur', 'sol_type', 'ventilation_type'],
  corridor: ['surface', 'plafond_hauteur', 'sol_type', 'eclairage_type'],
  storage: ['surface', 'plafond_hauteur', 'sol_type', 'parois_isolation'],
  basement: [
    'surface',
    'plafond_hauteur',
    'sol_type',
    'parois_isolation',
    'ventilation_type',
    'humidite_observation',
  ],
  attic: [
    'surface',
    'plafond_hauteur',
    'parois_isolation',
    'isolation_combles',
    'ventilation_type',
    'humidite_observation',
  ],
  garage: ['surface', 'plafond_hauteur', 'sol_type', 'porte_type', 'parois_isolation'],
  other: ['surface', 'plafond_hauteur', 'sol_type'],
} as const

/** Statut de complétude d'une pièce selon les champs déjà renseignés. */
export type RoomCompletionStatus = 'empty' | 'partial' | 'complete'

/**
 * Détermine le statut de complétion d'une pièce.
 *
 * @param filled Liste des clés de champs déjà saisies pour cette pièce
 * @param type Type canonique de la pièce
 * @returns 'empty' si 0 champ, 'partial' si <90% requis, 'complete' sinon
 */
export function computeRoomStatus(filled: readonly string[], type: RoomType): RoomCompletionStatus {
  const required = REQUIRED_FIELDS_BY_ROOM_TYPE[type] ?? []
  if (filled.length === 0) return 'empty'
  if (required.length === 0) return filled.length > 0 ? 'complete' : 'empty'
  const ratio = filled.length / required.length
  if (ratio < 0.9) return 'partial'
  return 'complete'
}

/**
 * Retourne le nombre total de champs requis pour ce type de pièce.
 * Utilisé pour afficher "3/9" dans la sidebar.
 */
export function getRequiredFieldsCount(type: RoomType): number {
  return REQUIRED_FIELDS_BY_ROOM_TYPE[type]?.length ?? 0
}

/**
 * Label humain FR pour chaque type de pièce — utilisé en fallback si la pièce
 * n'a pas de nom personnalisé (ex: "Chambre 1", "Salle de bain principale").
 */
export const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  living: 'Salon',
  kitchen: 'Cuisine',
  bedroom: 'Chambre',
  bathroom: 'Salle de bain',
  office: 'Bureau',
  wc: 'WC',
  corridor: 'Couloir',
  storage: 'Rangement',
  basement: 'Cave',
  attic: 'Combles',
  garage: 'Garage',
  other: 'Autre',
}

/**
 * Tente de déduire le type d'une pièce à partir de son nom (case-insensitive).
 * Retourne 'other' si pas de match.
 */
export function inferRoomTypeFromName(name: string): RoomType {
  const lower = name.toLowerCase().trim()
  if (/(salon|s[ée]jour|living)/.test(lower)) return 'living'
  if (/cuisine|kitchen/.test(lower)) return 'kitchen'
  if (/chambre|bedroom|nuit/.test(lower)) return 'bedroom'
  if (/salle.de.bain|sdb|salle.d.eau|bathroom|douche/.test(lower)) return 'bathroom'
  if (/bureau|office/.test(lower)) return 'office'
  if (/^wc$|toilette/.test(lower)) return 'wc'
  if (/couloir|d[ée]gagement|entr[ée]e|hall|corridor/.test(lower)) return 'corridor'
  if (/cellier|d[ée]barras|dressing|rangement|placard/.test(lower)) return 'storage'
  if (/cave|sous.sol|basement/.test(lower)) return 'basement'
  if (/comble|grenier|attic/.test(lower)) return 'attic'
  if (/garage|parking|abri/.test(lower)) return 'garage'
  return 'other'
}
