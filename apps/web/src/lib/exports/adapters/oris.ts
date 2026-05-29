import type { MissionExportData } from '@/lib/exports/build-mission-data'
import type { EditorExportAdapter, EditorExportResult } from './types'
import { buildUniversalFallback } from './universal-fallback'

/**
 * Adaptateur ORIS.
 *
 * FALLBACK UNIVERSEL — adaptateur natif à implémenter dès réception de la spec
 * d'import éditeur ORIS. En attendant, on délègue à `buildExportZip` (export
 * universel PDF/Word/CSV/JSON/XML, importable de façon semi-manuelle).
 *
 * AUCUN champ ni format propriétaire ORIS n'est inventé ici. Pour bâtir le
 * mapping natif le jour où la spec est disponible, suivre le patron de
 * `lib/liciel/export` (XML spécifiques + structure d'archive propre à l'éditeur).
 */
export const orisAdapter: EditorExportAdapter = {
  id: 'oris',
  label: 'ORIS',
  nativeMapping: false,
  async build(data: MissionExportData): Promise<EditorExportResult> {
    return buildUniversalFallback(data, 'ORIS')
  },
}
