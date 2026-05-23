/**
 * KOVAS — Helper pré-remplissage pièces standard (mode mission, sidebar pièces).
 *
 * Génère une liste de pièces canoniques à partir des caractéristiques d'un bien
 * (type T1-T6, surface, nb chambres, maison vs appartement). L'utilisateur peut
 * ensuite ajouter/supprimer manuellement depuis la sidebar.
 *
 * Convention surface :
 *   - T1 = 1 pièce principale (studio)
 *   - T2 = 2 pièces (salon + 1 chambre)
 *   - T3 = 3 pièces (salon + 2 chambres)
 *   - T4 = 4 pièces (salon + 3 chambres)
 *   - T5 = 5 pièces (salon + 4 chambres)
 *
 * Les pièces "techniques" (SDB, WC, cuisine, entrée) ne comptent PAS dans le T.
 *
 * Authority : CLAUDE.md §3 feature 4 (templates pièces pré-remplis).
 */

import type { RoomType } from './room-completion'

/** Structure d'une pièce générée par défaut. */
export interface DefaultRoom {
  id: string
  name: string
  type: RoomType
  surfaceSqm: number | null
}

/** Type du bien tel que stocké en DB (label libre, fallback inclus). */
export type PropertyTypeHint =
  | 'studio'
  | 't1'
  | 't2'
  | 't3'
  | 't4'
  | 't5'
  | 't6'
  | 'appartement'
  | 'maison'
  | string
  | null
  | undefined

interface DefaultRoomsInput {
  propertyType: PropertyTypeHint
  surfaceSqm?: number | null
  bedroomsCount?: number | null
}

/**
 * Génère un ID local stable (préfixe `default-`) pour les pièces pré-remplies.
 * En V1.5, on remplacera par les vrais UUID DB côté sync.
 */
let counter = 0
function nextId(prefix: string): string {
  counter += 1
  return `default-${prefix}-${counter}`
}

/**
 * Extrait le nombre de chambres d'un libellé "T3", "t4", "Studio", etc.
 * Retourne null si non détecté.
 */
function extractBedroomsFromPropertyType(pt: PropertyTypeHint): number | null {
  if (!pt) return null
  const m = /^t\s*(\d)/i.exec(String(pt).trim())
  if (m) {
    const t = Number(m[1])
    // T1 = 0 chambres (studio/1 pièce principale)
    // T2 = 1 chambre, T3 = 2 chambres, etc.
    return Math.max(0, t - 1)
  }
  if (/studio/i.test(String(pt))) return 0
  return null
}

function isHouse(pt: PropertyTypeHint): boolean {
  return /maison|house|villa|pavillon/i.test(String(pt ?? ''))
}

/**
 * Génère la liste des pièces standard pour un bien donné.
 *
 * Stratégie : on commence par les pièces principales (T), puis on ajoute
 * cuisine + SDB + WC + entrée. Si maison, on ajoute potentiellement
 * combles/cave/garage si la surface le suggère (> 80 m²).
 *
 * Retourne un array vide si le type est inconnu ET aucun bedroomsCount n'est fourni.
 */
export function generateDefaultRooms({
  propertyType,
  surfaceSqm,
  bedroomsCount,
}: DefaultRoomsInput): DefaultRoom[] {
  counter = 0 // reset à chaque appel pour des IDs stables par mission

  const bedrooms = bedroomsCount ?? extractBedroomsFromPropertyType(propertyType)
  if (bedrooms == null) return []

  const isHouseProperty = isHouse(propertyType)
  const surface = surfaceSqm ?? 0
  const rooms: DefaultRoom[] = []

  // Studio / T1 — 1 seule pièce principale + SDB + WC (cuisine ouverte fréquente)
  if (bedrooms === 0) {
    rooms.push({
      id: nextId('main'),
      name: 'Pièce principale',
      type: 'living',
      surfaceSqm: null,
    })
    rooms.push({
      id: nextId('bath'),
      name: 'Salle de bain',
      type: 'bathroom',
      surfaceSqm: null,
    })
    rooms.push({ id: nextId('wc'), name: 'WC', type: 'wc', surfaceSqm: null })
    return rooms
  }

  // T2+ — Salon + N chambres + cuisine + SDB + WC
  rooms.push({ id: nextId('living'), name: 'Salon', type: 'living', surfaceSqm: null })
  for (let i = 1; i <= bedrooms; i++) {
    rooms.push({
      id: nextId(`bed-${i}`),
      name: bedrooms === 1 ? 'Chambre' : `Chambre ${i}`,
      type: 'bedroom',
      surfaceSqm: null,
    })
  }
  rooms.push({
    id: nextId('kitchen'),
    name: 'Cuisine',
    type: 'kitchen',
    surfaceSqm: null,
  })

  // T5+ ou maison : 2 salles de bain
  if (bedrooms >= 4 || (isHouseProperty && bedrooms >= 3)) {
    rooms.push({
      id: nextId('bath-1'),
      name: 'Salle de bain principale',
      type: 'bathroom',
      surfaceSqm: null,
    })
    rooms.push({
      id: nextId('bath-2'),
      name: 'Salle d’eau',
      type: 'bathroom',
      surfaceSqm: null,
    })
  } else {
    rooms.push({
      id: nextId('bath'),
      name: 'Salle de bain',
      type: 'bathroom',
      surfaceSqm: null,
    })
  }
  rooms.push({ id: nextId('wc'), name: 'WC', type: 'wc', surfaceSqm: null })

  // Maison : ajoute entrée + couloir + éventuellement combles/cave/garage
  if (isHouseProperty) {
    rooms.push({ id: nextId('entry'), name: 'Entrée', type: 'corridor', surfaceSqm: null })
    if (surface > 100) {
      rooms.push({
        id: nextId('corridor'),
        name: 'Couloir',
        type: 'corridor',
        surfaceSqm: null,
      })
    }
    if (surface > 80) {
      rooms.push({ id: nextId('garage'), name: 'Garage', type: 'garage', surfaceSqm: null })
    }
    if (surface > 100) {
      rooms.push({ id: nextId('attic'), name: 'Combles', type: 'attic', surfaceSqm: null })
    }
    if (surface > 120) {
      rooms.push({ id: nextId('basement'), name: 'Cave', type: 'basement', surfaceSqm: null })
    }
  }

  return rooms
}
