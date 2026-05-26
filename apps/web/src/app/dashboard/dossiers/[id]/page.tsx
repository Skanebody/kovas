import { ActivityLogSection, type ActivityEvent } from '@/components/dossier/hub/ActivityLogSection'
import { BillingSection, type BillingItem } from '@/components/dossier/hub/BillingSection'
import { CaptureSection } from '@/components/dossier/hub/CaptureSection'
import { CommunicationSection } from '@/components/dossier/hub/CommunicationSection'
import { DataQualitySection } from '@/components/dossier/hub/DataQualitySection'
import { ExportsSection } from '@/components/dossier/hub/ExportsSection'
import { FollowupSection } from '@/components/dossier/hub/FollowupSection'
import {
  HistoricalDocumentsSection,
  type HistoricalDocumentCategory,
  type HistoricalDocumentItem,
} from '@/components/dossier/hub/HistoricalDocumentsSection'
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
import { ExtendedRisksSection } from '@/components/dossier/hub/ExtendedRisksSection'
import { getCurrentUser } from '@/lib/auth/current-user'
import { runCoherenceChecks } from '@/lib/coherence-validation'
import { getVisibleSections, resolveDossierState } from '@/lib/dossier/states'
import { buildExtendedRisksFindings } from '@/lib/opendata/extended-risks-findings'
import { getExtendedRisks } from '@/lib/opendata/georisques-cache'
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
  // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore regénérés post-migration FIX-KK.
  const sb = supabase as any

  // -------------------------------------------------------------
  // 1. Charge dossier + relations
  // -------------------------------------------------------------
  const { data: dossier } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, started_at, completed_at, notes, metadata, client_upload_token, client_upload_expires_at, property_id, client_id, properties(id, address, postal_code, city, insee_code, surface_total, year_built, property_type, location), clients(id, display_name, email, phone)',
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
    { data: quotesData },
    { data: invoicesData },
    { data: historicalDocsData },
    { data: activityLogData },
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
    // Chantier A (FIX-KK §A) — devis rattachés à ce dossier
    sb
      .from('quotes')
      .select('id, reference, status, amount_ttc, issued_at, created_at')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    // Chantier A (FIX-KK §A) — factures rattachées à ce dossier
    sb
      .from('invoices')
      .select('id, reference, status, amount_ttc, paid_amount, issued_at, created_at')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false }),
    // Chantier B (FIX-KK §B) — docs historiques du bien
    sb
      .from('dossier_historical_documents')
      .select(
        'id, category, storage_path, original_filename, file_size_bytes, mime_type, uploaded_at, ai_extraction_status, ai_extracted_data',
      )
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('uploaded_at', { ascending: false }),
    // Chantier E (FIX-KK §E) — timeline activité
    sb
      .from('dossier_activity_log')
      .select('id, event_type, event_data, occurred_at')
      .eq('dossier_id', id)
      .eq('organization_id', orgId)
      .order('occurred_at', { ascending: false })
      .limit(100),
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
  // 6. Communication, Followup — placeholders V1 (tables à venir)
  // -------------------------------------------------------------
  const communicationEvents: ReadonlyArray<{
    id: string
    kind: 'email' | 'sms' | 'call'
    direction: 'in' | 'out'
    at: string
    subject: string | null
    preview: string | null
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
  // 6bis. Chantier A (FIX-KK §A) — Billing items réels (devis + factures)
  // -------------------------------------------------------------
  const quotesRows = (quotesData ?? []) as Array<{
    id: string
    reference: string
    status: string
    amount_ttc: number | string | null
    issued_at: string | null
    created_at: string
  }>
  const invoicesRows = (invoicesData ?? []) as Array<{
    id: string
    reference: string
    status: string
    amount_ttc: number | string | null
    paid_amount: number | string | null
    issued_at: string | null
    created_at: string
  }>

  function toCents(v: number | string | null): number {
    const n = typeof v === 'string' ? Number(v) : (v ?? 0)
    return Math.round(Number.isFinite(n) ? n * 100 : 0)
  }

  const billingItems: ReadonlyArray<BillingItem> = [
    ...quotesRows.map<BillingItem>((q) => ({
      id: q.id,
      kind: 'quote',
      reference: q.reference,
      amountCents: toCents(q.amount_ttc ?? null),
      status: (q.status as BillingItem['status']) ?? 'draft',
      date: q.issued_at ?? q.created_at,
    })),
    ...invoicesRows.map<BillingItem>((inv) => ({
      id: inv.id,
      kind: 'invoice',
      reference: inv.reference,
      amountCents: toCents(inv.amount_ttc ?? null),
      status: (inv.status as BillingItem['status']) ?? 'draft',
      date: inv.issued_at ?? inv.created_at,
    })),
  ]

  // -------------------------------------------------------------
  // 6ter. Chantier B (FIX-KK §B) — documents historiques + signed URLs
  // -------------------------------------------------------------
  const historicalDocsRows = (historicalDocsData ?? []) as Array<{
    id: string
    category: HistoricalDocumentCategory
    storage_path: string
    original_filename: string | null
    file_size_bytes: number | null
    mime_type: string | null
    uploaded_at: string
    ai_extraction_status: HistoricalDocumentItem['ai_extraction_status']
    ai_extracted_data: Record<string, unknown> | null
  }>

  let historicalDocs: HistoricalDocumentItem[] = []
  if (historicalDocsRows.length > 0) {
    const paths = historicalDocsRows.map((d) => d.storage_path)
    const { data: signed } = await supabase.storage
      .from('dossier-documents')
      .createSignedUrls(paths, 3600)
    const signedMap = new Map<string, string>()
    ;(signed ?? []).forEach((entry, i) => {
      const p = paths[i]
      if (entry?.signedUrl && p) signedMap.set(p, entry.signedUrl)
    })
    historicalDocs = historicalDocsRows.map((d) => ({
      id: d.id,
      category: d.category,
      storage_path: d.storage_path,
      original_filename: d.original_filename,
      file_size_bytes: d.file_size_bytes,
      mime_type: d.mime_type,
      uploaded_at: d.uploaded_at,
      ai_extraction_status: d.ai_extraction_status ?? null,
      ai_extracted_data: d.ai_extracted_data,
      signed_url: signedMap.get(d.storage_path) ?? null,
    }))
  }

  // -------------------------------------------------------------
  // 6quater. Chantier E (FIX-KK §E) — activity log timeline
  // -------------------------------------------------------------
  const activityEvents: ReadonlyArray<ActivityEvent> = ((activityLogData ?? []) as unknown[]).map(
    (e) => {
      const row = e as {
        id: string
        event_type: string
        event_data?: Record<string, unknown> | null
        occurred_at: string
      }
      return {
        id: String(row.id),
        event_type: String(row.event_type),
        event_data: row.event_data ?? null,
        occurred_at: String(row.occurred_at),
      }
    },
  )

  // -------------------------------------------------------------
  // 6quinquies. Géorisques étendu (Radon / PPRI / Argiles / Cavités)
  // Lecture cache 30j avec fallback réseau gracieux. JAMAIS bloquant.
  // -------------------------------------------------------------
  const propRaw = prop as
    | (typeof prop & {
        insee_code?: string | null
        location?: { coordinates?: [number, number] } | string | null
      })
    | null
  let propLat: number | null = null
  let propLng: number | null = null
  if (propRaw?.location && typeof propRaw.location === 'object') {
    const coords = (propRaw.location as { coordinates?: [number, number] }).coordinates
    if (Array.isArray(coords) && coords.length === 2) {
      propLng = coords[0] ?? null
      propLat = coords[1] ?? null
    }
  }
  const propInseeCode = propRaw?.insee_code ?? null
  const extendedRisksBundle =
    propInseeCode || (propLat !== null && propLng !== null)
      ? await getExtendedRisks(propInseeCode, propLat, propLng).catch(() => null)
      : null

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
              // Lot Géorisques étendu — vérifications IAL (Information Acquéreur/Locataire)
              ...buildExtendedRisksFindings(extendedRisksBundle, meta),
            ]}
          />
        ) : null
      }
      exports={visibleSections.exports ? <ExportsSection dossierId={dossier.id} exports={[]} /> : null}
      communication={
        visibleSections.communication ? <CommunicationSection events={communicationEvents} /> : null
      }
      billing={
        visibleSections.billing ? (
          <BillingSection
            items={billingItems}
            dossierId={dossier.id}
            clientId={client.id}
            propertyId={property.id ?? null}
          />
        ) : null
      }
      followup={visibleSections.followup ? <FollowupSection items={followupItems} /> : null}
      historicalDocs={
        visibleSections.historicalDocs ? (
          <HistoricalDocumentsSection dossierId={dossier.id} documents={historicalDocs} />
        ) : null
      }
      activityLog={
        visibleSections.activityLog ? <ActivityLogSection events={activityEvents} /> : null
      }
      extendedRisks={
        extendedRisksBundle ? (
          <ExtendedRisksSection
            radon={extendedRisksBundle.radon}
            ppri={extendedRisksBundle.ppri}
            argiles={extendedRisksBundle.argiles}
            cavites={extendedRisksBundle.cavites}
            dossierRisquesHref={`/dashboard/dossiers/${dossier.id}/risques`}
          />
        ) : null
      }
      notes={<NotesSection dossierId={dossier.id} initialNotes={dossier.notes} />}
      sidebar={
        <Sidebar
          dossierId={dossier.id}
          dossierReference={dossier.reference}
          clientName={client.display_name}
          clientPhone={client.phone}
          clientEmail={client.email}
          clientAddress={null}
          propertyAddress={fullAddress || null}
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
