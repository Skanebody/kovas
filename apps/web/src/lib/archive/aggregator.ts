/**
 * KOVAS — Agrégateur Archive (4 sources : photos / voice_notes / documents / dossier_exports).
 *
 * Stratégie :
 *   - Une requête par source avec filtres (date / dossier / type) appliqués en SQL
 *     pour éviter le full table scan.
 *   - Cap dur 200 rows par source avant pagination en mémoire (V1 — un user typique
 *     dépasse rarement 50 fichiers/mois sur une période courte).
 *   - Joint avec `dossiers` + `missions` pour la référence et le filtre diagnostic.
 *   - Multi-tenant : `organization_id = orgId` strict côté SQL (en plus de RLS).
 *
 * Note : `documents` n'a pas de colonne `organization_id` indexée sur user — on
 * filtre via `user_id = auth.uid()` (RLS) et `organization_id` (multi-tenant).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ARCHIVE_DEFAULT_LIMIT,
  type ArchiveDiagnostic,
  type ArchiveFile,
  type ArchiveListResponse,
  type ArchiveQuery,
} from './types'

const SOURCE_HARD_CAP = 200

/**
 * Mapping diagnostic UI → enum MissionType (Supabase).
 * Un filtre diagnostic = N types missions (DPE = dpe_vente + dpe_location + copropriete).
 */
const DIAG_TO_MISSION_TYPES: Record<ArchiveDiagnostic, string[]> = {
  dpe: ['dpe_vente', 'dpe_location', 'copropriete'],
  amiante: ['amiante_vente', 'amiante_avant_travaux'],
  plomb: ['plomb_crep'],
  gaz: ['gaz'],
  electricite: ['electricite'],
  termites: ['termites'],
  carrez: ['carrez_boutin'],
  erp: ['erp'],
}

interface PeriodRange {
  from: string | null
  to: string | null
}

function resolvePeriod(period: ArchiveQuery['period']): PeriodRange {
  const now = new Date()
  switch (period) {
    case '7d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 7)
      return { from: d.toISOString(), to: null }
    }
    case '30d': {
      const d = new Date(now)
      d.setDate(d.getDate() - 30)
      return { from: d.toISOString(), to: null }
    }
    case '12m': {
      const d = new Date(now)
      d.setFullYear(d.getFullYear() - 1)
      return { from: d.toISOString(), to: null }
    }
    case '2025':
      return { from: '2025-01-01T00:00:00Z', to: '2026-01-01T00:00:00Z' }
    case '2024':
      return { from: '2024-01-01T00:00:00Z', to: '2025-01-01T00:00:00Z' }
    case '2023':
      return { from: '2023-01-01T00:00:00Z', to: '2024-01-01T00:00:00Z' }
    case 'all':
    default:
      return { from: null, to: null }
  }
}

/**
 * Pré-charge la liste des dossier_id qui matchent le filtre client / diagnostic.
 * Si aucun filtre, retourne `null` (= pas de restriction).
 */
async function resolveAllowedDossierIds(
  supabase: SupabaseClient,
  orgId: string,
  clientId: string | null,
  diagnostic: ArchiveQuery['diagnostic'],
): Promise<string[] | null> {
  if (!clientId && diagnostic === 'all') return null

  let query = supabase
    .from('dossiers')
    .select('id, missions(type)')
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (clientId) {
    query = query.eq('client_id', clientId)
  }

  const { data, error } = await query
  if (error || !data) return []

  const rows = data as Array<{ id: string; missions: { type: string }[] | null }>
  if (diagnostic === 'all') return rows.map((r) => r.id)

  const allowedTypes = new Set(DIAG_TO_MISSION_TYPES[diagnostic] ?? [])
  return rows
    .filter((r) => (r.missions ?? []).some((m) => allowedTypes.has(m.type)))
    .map((r) => r.id)
}

/**
 * Dérive un nom de fichier lisible depuis un storage_path.
 *   `<org>/<dossier>/<uuid>.webp` → `<uuid>.webp`
 */
function deriveName(storagePath: string, fallback?: string | null): string {
  if (fallback && fallback.trim().length > 0) return fallback
  const segments = storagePath.split('/')
  return segments[segments.length - 1] ?? storagePath
}

/**
 * Construit un index dossier_id → reference depuis le résultat des requêtes.
 */
async function buildDossierReferenceMap(
  supabase: SupabaseClient,
  orgId: string,
  dossierIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (dossierIds.length === 0) return map

  const { data } = await supabase
    .from('dossiers')
    .select('id, reference')
    .eq('organization_id', orgId)
    .in('id', dossierIds)

  for (const row of (data ?? []) as Array<{ id: string; reference: string }>) {
    map.set(row.id, row.reference)
  }
  return map
}

interface FetchSourcesArgs {
  supabase: SupabaseClient
  orgId: string
  userId: string
  range: PeriodRange
  allowedDossierIds: string[] | null
  searchText: string | null
  kindFilter: ArchiveQuery['kind']
}

