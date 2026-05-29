import type { MissionExportData } from '@/lib/exports/build-mission-data'
import { buildExportZip } from '@/lib/exports/zip-bundle'
import { isoDate, slugifyClientName } from '@/lib/file-naming'
import type { EditorExportResult } from './types'

/**
 * Fabrique de fallback universel partagée par les adaptateurs sans spec native
 * (OBBC, AnalysImmo).
 *
 * Tant que la spec d'import propriétaire de l'éditeur n'a pas été reçue, on
 * délègue à l'export UNIVERSEL (`buildExportZip` : PDF + Word + CSV + JSON +
 * XML structuré + photos). Cet export est indépendant de tout format
 * propriétaire et s'importe de façon semi-manuelle chez n'importe quel éditeur.
 *
 * IMPORTANT (honnêteté) : on n'invente AUCUN champ ni format natif ici. Le seul
 * marqueur spécifique à l'éditeur est le nom de fichier (lisibilité utilisateur).
 *
 * @param editorTag Suffixe éditeur en MAJUSCULES pour le nom de fichier
 *   (ex. `OBBC`, `ANALYSIMMO`).
 */
export async function buildUniversalFallback(
  data: MissionExportData,
  editorTag: string,
): Promise<EditorExportResult> {
  const buffer = await buildExportZip(data)

  // Nom de fichier : KOVAS_export_<EDITEUR>_<client?>_<ref>.zip — auto-descriptif.
  // Construit ici (et non via buildZipFileName) pour rester autonome et couvrir
  // les éditeurs non encore listés dans la convention de nommage centrale.
  const date = isoDate(data.exportedAt)
  const client = data.client?.display_name ? slugifyClientName(data.client.display_name, 40) : null
  const parts = [date, `KOVAS-export-${editorTag}`]
  if (client) parts.push(client)
  parts.push(data.mission.reference)
  const filename = `${parts.join('_')}.zip`

  return { buffer, filename, mimeType: 'application/zip' }
}
