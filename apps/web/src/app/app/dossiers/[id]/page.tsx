import {
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  FileText,
  Mic,
  User,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DangerZone } from '@/components/danger-zone'
import { MissionRealtime } from '@/components/mission-realtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { runChecklist } from '@/lib/checklists'
import { runCoherenceChecks } from '@/lib/coherence-validation'
import { runWorkflow } from '@/lib/dossier-workflow'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import type { VoiceParsedData } from '@/lib/voice-parser'
import { softDeleteDossierAction } from '../actions'
import { AddMissionButton } from './add-mission'
import { ClientUploadLink } from './client-upload-link'
import { CoherenceWarnings } from './coherence-warnings'
import { DossierInfoEdit } from './dossier-info-edit'
import { MissionChecklist } from './mission-checklist'
import { OwnerDocumentsList } from './owner-documents-list'
import { PhotoCapture } from './photo-capture'
import { PhotoGallery } from './photo-gallery'
import { RemoveMissionButton } from './remove-mission-button'
import { RoomsList } from './rooms-list'
import { ResumeButton } from './resume-button'
import { RoomsMatrixView } from './rooms-matrix-view'
import { ShareMissionButton } from './share-button'
import { MissionStatusButton } from './status-button'
import { ViewToggle } from './view-toggle'
import { VoiceNotesList } from './voice-notes-list'
import { VoiceRecorder } from './voice-recorder'
import { WorkflowStepper } from './workflow-stepper'

export const metadata: Metadata = { title: 'Détail dossier' }

const DOSSIER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const DOSSIER_STATUS_VARIANT: Record<string, 'muted' | 'blue' | 'green' | 'orange' | 'red'> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'orange',
  back_office: 'orange',
  done: 'green',
  archived: 'muted',
  cancelled: 'red',
}

