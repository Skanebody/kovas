/**
 * Formatage d'adresse postale complète (voie + compléments + CP ville).
 * Utilisé pour clients (facturation) et properties (biens).
 */

export type AddressParts = {
  address?: string | null
  postal_code?: string | null
  city?: string | null
  building_letter?: string | null
  apartment_detail?: string | null
  floor_number?: number | null
  address_complement?: string | null
  lot_number?: string | null
}

/** Ligne 2 : bâtiment, appartement, étage, lot, complément libre */
export function formatAddressComplements(parts: AddressParts): string[] {
  const lines: string[] = []
  const detailParts: string[] = []

  if (parts.building_letter) detailParts.push(`Bât. ${parts.building_letter}`)
  if (parts.apartment_detail) detailParts.push(parts.apartment_detail)
  if (typeof parts.floor_number === 'number') {
    detailParts.push(
      parts.floor_number === 0
        ? 'RDC'
        : parts.floor_number > 0
          ? `${parts.floor_number}e étage`
          : `sous-sol ${Math.abs(parts.floor_number)}`,
    )
  }
  if (parts.lot_number) detailParts.push(`Lot ${parts.lot_number}`)
  if (detailParts.length > 0) lines.push(detailParts.join(' · '))

  if (parts.address_complement?.trim()) {
    lines.push(parts.address_complement.trim())
  }

  return lines
}

/** Adresse multi-lignes pour affichage fiche */
export function formatFullAddress(parts: AddressParts): string[] {
  const lines: string[] = []
  if (parts.address?.trim()) lines.push(parts.address.trim())
  lines.push(...formatAddressComplements(parts))
  const locality = [parts.postal_code, parts.city].filter(Boolean).join(' ')
  if (locality) lines.push(locality)
  return lines
}

/** Une seule chaîne (GPS, exports) */
export function formatFullAddressLine(parts: AddressParts): string {
  return formatFullAddress(parts).join(', ')
}
