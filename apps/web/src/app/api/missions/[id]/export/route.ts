import { getCurrentUser } from '@/lib/auth/current-user'
import { getEditorAdapter } from '@/lib/exports/adapters/registry'
import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { buildExportZip } from '@/lib/exports/zip-bundle'
import { buildZipFileName } from '@/lib/file-naming'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * Génère un export mission, routé via le registre d'adaptateurs éditeur :
 *  - ?format=zip (default)        : ZIP universel PDF + Word + CSV + JSON + XML + photos
 *  - ?format=liciel               : ZIP Liciel NATIF EXACT (cf. lib/liciel/export)
 *  - ?format=obbc|analysimmo|oris : fallback universel honnête (spec native à venir)
 *
 * Tout identifiant d'éditeur inconnu retombe sur l'export universel.
 * Rétrocompat : `?format=liciel` et `?format=zip` se comportent comme avant.
 *
 * Réponse : binary stream (Content-Disposition attachment).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: missionId } = await context.params
  const url = new URL(request.url)
  const format = url.searchParams.get('format') ?? 'zip'

  let orgId: string
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const data = await buildMissionExportData(missionId, orgId)

  let buffer: Buffer
  let filename: string

  // Adaptateur éditeur (liciel natif / obbc·analysimmo·oris fallback universel).
  const adapter = getEditorAdapter(format)
  if (adapter) {
    const result = await adapter.build(data)
    buffer = result.buffer
    filename = result.filename
  } else {
    // `format=zip` ou identifiant inconnu → export universel KOVAS par défaut.
    buffer = await buildExportZip(data)
    filename = buildZipFileName({
      ctx: {
        date: data.exportedAt,
        reference: data.mission.reference,
        client: data.client ? { display_name: data.client.display_name } : null,
      },
      target: 'KOVAS',
    })
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
