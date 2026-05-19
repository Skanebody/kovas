import { MissionRealtime } from '@/components/mission-realtime'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { getCurrentUser } from '@/lib/auth/current-user'
import { runChecklist } from '@/lib/checklists'
import { runCoherenceChecks } from '@/lib/coherence-validation'
import { runWorkflow } from '@/lib/dossier-workflow'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import type { VoiceParsedData } from '@/lib/voice-parser'
import { ArrowLeft, Calendar, Camera, FileText, MapPin, Mic, User } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddMissionButton } from './add-mission'
import { ClientUploadLink } from './client-upload-link'
import { CoherenceWarnings } from './coherence-warnings'
import { DiagnosticStatusPills } from './diagnostic-status-pills'
import { DossierInfoEdit } from './dossier-info-edit'
import { DossierMoreMenu } from './dossier-more-menu'
import { MissionChecklist } from './mission-checklist'
import { type MissionDrawerItem, MissionsWithDrawer } from './missions-with-drawer'
import { OwnerDocumentsList } from './owner-documents-list'
import { PhotoCapture } from './photo-capture'
import { PhotoGallery } from './photo-gallery'
import { RemoveMissionButton } from './remove-mission-button'
import { ResumeButton } from './resume-button'
import { RoomsList } from './rooms-list'
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

/**
 * Compose l'adresse en évitant la duplication ville si BAN l'a déjà mise dans `address`.
 */
