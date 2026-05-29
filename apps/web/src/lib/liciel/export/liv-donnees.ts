/**
 * Génère XML/LIV_donnees.xml — « Données principales » (spec §1).
 *
 * La spec ne détaille pas de table de champs pour LIV_donnees ; les champs du
 * bien (§A) sont rattachés à LIV_DPE.*. LIV_donnees porte donc les métadonnées
 * globales du dossier : référence, date d'export, organisation émettrice.
 *
 * RÈGLE D'HONNÊTETÉ : aucun nom de champ inventé. On reste sur des balises
 * descriptives génériques (reference_dossier, date_export, cabinet_emetteur)
 * qui ne prétendent pas mapper un champ Liciel précis non documenté.
 */

import type { MissionExportData } from '@/lib/exports/build-mission-data'
import { el, isoDate, xmlDocument } from './xml-utils'

export function buildLivDonnees(data: MissionExportData): string {
  const lines: string[] = []
  lines.push(el('reference_dossier', data.mission.reference, '  '))
  lines.push(el('type_mission_kovas', data.mission.type, '  '))
  lines.push(el('date_export', isoDate(data.exportedAt), '  '))
  lines.push(el('cabinet_emetteur', data.organization?.name, '  '))
  return xmlDocument('document', lines.join('\n'))
}
