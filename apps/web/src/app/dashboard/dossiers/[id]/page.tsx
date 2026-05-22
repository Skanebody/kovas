import { BillingSection } from '@/components/dossier/hub/BillingSection'
import { CaptureSection } from '@/components/dossier/hub/CaptureSection'
import { CommunicationSection } from '@/components/dossier/hub/CommunicationSection'
import { DataQualitySection } from '@/components/dossier/hub/DataQualitySection'
import { ExportsSection } from '@/components/dossier/hub/ExportsSection'
import { FollowupSection } from '@/components/dossier/hub/FollowupSection'
import { HubHeader } from '@/components/dossier/hub/HubHeader'
import { IdentitySection } from '@/components/dossier/hub/IdentitySection'
import { NotesSection } from '@/components/dossier/hub/NotesSection'
import { PreExportSection } from '@/components/dossier/hub/PreExportSection'
import { Sidebar } from '@/components/dossier/hub/Sidebar'
import type { CalendarEntry } from '@/components/dossier/hub/SidebarBlocks/CalendarBlock'
import type { Opportunity } from '@/components/dossier/hub/SidebarBlocks/OpportunitiesBlock'
import type { OtherDossier } from '@/components/dossier/hub/SidebarBlocks/OtherDossiersBlock'
import type { PropertyHistoryItem } from '@/components/dossier/hub/SidebarBlocks/PropertyHistoryBlock'
import type { VigilanceSignal } from '@/components/dossier/hub/SidebarBlocks/VigilanceBlock'
import { getCurrentUser } from '@/lib/auth/current-user'
import { runCoherenceChecks } from '@/lib/coherence-validation'
import { getVisibleSections, resolveDossierState } from '@/lib/dossier/states'
import type { VoiceParsedData } from '@/lib/voice-parser'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { DossierHubClient } from './dossier-hub-client'
import { DossierMoreMenu } from './dossier-more-menu'

