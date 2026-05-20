import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { buildExportZip } from '@/lib/exports/zip-bundle'
import { buildZipFileName } from '@/lib/file-naming'
/**
 * KOVAS — Exporter archive complète (Partition D).
 *
 * Génère un ZIP complet (PDFs + photos + voice notes + JSON brut) et l'upload
 * dans le bucket `dossier-archives/<orgId>/<dossierId>/<timestamp>.zip`.
 *
 * Conservation :
 *   - 10 ans (défaut, obligation légale FR diagnostic immobilier)
 *   - 50 ans si AMIANTE actif sur le dossier
 *
 * Pour V1 : on réutilise `buildExportZip` (zip-bundle) mission par mission,
 * agrégé dans un méta-ZIP avec arborescence par mission.
 *
 * Cf. CLAUDE.md §3 feature 8 + RGPD.
 */
import JSZip from 'jszip'
import { getAdminClient, loadDossierContext } from './_common'

export interface ArchiveExportResult {
  buffer: Buffer
  filename: string
  storagePath: string
  retentionYears: number
}

const BUCKET = 'dossier-archives'

export async function exportArchive(
  dossierId: string,
  orgId: string,
): Promise<ArchiveExportResult> {
  const ctx = await loadDossierContext(dossierId, orgId)
  const exportedAt = new Date()
  const retentionYears = ctx.dossier.has_amiante ? 50 : 10

  const fileNameCtx = {
    date: exportedAt,
    reference: ctx.dossier.reference,
    client: ctx.client ? { display_name: ctx.client.display_name } : null,
    property: ctx.property,
  }

  // Méta-ZIP de l'archive
  const archive = new JSZip()
  archive.file(
    'LISEZ-MOI.txt',
    [
      `Archive KOVAS — Dossier ${ctx.dossier.reference}`,
      '',
      `Date export   : ${exportedAt.toLocaleString('fr-FR')}`,
      `Conservation  : ${retentionYears} ans${ctx.dossier.has_amiante ? ' (amiante)' : ''}`,
      `Missions      : ${ctx.missionIds.length}`,
      '',
      'Ce ZIP contient une sous-archive complète par mission :',
      '  - rapport.pdf / rapport.docx / donnees.csv / donnees.json',
      '  - photos terrain organisées par pièce',
      '  - notes vocales structurées (JSON)',
      '',
      'Conservé sur infrastructure EU (Supabase Paris).',
    ].join('\n'),
  )

  for (const missionId of ctx.missionIds) {
    const data = await buildMissionExportData(missionId, orgId)
    const buffer = await buildExportZip(data)
    archive.file(`mission_${data.mission.reference}.zip`, buffer)
  }

  const buffer = await archive.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  // Upload Storage (best-effort : si bucket absent en dev → log + return quand même)
  const timestamp = exportedAt.toISOString().replace(/[:.]/g, '-')
  const storagePath = `${orgId}/${dossierId}/${timestamp}.zip`
  const admin = getAdminClient()
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/zip', upsert: false })
  if (upErr) {
    console.warn('[ArchiveExporter] upload bucket fallback :', upErr.message)
  }

  return {
    buffer,
    filename: buildZipFileName({ ctx: fileNameCtx, target: 'KOVAS' }).replace(
      '_KOVAS-EXPORT_',
      '_ARCHIVE_',
    ),
    storagePath: `${BUCKET}/${storagePath}`,
    retentionYears,
  }
}
