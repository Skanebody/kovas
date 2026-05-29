import type { MissionExportData } from '@/lib/exports/build-mission-data'
import { buildZipFileName } from '@/lib/file-naming'
import { buildLicielZip } from '@/lib/liciel/export'
import type { EditorExportAdapter, EditorExportResult } from './types'

/**
 * Adaptateur Liciel — mapping NATIF EXACT.
 *
 * Délègue à `buildLicielZip` (cf. `lib/liciel/export`) qui produit la structure
 * ZIP propriétaire Liciel (XML spécifiques + photos par pièce + annexes),
 * importable en 1 clic via « Importer XML spécifique ». C'est le seul
 * adaptateur natif aujourd'hui et le patron de référence pour les futurs.
 */
export const licielAdapter: EditorExportAdapter = {
  id: 'liciel',
  label: 'Liciel',
  nativeMapping: true,
  async build(data: MissionExportData): Promise<EditorExportResult> {
    const buffer = await buildLicielZip(data)
    const filename = buildZipFileName({
      ctx: {
        date: data.exportedAt,
        reference: data.mission.reference,
        client: data.client ? { display_name: data.client.display_name } : null,
      },
      target: 'LICIEL',
    })
    return { buffer, filename, mimeType: 'application/zip' }
  },
}
