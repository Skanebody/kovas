import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { generateCsv } from '@/lib/exports/csv'
import { generateJson } from '@/lib/exports/json'
import { buildZipFileName } from '@/lib/file-naming'
/**
 * KOVAS — Exporter brut JSON + CSV (Partition D).
 *
 * Génère un ZIP contenant :
 *   - donnees.json : `dossier_field_values` + metadata complète (toutes missions)
 *   - donnees.csv  : table à plat des champs consolidés (1 ligne par champ)
 *   - mission_<ref>.json : payload mission par mission (réutilise generateJson)
 *
 * Sauvegarde technique ou import logiciel tiers.
 *
 * Cf. CLAUDE.md §3 feature 9.
 */
import JSZip from 'jszip'
import { getAdminClient, loadDossierContext } from './_common'

export interface RawJsonCsvExportResult {
  buffer: Buffer
  filename: string
}

interface DossierFieldValueRow {
  id: string
  dossier_id: string
  diagnostic_type: string | null
  field_path: string | null
  value_text: string | null
  value_number: number | null
  value_json: unknown
  confidence: number | null
  source_kind: string | null
  needs_review: boolean | null
  created_at: string
}

export async function exportRawJsonCsv(
  dossierId: string,
  orgId: string,
): Promise<RawJsonCsvExportResult> {
  const ctx = await loadDossierContext(dossierId, orgId)
  const exportedAt = new Date()
  const fileNameCtx = {
    date: exportedAt,
    reference: ctx.dossier.reference,
    client: ctx.client ? { display_name: ctx.client.display_name } : null,
    property: ctx.property,
  }

  // Charge les `dossier_field_values` consolidés.
  // Cast `as never` : table absente des types DB générés (migration récente).
  const admin = getAdminClient()
  const queryRes = (await admin
    .from('dossier_field_values' as never)
    .select(
      'id, dossier_id, diagnostic_type, field_path, value_text, value_number, value_json, confidence, source_kind, needs_review, created_at',
    )
    .eq('dossier_id', dossierId)) as { data: DossierFieldValueRow[] | null }

  const fields: DossierFieldValueRow[] = queryRes.data ?? []

  const zip = new JSZip()

  // README
  zip.file(
    'README.txt',
    [
      `Export brut KOVAS — Dossier ${ctx.dossier.reference}`,
      '',
      `Date export : ${exportedAt.toLocaleString('fr-FR')}`,
      `Missions    : ${ctx.missionIds.length}`,
      `Champs consolidés : ${fields.length}`,
      '',
      'Contenu :',
      '  - donnees.json : champs consolidés tous diagnostics + metadata',
      '  - donnees.csv  : champs consolidés à plat (1 ligne / champ)',
      '  - mission_<ref>.json : payload détaillé par mission',
    ].join('\n'),
  )

  // donnees.json — tout le dossier
  const dossierJson = {
    kovas_export_version: '1.0',
    export_kind: 'raw_dossier',
    exported_at: exportedAt.toISOString(),
    dossier: {
      id: ctx.dossier.id,
      reference: ctx.dossier.reference,
    },
    client: ctx.client,
    property: ctx.property,
    mission_ids: ctx.missionIds,
    fields,
  }
  zip.file('donnees.json', JSON.stringify(dossierJson, null, 2))

  // donnees.csv — table à plat
  const csvLines: string[] = []
  csvLines.push(
    'diagnostic,field_path,value_text,value_number,value_json,confidence,source_kind,needs_review',
  )
  for (const f of fields) {
    csvLines.push(
      [
        csvCell(f.diagnostic_type),
        csvCell(f.field_path),
        csvCell(f.value_text),
        csvCell(f.value_number),
        csvCell(f.value_json ? JSON.stringify(f.value_json) : ''),
        csvCell(f.confidence),
        csvCell(f.source_kind),
        csvCell(f.needs_review),
      ].join(','),
    )
  }
  zip.file('donnees.csv', `${csvLines.join('\n')}\n`)

  // Payload par mission (réutilise generateJson + generateCsv pour cohérence)
  for (const missionId of ctx.missionIds) {
    const data = await buildMissionExportData(missionId, orgId)
    zip.file(`mission_${data.mission.reference}.json`, generateJson(data))
    zip.file(`mission_${data.mission.reference}.csv`, generateCsv(data))
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
      '_RAW_',
    ),
  }
}

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}
