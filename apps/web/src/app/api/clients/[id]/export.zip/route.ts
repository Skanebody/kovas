import { getCurrentUser } from '@/lib/auth/current-user'
import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { generateCsv } from '@/lib/exports/csv'
import { generateDocx } from '@/lib/exports/docx'
import { generateJson } from '@/lib/exports/json'
import { generatePdf } from '@/lib/exports/pdf'
import {
  buildClientArchiveFileName,
  buildDirectoryName,
  missionTypeTag,
  slugify,
  slugifyAddress,
} from '@/lib/file-naming'
import { applyCsvWatermarkLine } from '@/lib/watermark'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { NextResponse } from 'next/server'

/**
 * GET /api/clients/[id]/export.zip
 *
 * Génère UNE archive ZIP unique contenant TOUS les dossiers actifs d'un client
 * (un sous-dossier par dossier KOVAS, avec un sous-sous-dossier par mission
 * contenant PDF + DOCX + CSV + JSON + photos).
 *
 * Cap dur : 50 missions max au total. Au-delà, on retourne 413 et on invite
 * l'utilisateur à exporter dossier par dossier (sinon la route Vercel finit
 * en timeout 90s et le ZIP devient ingérable).
 *
 * Filename : [DATE]_FICHIER-CLIENT_[CLIENT].zip
 *   ex : 2026-05-20_FICHIER-CLIENT_DUPONT-Pierre.zip
 *
 * Arborescence du ZIP :
 *   README.txt
 *   DOS-2026-00012_12-rue-Rivoli-Paris/
 *     MIS-2026-00045_DPE/
 *       rapport.pdf
 *       rapport.docx
 *       donnees.csv
 *       donnees.json
 *       photos/...
 *     MIS-2026-00046_AMIANTE/...
 *   DOS-2026-00021_45-av-Hugo/...
 */

export const runtime = 'nodejs'
export const maxDuration = 90

const MAX_TOTAL_MISSIONS = 50

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: clientId } = await context.params

  let orgId: string
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Client + dossiers actifs (deleted_at IS NULL) + properties + missions
  const { data: client } = await admin
    .from('clients')
    .select('id, display_name')
    .eq('id', clientId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!client) {
    return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  const { data: dossiers } = await admin
    .from('dossiers')
    .select(
      'id, reference, scheduled_at, created_at, properties(address, postal_code, city), missions(id, reference, type, deleted_at)',
    )
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  type DossierRow = {
    id: string
    reference: string
    scheduled_at: string | null
    created_at: string
    properties:
      | { address: string | null; postal_code: string | null; city: string | null }
      | { address: string | null; postal_code: string | null; city: string | null }[]
      | null
    missions: { id: string; reference: string; type: string; deleted_at: string | null }[] | null
  }

  const rows = (dossiers ?? []) as DossierRow[]

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Aucun dossier rattaché à ce client.' }, { status: 404 })
  }

  // Compte total missions actives
  let totalMissions = 0
  for (const d of rows) {
    const missions = (d.missions ?? []).filter((m) => m.deleted_at === null)
    totalMissions += missions.length
  }

  if (totalMissions === 0) {
    return NextResponse.json(
      { error: 'Aucune mission à exporter pour ce client.' },
      { status: 404 },
    )
  }

  if (totalMissions > MAX_TOTAL_MISSIONS) {
    return NextResponse.json(
      {
        error: `Trop de missions (${totalMissions} > ${MAX_TOTAL_MISSIONS}). Exporte par dossier individuel.`,
      },
      { status: 413 },
    )
  }

  // 2. Trial flag (pour watermark CSV + mention README)
  const { data: trial } = await admin
    .from('cabinet_trials')
    .select('converted_to_paid')
    .eq('organization_id', orgId)
    .maybeSingle()
  const isTrial = Boolean(trial && !trial.converted_to_paid)

  // 3. Construction ZIP
  const zip = new JSZip()
  const exportedAt = new Date()

  // README global
  const readme = [
    'Export consolidé KOVAS',
    '======================',
    `Client : ${client.display_name}`,
    `Date export : ${exportedAt.toLocaleString('fr-FR')}`,
    `Dossiers : ${rows.length}`,
    `Missions : ${totalMissions}`,
    '',
    'Structure :',
    '  - 1 sous-dossier par dossier (référence DOS-XXXX)',
    '  - 1 sous-sous-dossier par mission (référence MIS-XXXX + type)',
    '  - Dans chaque mission : rapport.pdf, rapport.docx, donnees.csv, donnees.json + photos/',
    isTrial ? '' : null,
    isTrial ? "⚠ Documents générés pendant l'essai gratuit KOVAS — kovas.fr" : null,
  ]
    .filter(Boolean)
    .join('\n')
  zip.file('README.txt', readme)

  // Map room id → name pour les photos (rempli au fil de l'eau par mission)
  for (const d of rows) {
    const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
    const propertyAddressSlug = prop
      ? slugifyAddress([prop.address, prop.postal_code, prop.city].filter(Boolean).join(' '), 40)
      : null
    // Nom du dossier dans le ZIP : DOS-XXXX_<adresse-courte>
    const dossierFolderParts = [d.reference]
    if (propertyAddressSlug) dossierFolderParts.push(propertyAddressSlug)
    const dossierFolderName =
      dossierFolderParts.join('_') ||
      buildDirectoryName({
        reference: d.reference,
        client: { display_name: client.display_name },
        property: prop ? { city: prop.city ?? null } : null,
      })

    const missions = (d.missions ?? []).filter((m) => m.deleted_at === null)

    for (const m of missions) {
      // buildMissionExportData revalide org + va chercher dossier/property/client
      const data = await buildMissionExportData(m.id, orgId)

      const missionFolderName = `${m.reference}_${missionTypeTag(m.type)}`
      const base = `${dossierFolderName}/${missionFolderName}`

      // PDF
      zip.file(`${base}/rapport.pdf`, generatePdf(data))
      // DOCX
      zip.file(`${base}/rapport.docx`, await generateDocx(data))
      // CSV (watermark si trial)
      let csv = generateCsv(data)
      if (data.isTrial) {
        csv = applyCsvWatermarkLine(csv, data.mission.reference)
      }
      zip.file(`${base}/donnees.csv`, csv)
      // JSON
      zip.file(`${base}/donnees.json`, generateJson(data))

      // Photos : on copie depuis Supabase Storage, organisées par pièce
      if (data.photos.length > 0) {
        const roomNameById: Record<string, string> = {}
        for (const r of data.rooms) roomNameById[r.id] = r.name

        for (const p of data.photos) {
          const { data: blob } = await admin.storage.from('mission-photos').download(p.storage_path)
          if (!blob) continue
          const buffer = Buffer.from(await blob.arrayBuffer())
          const ext = p.storage_path.split('.').pop() ?? 'webp'
          const roomFolder = p.room_id
            ? `photos/${slugify(roomNameById[p.room_id] ?? 'piece', 25)}_${p.room_id.slice(0, 8)}`
            : 'photos/_sans_piece'
          zip.file(`${base}/${roomFolder}/${p.id.slice(0, 8)}.${ext}`, buffer)
        }
      }
    }
  }

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  })

  const filename = buildClientArchiveFileName({
    date: exportedAt,
    client: { display_name: client.display_name },
  })

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
