import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { generatePdf } from '@/lib/exports/pdf'
import { buildReportFileName, buildZipFileName } from '@/lib/file-naming'
import { jsPDF } from 'jspdf'
/**
 * KOVAS — Exporter rapports PDF agrégés dossier (Partition D).
 *
 * - Si 0 mission → PDF "dossier vide" minimal
 * - Si 1 mission → PDF unique (via lib/exports/pdf.ts)
 * - Si N missions → ZIP regroupant N PDFs (un par mission)
 *
 * Cf. CLAUDE.md §3 feature 9.
 */
import JSZip from 'jszip'
import { loadDossierContext } from './_common'

export interface PdfReportExportResult {
  buffer: Buffer
  filename: string
  /** application/pdf si 1 mission, application/zip si N */
  contentType: 'application/pdf' | 'application/zip'
  missionCount: number
}

export async function exportPdfReports(
  dossierId: string,
  orgId: string,
): Promise<PdfReportExportResult> {
  const ctx = await loadDossierContext(dossierId, orgId)
  const exportedAt = new Date()
  const fileNameCtx = {
    date: exportedAt,
    reference: ctx.dossier.reference,
    client: ctx.client ? { display_name: ctx.client.display_name } : null,
    property: ctx.property,
  }

  // Cas 0 : PDF minimal
  if (ctx.missionIds.length === 0) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })
    doc.setFontSize(16)
    doc.text(`Dossier ${ctx.dossier.reference}`, 40, 60)
    doc.setFontSize(11)
    doc.setTextColor(128)
    doc.text('Aucune mission rattachée à ce dossier.', 40, 90)
    const buffer = Buffer.from(doc.output('arraybuffer'))
    return {
      buffer,
      filename: `${ctx.dossier.reference}_rapport.pdf`,
      contentType: 'application/pdf',
      missionCount: 0,
    }
  }

  // Cas 1 : PDF unique
  const firstMissionId = ctx.missionIds[0]
  if (ctx.missionIds.length === 1 && firstMissionId) {
    const data = await buildMissionExportData(firstMissionId, orgId)
    const buffer = generatePdf(data)
    return {
      buffer,
      filename: buildReportFileName({
        ctx: fileNameCtx,
        missionType: data.mission.type,
        ext: 'pdf',
      }),
      contentType: 'application/pdf',
      missionCount: 1,
    }
  }

  // Cas N : ZIP regroupant N PDFs
  const zip = new JSZip()
  for (const missionId of ctx.missionIds) {
    const data = await buildMissionExportData(missionId, orgId)
    const pdfBuffer = generatePdf(data)
    const filename = buildReportFileName({
      ctx: fileNameCtx,
      missionType: data.mission.type,
      ext: 'pdf',
    })
    zip.file(filename, pdfBuffer)
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })
  return {
    buffer,
    filename: buildZipFileName({ ctx: fileNameCtx, target: 'KOVAS' }).replace(
      '_KOVAS-EXPORT_',
      '_PDF-RAPPORTS_',
    ),
    contentType: 'application/zip',
    missionCount: ctx.missionIds.length,
  }
}
