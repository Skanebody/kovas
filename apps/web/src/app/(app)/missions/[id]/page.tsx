import { ArrowLeft, Building2, Calendar, Camera, FileText, Mic, User } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MissionRealtime } from '@/components/mission-realtime'
import { getCurrentUser } from '@/lib/auth/current-user'
import { runChecklist } from '@/lib/checklists'
import { runCoherenceChecks } from '@/lib/coherence-validation'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import type { VoiceParsedData } from '@/lib/voice-parser'
import { ClientUploadLink } from './client-upload-link'
import { CoherenceWarnings } from './coherence-warnings'
import { MissionChecklist } from './mission-checklist'
import { OwnerDocumentsList } from './owner-documents-list'
import { PhotoCapture } from './photo-capture'
import { PhotoGallery } from './photo-gallery'
import { RoomsList } from './rooms-list'
import { MissionStatusButton } from './status-button'
import { VoiceNotesList } from './voice-notes-list'
import { VoiceRecorder } from './voice-recorder'

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
    { data: voiceNotes },
    { data: ownerDocs },
  ] = await Promise.all([
    supabase
      .from('missions')
      .select(
        'id, reference, type, status, scheduled_at, notes, metadata, created_at, property_id, client_id, properties(address, city, postal_code, surface_total, year_built, property_type), clients(display_name)',
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
    supabase
      .from('voice_notes')
      .select('id, storage_path, duration_seconds, transcript_raw, transcript_structured, ai_confidence, parser_used, room_id, created_at')
      .eq('mission_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('owner_documents')
      .select('id, storage_path, original_name, size_bytes, mime_type, doc_kind, uploaded_at, reviewed_by_diag')
      .eq('mission_id', id)
      .eq('organization_id', orgId)
      .order('uploaded_at', { ascending: false }),
  ])

  if (!mission) notFound()

  const prop = Array.isArray(mission.properties) ? mission.properties[0] : mission.properties
  const client = Array.isArray(mission.clients) ? mission.clients[0] : mission.clients

  // Get mission with token for upload link UI
  const { data: missionFull } = await supabase
    .from('missions')
    .select('client_upload_token, client_upload_expires_at')
    .eq('id', id)
    .single()

  // Compute checklist state
  const metadata = (mission.metadata as Record<string, unknown> | null) ?? {}
  const manualChecklistState =
    (metadata.checklist as Record<string, boolean> | undefined) ?? {}
  const checklist = runChecklist(
    mission.type,
    {
      rooms: (rooms ?? []).map((r) => ({ id: r.id, room_type: r.room_type })),
      photos: (photos ?? []).map((p) => ({ room_id: p.room_id })),
      voiceNotes: (voiceNotes ?? []).map((v) => ({
        room_id: v.room_id,
        transcript_structured: v.transcript_structured,
      })),
      property: {
        surface_total: prop?.surface_total ?? null,
        year_built: prop?.year_built ?? null,
        property_type: prop?.property_type ?? null,
      },
    },
    manualChecklistState,
  )

  // Coherence warnings (règles métier sans IA)
  const coherenceWarnings = runCoherenceChecks({
    property: {
      surface_total: prop?.surface_total ?? null,
      year_built: prop?.year_built ?? null,
      property_type: prop?.property_type ?? null,
    },
    voiceNotes: (voiceNotes ?? []).map((v) => {
      const parsed = (v.transcript_structured as VoiceParsedData | null) ?? null
      return {
        surface_m2: parsed?.surface_m2,
        year_built: parsed?.year_built,
        equipment: parsed?.equipment ?? [],
      }
    }),
  })

  return (
    <div className="max-w-4xl space-y-6">
      <MissionRealtime missionId={mission.id} />
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
        </div>
        <MissionStatusButton missionId={mission.id} currentStatus={mission.status as never} />
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

      <MissionChecklist
        missionId={mission.id}
        items={checklist.items}
        completion={checklist.completion}
        requiredOk={checklist.requiredOk}
      />

      <CoherenceWarnings warnings={coherenceWarnings} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" /> Documents propriétaire ({ownerDocs?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ClientUploadLink
            missionId={mission.id}
            token={missionFull?.client_upload_token ?? null}
            expiresAt={missionFull?.client_upload_expires_at ?? null}
          />
          <OwnerDocumentsList missionId={mission.id} documents={ownerDocs ?? []} />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="size-4" /> Notes vocales ({voiceNotes?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <VoiceRecorder
            missionId={mission.id}
            orgId={orgId}
            rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
          />
          <VoiceNotesList
            missionId={mission.id}
            rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
            notes={(voiceNotes ?? []).map((n) => ({
              id: n.id,
              storage_path: n.storage_path,
              duration_seconds: n.duration_seconds,
              transcript_raw: n.transcript_raw,
              transcript_structured: n.transcript_structured as VoiceParsedData | null,
              ai_confidence: n.ai_confidence,
              parser_used: n.parser_used,
              room_id: n.room_id,
              created_at: n.created_at,
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
