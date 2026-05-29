import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import type {
  DedupeEntityType,
  DedupeResolution,
  FieldChoiceMap,
  ImportJobStatus,
} from '@/lib/import/types'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { DedupeMatchPayload } from './duplicate-review-view'
import { DuplicateReviewView } from './duplicate-review-view'
import { ImportSummary } from './import-summary'
import { JobStatusPoller } from './job-status-poller'

export const metadata: Metadata = {
  title: 'Analyse de l’import',
}

interface JobRow {
  id: string
  status: ImportJobStatus
  source_filename: string
  organization_id: string
  detected_clients_count: number
  detected_properties_count: number
  detected_coproprietes_count: number
  detected_lots_count: number
  duplicates_clients_count: number
  duplicates_properties_count: number
  duplicates_coproprietes_count: number
}

interface DedupeRow {
  id: string
  entity_type: DedupeEntityType
  staging_entity_id: string
  existing_entity_id: string
  confidence_score: number
  match_reasons: string[] | null
  resolution: DedupeResolution | null
  field_choices: FieldChoiceMap | null
}

interface StagingClientRow {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  siret: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  notes: string | null
}

interface ClientRow {
  id: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  siret: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  notes: string | null
}

interface StagingPropertyRow {
  id: string
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
}

interface PropertyRow {
  id: string
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
}

interface StagingCoproRow {
  id: string
  name: string | null
  rnic_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
}

interface CoproRow {
  id: string
  name: string | null
  rnic_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
}

/**
 * Page de suivi + validation d'un job d'import (multi-source : Liciel /
 * AnalysImmo / OBBC / Autre).
 *
 * Logique d'affichage selon `job.status` :
 *   - completed → ImportSummary (récap final + CTA)
 *   - deduped   → DuplicateReviewView (validation des doublons)
 *   - failed/cancelled/autre → JobStatusPoller (polling pipeline en cours)
 */
