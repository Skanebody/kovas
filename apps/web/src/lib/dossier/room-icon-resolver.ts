/**
 * KOVAS — Resolver d'icône Lucide par type de pièce.
 *
 * Mapping minimal aligné sur `room-templates.ts` (room_type slug). Toute pièce
 * inconnue tombe sur l'icône `DoorOpen` (générique).
 */

import {
  Archive,
  Bath,
  Bed,
  Box,
  Briefcase,
  Car,
  CookingPot,
  DoorClosed,
  DoorOpen,
  Home,
  Layers,
  type LucideIcon,
  Shirt,
  Sofa,
  Square,
  StepForward,
  Toilet,
  UtensilsCrossed,
  Warehouse,
} from 'lucide-react'

const ROOM_ICON_BY_TYPE: Record<string, LucideIcon> = {
  salon: Sofa,
  sejour: Sofa,
  chambre: Bed,
  cuisine: CookingPot,
  salle_de_bain: Bath,
  salle_d_eau: Bath,
  wc: Toilet,
  entree: DoorOpen,
  couloir: DoorOpen,
  bureau: Briefcase,
  cave: Warehouse,
  garage: Warehouse,
  grenier: Layers,
  combles: Layers,
  cellier: Box,
  lingerie: Shirt,
  palier: StepForward,
  autres: Square,
}

export function resolveRoomIcon(type: string | null | undefined): LucideIcon {
  if (!type) return DoorOpen
  const key = type.toLowerCase()
  return ROOM_ICON_BY_TYPE[key] ?? DoorOpen
}

/**
 * Résout une icône Lucide depuis son nom (string). Utilisé par room-mapping.ts
 * qui stocke un `iconName` string (évite cycle d'import + sérialisable côté serveur).
 *
 * Fallback `Square` si le nom n'est pas reconnu.
 */
const ICON_BY_NAME: Record<string, LucideIcon> = {
  Archive,
  Bath,
  Bed,
  Box,
  Briefcase,
  Car,
  CookingPot,
  DoorClosed,
  DoorOpen,
  Home,
  Layers,
  Shirt,
  Sofa,
  Square,
  StepForward,
  Toilet,
  UtensilsCrossed,
  Warehouse,
}

export function resolveLucideIconByName(name: string): LucideIcon {
  return ICON_BY_NAME[name] ?? Square
}
