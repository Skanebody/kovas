/**
 * KOVAS — API GET /api/archive/files
 *
 * Endpoint principal de la vue "Mes fichiers" : agrège photos / voice_notes /
 * documents / dossier_exports et renvoie un payload paginé typé.
 *
 * Query params :
 *   - type       : 'photo' | 'audio' | 'document' | 'export' | 'all'    (def: 'all')
 *   - period     : '7d' | '30d' | '12m' | '2025' | '2024' | '2023' | 'all' (def: 'all')
 *   - client_id  : uuid                                                  (optionnel)
 *   - diagnostic : 'dpe' | 'amiante' | 'plomb' | 'gaz' | 'electricite'
 *                | 'termites' | 'carrez' | 'erp' | 'all'                 (def: 'all')
 *   - q          : recherche libre (nom + transcription)                 (optionnel)
 *   - page       : entier >= 1                                           (def: 1)
 *   - limit      : 1..200                                                 (def: 50)
 *
 * Sécurité : multi-tenant strict via `getCurrentUser()` + RLS Supabase.
 */

import { aggregateArchiveFiles } from '@/lib/archive/aggregator'
import {
  ARCHIVE_DEFAULT_LIMIT,
  type ArchiveDiagnostic,
  type ArchiveFileKind,
  type ArchiveQuery,
} from '@/lib/archive/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KIND_VALUES: ReadonlyArray<ArchiveFileKind | 'all'> = [
  'all',
  'photo',
  'audio',
  'document',
  'export',
]
const PERIOD_VALUES: ReadonlyArray<ArchiveQuery['period']> = [
  'all',
  '7d',
  '30d',
  '12m',
  '2025',
  '2024',
  '2023',
]
const DIAG_VALUES: ReadonlyArray<ArchiveDiagnostic | 'all'> = [
  'all',
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
]

function parseEnum<T extends string>(
  value: string | null,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  if (value === null) return fallback
  return (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : fallback
}

function parseInt32(value: string | null, fallback: number, min: number, max: number): number {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

export async function GET(request: Request) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    user = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const params = url.searchParams

  const query: ArchiveQuery = {
    kind: parseEnum<ArchiveFileKind | 'all'>(params.get('type'), KIND_VALUES, 'all'),
    period: parseEnum<ArchiveQuery['period']>(params.get('period'), PERIOD_VALUES, 'all'),
    clientId: params.get('client_id'),
    diagnostic: parseEnum<ArchiveDiagnostic | 'all'>(params.get('diagnostic'), DIAG_VALUES, 'all'),
    q: params.get('q'),
    page: parseInt32(params.get('page'), 1, 1, 10_000),
    limit: parseInt32(params.get('limit'), ARCHIVE_DEFAULT_LIMIT, 1, 200),
  }

  const response = await aggregateArchiveFiles({
    supabase: user.supabase,
    orgId: user.orgId,
    userId: user.user.id,
    query,
  })

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
