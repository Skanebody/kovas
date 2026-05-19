import { getCurrentUser } from '@/lib/auth/current-user'
import { buildIcs, buildIcsFileName } from '@/lib/ics'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { NextResponse } from 'next/server'

/**
 * GET /api/dossiers/[id]/calendar.ics
 * Télécharge un fichier .ics pour le dossier — importable dans n'importe
 * quel agenda (Google, Apple, Outlook, Thunderbird).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: dossier } = await supabase
    .from('dossiers')
    .select(
      'id, reference, scheduled_at, notes, properties(address, postal_code, city), clients(display_name, phone), missions(type)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!dossier) {
    return NextResponse.json({ error: 'Dossier introuvable' }, { status: 404 })
  }
  if (!dossier.scheduled_at) {
    return NextResponse.json({ error: 'Pas de date planifiée sur ce dossier' }, { status: 400 })
  }

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients
  const missions = (dossier.missions ?? []) as { type: string }[]

  const missionLabels = missions
    .map((m) => MISSION_TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type)
    .join(', ')

  const address = prop ? [prop.address, prop.postal_code, prop.city].filter(Boolean).join(' ') : ''

  const summary = `Diagnostic ${missionLabels || ''} — ${client?.display_name ?? 'Client'}`.trim()

  const descriptionParts: string[] = []
  descriptionParts.push(`Dossier ${dossier.reference}`)
  if (missionLabels) descriptionParts.push(`Diagnostics : ${missionLabels}`)
  if (client?.display_name) descriptionParts.push(`Client : ${client.display_name}`)
  if (client?.phone) descriptionParts.push(`Tél : ${client.phone}`)
  if (dossier.notes) descriptionParts.push(`Notes : ${dossier.notes}`)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'
  const dossierUrl = `${baseUrl}/app/dossiers/${dossier.id}`

  const ics = buildIcs({
    uid: `kovas-${dossier.id}@kovas.fr`,
    start: new Date(dossier.scheduled_at),
    durationMinutes: 90,
    summary,
    description: descriptionParts.join('\n'),
    location: address,
    url: dossierUrl,
  })

  const filename = buildIcsFileName({
    date: new Date(dossier.scheduled_at),
    reference: dossier.reference,
    client: client ? { display_name: client.display_name } : null,
    property: prop
      ? {
          address: prop.address,
          city: prop.city ?? null,
          apartment_detail: null,
          building_letter: null,
        }
      : null,
  })

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
