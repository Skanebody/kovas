import type {
  DossierMainContentMission,
  PreparationItem,
} from '@/components/dossier/v5simp/DossierMainContent'
import type { DossierSectionItem } from '@/components/dossier/v5simp/DossierSectionsDrawer'
import type { VerificationChecklistItem } from '@/components/dossier/v5simp/DossierVerificationSheet'
import { MissionRealtime } from '@/components/mission-realtime'
import { getCurrentUser } from '@/lib/auth/current-user'
import { runChecklist } from '@/lib/checklists'
import { runCoherenceChecks } from '@/lib/coherence-validation'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import type { VoiceParsedData } from '@/lib/voice-parser'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ClientUploadLink } from './client-upload-link'
import { DossierSimpLayoutClient } from './dossier-simp-layout-client'
import { MissionChecklist } from './mission-checklist'
import { OwnerDocumentsList } from './owner-documents-list'
import { PhotoCapture } from './photo-capture'
import { PhotoGallery } from './photo-gallery'
import { RemoveMissionButton } from './remove-mission-button'
import { ResumeButton } from './resume-button'
import { RoomsList } from './rooms-list'
import { ShareMissionButton } from './share-button'
import { MissionStatusButton } from './status-button'
import { VoiceNotesList } from './voice-notes-list'
import { VoiceRecorder } from './voice-recorder'

export const metadata: Metadata = { title: 'Détail dossier' }

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

/**
 * Donne une short-label compacte (DPE / AMIANTE / PLOMB / ...) à partir du type mission.
 * Utilisé dans le drawer hamburger sections.
 */
