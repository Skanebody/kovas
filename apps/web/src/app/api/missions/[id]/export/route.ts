import { NextResponse } from 'next/server'
import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { buildExportZip } from '@/lib/exports/zip-bundle'
import { buildLicielZip } from '@/lib/exports/zip-liciel'
import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * Génère un export mission :
 *  - ?format=zip (default) : ZIP universel PDF + Word + CSV + JSON + photos
 *  - ?format=liciel : ZIP Liciel (stub V1 : XMLs + photos sans .mdb)
 *
 * Réponse : binary stream (Content-Disposition attachment).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  if (format === 'liciel') {
    buffer = await buildLicielZip(data)
    filename = `LICIEL_${data.mission.reference}.zip`
  } else {
    buffer = await buildExportZip(data)
    filename = `KOVAS_${data.mission.reference}.zip`
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
