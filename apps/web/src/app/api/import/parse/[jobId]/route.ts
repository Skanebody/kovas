import { getCurrentUser } from '@/lib/auth/current-user'
import { extractStructuredData } from '@/lib/import/claude-extractor'
import {
  type DedupeMatchInput,
  type ExistingClient,
  type ExistingCopropriete,
  type ExistingProperty,
  findClientDuplicates,
  findCopropriereDuplicates,
  findPropertyDuplicates,
} from '@/lib/import/deduper'
import {
  BanCache,
  type NormalizedClient,
  type NormalizedCopropriete,
  type NormalizedProperty,
  Semaphore,
  normalizeClient,
  normalizeCopropriete,
  normalizeProperty,
} from '@/lib/import/normalizer'
import { parseSourceExport } from '@/lib/import/source-parser'
import {
  ImportError,
  type ParsedExport,
  type ProcessingLogEntry,
  SOURCE_LOGICIELS,
  type SourceLogiciel,
} from '@/lib/import/types'
import { createKovasAdminClient } from '@kovas/database'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/import/parse/[jobId]
 *
 * Pipeline complet :
 *  1. Lit job (status='uploaded'), passe en parsing
 *  2. Download fichier Storage
 *  3. parseSourceExport (dispatch CSV pour V1, mapping selon job.source_logiciel,
 *     fallback Claude si nécessaire)
 *  4. normalize (BAN cache + libphonenumber + Luhn SIRET)
 *  5. insert staging (batch 100)
 *  6. dedupe vs prod (clients + properties + coproprietes)
 *  7. status='deduped' avec compteurs
 *
 * En cas d'échec : status='failed' + error_message + error_details.
 *
 * Cf. CLAUDE.md §13 (stratégie défensive logiciels concurrents) + spec
 * « Import logiciel diag ».
 */
export const runtime = 'nodejs'
export const maxDuration = 60

interface JobRow {
  id: string
  status: string
  organization_id: string
  source_storage_path: string
  source_filename: string
  source_mime_type: string
  source_logiciel: SourceLogiciel
  processing_log: ProcessingLogEntry[] | null
}

const VALID_SOURCES = new Set<string>(SOURCE_LOGICIELS)

interface StagingClientInsert {
  job_id: string
  organization_id: string
  raw_data: Record<string, unknown>
  type: string | null
  display_name: string | null
  first_name: string | null
  last_name: string | null
  company_name: string | null
  siret: string | null
  email: string | null
  phone: string | null
  phone_mobile: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  country: string
  notes: string | null
  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null
  status: 'pending'
  normalization_warnings: unknown[]
  confidence_score: number
}

interface StagingPropertyInsert {
  job_id: string
  organization_id: string
  raw_data: Record<string, unknown>
  property_type: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
  country: string
  surface_total: number | null
  surface_carrez: number | null
  surface_boutin: number | null
  rooms_count: number | null
  floors_count: number | null
  year_built: number | null
  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null
  status: 'pending'
  normalization_warnings: unknown[]
  confidence_score: number
}

interface StagingCoproprieteInsert {
  job_id: string
  organization_id: string
  raw_data: Record<string, unknown>
  name: string | null
  rnic_number: string | null
  address: string | null
  postal_code: string | null
  city: string | null
  insee_code: string | null
  year_built: number | null
  lots_count: number | null
  geocoded_lat: number | null
  geocoded_lng: number | null
  ban_id: string | null
  status: 'pending'
  normalization_warnings: unknown[]
  confidence_score: number
}

interface DedupeMatchInsert {
  job_id: string
  organization_id: string
  entity_type: 'client' | 'property' | 'copropriete'
  staging_entity_id: string
  existing_entity_id: string
  confidence_score: number
  match_reasons: unknown
}

type AdminClient = SupabaseClient<Database>