async function fetchPhotos(args: FetchSourcesArgs): Promise<ArchiveFile[]> {
  if (args.kindFilter !== 'all' && args.kindFilter !== 'photo') return []

  let q = args.supabase
    .from('photos')
    .select('id, storage_path, mime_type, size_bytes, created_at, dossier_id')
    .eq('organization_id', args.orgId)
    .order('created_at', { ascending: false })
    .limit(SOURCE_HARD_CAP)

  if (args.range.from) q = q.gte('created_at', args.range.from)
  if (args.range.to) q = q.lt('created_at', args.range.to)
  if (args.allowedDossierIds) {
    if (args.allowedDossierIds.length === 0) return []
    q = q.in('dossier_id', args.allowedDossierIds)
  }

  const { data, error } = await q
  if (error || !data) return []

  const rows = data as Array<{
    id: string
    storage_path: string
    mime_type: string | null
    size_bytes: number | null
    created_at: string
    dossier_id: string | null
  }>

  return rows
    .filter((r) => {
      if (!args.searchText) return true
      return deriveName(r.storage_path).toLowerCase().includes(args.searchText)
    })
    .map((r) => ({
      id: r.id,
      kind: 'photo' as const,
      name: deriveName(r.storage_path),
      mime_type: r.mime_type ?? 'image/webp',
      file_size_bytes: r.size_bytes,
      created_at: r.created_at,
      dossier_id: r.dossier_id,
      dossier_reference: null,
      signed_url: null,
      storage_path: r.storage_path,
      bucket: 'mission-photos' as const,
    }))
}

async function fetchVoiceNotes(args: FetchSourcesArgs): Promise<ArchiveFile[]> {
  if (args.kindFilter !== 'all' && args.kindFilter !== 'audio') return []

  let q = args.supabase
    .from('voice_notes')
    .select('id, storage_path, transcript_raw, duration_seconds, created_at, dossier_id')
    .eq('organization_id', args.orgId)
    .order('created_at', { ascending: false })
    .limit(SOURCE_HARD_CAP)

  if (args.range.from) q = q.gte('created_at', args.range.from)
  if (args.range.to) q = q.lt('created_at', args.range.to)
  if (args.allowedDossierIds) {
    if (args.allowedDossierIds.length === 0) return []
    q = q.in('dossier_id', args.allowedDossierIds)
  }

  const { data, error } = await q
  if (error || !data) return []

  const rows = data as Array<{
    id: string
    storage_path: string
    transcript_raw: string | null
    duration_seconds: number | null
    created_at: string
    dossier_id: string | null
  }>

  return rows
    .filter((r) => {
      if (!args.searchText) return true
      const haystack = `${deriveName(r.storage_path)} ${r.transcript_raw ?? ''}`.toLowerCase()
      return haystack.includes(args.searchText)
    })
    .map((r) => ({
      id: r.id,
      kind: 'audio' as const,
      name: deriveName(r.storage_path),
      mime_type: 'audio/webm',
      file_size_bytes: null,
      created_at: r.created_at,
      dossier_id: r.dossier_id,
      dossier_reference: null,
      signed_url: null,
      storage_path: r.storage_path,
      bucket: 'voice-notes' as const,
    }))
}

async function fetchDocuments(args: FetchSourcesArgs): Promise<ArchiveFile[]> {
  if (args.kindFilter !== 'all' && args.kindFilter !== 'document') return []

  // documents : path est <userId>/... — bucket isolé par user
  let q = args.supabase
    .from('documents')
    .select(
      'id, raw_file_path, original_filename, mime_type, file_size_bytes, created_at, dossier_id, ocr_text',
    )
    .eq('user_id', args.userId)
    .order('created_at', { ascending: false })
    .limit(SOURCE_HARD_CAP)

  if (args.range.from) q = q.gte('created_at', args.range.from)
  if (args.range.to) q = q.lt('created_at', args.range.to)
  if (args.allowedDossierIds) {
    if (args.allowedDossierIds.length === 0) return []
    q = q.in('dossier_id', args.allowedDossierIds)
  }

  const { data, error } = await q
  if (error || !data) return []

  const rows = data as Array<{
    id: string
    raw_file_path: string
    original_filename: string | null
    mime_type: string | null
    file_size_bytes: number | null
    created_at: string
    dossier_id: string | null
    ocr_text: string | null
  }>

  return rows
    .filter((r) => {
      if (!args.searchText) return true
      const haystack =
        `${r.original_filename ?? ''} ${deriveName(r.raw_file_path)} ${r.ocr_text ?? ''}`.toLowerCase()
      return haystack.includes(args.searchText)
    })
    .map((r) => ({
      id: r.id,
      kind: 'document' as const,
      name: deriveName(r.raw_file_path, r.original_filename),
      mime_type: r.mime_type,
      file_size_bytes: r.file_size_bytes,
      created_at: r.created_at,
      dossier_id: r.dossier_id,
      dossier_reference: null,
      signed_url: null,
      storage_path: r.raw_file_path,
      bucket: 'documents' as const,
    }))
}

