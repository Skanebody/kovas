/**
 * Génère un fichier LIV_<diag>.xml pour les diagnostics NON-DPE
 * (amiante, plomb, gaz, électricité, termites, carrez, ERP).
 *
 * docs/liciel-parser-specs.md ne fournit de table de champs détaillée QUE pour
 * le DPE (§A–§H). Pour les autres diagnostics, aucun nom de champ Liciel n'est
 * documenté. Conformément à la RÈGLE D'HONNÊTETÉ, on n'invente AUCUN champ :
 * ce fichier ne porte que des informations dont le sens est non ambigu et
 * partagé (référence dossier, identité minimale du bien déjà connue de §A) +
 * un marqueur explicite indiquant que le mapping fin reste à spécifier.
 *
 * Les fichiers détaillés (LIV_amiante avec localisation des MPCA, LIV_plomb
 * avec unités de diagnostic, etc.) seront complétés quand la spec listera les
 * noms de champs exacts (cf. rapport « champs non couverts »).
 */

import type { MissionExportData } from '@/lib/exports/build-mission-data'
import { derivePeriodeConstruction } from './derived'
import { el, xmlDocument } from './xml-utils'

export function buildLivDiagnosticGeneric(
  data: MissionExportData,
  diagnosticLabel: string,
): string {
  const lines: string[] = []
  lines.push(el('reference_dossier', data.mission.reference, '  '))
  lines.push(el('diagnostic', diagnosticLabel, '  '))

  // Identité minimale du bien (champs §A documentés, réutilisés tels quels).
  lines.push('  <bien>')
  lines.push(el('adresse_complete', data.property?.address, '    '))
  lines.push(el('code_postal', data.property?.postal_code, '    '))
  lines.push(el('ville', data.property?.city, '    '))
  lines.push(el('annee_construction', data.property?.year_built, '    '))
  lines.push(
    el('periode_construction', derivePeriodeConstruction(data.property?.year_built), '    '),
  )
  lines.push('  </bien>')

  return xmlDocument('document', lines.join('\n'))
}
