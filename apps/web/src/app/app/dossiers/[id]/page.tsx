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
import {
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Camera,
  FileText,
  MapPin,
  Mic,
  User,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddMissionButton } from './add-mission'
import { ClientUploadLink } from './client-upload-link'
import { CoherenceWarnings } from './coherence-warnings'
import { DossierInfoEdit } from './dossier-info-edit'
import { DossierMoreMenu } from './dossier-more-menu'
import { MissionActionsMenu } from './mission-actions-menu'
import { MissionChecklist } from './mission-checklist'
import { type MissionDrawerItem, MissionsWithDrawer } from './missions-with-drawer'
import { OwnerDocumentsList } from './owner-documents-list'
import { PhotoCapture } from './photo-capture'
import { PhotoGallery } from './photo-gallery'
import { ResumeButton } from './resume-button'
import { RoomsList } from './rooms-list'
import { RoomsMatrixView } from './rooms-matrix-view'
import { ShareMissionButton } from './share-button'
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
 * Compose l'adresse en évitant la duplication ville si BAN l'a déjà mise dans
 * `address`. Inclut bâtiment / étage / appartement / lot saisis lors du RDV
 * pour que le diagnostiqueur n'ait pas à les redemander sur place.
 */
function compactAddress(
  prop: {
    address: string | null
    postal_code: string | null
    city: string | null
    building_letter?: string | null
    apartment_detail?: string | null
    floor_number?: number | null
    lot_number?: string | null
  } | null,
): string {
  if (!prop) return ''
  const a = prop.address ?? ''
  const c = prop.city ?? ''
  const cp = prop.postal_code ?? ''
  // Compléments (bât / étage / apt / lot)
  const detailParts: string[] = []
  if (prop.building_letter) detailParts.push(`Bât. ${prop.building_letter}`)
  if (prop.apartment_detail) detailParts.push(prop.apartment_detail)
  if (typeof prop.floor_number === 'number') {
    detailParts.push(
      prop.floor_number === 0
        ? 'RDC'
        : prop.floor_number > 0
          ? `${prop.floor_number}e étage`
          : `sous-sol ${Math.abs(prop.floor_number)}`,
    )
  }
  if (prop.lot_number) detailParts.push(`Lot ${prop.lot_number}`)

  const streetPart =
    c && a.toLowerCase().includes(c.toLowerCase())
      ? a
      : [a, [cp, c].filter(Boolean).join(' ')].filter(Boolean).join(', ')

  return detailParts.length > 0 ? `${streetPart} — ${detailParts.join(' · ')}` : streetPart
}

/**
 * Calcule le nombre de jours restants avant le RDV (négatif si passé).
 * Renvoie null si pas de RDV planifié.
 */