function compactAddress(
  prop: {
    address: string | null
    postal_code: string | null
    city: string | null
  } | null,
): string {
  if (!prop) return ''
  const a = prop.address ?? ''
  const c = prop.city ?? ''
  const cp = prop.postal_code ?? ''
  if (c && a.toLowerCase().includes(c.toLowerCase())) return a
  return [a, [cp, c].filter(Boolean).join(' ')].filter(Boolean).join(', ')
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
  const workflowState = (dossierMeta.workflowSteps as Record<string, boolean> | undefined) ?? {}

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

  // Pré-calcul checklist par mission (utilisé pour les pills + cards)
  const missionsWithChecklist = missionsList.map((m) => {
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
    const percentage = Math.round(checklist.completion * 100)
    const missingRequiredCount = checklist.items.filter((it) => {
      const done = it.status === 'auto_ok' || it.manualChecked === true
      return it.required && !done
    }).length
    return { mission: m, checklist, percentage, missingRequiredCount }
  })

  const fullAddress = compactAddress(prop)

  return (
    <div className="max-w-4xl space-y-4">
      <MissionRealtime missionId={dossier.id} />

      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dossiers">
          <ArrowLeft className="size-4" /> Retour aux dossiers
        </Link>
      </Button>

      <Card variant="opaque" padding="lg" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
              {dossier.reference}
            </p>
            <h1 className="font-serif italic font-normal text-3xl md:text-4xl tracking-tight text-ink leading-[1.1]">
              {client?.display_name ?? 'Dossier de visite'}
            </h1>
            {fullAddress ? (
              <p className="text-[14px] text-ink-soft flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-ink-mute" />
                {fullAddress}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={DOSSIER_STATUS_VARIANT[dossier.status] ?? 'muted'}>
              {DOSSIER_STATUS_LABELS[dossier.status] ?? dossier.status}
            </Badge>
            <DossierMoreMenu dossierId={dossier.id} />
          </div>
        </div>
        {(client || dossier.scheduled_at) && (
          <div className="flex flex-wrap items-center gap-4 text-[12px] text-ink-mute pt-2 border-t border-rule/80">
            {client && dossier.client_id && (
              <Link
                href={`/app/clients/${dossier.client_id}`}
                className="flex items-center gap-1 hover:text-ink transition-colors duration-fast"
              >
                <User className="size-3.5" /> {client.display_name}
              </Link>
            )}
            {dossier.scheduled_at && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {new Date(dossier.scheduled_at).toLocaleString('fr-FR', {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })}
                <a
                  href={`/api/dossiers/${dossier.id}/calendar.ics`}
                  download
                  className="ml-2 underline-offset-4 hover:underline hover:text-ink"
                >
                  .ics
                </a>
              </span>
            )}
          </div>
        )}
      </Card>

      {/* Pills statut diagnostics — scan visuel rapide */}
      {missionsWithChecklist.length > 0 && (
        <DiagnosticStatusPills
          pills={missionsWithChecklist.map(({ mission, percentage }) => ({
            missionId: mission.id,
            type: mission.type,
            label: MISSION_TYPE_LABELS[mission.type]?.split(' ')[0] ?? mission.type,
            percentage,
          }))}
        />
      )}

      <Card variant="opaque" padding="default" className="flex flex-wrap items-center gap-3">
        <MapPin className="size-4 text-ink-mute shrink-0" />
        {prop ? (
          <Link
            href={`/app/properties/${dossier.property_id}`}
            className="text-[14px] font-medium text-ink hover:underline truncate flex-1 min-w-0"
          >
            {fullAddress || 'Bien sans adresse'}
          </Link>
        ) : (
          <span className="text-[13px] text-ink-mute flex-1">Aucun bien rattaché</span>
        )}
        {prop?.year_built && (
          <span className="text-[11px] text-ink-mute">{prop.year_built}</span>
        )}
        {prop?.surface_total && (
          <span className="text-[11px] text-ink-mute">· {prop.surface_total} m²</span>
        )}
        <DossierInfoEdit
          dossierId={dossier.id}
          scheduledAt={dossier.scheduled_at ?? null}
          notes={dossier.notes ?? null}
          clientId={dossier.client_id ?? null}
          clients={clientsList ?? []}
        />
      </Card>

      {/* WORKFLOW STEPPER — la pièce maîtresse */}
      <WorkflowStepper
        dossierId={dossier.id}
        steps={workflow.steps}
        overallProgress={workflow.overallProgress}
      />

      <CoherenceWarnings warnings={coherenceWarnings} />

      {/* Documents propriétaire — collapsible */}
      <CollapsibleSection
        storageKey={`kovas_dossier_${dossier.id}_owner_docs`}
        title={
          <>
            <FileText className="size-4" /> Documents propriétaire
          </>
        }
        meta={`(${ownerDocs?.length ?? 0})`}
      >
        <div className="space-y-6">
          <ClientUploadLink
            dossierId={dossier.id}
            token={dossier.client_upload_token ?? null}
            expiresAt={dossier.client_upload_expires_at ?? null}
          />
          <OwnerDocumentsList
            dossierId={dossier.id}
            documents={(ownerDocs ?? []).map((d) => ({
              ...d,
              extracted_data: d.extracted_data as never,
            }))}
          />
        </div>
      </CollapsibleSection>

      {/* Pièces — ouvert si vide (setup needed), fermé sinon */}
      <CollapsibleSection
        storageKey={`kovas_dossier_${dossier.id}_rooms`}
        defaultExpanded={(rooms?.length ?? 0) === 0}
        title={<>Pièces du bien</>}
        meta={`(${rooms?.length ?? 0})`}
      >
        <RoomsList dossierId={dossier.id} rooms={rooms ?? []} />
      </CollapsibleSection>

      {/* Photos — ouvert si aucune photo (setup terrain), fermé sinon (review) */}
      <CollapsibleSection
        storageKey={`kovas_dossier_${dossier.id}_photos`}
        defaultExpanded={(photos?.length ?? 0) === 0}
        title={
          <>
            <Camera className="size-4" /> Photos terrain
          </>
        }
        meta={`(${photos?.length ?? 0})`}
      >
        <div className="space-y-6">
          {(() => {
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
        </div>
      </CollapsibleSection>

      {/* Notes vocales — fermé par défaut (action terrain via Drawer mode mission) */}
      <CollapsibleSection
        storageKey={`kovas_dossier_${dossier.id}_voice`}
        title={
          <>
            <Mic className="size-4" /> Notes vocales
          </>
        }
        meta={`(${voiceNotes?.length ?? 0})`}
      >
        <div className="space-y-6">
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
        </div>
      </CollapsibleSection>

      {/* Toggle Vue par pièce / Vue par diag */}
      <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
        <div className="space-y-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
            {viewPreference === 'rooms' ? 'Vue terrain' : 'Vue bureau'}
          </p>
          <h2 className="font-serif italic font-normal text-2xl text-ink leading-tight">
            {viewPreference === 'rooms'
              ? `${rooms?.length ?? 0} ${(rooms?.length ?? 0) === 1 ? 'pièce' : 'pièces'}.`
              : `${missionsList.length} ${missionsList.length === 1 ? 'diagnostic' : 'diagnostics'}.`}
          </h2>
          <p className="text-sm text-ink-mute max-w-xl">
            {viewPreference === 'rooms'
              ? 'Pour chaque pièce, les tâches de tous les diagnostics applicables.'
              : 'Pour chaque diagnostic, sa check-list de complétude et son export.'}
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
        (() => {
          // Sections embarquées dans le drawer (réutilisent les composants existants).
          // Photos / voice notes / pièces restent au niveau dossier — pas de mission_id.
          const photoCountsByRoom: Record<string, number> = {}
          for (const p of photos ?? []) {
            if (p.room_id) photoCountsByRoom[p.room_id] = (photoCountsByRoom[p.room_id] ?? 0) + 1
          }
          const roomIndexById: Record<string, number> = {}
          ;(rooms ?? []).forEach((r, idx) => {
            roomIndexById[r.id] = idx + 1
          })
          const roomsArr = (rooms ?? []).map((r) => ({ id: r.id, name: r.name }))

          const sharedPhotoSection = (
            <>
              <PhotoCapture
                dossierId={dossier.id}
                dossierReference={dossier.reference}
                orgId={orgId}
                rooms={roomsArr}
                photoCountsByRoom={photoCountsByRoom}
                roomIndexById={roomIndexById}
              />
              <PhotoGallery
                dossierId={dossier.id}
                rooms={roomsArr}
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
            </>
          )

          const sharedVoiceSection = (
            <>
              <VoiceRecorder dossierId={dossier.id} orgId={orgId} rooms={roomsArr} />
              <VoiceNotesList
                dossierId={dossier.id}
                rooms={roomsArr}
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
            </>
          )

          const sharedRoomsSection = <RoomsList dossierId={dossier.id} rooms={rooms ?? []} />

          const items: MissionDrawerItem[] = missionsWithChecklist.map(
            ({ mission: m, checklist, percentage, missingRequiredCount }) => ({
              id: m.id,
              type: m.type,
              typeLabel: MISSION_TYPE_LABELS[m.type] ?? m.type,
              reference: m.reference,
              status: m.status,
              percentage,
              missingRequiredCount,
              checklistItems: checklist.items,
              checklistCompletion: checklist.completion,
              checklistRequiredOk: checklist.requiredOk,
              headerActions: (
                <>
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
                </>
              ),
              checklistContent: (
                <MissionChecklist
                  missionId={m.id}
                  items={checklist.items}
                  completion={checklist.completion}
                  requiredOk={checklist.requiredOk}
                />
              ),
              roomsSection: sharedRoomsSection,
              photoSection: sharedPhotoSection,
              voiceSection: sharedVoiceSection,
            }),
          )

          return <MissionsWithDrawer missions={items} propertyAddress={fullAddress} />
        })()
      )}

      {dossier.notes && (
        <Card variant="opaque" padding="default">
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-ink-soft">{dossier.notes}</CardContent>
        </Card>
      )}
    </div>
  )
}
