import { ArrowLeft, Building2, Calendar, Camera, User } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  MISSION_STATUS_LABELS,
  MISSION_STATUS_VARIANT,
  MISSION_TYPE_LABELS,
} from '@/lib/mission-helpers'
import { PhotoCapture } from './photo-capture'
import { PhotoGallery } from './photo-gallery'
import { RoomsList } from './rooms-list'

export const metadata: Metadata = { title: 'Détail mission' }

export default async function MissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const [
    { data: mission },
    { data: rooms },
    { data: photos },
  ] = await Promise.all([
    supabase
      .from('missions')
      .select(
        'id, reference, type, status, scheduled_at, notes, created_at, property_id, client_id, properties(address, city, postal_code), clients(display_name)',
      )
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('mission_rooms')
      .select('id, name, room_type, surface_m2, position')
      .eq('mission_id', id)
      .eq('organization_id', orgId)
      .order('position', { ascending: true }),
    supabase
      .from('photos')
      .select('id, storage_path, width, height, size_bytes, room_id, taken_at')
      .eq('mission_id', id)
      .eq('organization_id', orgId)
      .order('taken_at', { ascending: false }),
  ])

  if (!mission) notFound()

  const prop = Array.isArray(mission.properties) ? mission.properties[0] : mission.properties
  const client = Array.isArray(mission.clients) ? mission.clients[0] : mission.clients

  return (
    <div className="max-w-4xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/missions">
          <ArrowLeft className="size-4" /> Retour aux missions
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-mono text-muted-foreground">{mission.reference}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            {MISSION_TYPE_LABELS[mission.type] ?? mission.type}
          </h1>
          <Badge variant={MISSION_STATUS_VARIANT[mission.status] ?? 'muted'}>
            {MISSION_STATUS_LABELS[mission.status] ?? mission.status}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Détails</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {prop && (
            <div className="flex items-start gap-2">
              <Building2 className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <Link href={`/app/properties/${mission.property_id}`} className="hover:underline">
                {prop.address}
                {prop.city ? `, ${prop.postal_code ?? ''} ${prop.city}` : ''}
              </Link>
            </div>
          )}
          {client && mission.client_id && (
            <div className="flex items-start gap-2">
              <User className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <Link href={`/app/clients/${mission.client_id}`} className="hover:underline">
                {client.display_name}
              </Link>
            </div>
          )}
          {mission.scheduled_at && (
            <div className="flex items-start gap-2">
              <Calendar className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>
                {new Date(mission.scheduled_at).toLocaleString('fr-FR', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <RoomsList missionId={mission.id} rooms={rooms ?? []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="size-4" /> Photos terrain ({photos?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <PhotoCapture
            missionId={mission.id}
            orgId={orgId}
            rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
          />
          <PhotoGallery
            missionId={mission.id}
            rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
            photos={(photos ?? []).map((p) => ({
              id: p.id,
              storage_path: p.storage_path,
              width: p.width,
              height: p.height,
              size_bytes: p.size_bytes,
              room_id: p.room_id,
              taken_at: p.taken_at,
              location_text: null,
            }))}
          />
        </CardContent>
      </Card>

      {mission.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{mission.notes}</CardContent>
        </Card>
      )}
    </div>
  )
}
