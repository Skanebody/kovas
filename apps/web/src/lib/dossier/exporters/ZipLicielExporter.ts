import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { buildLicielZip } from '@/lib/exports/zip-liciel'
import { buildZipFileName } from '@/lib/file-naming'
/**
 * KOVAS — Exporter ZIP Liciel agrégé dossier (Partition D).
 *
 * Réutilise `buildLicielZip` (V1 stub : XMLs + photos sans .mdb) et l'agrège
 * sur toutes les missions du dossier. Fallback "dossier vide" si aucune
 * mission rattachée.
 *
 * Cf. CLAUDE.md §3 feature 8 + lib/exports/zip-liciel.ts.
 */
import JSZip from 'jszip'
import { loadDossierContext } from './_common'

export interface ZipLicielExportResult {
  buffer: Buffer
  filename: string
  missionCount: number
}

export async function exportLicielZip(
  dossierId: string,
  orgId: string,
): Promise<ZipLicielExportResult> {
  const ctx = await loadDossierContext(dossierId, orgId)

  const exportedAt = new Date()
  const fileNameCtx = {
    date: exportedAt,
    reference: ctx.dossier.reference,
    client: ctx.client ? { display_name: ctx.client.display_name } : null,
    property: ctx.property,
  }

  // Cas 1 : aucune mission → ZIP "presque vide" avec juste un LISEZ-MOI
  if (ctx.missionIds.length === 0) {
    const zip = new JSZip()
    zip.file(
      'LISEZ-MOI.txt',
      `Dossier KOVAS ${ctx.dossier.reference}\n\nAucune mission rattachée. Ce ZIP est vide.\n`,
    )
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    return {
      buffer,
      filename: buildZipFileName({ ctx: fileNameCtx, target: 'LICIEL' }),
      missionCount: 0,
    }
  }

  // Cas 2 : 1 mission → ZIP Liciel direct (pas d'agrégation)
  const firstMissionId = ctx.missionIds[0]
  if (ctx.missionIds.length === 1 && firstMissionId) {
    const data = await buildMissionExportData(firstMissionId, orgId)
    const buffer = await buildLicielZip(data)
    return {
      buffer,
      filename: buildZipFileName({ ctx: fileNameCtx, target: 'LICIEL' }),
      missionCount: 1,
    }
  }

  // Cas 3 : N missions → wrap chaque ZIP mission dans un méta-ZIP dossier
  const metaZip = new JSZip()
  metaZip.file(
    'LISEZ-MOI.txt',
    [
      `Dossier KOVAS ${ctx.dossier.reference}`,
      '',
      `${ctx.missionIds.length} missions exportées au format Liciel.`,
      "Chaque sous-archive contient les XMLs + photos d'une mission.",
      '',
      `Date export : ${exportedAt.toLocaleString('fr-FR')}`,
    ].join('\n'),
  )

  for (const missionId of ctx.missionIds) {
    const data = await buildMissionExportData(missionId, orgId)
    const buffer = await buildLicielZip(data)
    metaZip.file(`mission_${data.mission.reference}.zip`, buffer)
  }

  const buffer = await metaZip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  return {
    buffer,
    filename: buildZipFileName({ ctx: fileNameCtx, target: 'LICIEL' }),
    missionCount: ctx.missionIds.length,
  }
}
