/**
 * Génère XML/LIV_administratif.xml — donneur d'ordre & propriétaire.
 *
 * Mapping spec §B (docs/liciel-parser-specs.md) :
 *   clients.first_name + last_name → LIV_administratif.proprietaire_nom_prenom
 *   clients.address               → LIV_administratif.proprietaire_adresse
 *   clients.phone                 → LIV_administratif.proprietaire_telephone
 *   clients.email                 → LIV_administratif.proprietaire_email
 *
 * Champs spec NON couverts (pas de source KOVAS dans MissionExportData) :
 *   - donneur_ordre_*  : KOVAS ne distingue pas encore donneur d'ordre ≠ propriétaire
 *   - agent_*          : pas d'agent immobilier modélisé
 *   - custom_fields    : table client_custom_fields prévue V1.5 (spec §3),
 *                        non disponible dans MissionExportData → nœud omis.
 * Ces champs sont laissés absents (jamais inventés).
 */

import type { MissionExportData } from '@/lib/exports/build-mission-data'
import { applyZipLicielWatermark } from '@/lib/watermark'
import { el, xmlDocument } from './xml-utils'

/**
 * Compose le nom complet propriétaire depuis first_name + last_name.
 * Fallback sur display_name si les composantes ne sont pas renseignées
 * (display_name est toujours présent côté DB).
 */
function ownerFullName(client: NonNullable<MissionExportData['client']>): string {
  const composed = [client.first_name, client.last_name]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(' ')
    .trim()
  return composed || client.display_name
}

export function buildLivAdministratif(data: MissionExportData): string {
  const { client } = data
  const lines: string[] = []

  lines.push(el('reference_dossier', data.mission.reference, '  '))

  // Propriétaire (spec §B — proprietaire_*)
  lines.push('  <proprietaire>')
  if (client) {
    lines.push(el('nom_prenom', ownerFullName(client), '    '))
    lines.push(el('adresse', client.address, '    '))
    lines.push(el('telephone', client.phone, '    '))
    lines.push(el('email', client.email, '    '))
  } else {
    // Champ obligatoire spec mais pas de client → balises vides explicites.
    lines.push(el('nom_prenom', null, '    '))
    lines.push(el('adresse', null, '    '))
    lines.push(el('telephone', null, '    '))
    lines.push(el('email', null, '    '))
  }
  lines.push('  </proprietaire>')

  let xml = xmlDocument('document', lines.join('\n'))

  // Watermark essai (injecté dans <notes_administratives>, visible après import).
  if (data.isTrial) xml = applyZipLicielWatermark(xml)

  return xml
}
