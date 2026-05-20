import { getCurrentUser } from '@/lib/auth/current-user'
import { exportArchive } from '@/lib/dossier/exporters/ArchiveExporter'
import { sendDossierToClient } from '@/lib/dossier/exporters/ClientEmailExporter'
import { exportPdfReports } from '@/lib/dossier/exporters/PdfReportExporter'
import { exportRawJsonCsv } from '@/lib/dossier/exporters/RawJsonCsvExporter'
import { exportLicielZip } from '@/lib/dossier/exporters/ZipLicielExporter'
import {
  type DossierExportInsert,
  loadDossierContext,
  recordDossierExport,
} from '@/lib/dossier/exporters/_common'
import { calculateProgression } from '@/lib/dossier/progression-calculator'
import type { DiagnosticType } from '@/lib/mission/types'
/**
 * KOVAS — Route handler exports dossier (Partition D).
 *
 * POST /api/dossiers/:id/export/:format
 *
 * Formats acceptés : `liciel_zip` | `pdf_reports` | `client_email` | `archive` | `raw_json_csv`
 *
 * Flow :
 *   1. Auth via getCurrentUser
 *   2. Vérifie l'appartenance multi-tenant (loadDossierContext)
 *   3. Calcule les missing fields via `calculateProgression`
 *   4. Si manques > 0 ET pas `confirmIncomplete` → 409 INCOMPLETE
 *   5. Dispatch vers l'exporter approprié
 *   6. INSERT dossier_exports (historique) — trigger SQL bump `dossiers.exported_count`
 *   7. Réponse :
 *      - binary (Content-Disposition attachment) pour liciel_zip / pdf_reports / archive / raw_json_csv
 *      - JSON { ok, token, expires_at } pour client_email
 *
 * Authority : CLAUDE.md §3 features 8-9 + migration 20260521150000_dossier_refonte.sql.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const VALID_FORMATS = [
  'liciel_zip',
  'pdf_reports',
  'client_email',
  'archive',
  'raw_json_csv',
] as const
type ExportFormat = (typeof VALID_FORMATS)[number]

interface MissingFieldLite {
  diagnostic: DiagnosticType
  label: string
}

interface RequestBody {
  confirmIncomplete?: boolean
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; format: string }> },
) {
  const { id: dossierId, format } = await context.params

  // 1. Validate format
  if (!VALID_FORMATS.includes(format as ExportFormat)) {
    return NextResponse.json(
      { error: `Format inconnu : ${format}. Attendu : ${VALID_FORMATS.join(', ')}.` },
      { status: 400 },
    )
  }
  const exportFormat = format as ExportFormat

  // 2. Auth
  let orgId: string
  let userId: string
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userId = u.user.id
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 3. Body
  let body: RequestBody = {}
  try {
    body = (await request.json().catch(() => ({}))) as RequestBody
  } catch {
    body = {}
  }
  const confirmIncomplete = Boolean(body.confirmIncomplete)

  // 4. Vérifie le dossier (lance 404 si introuvable ou hors org)
  try {
    await loadDossierContext(dossierId, orgId)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'dossier-not-found' },
      { status: 404 },
    )
  }

  const { supabase } = await getCurrentUser()
  const progression = await calculateProgression(supabase, dossierId)
  const missingFields: MissingFieldLite[] = (progression.missingFields ?? []).map((f) => ({
    diagnostic: f.diagnostic,
    label: f.label,
  }))

  // 5. Si manques + pas confirmé → 409
  if (missingFields.length > 0 && !confirmIncomplete) {
    return NextResponse.json(
      {
        error: 'INCOMPLETE',
        missingFields,
        missingFieldsCount: missingFields.length,
      },
      { status: 409 },
    )
  }

  // 6. Dispatch
  try {
    if (exportFormat === 'client_email') {
      const result = await sendDossierToClient(dossierId, orgId)

      const insertPayload: DossierExportInsert = {
        organization_id: orgId,
        dossier_id: dossierId,
        destination: 'client_email',
        was_complete: missingFields.length === 0,
        missing_fields_count: missingFields.length,
        missing_fields_snapshot: missingFields,
        recipient: result.recipientEmail,
        storage_path: result.storagePath,
        download_token: result.token,
        expires_at: result.expiresAt,
        created_by: userId,
      }
      await recordDossierExport(insertPayload)

      return NextResponse.json({
        ok: true,
        token: result.token,
        expires_at: result.expiresAt,
        share_url: result.shareUrl,
      })
    }

    // Binary exporters
    let buffer: Buffer
    let filename: string
    let contentType = 'application/zip'
    let storagePath: string | null = null

    if (exportFormat === 'liciel_zip') {
      const r = await exportLicielZip(dossierId, orgId)
      buffer = r.buffer
      filename = r.filename
    } else if (exportFormat === 'pdf_reports') {
      const r = await exportPdfReports(dossierId, orgId)
      buffer = r.buffer
      filename = r.filename
      contentType = r.contentType
    } else if (exportFormat === 'archive') {
      const r = await exportArchive(dossierId, orgId)
      buffer = r.buffer
      filename = r.filename
      storagePath = r.storagePath
    } else {
      // raw_json_csv
      const r = await exportRawJsonCsv(dossierId, orgId)
      buffer = r.buffer
      filename = r.filename
    }

    // 7. Historique
    const insertPayload: DossierExportInsert = {
      organization_id: orgId,
      dossier_id: dossierId,
      destination: exportFormat,
      was_complete: missingFields.length === 0,
      missing_fields_count: missingFields.length,
      missing_fields_snapshot: missingFields,
      storage_path: storagePath,
      created_by: userId,
    }
    await recordDossierExport(insertPayload)

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur export'
    console.error('[dossier-export]', exportFormat, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