const BATCH_SIZE = 100
const BAN_CONCURRENCY = 5

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params

  // ── Auth ──────────────────────────────────────────────────────────
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let orgId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── Lecture job (via RLS user) ────────────────────────────────────
  const { data: job, error: fetchErr } = await supabase
    .from('import_jobs')
    .select(
      'id, status, organization_id, source_storage_path, source_filename, source_mime_type, source_logiciel, processing_log',
    )
    .eq('id', jobId)
    .maybeSingle<JobRow>()

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (job.organization_id !== orgId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (job.status !== 'uploaded') {
    return NextResponse.json(
      { error: `job not in 'uploaded' state (current: ${job.status})` },
      { status: 409 },
    )
  }

  // ── Admin client pour writes (bypass RLS sur staging insert batch) ─
  const admin = createKovasAdminClient()

  const processingLog: ProcessingLogEntry[] = job.processing_log ?? []

  // Helper local pour log append + update DB (best-effort)
  async function logStep(entry: ProcessingLogEntry): Promise<void> {
    processingLog.push(entry)
    await admin
      .from('import_jobs')
      .update({ processing_log: processingLog } as never)
      .eq('id', jobId)
  }

  try {
    // ─── Étape 1 : status='parsing' ─────────────────────────────────
    await admin
      .from('import_jobs')
      .update({
        status: 'parsing',
        parsing_started_at: new Date().toISOString(),
      } as never)
      .eq('id', jobId)
    await logStep({
      ts: new Date().toISOString(),
      step: 'parse',
      level: 'info',
      message: 'Démarrage du parsing',
    })

    // ─── Étape 2 : download fichier Storage ─────────────────────────
    // NOTE : nom du bucket conservé pour éviter une migration storage destructrice
    // (cf. migration 20260520150000_import_multi_source.sql). Invisible côté UI.
    const { data: blob, error: dlError } = await admin.storage
      .from('import-liciel-staging')
      .download(job.source_storage_path)
    if (dlError || !blob) {
      throw new ImportError(
        'FILE_CORRUPTED',
        `Storage download failed : ${dlError?.message ?? 'unknown'}`,
      )
    }
    const buffer = Buffer.from(await blob.arrayBuffer())

    // ─── Étape 3 : parse (avec fallback Claude si nécessaire) ───────
    // Garde-fou : si la colonne arrive avec une valeur inconnue, on bascule
    // sur 'autre' (= fallback Claude direct, jamais d'erreur ici).
    const sourceLogiciel: SourceLogiciel = VALID_SOURCES.has(job.source_logiciel)
      ? job.source_logiciel
      : 'autre'

    let parsed: ParsedExport
    try {
      parsed = await parseSourceExport(
        buffer,
        job.source_filename,
        job.source_mime_type,
        sourceLogiciel,
      )
    } catch (err) {
      // Fallback Claude si :
      //  - détection de format CSV ambiguë (FORMAT_DETECTION_FAILED), OU
      //  - mapping headers vide pour ce logiciel (cas Autre/AnalysImmo/OBBC V1)
      if (err instanceof ImportError && err.code === 'FORMAT_DETECTION_FAILED') {
        const text = buffer.toString('utf8').replace(/^﻿/, '').slice(0, 8000)
        await logStep({
          ts: new Date().toISOString(),
          step: 'parse',
          level: 'warn',
          message: `Détection format CSV échouée (source=${sourceLogiciel}) — fallback Claude`,
        })
        parsed = await extractStructuredData(text)
      } else {
        throw err
      }
    }

    await admin
      .from('import_jobs')
      .update({ status: 'parsed' } as never)
      .eq('id', jobId)
    await logStep({
      ts: new Date().toISOString(),
      step: 'parse',
      level: 'info',
      message: `Parsing terminé : ${parsed.clients.length} clients · ${parsed.properties.length} biens · ${parsed.coproprietes.length} copros · ${parsed.lots.length} lots`,
    })

    // ─── Étape 4 : normalisation ────────────────────────────────────
    await admin
      .from('import_jobs')
      .update({ status: 'normalizing' } as never)
      .eq('id', jobId)

    const banCache = new BanCache()
    const semaphore = new Semaphore(BAN_CONCURRENCY)

    const normalizedClients = await Promise.all(
      parsed.clients.map(async (c) => {
        const release = await semaphore.acquire()
        try {
          return { source: c, ...(await normalizeClient(c, banCache)) }
        } finally {
          release()
        }
      }),
    )
    const normalizedProperties = await Promise.all(
      parsed.properties.map(async (p) => {
        const release = await semaphore.acquire()
        try {
          return { source: p, ...(await normalizeProperty(p, banCache)) }
        } finally {
          release()
        }
      }),
    )
    const normalizedCopros = await Promise.all(
      parsed.coproprietes.map(async (c) => {
        const release = await semaphore.acquire()
        try {
          return { source: c, ...(await normalizeCopropriete(c, banCache)) }
        } finally {
          release()
        }
      }),
    )

    await logStep({
      ts: new Date().toISOString(),
      step: 'normalize_addresses',
      level: 'info',
      message: `Normalisation terminée (BAN cache hits : ${banCache.size})`,
    })

    // ─── Étape 5 : insert staging (batch 100) ───────────────────────
    const stagingClientIds = await insertStagingClients(
      admin,
      jobId,
      orgId,
      normalizedClients.map((n) => ({
        raw_data: n.source as unknown as Record<string, unknown>,
        data: n.data,
        warnings: n.warnings,
        confidence: n.confidence,
      })),
    )
    const stagingPropertyIds = await insertStagingProperties(
      admin,
      jobId,
      orgId,
      normalizedProperties.map((n) => ({
        raw_data: n.source as unknown as Record<string, unknown>,
        data: n.data,
        warnings: n.warnings,
        confidence: n.confidence,
      })),
    )
    const stagingCoproIds = await insertStagingCoproprietes(
      admin,
      jobId,
      orgId,
      normalizedCopros.map((n) => ({
        raw_data: n.source as unknown as Record<string, unknown>,
        data: n.data,
        warnings: n.warnings,
        confidence: n.confidence,
      })),
    )

    await admin
      .from('import_jobs')
      .update({ status: 'normalized' } as never)
      .eq('id', jobId)

    // ─── Étape 6 : dedupe vs prod ───────────────────────────────────
    await admin
      .from('import_jobs')
      .update({ status: 'deduping' } as never)
      .eq('id', jobId)

    const [existingClientsRes, existingPropertiesRes, existingCoprosRes] = await Promise.all([
      admin
        .from('clients')
        .select('id, display_name, email, phone, siret, address, city, postal_code')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      admin
        .from('properties')
        .select('id, address, city, postal_code, surface_total, surface_carrez')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      admin
        // biome-ignore lint/suspicious/noExplicitAny: table coproprietes pas dans types generator
        .from('coproprietes' as any)
        .select('id, name, rnic_number, address, city, postal_code')
        .eq('organization_id', orgId)
        .is('deleted_at', null),
    ])

    const existingClients: ExistingClient[] = (existingClientsRes.data ?? []) as ExistingClient[]
    const existingProperties: ExistingProperty[] = (
      (existingPropertiesRes.data ?? []) as Array<
        Omit<ExistingProperty, 'location_lat' | 'location_lng'>
      >
    ).map((p) => ({
      ...p,
      location_lat: null,
      location_lng: null,
    }))
    const existingCopros: ExistingCopropriete[] = (existingCoprosRes.data ??
      []) as unknown as ExistingCopropriete[]

    const clientMatches = findClientDuplicates(
      normalizedClients.map((n, i) => ({
        staging_id: stagingClientIds[i] ?? '',
        data: n.data as NormalizedClient,
        geocoded_lat: n.data.geocoded_lat,
        geocoded_lng: n.data.geocoded_lng,
      })),
      existingClients,
    )
    const propertyMatches = findPropertyDuplicates(
      normalizedProperties.map((n, i) => ({
        staging_id: stagingPropertyIds[i] ?? '',
        data: n.data as NormalizedProperty,
        geocoded_lat: n.data.geocoded_lat,
        geocoded_lng: n.data.geocoded_lng,
      })),
      existingProperties,
    )
    const coproMatches = findCopropriereDuplicates(
      normalizedCopros.map((n, i) => ({
        staging_id: stagingCoproIds[i] ?? '',
        data: n.data as NormalizedCopropriete,
      })),
      existingCopros,
    )

    const allMatches = [...clientMatches, ...propertyMatches, ...coproMatches].filter(
      (m) => m.staging_entity_id !== '',
    )

    if (allMatches.length > 0) {
      await insertDedupeMatches(admin, jobId, orgId, allMatches)
    }

    await logStep({
      ts: new Date().toISOString(),
      step: 'dedupe',
      level: 'info',
      message: `Dédoublonnage terminé : ${clientMatches.length} clients · ${propertyMatches.length} biens · ${coproMatches.length} copros`,
    })

    // ─── Étape 7 : status='deduped' + compteurs finaux ──────────────
    const now = new Date().toISOString()
    const { error: finalErr } = await admin
      .from('import_jobs')
      .update({
        status: 'deduped',
        detected_clients_count: parsed.clients.length,
        detected_properties_count: parsed.properties.length,
        detected_coproprietes_count: parsed.coproprietes.length,
        detected_lots_count: parsed.lots.length,
        detected_diagnostics_count: parsed.diagnostics.length,
        duplicates_clients_count: clientMatches.length,
        duplicates_properties_count: propertyMatches.length,
        duplicates_coproprietes_count: coproMatches.length,
        parsing_completed_at: now,
        dedupe_completed_at: now,
      } as never)
      .eq('id', jobId)

    if (finalErr) {
      throw new Error(`Final update failed : ${finalErr.message}`)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const details =
      err instanceof ImportError
        ? { code: err.code, ...err.details }
        : { name: err instanceof Error ? err.name : 'UnknownError' }

    await admin
      .from('import_jobs')
      .update({
        status: 'failed',
        error_message: message,
        error_details: details,
      } as never)
      .eq('id', jobId)

    await logStep({
      ts: new Date().toISOString(),
      step: 'parse',
      level: 'error',
      message: `Échec pipeline : ${message}`,
    }).catch(() => {
      // best-effort
    })

    const status = err instanceof ImportError && err.code === 'FORMAT_UNSUPPORTED' ? 415 : 500
    return NextResponse.json(
      { error: message, code: err instanceof ImportError ? err.code : undefined },
      {
        status,
      },
    )
  }
}

// ============================================================================
// Inserts staging (batch + retour des IDs)
// ============================================================================

interface StagingInputClient {
  raw_data: Record<string, unknown>
  data: NormalizedClient
  warnings: unknown[]
  confidence: number
}
interface StagingInputProperty {
  raw_data: Record<string, unknown>
  data: NormalizedProperty
  warnings: unknown[]
  confidence: number
}
interface StagingInputCopro {
  raw_data: Record<string, unknown>
  data: NormalizedCopropriete
  warnings: unknown[]
  confidence: number
}

async function insertStagingClients(
  admin: AdminClient,
  jobId: string,
  orgId: string,
  items: StagingInputClient[],
): Promise<string[]> {
  if (items.length === 0) return []
  const rows: StagingClientInsert[] = items.map((item) => ({
    job_id: jobId,
    organization_id: orgId,
    raw_data: item.raw_data,
    type: item.data.type,
    display_name: item.data.display_name,
    first_name: item.data.first_name,
    last_name: item.data.last_name,
    company_name: item.data.company_name,
    siret: item.data.siret,
    email: item.data.email,
    phone: item.data.phone,
    phone_mobile: item.data.phone_mobile,
    address: item.data.address,
    postal_code: item.data.postal_code,
    city: item.data.city,
    country: item.data.country,
    notes: item.data.notes,
    geocoded_lat: item.data.geocoded_lat,
    geocoded_lng: item.data.geocoded_lng,
    ban_id: item.data.ban_id,
    status: 'pending',
    normalization_warnings: item.warnings,
    confidence_score: item.confidence,
  }))
  return insertInBatches(admin, 'import_staging_clients', rows)
}

async function insertStagingProperties(
  admin: AdminClient,
  jobId: string,
  orgId: string,
  items: StagingInputProperty[],
): Promise<string[]> {
  if (items.length === 0) return []
  const rows: StagingPropertyInsert[] = items.map((item) => ({
    job_id: jobId,
    organization_id: orgId,
    raw_data: item.raw_data,
    property_type: item.data.property_type,
    address: item.data.address,
    postal_code: item.data.postal_code,
    city: item.data.city,
    insee_code: item.data.insee_code,
    country: item.data.country,
    surface_total: item.data.surface_total,
    surface_carrez: item.data.surface_carrez,
    surface_boutin: item.data.surface_boutin,
    rooms_count: item.data.rooms_count,
    floors_count: item.data.floors_count,
    year_built: item.data.year_built,
    geocoded_lat: item.data.geocoded_lat,
    geocoded_lng: item.data.geocoded_lng,
    ban_id: item.data.ban_id,
    status: 'pending',
    normalization_warnings: item.warnings,
    confidence_score: item.confidence,
  }))
  return insertInBatches(admin, 'import_staging_properties', rows)
}

async function insertStagingCoproprietes(
  admin: AdminClient,
  jobId: string,
  orgId: string,
  items: StagingInputCopro[],
): Promise<string[]> {
  if (items.length === 0) return []
  const rows: StagingCoproprieteInsert[] = items.map((item) => ({
    job_id: jobId,
    organization_id: orgId,
    raw_data: item.raw_data,
    name: item.data.name,
    rnic_number: item.data.rnic_number,
    address: item.data.address,
    postal_code: item.data.postal_code,
    city: item.data.city,
    insee_code: item.data.insee_code,
    year_built: item.data.year_built,
    lots_count: item.data.lots_count,
    geocoded_lat: item.data.geocoded_lat,
    geocoded_lng: item.data.geocoded_lng,
    ban_id: item.data.ban_id,
    status: 'pending',
    normalization_warnings: item.warnings,
    confidence_score: item.confidence,
  }))
  return insertInBatches(admin, 'import_staging_coproprietes', rows)
}

async function insertDedupeMatches(
  admin: AdminClient,
  jobId: string,
  orgId: string,
  matches: DedupeMatchInput[],
): Promise<void> {
  if (matches.length === 0) return
  const rows: DedupeMatchInsert[] = matches.map((m) => ({
    job_id: jobId,
    organization_id: orgId,
    entity_type: m.entity_type,
    staging_entity_id: m.staging_entity_id,
    existing_entity_id: m.existing_entity_id,
    confidence_score: m.confidence_score,
    match_reasons: m.match_reasons,
  }))
  // Pas besoin d'IDs en retour
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const { error } = await admin.from('import_dedupe_matches').insert(chunk as never)
    if (error) throw new Error(`insert dedupe matches : ${error.message}`)
  }
}

/**
 * Insert un lot de rows en batches de BATCH_SIZE, renvoie les UUIDs créés
 * dans le même ordre que `rows`.
 */
async function insertInBatches<T extends object>(
  admin: AdminClient,
  table: 'import_staging_clients' | 'import_staging_properties' | 'import_staging_coproprietes',
  rows: T[],
): Promise<string[]> {
  const allIds: string[] = []
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE)
    const { data, error } = await admin
      .from(table)
      .insert(chunk as never)
      .select('id')
    if (error) throw new Error(`insert ${table} : ${error.message}`)
    const ids = ((data ?? []) as Array<{ id: string }>).map((d) => d.id)
    allIds.push(...ids)
  }
  return allIds
}