export default async function DossierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const [
    { data: dossier },
    { data: missions },
    { data: rooms },
    { data: photos },
    { data: voiceNotes },
    { data: ownerDocs },
    { data: clientsList },
  ] = await Promise.all([
    supabase
      .from('dossiers')
      .select(
        'id, reference, status, scheduled_at, started_at, completed_at, notes, metadata, client_upload_token, client_upload_expires_at, property_id, client_id, properties(address, postal_code, city, surface_total, year_built, property_type), clients(display_name, email)',
      )
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('missions')
      .select('id, reference, type, status, completed_at, metadata')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('dossier_rooms')
      .select('id, name, room_type, surface_m2, position')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('position', { ascending: true }),
    supabase
      .from('photos')
      .select('id, storage_path, width, height, size_bytes, room_id, taken_at, view_type')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('taken_at', { ascending: false }),
    supabase
      .from('voice_notes')
      .select(
        'id, storage_path, duration_seconds, transcript_raw, transcript_structured, ai_confidence, parser_used, room_id, created_at',
      )
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('owner_documents')
      .select(
        'id, storage_path, original_name, size_bytes, mime_type, doc_kind, uploaded_at, reviewed_by_diag, extracted_data, extraction_status, extraction_error',
      )
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('display_name', { ascending: true }),
  ])

  if (!dossier) notFound()

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients
  const missionsList = missions ?? []

  // Workflow stepper state
  const dossierMeta = (dossier.metadata as Record<string, unknown> | null) ?? {}
  const viewPreference: 'rooms' | 'diags' =
    (dossierMeta.viewPreference as 'rooms' | 'diags' | undefined) ?? 'diags'
  const workflowState =
    (dossierMeta.workflowSteps as Record<string, boolean> | undefined) ?? {}

  const workflow = runWorkflow(
    {
      dossier: {
        status: dossier.status,
        started_at: dossier.started_at,
        completed_at: dossier.completed_at,
        notes: dossier.notes,
      },
      property: {
        surface_total: prop?.surface_total ?? null,
        year_built: prop?.year_built ?? null,
        property_type: prop?.property_type ?? null,
      },
      rooms: (rooms ?? []).map((r) => ({ id: r.id, room_type: r.room_type })),
      photos: (photos ?? []).map((p) => ({ room_id: p.room_id })),
      voiceNotes: (voiceNotes ?? []).map((v) => ({ room_id: v.room_id })),
      ownerDocuments: (ownerDocs ?? []).map((d) => ({ doc_kind: d.doc_kind })),
      missionTypes: missionsList.map((m) => m.type),
    },
    workflowState,
  )

  // Coherence warnings
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
      <MissionRealtime missionId={dossier.id} />

      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dossiers">
          <ArrowLeft className="size-4" /> Retour aux dossiers
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-mono text-muted-foreground">{dossier.reference}</p>
          <h1 className="text-2xl font-bold tracking-tight">
            Dossier de visite
          </h1>
          <div className="flex flex-wrap gap-2">
            {missionsList.map((m) => (
              <Badge key={m.id} variant="muted">
                {MISSION_TYPE_LABELS[m.type] ?? m.type}
              </Badge>
            ))}
          </div>
        </div>
        <Badge variant={DOSSIER_STATUS_VARIANT[dossier.status] ?? 'muted'}>
          {DOSSIER_STATUS_LABELS[dossier.status] ?? dossier.status}
        </Badge>
      </div>

      {/* Détails bien + client */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Détails de la visite</CardTitle>
          <DossierInfoEdit
            dossierId={dossier.id}
            scheduledAt={dossier.scheduled_at ?? null}
            notes={dossier.notes ?? null}
            clientId={dossier.client_id ?? null}
            clients={clientsList ?? []}
          />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {prop && (
            <div className="flex items-start gap-2">
              <Building2 className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <Link href={`/app/properties/${dossier.property_id}`} className="hover:underline">
                {prop.address}
                {prop.city ? `, ${prop.postal_code ?? ''} ${prop.city}` : ''}
                {prop.year_built && (
                  <span className="text-muted-foreground"> · {prop.year_built}</span>
                )}
                {prop.surface_total && (
                  <span className="text-muted-foreground"> · {prop.surface_total} m²</span>
                )}
              </Link>
            </div>
          )}
          {client && dossier.client_id && (
            <div className="flex items-start gap-2">
              <User className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <Link href={`/app/clients/${dossier.client_id}`} className="hover:underline">
                {client.display_name}
              </Link>
            </div>
          )}
          {dossier.scheduled_at && (
            <div className="flex items-start gap-2">
              <Calendar className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>
                {new Date(dossier.scheduled_at).toLocaleString('fr-FR', {
                  dateStyle: 'full',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* WORKFLOW STEPPER — la pièce maîtresse */}
      <WorkflowStepper
        dossierId={dossier.id}
        steps={workflow.steps}
        overallProgress={workflow.overallProgress}
      />

      <CoherenceWarnings warnings={coherenceWarnings} />

      {/* Documents propriétaire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="size-4" /> Documents propriétaire ({ownerDocs?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ClientUploadLink
            dossierId={dossier.id}
            token={dossier.client_upload_token ?? null}
            expiresAt={dossier.client_upload_expires_at ?? null}
          />
          <OwnerDocumentsList
            dossierId={dossier.id}
            documents={(ownerDocs ?? []).map((d) => ({
              ...d,
              // Json → typed ExtractedData (cast safe car structure validée par Claude)
              extracted_data: d.extracted_data as never,
            }))}
          />
        </CardContent>
      </Card>

      {/* Pièces */}
      <Card>
        <CardContent className="pt-6">
          <RoomsList dossierId={dossier.id} rooms={rooms ?? []} />
        </CardContent>
      </Card>

      {/* Photos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="size-4" /> Photos terrain ({photos?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {(() => {
            // Compteurs photos par pièce + index pièce (pour nommage)
            const photoCountsByRoom: Record<string, number> = {}
            for (const p of photos ?? []) {
              if (p.room_id) photoCountsByRoom[p.room_id] = (photoCountsByRoom[p.room_id] ?? 0) + 1
            }
            const roomIndexById: Record<string, number> = {}
            ;(rooms ?? []).forEach((r, idx) => {
              roomIndexById[r.id] = idx + 1
            })
            return (
              <PhotoCapture
                dossierId={dossier.id}
                dossierReference={dossier.reference}
                orgId={orgId}
                rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
                photoCountsByRoom={photoCountsByRoom}
                roomIndexById={roomIndexById}
              />
            )
          })()}
          <PhotoGallery
            dossierId={dossier.id}
            rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
            photos={(photos ?? []).map((p) => ({
              id: p.id,
              storage_path: p.storage_path,
              width: p.width,
              height: p.height,
              size_bytes: p.size_bytes,
              room_id: p.room_id,
              taken_at: p.taken_at,
              view_type: (p as { view_type?: string | null }).view_type ?? null,
              location_text: null,
            }))}
          />
        </CardContent>
      </Card>

      {/* Notes vocales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="size-4" /> Notes vocales ({voiceNotes?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <VoiceRecorder
            dossierId={dossier.id}
            orgId={orgId}
            rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name }))}
          />
          <VoiceNotesList
            dossierId={dossier.id}
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

      {/* Toggle Vue par pièce / Vue par diag */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <div>
          <h2 className="text-lg font-semibold">
            {viewPreference === 'rooms' ? `Pièces (${rooms?.length ?? 0})` : `Diagnostics (${missionsList.length})`}
          </h2>
          <p className="text-sm text-muted-foreground">
            {viewPreference === 'rooms'
              ? 'Vue terrain : pour chaque pièce, les tâches de tous les diagnostics applicables.'
              : "Vue bureau : pour chaque diagnostic, sa check-list de complétude et son export."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {viewPreference === 'diags' && (
            <AddMissionButton
              dossierId={dossier.id}
              existingTypes={missionsList.map((m) => m.type)}
            />
          )}
          <ViewToggle dossierId={dossier.id} current={viewPreference} />
        </div>
      </div>

      {viewPreference === 'rooms' ? (
        <RoomsMatrixView
          dossierId={dossier.id}
          rooms={(rooms ?? []).map((r) => ({ id: r.id, name: r.name, room_type: r.room_type }))}
          missionTypes={missionsList.map((m) => m.type as never)}
          photos={(photos ?? []).map((p) => ({ id: p.id, room_id: p.room_id }))}
          voiceNotes={(voiceNotes ?? []).map((v) => ({
            id: v.id,
            room_id: v.room_id,
            transcript_structured: v.transcript_structured,
          }))}
          manualState={
            (((dossier.metadata as Record<string, unknown> | null) ?? {}).roomTasksState as
              | Record<string, boolean>
              | undefined) ?? {}
          }
        />
      ) : (
        <div className="space-y-4">
          {missionsList.map((m) => {
            const missionMeta = (m.metadata as Record<string, unknown> | null) ?? {}
            const manualChecklistState =
              (missionMeta.checklist as Record<string, boolean> | undefined) ?? {}
            const checklist = runChecklist(
              m.type,
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

            return (
              <Card key={m.id} id={`mission-${m.id}`} className="scroll-mt-20">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <CardTitle className="text-base">
                        {MISSION_TYPE_LABELS[m.type] ?? m.type}
                      </CardTitle>
                      <p className="text-xs font-mono text-muted-foreground">{m.reference}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ResumeButton missionId={m.id} status={m.status} />
                      <MissionStatusButton missionId={m.id} currentStatus={m.status as never} />
                      <ShareMissionButton
                        missionId={m.id}
                        missionReference={m.reference}
                        clientEmail={client?.email ?? null}
                      />
                      <RemoveMissionButton
                        missionId={m.id}
                        missionLabel={MISSION_TYPE_LABELS[m.type] ?? m.type}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <MissionChecklist
                    missionId={m.id}
                    items={checklist.items}
                    completion={checklist.completion}
                    requiredOk={checklist.requiredOk}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {dossier.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{dossier.notes}</CardContent>
        </Card>
      )}

      <DangerZone
        entityLabel="dossier"
        onDelete={softDeleteDossierAction.bind(null, dossier.id)}
      />
    </div>
  )
}
