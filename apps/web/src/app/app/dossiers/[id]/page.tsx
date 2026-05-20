/**
 * Page dossier refondue — design v5 + 3 états visuels.
 *
 * Architecture :
 *   - resolveDossierState() détermine to-start / in-progress / completed
 *   - DossierHeroCard (hero compact, 3 variants)
 *   - DossierAttentionSection (contenu selon état via discriminated union)
 *   - Accordions conditionnels (ProgressionAccordion + Photos + History)
 *   - ExportSection en bas (in-progress + completed)
 *   - DossierStickyBar fixed bottom avec menu ⋯ + CTA primaire selon état
 *
 * Cf. commits :
 *   - migration 20260521150000_dossier_refonte.sql (mission_started_at,
 *     validated_at, exported_count, property_rooms, mission_sessions,
 *     dossier_exports)
 *   - lib/dossier/* (resolver + progression + room mapping + buckets)
 *   - components/dossier/* (hero, attention, sticky, progression, export)
 */

import { DocumentScanButton } from '@/components/documents'
import {
  DossierAttentionSection,
  DossierHeader,
  DossierHeroCard,
  DossierStickyBar,
  HistoryAccordion,
  PhotosAccordion,
  PreparationChecklist,
  ProgressionAccordion,
} from '@/components/dossier'
import { ExportSection } from '@/components/dossier/export/ExportSection'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { resolveDossierState } from '@/lib/dossier/dossier-state-resolver'
import { calculateProgression } from '@/lib/dossier/progression-calculator'
import { missionTypesToActiveDiagnostics } from '@/lib/mission/diagnostic-mapper'
import type { DiagnosticType } from '@/lib/mission/types'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Dossier' }

/**
 * Cast local — les colonnes ajoutées par la migration 20260521150000
 * (mission_started_at, validated_at, exported_count) ne sont pas encore
 * régénérées dans les types `@kovas/database`. Pattern projet : cast typed.
 * TODO : régénérer via `pnpm db:gen-types` quand stack locale dispo.
 */
interface DossierRow {
  id: string
  reference: string
  status: string
  scheduled_at: string | null
  mission_started_at: string | null
  validated_at: string | null
  exported_count: number | null
  notes: string | null
  property_id: string | null
  client_id: string | null
  properties: {
    address: string | null
    postal_code: string | null
    city: string | null
    surface_total: number | null
    year_built: number | null
    property_type: string | null
  } | null
  clients: {
    display_name: string | null
    email: string | null
    phone: string | null
  } | null
  missions: { type: string }[]
}