export default async function ImportJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ jobId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { jobId } = await params
  const sp = await searchParams

  const { supabase } = await getCurrentUser()
  const { data: job } = await supabase
    .from('import_jobs')
    .select(
      'id, status, source_filename, organization_id, detected_clients_count, detected_properties_count, detected_coproprietes_count, detected_lots_count, duplicates_clients_count, duplicates_properties_count, duplicates_coproprietes_count',
    )
    .eq('id', jobId)
    .maybeSingle<JobRow>()

  if (!job) {
    notFound()
  }

  // ── Branche 1 : import terminé → summary ─────────────────────────
  if (job.status === 'completed') {
    const imported = {
      clients: numFromSp(sp.ic),
      properties: numFromSp(sp.ip),
      coproprietes: numFromSp(sp.ico),
      lots: numFromSp(sp.il),
    }
    const merged = {
      clients: numFromSp(sp.mc),
      properties: numFromSp(sp.mp),
      coproprietes: numFromSp(sp.mco),
    }
    return (
      <div className="max-w-3xl space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/dossiers/import">
            <ArrowLeft className="size-4" /> Nouveau import
          </Link>
        </Button>
        <AppPageHeader
          title="Récapitulatif de"
          accent="ton import"
          eyebrow="📥 IMPORT · ÉTAPE 5 / 5"
          description={`Fichier : ${job.source_filename}.`}
        />
        <ImportSummary
          jobId={job.id}
          filename={job.source_filename}
          imported={imported}
          merged={merged}
        />
      </div>
    )
  }

  // ── Branche 2 : dedupé → validation user ─────────────────────────
  if (job.status === 'deduped' || job.status === 'normalized') {
    const { data: matchesRaw } = await supabase
      .from('import_dedupe_matches')
      .select(
        'id, entity_type, staging_entity_id, existing_entity_id, confidence_score, match_reasons, resolution, field_choices',
      )
      .eq('job_id', jobId)

    const matchesByType: Record<DedupeEntityType, DedupeMatchPayload[]> = {
      client: [],
      property: [],
      copropriete: [],
    }

    const allMatches = (matchesRaw ?? []) as unknown as DedupeRow[]

    if (allMatches.length > 0) {
      // Charge les staging + existants pour les afficher en preview
      const stagingClientIds = allMatches
        .filter((m) => m.entity_type === 'client')
        .map((m) => m.staging_entity_id)
      const existingClientIds = allMatches
        .filter((m) => m.entity_type === 'client')
        .map((m) => m.existing_entity_id)
      const stagingPropertyIds = allMatches
        .filter((m) => m.entity_type === 'property')
        .map((m) => m.staging_entity_id)
      const existingPropertyIds = allMatches
        .filter((m) => m.entity_type === 'property')
        .map((m) => m.existing_entity_id)
      const stagingCoproIds = allMatches
        .filter((m) => m.entity_type === 'copropriete')
        .map((m) => m.staging_entity_id)
      const existingCoproIds = allMatches
        .filter((m) => m.entity_type === 'copropriete')
        .map((m) => m.existing_entity_id)

      const [
        stagingClients,
        existingClients,
        stagingProperties,
        existingProperties,
        stagingCopros,
        existingCopros,
      ] = await Promise.all([
        stagingClientIds.length === 0
          ? Promise.resolve({ data: [] as StagingClientRow[] })
          : supabase
              .from('import_staging_clients')
              .select(
                'id, display_name, first_name, last_name, company_name, email, phone, siret, address, postal_code, city, notes',
              )
              .in('id', stagingClientIds),
        existingClientIds.length === 0
          ? Promise.resolve({ data: [] as ClientRow[] })
          : supabase
              .from('clients')
              .select(
                'id, display_name, first_name, last_name, company_name, email, phone, siret, address, postal_code, city, notes',
              )
              .in('id', existingClientIds),
        stagingPropertyIds.length === 0
          ? Promise.resolve({ data: [] as StagingPropertyRow[] })
          : supabase
              .from('import_staging_properties')
              .select('id, address, postal_code, city, insee_code')
              .in('id', stagingPropertyIds),
        existingPropertyIds.length === 0
          ? Promise.resolve({ data: [] as PropertyRow[] })
          : supabase
              .from('properties')
              .select('id, address, postal_code, city, insee_code')
              .in('id', existingPropertyIds),
        stagingCoproIds.length === 0
          ? Promise.resolve({ data: [] as StagingCoproRow[] })
          : supabase
              .from('import_staging_coproprietes')
              .select('id, name, rnic_number, address, postal_code, city')
              .in('id', stagingCoproIds),
        existingCoproIds.length === 0
          ? Promise.resolve({ data: [] as CoproRow[] })
          : supabase
              // biome-ignore lint/suspicious/noExplicitAny: coproprietes pas dans types generator
              .from('coproprietes' as any)
              .select('id, name, rnic_number, address, postal_code, city')
              .in('id', existingCoproIds),
      ])

      const stagingClientById = indexById((stagingClients.data ?? []) as StagingClientRow[])
      const existingClientById = indexById((existingClients.data ?? []) as ClientRow[])
      const stagingPropertyById = indexById((stagingProperties.data ?? []) as StagingPropertyRow[])
      const existingPropertyById = indexById((existingProperties.data ?? []) as PropertyRow[])
      const stagingCoproById = indexById((stagingCopros.data ?? []) as StagingCoproRow[])
      const existingCoproById = indexById((existingCopros.data ?? []) as unknown as CoproRow[])

      for (const m of allMatches) {
        if (m.entity_type === 'client') {
          const s = stagingClientById.get(m.staging_entity_id)
          const e = existingClientById.get(m.existing_entity_id)
          if (!s || !e) continue
          matchesByType.client.push({
            match_id: m.id,
            entity_type: 'client',
            staging_entity_id: m.staging_entity_id,
            existing_entity_id: m.existing_entity_id,
            confidence_score: m.confidence_score,
            match_reasons: m.match_reasons ?? [],
            resolution: m.resolution,
            field_choices: m.field_choices,
            staging: {
              fields: {
                display_name: s.display_name,
                first_name: s.first_name,
                last_name: s.last_name,
                company_name: s.company_name,
                email: s.email,
                phone: s.phone,
                siret: s.siret,
                address: s.address,
                postal_code: s.postal_code,
                city: s.city,
                notes: s.notes,
              },
            },
            existing: {
              fields: {
                display_name: e.display_name,
                first_name: e.first_name,
                last_name: e.last_name,
                company_name: e.company_name,
                email: e.email,
                phone: e.phone,
                siret: e.siret,
                address: e.address,
                postal_code: e.postal_code,
                city: e.city,
                notes: e.notes,
              },
            },
            staging_label: clientLabel(s),
            existing_label: clientLabel(e),
          })
        } else if (m.entity_type === 'property') {
          const s = stagingPropertyById.get(m.staging_entity_id)
          const e = existingPropertyById.get(m.existing_entity_id)
          if (!s || !e) continue
          matchesByType.property.push({
            match_id: m.id,
            entity_type: 'property',
            staging_entity_id: m.staging_entity_id,
            existing_entity_id: m.existing_entity_id,
            confidence_score: m.confidence_score,
            match_reasons: m.match_reasons ?? [],
            resolution: m.resolution,
            field_choices: m.field_choices,
            staging: {
              fields: {
                address: s.address,
                postal_code: s.postal_code,
                city: s.city,
                insee_code: s.insee_code,
              },
            },
            existing: {
              fields: {
                address: e.address,
                postal_code: e.postal_code,
                city: e.city,
                insee_code: e.insee_code,
              },
            },
            staging_label: propertyLabel(s),
            existing_label: propertyLabel(e),
          })
        } else if (m.entity_type === 'copropriete') {
          const s = stagingCoproById.get(m.staging_entity_id)
          const e = existingCoproById.get(m.existing_entity_id)
          if (!s || !e) continue
          matchesByType.copropriete.push({
            match_id: m.id,
            entity_type: 'copropriete',
            staging_entity_id: m.staging_entity_id,
            existing_entity_id: m.existing_entity_id,
            confidence_score: m.confidence_score,
            match_reasons: m.match_reasons ?? [],
            resolution: m.resolution,
            field_choices: m.field_choices,
            staging: {
              fields: {
                name: s.name,
                rnic_number: s.rnic_number,
                address: s.address,
                postal_code: s.postal_code,
                city: s.city,
              },
            },
            existing: {
              fields: {
                name: e.name,
                rnic_number: e.rnic_number,
                address: e.address,
                postal_code: e.postal_code,
                city: e.city,
              },
            },
            staging_label: coproLabel(s),
            existing_label: coproLabel(e),
          })
        }
      }
    }

    // Compteurs « nouveaux à importer tels quels »
    const newEntitiesCount = {
      client: Math.max(0, job.detected_clients_count - matchesByType.client.length),
      property: Math.max(0, job.detected_properties_count - matchesByType.property.length),
      copropriete: Math.max(0, job.detected_coproprietes_count - matchesByType.copropriete.length),
      lot: job.detected_lots_count,
    }

    return (
      <div className="max-w-5xl space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/dossiers/import">
            <ArrowLeft className="size-4" /> Nouveau import
          </Link>
        </Button>
        <AppPageHeader
          title="Validez les"
          accent="doublons détectés"
          eyebrow="📥 IMPORT · ÉTAPE 5 / 5"
          description={`Fichier : ${job.source_filename}. Pour chaque doublon, choisissez de fusionner, garder séparé ou ignorer. Puis lancez l'import définitif.`}
        />
        <DuplicateReviewView
          job={{
            id: job.id,
            source_filename: job.source_filename,
            detected_clients_count: job.detected_clients_count,
            detected_properties_count: job.detected_properties_count,
            detected_coproprietes_count: job.detected_coproprietes_count,
            detected_lots_count: job.detected_lots_count,
            duplicates_clients_count: job.duplicates_clients_count,
            duplicates_properties_count: job.duplicates_properties_count,
            duplicates_coproprietes_count: job.duplicates_coproprietes_count,
          }}
          matches={matchesByType}
          newEntitiesCount={newEntitiesCount}
        />
      </div>
    )
  }

  // ── Branche 3 : pipeline en cours / failed → poller ──────────────
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/dossiers/import">
          <ArrowLeft className="size-4" /> Nouveau import
        </Link>
      </Button>

      <AppPageHeader
        title="Analyse de"
        accent="ton fichier"
        eyebrow="📥 IMPORT · ÉTAPE 4 / 5"
        description={`Fichier : ${job.source_filename}. Suivi temps réel de l'extraction, normalisation et détection des doublons.`}
      />

      <JobStatusPoller jobId={job.id} initialStatus={job.status} />
    </div>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  const m = new Map<string, T>()
  for (const r of rows) m.set(r.id, r)
  return m
}

function numFromSp(v: string | string[] | undefined): number {
  if (Array.isArray(v)) return numFromSp(v[0])
  if (typeof v !== 'string') return 0
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function clientLabel(c: {
  display_name: string | null
  last_name: string | null
  first_name: string | null
  company_name: string | null
  email: string | null
}): string {
  if (c.display_name) return c.display_name
  const name = [c.last_name, c.first_name].filter(Boolean).join(' ')
  if (name) return name
  if (c.company_name) return c.company_name
  if (c.email) return c.email
  return 'Client'
}

function propertyLabel(p: { address: string | null; city: string | null }): string {
  if (p.address) {
    return p.city ? `${p.address}, ${p.city}` : p.address
  }
  return p.city ?? 'Bien'
}

function coproLabel(c: { name: string | null; address: string | null }): string {
  if (c.name) return c.name
  if (c.address) return c.address
  return 'Copropriété'
}