async function fetchExports(args: FetchSourcesArgs): Promise<ArchiveFile[]> {
  if (args.kindFilter !== 'all' && args.kindFilter !== 'export') return []

  // dossier_exports : pas dans les types générés → cast contrôlé
  const table = args.supabase.from('dossier_exports' as never) as unknown as {
    select: (s: string) => {
      eq: (col: string, value: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{
            data:
              | Array<{
                  id: string
                  destination: string
                  storage_path: string | null
                  created_at: string
                  dossier_id: string
                }>
              | null
            error: { message: string } | null
          }>
        }
      }
    }
  }

  const { data, error } = await table
    .select('id, destination, storage_path, created_at, dossier_id')
    .eq('organization_id', args.orgId)
    .order('created_at', { ascending: false })
    .limit(SOURCE_HARD_CAP)

  if (error || !data) return []

  const rows = data
    // Range filtre côté JS (la table reste petite, ~10/mois)
    .filter((r) => {
      if (args.range.from && r.created_at < args.range.from) return false
      if (args.range.to && r.created_at >= args.range.to) return false
      if (args.allowedDossierIds && !args.allowedDossierIds.includes(r.dossier_id)) return false
      return true
    })
    .filter((r) => r.storage_path !== null) // exclu les exports email (pas de fichier persistant)

  return rows
    .filter((r) => {
      if (!args.searchText) return true
      const name = r.storage_path ? deriveName(r.storage_path) : r.destination
      return name.toLowerCase().includes(args.searchText)
    })
    .map((r) => ({
      id: r.id,
      kind: 'export' as const,
      name: r.storage_path ? deriveName(r.storage_path) : `Export ${r.destination}`,
      mime_type: 'application/zip',
      file_size_bytes: null,
      created_at: r.created_at,
      dossier_id: r.dossier_id,
      dossier_reference: null,
      signed_url: null,
      storage_path: r.storage_path ?? '',
      bucket: 'dossier-archives' as const,
    }))
}

/**
 * Génère les signed URLs en batch par bucket (1 round-trip par bucket).
 * TTL : 3600s (60 minutes — spec).
 */
async function enrichSignedUrls(
  supabase: SupabaseClient,
  files: ArchiveFile[],
): Promise<ArchiveFile[]> {
  const byBucket = new Map<ArchiveFile['bucket'], ArchiveFile[]>()
  for (const f of files) {
    if (!f.storage_path) continue
    const list = byBucket.get(f.bucket) ?? []
    list.push(f)
    byBucket.set(f.bucket, list)
  }

  const signedMap = new Map<string, string>()

  for (const [bucket, list] of byBucket.entries()) {
    const paths = list.map((f) => f.storage_path)
    const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600)
    if (!data) continue
    for (let i = 0; i < list.length; i++) {
      const signedUrl = data[i]?.signedUrl
      if (signedUrl) {
        signedMap.set(`${bucket}:${paths[i]}`, signedUrl)
      }
    }
  }

  return files.map((f) => ({
    ...f,
    signed_url: signedMap.get(`${f.bucket}:${f.storage_path}`) ?? null,
  }))
}

export interface AggregateArgs {
  supabase: SupabaseClient
  orgId: string
  userId: string
  query: ArchiveQuery
}

/**
 * Point d'entrée principal — agrège, filtre, paginate, génère signed URLs.
 */
export async function aggregateArchiveFiles(
  args: AggregateArgs,
): Promise<ArchiveListResponse> {
  const { supabase, orgId, userId, query } = args
  const range = resolvePeriod(query.period)
  const searchText = query.q ? query.q.trim().toLowerCase() : null

  const allowedDossierIds = await resolveAllowedDossierIds(
    supabase,
    orgId,
    query.clientId,
    query.diagnostic,
  )

  const fetchArgs: FetchSourcesArgs = {
    supabase,
    orgId,
    userId,
    range,
    allowedDossierIds,
    searchText,
    kindFilter: query.kind,
  }

  const [photos, audio, documents, exports] = await Promise.all([
    fetchPhotos(fetchArgs),
    fetchVoiceNotes(fetchArgs),
    fetchDocuments(fetchArgs),
    fetchExports(fetchArgs),
  ])

  const merged: ArchiveFile[] = [...photos, ...audio, ...documents, ...exports].sort(
    (a, b) => (a.created_at < b.created_at ? 1 : -1),
  )

  const total = merged.length
  const limit = query.limit > 0 ? query.limit : ARCHIVE_DEFAULT_LIMIT
  const page = Math.max(1, query.page)
  const offset = (page - 1) * limit
  const slice = merged.slice(offset, offset + limit)

  // Enrichissement reference dossier + signed URLs
  const uniqueDossierIds = Array.from(
    new Set(slice.map((f) => f.dossier_id).filter((id): id is string => id !== null)),
  )
  const refMap = await buildDossierReferenceMap(supabase, orgId, uniqueDossierIds)
  const withRefs = slice.map((f) => ({
    ...f,
    dossier_reference: f.dossier_id ? refMap.get(f.dossier_id) ?? null : null,
  }))

  const withUrls = await enrichSignedUrls(supabase, withRefs)

  return {
    files: withUrls,
    total,
    page,
    hasMore: offset + slice.length < total,
  }
}
