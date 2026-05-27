import { getCurrentUser } from '@/lib/auth/current-user'
import { buildMissionExportData } from '@/lib/exports/build-mission-data'
import { buildExportZip } from '@/lib/exports/zip-bundle'
import { buildLicielZip } from '@/lib/exports/zip-liciel'
import { buildZipFileName } from '@/lib/file-naming'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 90

/**
 * Génère un export mission :
 *  - ?format=zip (default) : ZIP universel PDF + Word + CSV + JSON + photos
 *  - ?format=liciel : ZIP Liciel (stub V1 : XMLs + photos sans .mdb)
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

  const ctx = {
    date: data.exportedAt,
    reference: data.mission.reference,
    client: data.client ? { display_name: data.client.display_name } : null,
    property: data.property
      ? {
          address: data.property.address,
          city: data.property.city ?? null,
          apartment_detail: null,
          building_letter: null,
        }
      : null,
  }

  if (format === 'liciel') {
    buffer = await buildLicielZip(data)
    filename = buildZipFileName({ ctx, target: 'LICIEL' })
  } else {
    buffer = await buildExportZip(data)
    filename = buildZipFileName({ ctx, target: 'KOVAS' })
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