export const metadata: Metadata = { title: 'Dossier — Hub' }

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

  // -------------------------------------------------------------
  // 1. Charge dossier + relations
  // -------------------------------------------------------------
  const { data: dossier } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, started_at, completed_at, notes, metadata, client_upload_token, client_upload_expires_at, property_id, client_id, properties(id, address, postal_code, city, surface_total, year_built, property_type), clients(id, display_name, email, phone)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!dossier) notFound()

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const clientRow = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients

  // -------------------------------------------------------------
  // 2. Charge collections liées en parallèle
  // -------------------------------------------------------------
  const [
    { data: missions },
    { data: rooms },
    { data: photos },
    { data: voiceNotes },
    { data: ownerDocs },
    { data: otherDossiersData },
  ] = await Promise.all([
    supabase
      .from('missions')
      .select('id, reference, type, status, completed_at')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true }),
    supabase
      .from('dossier_rooms')
      .select('id, name, room_type, surface_m2')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('position', { ascending: true }),
    supabase
      .from('photos')
      .select('id, storage_path, room_id, taken_at')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('taken_at', { ascending: false }),
    supabase
      .from('voice_notes')
      .select(
        'id, transcript_raw, transcript_structured, ai_confidence, parser_used, room_id, duration_seconds, created_at',
      )
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    supabase
      .from('owner_documents')
      .select('id, doc_kind, original_name, uploaded_at, extraction_status')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('uploaded_at', { ascending: false }),
    dossier.client_id
      ? supabase
          .from('dossiers')
          .select(
            'id, reference, status, scheduled_at, started_at, completed_at, metadata, properties(address, postal_code, city)',
          )
          .eq('client_id', dossier.client_id)
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .neq('id', dossier.id)
          .order('created_at', { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ])

  // -------------------------------------------------------------
  // 3. État conceptuel + sections visibles
  // -------------------------------------------------------------
  const meta = (dossier.metadata as Record<string, unknown> | null) ?? {}
  const dossierState = resolveDossierState({
    status: dossier.status,
    scheduled_at: dossier.scheduled_at,
    started_at: dossier.started_at,
    completed_at: dossier.completed_at,
    metadata: meta,
  })
  const visibleSections = getVisibleSections(dossierState)

  const fullAddress = compactAddress(prop ?? null)
  const missionsList = missions ?? []
  const roomsList = rooms ?? []
  const photosList = photos ?? []
  const voiceNotesList = voiceNotes ?? []
  const ownerDocsList = ownerDocs ?? []

  // -------------------------------------------------------------
  // 4. Cohérence métier (Section 3 : Data Quality)
  // -------------------------------------------------------------
  const coherence = runCoherenceChecks({
    property: {
      surface_total: prop?.surface_total ?? null,
      year_built: prop?.year_built ?? null,
      property_type: prop?.property_type ?? null,
    },
    voiceNotes: voiceNotesList.map((v) => {
      const parsed = (v.transcript_structured as VoiceParsedData | null) ?? null
      return {
        surface_m2: parsed?.surface_m2,
        year_built: parsed?.year_built,
        equipment: parsed?.equipment ?? [],
      }
    }),
  })
  const coherenceWarnings = coherence.map((c, i) => ({
    id: `coh-${i}`,
    severity: c.severity === 'error' ? ('warn' as const) : ('info' as const),
    message: c.message,
  }))

  // -------------------------------------------------------------
  // 5. Données dérivées sidebar
  // -------------------------------------------------------------
  const calendarEntries: CalendarEntry[] = []
  if (dossier.scheduled_at) {
    calendarEntries.push({
      id: 'scheduled',
      kind: 'mission',
      at: dossier.scheduled_at,
      label: 'Mission planifiée',
    })
  }

  const otherDossiers: OtherDossier[] = (otherDossiersData ?? []).map(
    (d): OtherDossier => {
      const dProp = Array.isArray((d as { properties?: unknown }).properties)
        ? ((d as { properties?: Array<{ address: string | null; city: string | null; postal_code: string | null }> }).properties?.[0] ?? null)
        : ((d as { properties?: { address: string | null; city: string | null; postal_code: string | null } | null }).properties ?? null)
      return {
        id: String((d as { id: string }).id),
        reference: String((d as { reference: string }).reference),
        status: String((d as { status: string }).status),
        scheduled_at: (d as { scheduled_at: string | null }).scheduled_at ?? null,
        started_at: (d as { started_at: string | null }).started_at ?? null,
        completed_at: (d as { completed_at: string | null }).completed_at ?? null,
        metadata: ((d as { metadata?: Record<string, unknown> | null }).metadata ?? null) as Record<
          string,
          unknown
        > | null,
        address: dProp ? compactAddress(dProp) : null,
      }
    },
  )

  const propertyHistory: PropertyHistoryItem[] = []

  const opportunities: Opportunity[] = []
  // Heuristique simple : si bien ancien (<1975) sans amiante listé → suggestion
  const hasAmiante = missionsList.some((m) => m.type.startsWith('amiante'))
  if (prop?.year_built && prop.year_built < 1997 && !hasAmiante) {
    opportunities.push({
      id: 'opp-amiante',
      label: 'Diagnostic amiante recommandé',
      description: `Bien construit en ${prop.year_built} (avant 1997).`,
    })
  }

  const vigilanceSignals: VigilanceSignal[] = []
  if (voiceNotesList.length === 0 && dossierState === 'en_mission') {
    vigilanceSignals.push({
      id: 'vig-no-voice',
      message: 'Aucune note vocale pour le moment.',
      hint: 'Pensez à utiliser la saisie vocale terrain pour gagner du temps.',
    })
  }

  // -------------------------------------------------------------
  // 6. Communication, Billing, Followup — données placeholders V1
  // (tables non encore créées : communications, invoices, payments, followups)
  // -------------------------------------------------------------
  const communicationEvents: ReadonlyArray<{
    id: string
    kind: 'email' | 'sms' | 'call'
    direction: 'in' | 'out'
    at: string
    subject: string | null
    preview: string | null
  }> = []
  const billingItems: ReadonlyArray<{
    id: string
    kind: 'quote' | 'invoice' | 'payment'
    reference: string
    amountCents: number
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
    date: string
  }> = []
  const followupItems: ReadonlyArray<{
    id: string
    kind: 'milestone' | 'opportunity' | 'reminder'
    at: string
    label: string
    description: string | null
    done: boolean
  }> = []

  // -------------------------------------------------------------
  // 7. Render — assemble sections et passe au Client orchestrateur
  // -------------------------------------------------------------
  const client = {
    id: clientRow?.id ?? null,
    display_name: clientRow?.display_name ?? null,
    email: clientRow?.email ?? null,
    phone: clientRow?.phone ?? null,
  }
  const property = {
    id: prop?.id ?? dossier.property_id,
    address: prop?.address ?? null,
    postal_code: prop?.postal_code ?? null,
    city: prop?.city ?? null,
    surface_total: prop?.surface_total ?? null,
    year_built: prop?.year_built ?? null,
    property_type: prop?.property_type ?? null,
  }

  const header = (
    <HubHeader
      reference={dossier.reference}
      clientName={client.display_name ?? 'Dossier sans client'}
      fullAddress={fullAddress}
      state={dossierState}
      dossierId={dossier.id}
      clientPhone={client.phone}
      moreMenu={<DossierMoreMenu dossierId={dossier.id} />}
    />
  )

  return (
    <DossierHubClient
      dossierId={dossier.id}
      state={dossierState}
      visibleSections={visibleSections}
      header={header}
      identity={
        <IdentitySection
          dossier={{
            ...dossier,
            metadata: meta,
          }}
          client={client}
          property={property}
          missions={missionsList}
          fullAddress={fullAddress}
        />
      }
      capture={
        visibleSections.capture ? (
          <CaptureSection
            dossierId={dossier.id}
            rooms={roomsList}
            photos={photosList}
            voiceNotes={voiceNotesList}
            ownerDocs={ownerDocsList}
          />
        ) : null
      }
      dataQuality={
        visibleSections.dataQuality ? (
          <DataQualitySection
            voiceNotes={voiceNotesList}
            roomsCount={roomsList.length}
            coherenceWarnings={coherenceWarnings}
          />
        ) : null
      }
      preExport={
        visibleSections.preExport ? (
          <PreExportSection
            ademeScore={null}
            findings={[
              ...(roomsList.length === 0
                ? [
                    {
                      id: 'no-rooms',
                      severity: 'warn' as const,
                      message: 'Aucune pièce renseignée. Ajoutez-en pour permettre le calcul.',
                    },
                  ]
                : []),
              ...(prop?.surface_total
                ? []
                : [
                    {
                      id: 'no-surface',
                      severity: 'warn' as const,
                      message: 'Surface totale manquante sur le bien.',
                    },
                  ]),
            ]}
          />
        ) : null
      }
      exports={visibleSections.exports ? <ExportsSection dossierId={dossier.id} exports={[]} /> : null}
      communication={
        visibleSections.communication ? <CommunicationSection events={communicationEvents} /> : null
      }
      billing={visibleSections.billing ? <BillingSection items={billingItems} /> : null}
      followup={visibleSections.followup ? <FollowupSection items={followupItems} /> : null}
      notes={<NotesSection dossierId={dossier.id} initialNotes={dossier.notes} />}
      sidebar={
        <Sidebar
          dossierId={dossier.id}
          clientPhone={client.phone}
          clientEmail={client.email}
          calendarEntries={calendarEntries}
          propertyHistory={propertyHistory}
          otherDossiers={otherDossiers}
          opportunities={opportunities}
          vigilanceSignals={vigilanceSignals}
        />
      }
    />
  )
}