function shortLabel(type: string): string {
  const full = MISSION_TYPE_LABELS[type] ?? type
  return full.split(' ')[0]?.toUpperCase() ?? type.toUpperCase()
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
  ])

  if (!dossier) notFound()

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients
  const missionsList = missions ?? []

  // Coherence warnings (calcul partagé sur tout le dossier)
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

  // Checklist par mission — réutilisée dans le contenu de section + bilan global
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
    return { mission: m, checklist, percentage }
  })

  const fullAddress = compactAddress(prop)
  const clientName = client?.display_name ?? 'Dossier de visite'

  // --- Construction des sections du drawer hamburger ---
  // 00 — Préparation (toujours)
  // 01..N — un par mission/diagnostic
  // 99 — Documents (toujours)
  const preparationDone =
    Boolean(prop?.address) &&
    Boolean(client?.display_name) &&
    Boolean(dossier.scheduled_at) &&
    (ownerDocs?.length ?? 0) > 0

  const diagnosticSections: DossierSectionItem[] = missionsWithChecklist.map(
    ({ mission, percentage }, idx) => {
      const number = String(idx + 1).padStart(2, '0')
      const state: DossierSectionItem['state'] =
        percentage >= 100 ? 'done' : percentage > 0 ? 'pending' : 'pending'
      return {
        id: `${number}-${mission.type}`,
        number,
        label: shortLabel(mission.type),
        state,
      }
    },
  )

  const documentsDone = (ownerDocs?.length ?? 0) > 0

  const sections: DossierSectionItem[] = [
    {
      id: '00-preparation',
      number: '00',
      label: 'Préparation',
      state: preparationDone ? 'done' : 'pending',
    },
    ...diagnosticSections,
    {
      id: '99-documents',
      number: '99',
      label: 'Documents',
      state: documentsDone ? 'done' : 'pending',
    },
  ]

  // Préparation items (00)
  const preparationItems: PreparationItem[] = [
    { id: 'identified', label: 'Bien identifié et géolocalisé', done: Boolean(prop?.address) },
    { id: 'client', label: 'Client confirmé', done: Boolean(client?.display_name) },
    { id: 'route', label: 'Itinéraire planifié', done: Boolean(dossier.scheduled_at) },
    {
      id: 'docs',
      label: 'Documents propriétaire reçus',
      done: (ownerDocs?.length ?? 0) > 0,
    },
  ]

  // --- Sections partagées rendues une seule fois et passées aux slots ---
  const photoCountsByRoom: Record<string, number> = {}
  for (const p of photos ?? []) {
    if (p.room_id) photoCountsByRoom[p.room_id] = (photoCountsByRoom[p.room_id] ?? 0) + 1
  }
  const roomIndexById: Record<string, number> = {}
  ;(rooms ?? []).forEach((r, idx) => {
    roomIndexById[r.id] = idx + 1
  })
  const roomsArr = (rooms ?? []).map((r) => ({ id: r.id, name: r.name }))

  const roomsSection = <RoomsList dossierId={dossier.id} rooms={rooms ?? []} />

  const photosSection = (
    <div className="space-y-6">
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
    </div>
  )

  const voiceSection = (
    <div className="space-y-6">
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
    </div>
  )

  const documentsSection = (
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
  )

  // --- Map missions par section.id pour le main content ---
  const missionsBySectionId: Record<string, DossierMainContentMission> = {}
  missionsWithChecklist.forEach(({ mission: m, checklist, percentage }, idx) => {
    const number = String(idx + 1).padStart(2, '0')
    const sectionId = `${number}-${m.type}`
    missionsBySectionId[sectionId] = {
      id: m.id,
      type: m.type,
      typeLabel: MISSION_TYPE_LABELS[m.type] ?? m.type,
      reference: m.reference,
      status: m.status,
      percentage,
      checklistContent: (
        <MissionChecklist
          missionId={m.id}
          items={checklist.items}
          completion={checklist.completion}
          requiredOk={checklist.requiredOk}
        />
      ),
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
    }
  })

  // --- Checklist agrégée pour la bottom sheet Vérifier ---
  const verificationChecklist: VerificationChecklistItem[] = [
    {
      id: 'identification',
      label: 'Bien et client identifiés',
      done: Boolean(prop?.address) && Boolean(client?.display_name),
    },
    {
      id: 'rooms',
      label: 'Au moins une pièce définie',
      done: (rooms?.length ?? 0) > 0,
    },
    {
      id: 'photos',
      label: 'Photos terrain présentes',
      done: (photos?.length ?? 0) > 0,
    },
    {
      id: 'documents',
      label: 'Documents propriétaire reçus',
      done: (ownerDocs?.length ?? 0) > 0,
    },
    ...missionsWithChecklist.map(({ mission: m, percentage }) => ({
      id: `diag-${m.id}`,
      label: `Diagnostic ${MISSION_TYPE_LABELS[m.type] ?? m.type} complet`,
      done: percentage >= 100,
    })),
  ]

  // EEAT score mock V1 — basé sur la complétude moyenne des diagnostics + items de base
  const completedItems = verificationChecklist.filter((i) => i.done).length
  const totalItems = Math.max(1, verificationChecklist.length)
  const eeatScore = Math.round((completedItems / totalItems) * 100)

  // --- Title + subtitle context bar ---
  const primaryMissionType = missionsList[0]?.type ?? null
  const titlePrefix = primaryMissionType ? `${shortLabel(primaryMissionType)} ` : ''
  const dossierTitle = `${titlePrefix}${clientName}`.trim() || dossier.reference
  const dossierSubtitle = fullAddress || dossier.reference

  // Ariane items (sans la section active — ajoutée côté client)
  const arianeItems: { label: string; href?: string }[] = [{ label: 'Dossier' }]
  if (client?.display_name && dossier.client_id) {
    arianeItems.push({
      label: client.display_name,
      href: `/dashboard/clients/${dossier.client_id}`,
    })
  } else if (client?.display_name) {
    arianeItems.push({ label: client.display_name })
  }
  if (prop && dossier.property_id) {
    const propLabel = fullAddress || 'Bien'
    arianeItems.push({ label: propLabel, href: `/dashboard/properties/${dossier.property_id}` })
  }

  return (
    <>
      <MissionRealtime missionId={dossier.id} />
      <DossierSimpLayoutClient
        dossierId={dossier.id}
        dossierTitle={dossierTitle}
        dossierSubtitle={dossierSubtitle}
        arianeItems={arianeItems}
        propertyAddressLine={fullAddress || null}
        sections={sections}
        missionsBySectionId={missionsBySectionId}
        preparationItems={preparationItems}
        documentsSection={documentsSection}
        roomsSection={roomsSection}
        photosSection={photosSection}
        voiceSection={voiceSection}
        verificationChecklist={verificationChecklist}
        coherenceWarnings={coherenceWarnings}
        eeatScore={eeatScore}
      />
    </>
  )
}