function daysUntil(scheduledAt: string | null): number | null {
  if (!scheduledAt) return null
  const target = new Date(scheduledAt).getTime()
  const now = Date.now()
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24))
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
        'id, reference, status, scheduled_at, started_at, completed_at, notes, metadata, client_upload_token, client_upload_expires_at, property_id, client_id, properties(address, postal_code, city, surface_total, year_built, property_type, building_letter, apartment_detail, floor_number, lot_number), clients(display_name, email, phone)',
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

  // Récap sidebar — agrégations légères pour l'aperçu mission
  const totalMissions = missionsList.length
  const completedMissions = missionsWithChecklist.filter((m) => m.percentage >= 100).length
  const totalPhotos = photos?.length ?? 0
  const totalVoiceNotes = voiceNotes?.length ?? 0
  const daysToRdv = daysUntil(dossier.scheduled_at ?? null)
  const overallPct = Math.round(workflow.overallProgress * 100)

  // Préparation des sections terrain partagées dans le drawer (vue par diag)
  const photoCountsByRoom: Record<string, number> = {}
  for (const p of photos ?? []) {
    if (p.room_id) photoCountsByRoom[p.room_id] = (photoCountsByRoom[p.room_id] ?? 0) + 1
  }
  const roomIndexById: Record<string, number> = {}
  ;(rooms ?? []).forEach((r, idx) => {
    roomIndexById[r.id] = idx + 1
  })
  const roomsArr = (rooms ?? []).map((r) => ({ id: r.id, name: r.name }))

  // Section Photos — réutilisée par le drawer mission ET par la zone terrain principale
  const photoCaptureNode = (
    <PhotoCapture
      dossierId={dossier.id}
      dossierReference={dossier.reference}
      orgId={orgId}
      rooms={roomsArr}
      photoCountsByRoom={photoCountsByRoom}
      roomIndexById={roomIndexById}
    />
  )
  const photoGalleryNode = (
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
  )

  // Section Voice — réutilisée par le drawer mission ET par la zone terrain principale
  const voiceRecorderNode = <VoiceRecorder dossierId={dossier.id} orgId={orgId} rooms={roomsArr} />
  const voiceNotesListNode = (
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
  )

  // Bundles utilisés dans le drawer (vue par diagnostic)
  const sharedPhotoSection = (
    <>
      {photoCaptureNode}
      {photoGalleryNode}
    </>
  )
  const sharedVoiceSection = (
    <>
      {voiceRecorderNode}
      {voiceNotesListNode}
    </>
  )
  const sharedRoomsSection = <RoomsList dossierId={dossier.id} rooms={rooms ?? []} />

  // Items du drawer mission (vue par diag uniquement)
  const drawerItems: MissionDrawerItem[] = missionsWithChecklist.map(
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
          <ShareMissionButton
            missionId={m.id}
            missionReference={m.reference}
            clientEmail={client?.email ?? null}
          />
          <MissionActionsMenu
            missionId={m.id}
            missionLabel={MISSION_TYPE_LABELS[m.type] ?? m.type}
            missionReference={m.reference}
            currentStatus={m.status as never}
            clientEmail={client?.email ?? null}
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

  return (
    <div className="animate-fade-in">
      <MissionRealtime missionId={dossier.id} />

      {/* Lien retour — discret, garde la même mécanique qu'avant */}
      <Button variant="ghost" size="sm" asChild className="mb-3">
        <Link href="/app/dossiers">
          <ArrowLeft className="size-4" /> Retour aux dossiers
        </Link>
      </Button>

      {/*
       * Layout principal :
       * - < xl : 1 colonne (mobile / tablet / desktop standard) max-w-5xl centré
       * - xl+ (≥ 1280px) : grille 12 cols → contenu 8 / sidebar sticky 4
       * Pas de max-width sur le wrapper xl : on laisse l'AppShell parent gérer.
       */}
      <div className="xl:grid xl:grid-cols-12 xl:gap-8 xl:items-start">
        {/* ============ COLONNE PRINCIPALE (full width <xl, col-span-8 xl+) ============ */}
        <div className="xl:col-span-8 space-y-4 md:space-y-6 xl:space-y-8 max-w-4xl xl:max-w-none mx-auto xl:mx-0">
          {/* ───────────────────────────────────────────────────────────────
              1. HEADER COMPACT — référence, titre client serif italic, adresse,
              statut + menu. Une seule card hero, padding lg pour respirer.
              Inclut le ribbon quick-info en footer (RDV, lien client, .ics).
              ─────────────────────────────────────────────────────────────── */}
          <Card variant="opaque" padding="lg" className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
                  {dossier.reference}
                </p>
                <h1 className="font-serif italic font-normal text-3xl md:text-4xl xl:text-5xl tracking-tight text-ink leading-[1.05]">
                  {client?.display_name ?? 'Dossier de visite'}
                </h1>
                {fullAddress ? (
                  <p className="text-[14px] md:text-[15px] text-ink-soft flex items-start gap-2">
                    <MapPin className="size-4 shrink-0 mt-0.5 text-ink-mute" />
                    <span className="break-words">{fullAddress}</span>
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

            {/* Quick info ribbon — fusionne l'ancienne card adresse (supprimée car
                redondante avec le hero ci-dessus). Pillules wrap-friendly sur mobile. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 border-t border-rule/80 text-[12px] text-ink-mute">
              <DossierInfoEdit
                dossierId={dossier.id}
                scheduledAt={dossier.scheduled_at ?? null}
                notes={dossier.notes ?? null}
                clientId={dossier.client_id ?? null}
                clients={clientsList ?? []}
              />
              {client && dossier.client_id && (
                <Link
                  href={`/app/clients/${dossier.client_id}`}
                  className="flex items-center gap-1.5 hover:text-ink transition-colors duration-fast"
                >
                  <User className="size-3.5" /> {client.display_name}
                </Link>
              )}
              {dossier.scheduled_at && (
                <span className="flex items-center gap-2">
                  <Calendar className="size-3.5" />
                  {new Date(dossier.scheduled_at).toLocaleString('fr-FR', {
                    dateStyle: 'long',
                    timeStyle: 'short',
                  })}
                  <a
                    href={`/api/dossiers/${dossier.id}/calendar.ics`}
                    download
                    className="inline-flex items-center gap-1 ml-1 rounded-pill border border-rule bg-paper hover:bg-cream-deep/40 px-2.5 py-1 text-[11px] font-medium text-ink-soft hover:text-ink transition-colors"
                    title="Ajouter au calendrier (Google, Apple, Outlook)"
                  >
                    <CalendarPlus className="size-3" /> Ajouter au calendrier
                  </a>
                </span>
              )}
              {prop?.year_built && (
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute/80">
                    Année
                  </span>
                  {prop.year_built}
                </span>
              )}
              {prop?.surface_total && (
                <span className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute/80">
                    Surface
                  </span>
                  {prop.surface_total} m²
                </span>
              )}
              {prop && dossier.property_id && (
                <Link
                  href={`/app/properties/${dossier.property_id}`}
                  className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-ink-soft hover:text-ink transition-colors"
                >
                  Fiche bien →
                </Link>
              )}
            </div>
          </Card>

          {/* ───────────────────────────────────────────────────────────────
              2. WORKFLOW STEPPER — pièce maîtresse v5, toujours visible top.
              ─────────────────────────────────────────────────────────────── */}
          <WorkflowStepper
            dossierId={dossier.id}
            steps={workflow.steps}
            overallProgress={workflow.overallProgress}
          />

          {/* ───────────────────────────────────────────────────────────────
              3. COHERENCE WARNINGS — caché par le composant si vide.
              ─────────────────────────────────────────────────────────────── */}
          <CoherenceWarnings warnings={coherenceWarnings} />

          {/* ───────────────────────────────────────────────────────────────
              4. TABS — Vue par diagnostic / Vue par pièce + actions.
              Le ViewToggle est un composant client : on l'expose ici juste
              au-dessus du contenu principal pour qu'il joue son rôle de tabs.
              Le wording est repris de l'ancien header de section.
              ─────────────────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="space-y-1 min-w-0">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                  {viewPreference === 'rooms' ? 'Vue terrain' : 'Vue bureau'}
                </p>
                <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-ink leading-tight">
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
              <div className="flex items-center gap-2 flex-wrap">
                {viewPreference === 'diags' && (
                  <AddMissionButton
                    dossierId={dossier.id}
                    existingTypes={missionsList.map((m) => m.type)}
                  />
                )}
                <ViewToggle dossierId={dossier.id} current={viewPreference} />
              </div>
            </div>

            {/* Contenu de la tab active */}
            {viewPreference === 'rooms' ? (
              <RoomsMatrixView
                dossierId={dossier.id}
                rooms={(rooms ?? []).map((r) => ({
                  id: r.id,
                  name: r.name,
                  room_type: r.room_type,
                }))}
                missionTypes={missionsList.map((m) => m.type as never)}
                photos={(photos ?? []).map((p) => ({ id: p.id, room_id: p.room_id }))}
                voiceNotes={(voiceNotes ?? []).map((v) => ({
                  id: v.id,
                  room_id: v.room_id,
                  transcript_structured: v.transcript_structured,
                }))}
                manualState={
                  (dossierMeta.roomTasksState as Record<string, boolean> | undefined) ?? {}
                }
              />
            ) : (
              <MissionsWithDrawer missions={drawerItems} propertyAddress={fullAddress} />
            )}
          </div>

          {/* ───────────────────────────────────────────────────────────────
              5. SECTION TERRAIN UNIFIÉE — Photos + Notes vocales.
              < xl : stack vertical. xl+ : grid 2 colonnes side-by-side.
              Encadrement dans 2 cards opaques avec header mono uppercase.
              ─────────────────────────────────────────────────────────────── */}
          <section className="space-y-4">
            <header className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                Captures terrain
              </p>
              <h2 className="font-serif italic font-normal text-2xl md:text-3xl text-ink leading-tight">
                Photos et notes vocales.
              </h2>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
              {/* Photos */}
              <Card variant="opaque" padding="default" className="space-y-6">
                <header className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
                    <Camera className="size-3.5" />
                    Photos terrain
                  </p>
                  <span className="text-[11px] text-ink-mute">{totalPhotos}</span>
                </header>
                {photoCaptureNode}
                {photoGalleryNode}
              </Card>

              {/* Notes vocales */}
              <Card variant="opaque" padding="default" className="space-y-6">
                <header className="flex items-center justify-between gap-3">
                  <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute flex items-center gap-2">
                    <Mic className="size-3.5" />
                    Notes vocales
                  </p>
                  <span className="text-[11px] text-ink-mute">{totalVoiceNotes}</span>
                </header>
                {voiceRecorderNode}
                {voiceNotesListNode}
              </Card>
            </div>
          </section>

          {/* ───────────────────────────────────────────────────────────────
              6. DOCUMENTS PROPRIÉTAIRE + PIÈCES DU BIEN — CollapsibleSection.
              Groupés en grid 2-col sur lg+, stack sur mobile.
              ─────────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
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

            <CollapsibleSection
              storageKey={`kovas_dossier_${dossier.id}_rooms`}
              defaultExpanded={(rooms?.length ?? 0) === 0}
              title={<>Pièces du bien</>}
              meta={`(${rooms?.length ?? 0})`}
            >
              <RoomsList dossierId={dossier.id} rooms={rooms ?? []} />
            </CollapsibleSection>
          </div>

          {/* ───────────────────────────────────────────────────────────────
              7. NOTES INTERNES (footer si présent)
              ─────────────────────────────────────────────────────────────── */}
          {dossier.notes && (
            <Card variant="opaque" padding="default">
              <CardHeader>
                <CardTitle className="text-base">Notes internes</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap text-ink-soft">
                {dossier.notes}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ============ SIDEBAR DESKTOP LARGE (xl+ uniquement, col-span-4) ============
            Récap mission + actions raccourci. Sticky pour rester visible
            pendant que le diagnostiqueur scroll le contenu principal.
            Masquée < xl (les actions raccourci sont déjà accessibles via
            DossierMoreMenu / WorkflowStepper / ResumeButton dans le drawer).
            ─────────────────────────────────────────────────────────────── */}
        <aside className="hidden xl:block xl:col-span-4 xl:sticky xl:top-4 space-y-4">
          <Card variant="opaque" padding="default" className="space-y-5">
            <header className="space-y-1">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                Récap mission
              </p>
              <h3 className="font-serif italic font-normal text-2xl text-ink leading-tight">
                Avancement.
              </h3>
            </header>

            {/* Progression globale workflow */}
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
                  Workflow
                </span>
                <span className="font-mono text-[11px] tabular-nums text-ink-soft">
                  {overallPct}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-pill bg-rule/50 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-base ease-spring"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>

            {/* Diagnostics complétés */}
            <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-rule/60">
              <span className="text-[13px] text-ink-soft">Diagnostics</span>
              <span className="font-mono text-[13px] tabular-nums text-ink">
                {completedMissions}
                <span className="text-ink-mute">/{totalMissions}</span>
              </span>
            </div>

            {/* RDV à venir / passé */}
            {daysToRdv !== null && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-ink-soft">RDV</span>
                <span className="font-mono text-[13px] tabular-nums text-ink-soft">
                  {daysToRdv > 0
                    ? `dans ${daysToRdv} ${daysToRdv === 1 ? 'jour' : 'jours'}`
                    : daysToRdv === 0
                      ? "aujourd'hui"
                      : `il y a ${Math.abs(daysToRdv)} ${Math.abs(daysToRdv) === 1 ? 'jour' : 'jours'}`}
                </span>
              </div>
            )}

            {/* Captures terrain */}
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-ink-soft">Photos</span>
              <span className="font-mono text-[13px] tabular-nums text-ink">{totalPhotos}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] text-ink-soft">Notes vocales</span>
              <span className="font-mono text-[13px] tabular-nums text-ink">{totalVoiceNotes}</span>
            </div>
          </Card>

          {/* Actions raccourci — sticky avec la card récap.
              On évite de dupliquer ResumeButton/ShareButton (déjà dans le
              drawer mission) : on propose uniquement des liens dossier-level
              non redondants. L'export complet passe par DossierMoreMenu. */}
          <Card variant="opaque" padding="default" className="space-y-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-1">
              Raccourcis
            </p>
            {client && dossier.client_id && (
              <Button variant="outline" size="sm" asChild className="w-full justify-start">
                <Link href={`/app/clients/${dossier.client_id}`}>Fiche client</Link>
              </Button>
            )}
            {prop && dossier.property_id && (
              <Button variant="outline" size="sm" asChild className="w-full justify-start">
                <Link href={`/app/properties/${dossier.property_id}`}>Fiche bien</Link>
              </Button>
            )}
            {dossier.scheduled_at && (
              <Button variant="outline" size="sm" asChild className="w-full justify-start">
                <a href={`/api/dossiers/${dossier.id}/calendar.ics`} download>
                  Ajouter au calendrier
                </a>
              </Button>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}
