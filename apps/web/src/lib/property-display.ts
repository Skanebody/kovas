/**
 * Helpers pour afficher / formater une adresse de propriété.
 * Gère les détails appartement (apt, lot, étage, bâtiment).
 */

export interface PropertyAddressLike {
  address: string | null
  postal_code?: string | null
  city?: string | null
  apartment_detail?: string | null
  floor_number?: number | null
  building_letter?: string | null
  lot_number?: string | null
}

/**
 * Compose une adresse multi-ligne pour affichage UI.
 * Exemple :
 *   "12 rue de la République"
 *   "Bât. B · Apt 12B · 3e étage · Lot 1234"
 *   "75001 Paris"
 */
export function formatPropertyAddress(p: PropertyAddressLike): {
  primary: string
  apartmentLine: string | null
  cityLine: string
} {
  const apartmentParts: string[] = []
  if (p.building_letter) apartmentParts.push(`Bât. ${p.building_letter}`)
  if (p.apartment_detail) apartmentParts.push(p.apartment_detail)
  if (typeof p.floor_number === 'number') {
    if (p.floor_number === 0) apartmentParts.push('RDC')
    else if (p.floor_number > 0) apartmentParts.push(`${p.floor_number}e étage`)
    else apartmentParts.push(`sous-sol ${Math.abs(p.floor_number)}`)
  }
  if (p.lot_number) apartmentParts.push(`Lot ${p.lot_number}`)

  return {
    primary: p.address ?? '',
    apartmentLine: apartmentParts.length > 0 ? apartmentParts.join(' · ') : null,
    cityLine: [p.postal_code, p.city].filter(Boolean).join(' '),
  }
}

/**
 * Version inline (1 ligne) pour les listes/badges.
 */
export function formatPropertyAddressInline(p: PropertyAddressLike): string {
  const parts: string[] = []
  if (p.address) parts.push(p.address)
  const apt: string[] = []
  if (p.building_letter) apt.push(`Bât. ${p.building_letter}`)
  if (p.apartment_detail) apt.push(p.apartment_detail)
  if (apt.length > 0) parts.push(apt.join(' '))
  if (p.postal_code || p.city) parts.push([p.postal_code, p.city].filter(Boolean).join(' '))
  return parts.join(' · ')
}