export default async function DossierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  // 1. Charge le dossier complet
  const { data: dossierRaw } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, mission_started_at, validated_at, exported_count, notes, property_id, client_id, properties(address, postal_code, city, surface_total, year_built, property_type), clients(display_name, email, phone), missions(type)',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!dossierRaw) notFound()

  const dossier = dossierRaw as unknown as DossierRow

  const prop = Array.isArray(dossier.properties) ? dossier.properties[0] : dossier.properties
  const client = Array.isArray(dossier.clients) ? dossier.clients[0] : dossier.clients

  // 2. Résout l'état visuel (3 états)
  const state = resolveDossierState({
    mission_started_at: dossier.mission_started_at,
    validated_at: dossier.validated_at,
    exported_count: dossier.exported_count ?? 0,
  })

  // 3. Charge la progression complète (diags + rooms + buckets + missing + counts)
  const progression = await calculateProgression(supabase, id)

  // 4. Diagnostics actifs mappés (mission.type → DiagnosticType)
  const activeDiagnostics: DiagnosticType[] = missionTypesToActiveDiagnostics(
    (dossier.missions ?? []).map((m) => m.type),
  )
  const hasDpe = activeDiagnostics.includes('DPE')
  const hasAmiante = activeDiagnostics.includes('AMIANTE')

  // 5. Header info
  const headerInfo = {
    address: prop?.address ?? 'Adresse manquante',
    city: prop?.city ?? undefined,
    propertyType: prop?.property_type ?? undefined,
    surface: prop?.surface_total ?? undefined,
    year: prop?.year_built ?? undefined,
    reference: dossier.reference,
    clientName: client?.display_name ?? undefined,
  }

  // 6. Hero summary
  const heroSummary = {
    photosCount: progression.photosCount,
    voiceNotesCount: progression.voiceNotesCount,
  }

  // 7. Preparation items pour état to-start
  const preparationItems = [
    {
      id: 'property-identified' as const,
      label: 'Bien identifié',
      done: Boolean(prop?.address),
    },
    {
      id: 'client-confirmed' as const,
      label: 'Client confirmé',
      done: Boolean(client?.display_name && (client.email || client.phone)),
    },
    {
      id: 'itinerary-ready' as const,
      label: 'Itinéraire prêt',
      done: Boolean(prop?.address && prop?.city),
    },
    {
      id: 'documents-received' as const,
      label: 'Documents propriétaire reçus',
      done: false, // TODO V1.5 : check owner_documents table
    },
  ]

  // 8. Recap final pour état completed
  const completedRecap = [
    `${activeDiagnostics.length} diagnostic${activeDiagnostics.length > 1 ? 's' : ''} (${activeDiagnostics.join(', ')})`,
    `${progression.fields.collected}/${progression.fields.total} champs collectés`,
    `${progression.photosCount} photos · ${progression.voiceNotesCount} notes vocales`,
  ]

  return (
    <>
      <div className="max-w-4xl space-y-6 animate-fade-in pb-24">
        {/* Retour */}
        <Button variant="ghost" size="sm" asChild>
          <Link href="/app/dossiers">
            <ArrowLeft className="size-4" /> Retour aux dossiers
          </Link>
        </Button>

        {/* Header : adresse serif italic + méta + ref mono */}
        <DossierHeader info={headerInfo} />

        {/* Toolbar actions rapides — scan document toujours accessible */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DocumentScanButton
            placement="dossier_toolbar"
            variant="secondary"
            dossierId={dossier.id}
          />
        </div>

        {/* Hero compact (3 variants selon état) */}
        <DossierHeroCard state={state} summary={heroSummary} />

        {/* Section attention — discriminated union par état */}
        {state === 'to-start' && (
          <DossierAttentionSection state="to-start" data={{ preparation: preparationItems }} />
        )}
        {state === 'in-progress' && (
          <DossierAttentionSection state="in-progress" data={progression} />
        )}
        {state === 'completed' && (
          <DossierAttentionSection state="completed" data={{ recap: completedRecap }} />
        )}

        {/* Accordions conditionnels selon état */}
        <div className="space-y-4">
          {state === 'to-start' && (
            <>
              <PreparationChecklist items={preparationItems} />
              {/* Scan documents propriétaire (état préparation) */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rule/60 bg-paper px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">Documents propriétaire</p>
                  <p className="text-xs text-ink-mute">
                    Scannez DPE antérieur, factures énergie, plans ou plaque chaudière pour
                    pré-remplir le dossier.
                  </p>
                </div>
                <DocumentScanButton
                  placement="preparation"
                  variant="primary"
                  dossierId={dossier.id}
                />
              </div>
            </>
          )}

          {(state === 'in-progress' || state === 'completed') && (
            <>
              <ProgressionAccordion
                dossierId={dossier.id}
                state={state}
                data={progression}
                activeDiagnostics={activeDiagnostics}
                initialView="by-diagnostic"
                defaultOpen={state === 'in-progress'}
              />
              <PhotosAccordion
                dossierId={dossier.id}
                photos={[]}
                rooms={[]}
                defaultExpanded={false}
              />
              <HistoryAccordion dossierId={dossier.id} />
            </>
          )}
        </div>

        {/* Section export (visible si mission démarrée) */}
        {(state === 'in-progress' || state === 'completed') && (
          <ExportSection
            dossierId={dossier.id}
            missingFields={progression.missingFields.map((m) => ({
              label: m.label,
              diagnostic: m.diagnostic,
            }))}
            hasDpe={hasDpe}
            hasAmiante={hasAmiante}
            client={
              client
                ? {
                    display_name: client.display_name,
                    email: client.email,
                  }
                : undefined
            }
          />
        )}
      </div>

      {/* Sticky bar fixed bottom — CTA primaire + menu ⋯ selon état */}
      <DossierStickyBar dossierId={dossier.id} state={state} summary={heroSummary} />
    </>
  )
}
