/**
 * KOVAS — Page Archive ("Mes fichiers")
 *
 * Agrège tous les fichiers d'un compte (photos / audio / documents / exports)
 * en une vue unique, recherchable et exportable en ZIP.
 *
 * Pattern :
 *   - Server component (RSC) : lit URL → agrège → render
 *   - Filtres pilotés par URL via <ArchiveFilters /> (client)
 *   - Pagination via ?page=N (lien serveur)
 *
 * URL exemples :
 *   /app/archive
 *   /app/archive?type=photo&period=30d
 *   /app/archive?diagnostic=dpe&client_id=<uuid>&q=chaudiere&page=2
 *
 * Sécurité : multi-tenant strict via getCurrentUser() + RLS Supabase.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { ArchiveBulkExportButton } from '@/components/archive/ArchiveBulkExportButton'
import { ArchiveFilters } from '@/components/archive/ArchiveFilters'
import { ArchiveTable } from '@/components/archive/ArchiveTable'
import { KpiHero } from '@/components/ui/kpi-hero'
import { aggregateArchiveFiles } from '@/lib/archive/aggregator'
import {
  ARCHIVE_DEFAULT_LIMIT,
  type ArchiveDiagnostic,
  type ArchiveFileKind,
  type ArchiveQuery,
} from '@/lib/archive/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mes fichiers' }
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
  value: string | undefined,
  allowed: ReadonlyArray<T>,
  fallback: T,
): T {
  if (!value) return fallback
  return (allowed as ReadonlyArray<string>).includes(value) ? (value as T) : fallback
}

function parseInt32(value: string | undefined, fallback: number, min: number, max: number): number {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function formatBytesShort(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} Mo`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} Go`
}

function formatRelative(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface ArchivePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const { supabase, orgId, user } = await getCurrentUser()
  const sp = await searchParams

  // Helper pour extraire string unique
  const single = (key: string): string | undefined => {
    const v = sp[key]
    if (Array.isArray(v)) return v[0]
    return v
  }

  const query: ArchiveQuery = {
    kind: parseEnum<ArchiveFileKind | 'all'>(single('type'), KIND_VALUES, 'all'),
    period: parseEnum<ArchiveQuery['period']>(single('period'), PERIOD_VALUES, 'all'),
    clientId: single('client_id') ?? null,
    diagnostic: parseEnum<ArchiveDiagnostic | 'all'>(single('diagnostic'), DIAG_VALUES, 'all'),
    q: single('q') ?? null,
    page: parseInt32(single('page'), 1, 1, 10_000),
    limit: parseInt32(single('limit'), ARCHIVE_DEFAULT_LIMIT, 1, 200),
  }

  // 1. Stats hero — aggregation globale (sans filtre) pour montrer le contexte
  // Note : 2e appel — pourrait être mergé avec le aggregator si besoin perf.
  const [globalAggregation, filteredAggregation, clientsResult] = await Promise.all([
    aggregateArchiveFiles({
      supabase,
      orgId,
      userId: user.id,
      query: {
        kind: 'all',
        period: 'all',
        clientId: null,
        diagnostic: 'all',
        q: null,
        page: 1,
        limit: 200,
      },
    }),
    aggregateArchiveFiles({ supabase, orgId, userId: user.id, query }),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('display_name', { ascending: true })
      .limit(500),
  ])

  const totalBytes = globalAggregation.files.reduce(
    (acc, f) => acc + (f.file_size_bytes ?? 0),
    0,
  )
  const lastFileAt = globalAggregation.files[0]?.created_at ?? null

  const clients = (clientsResult.data ?? []) as Array<{ id: string; display_name: string }>

  // Sérialise les query params actuels (sans `page`) pour la pagination du tableau
  const baseQuery = new URLSearchParams()
  if (query.kind !== 'all') baseQuery.set('type', query.kind)
  if (query.period !== 'all') baseQuery.set('period', query.period)
  if (query.clientId) baseQuery.set('client_id', query.clientId)
  if (query.diagnostic !== 'all') baseQuery.set('diagnostic', query.diagnostic)
  if (query.q) baseQuery.set('q', query.q)

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Mes"
        accent="fichiers"
        description="Vue globale de tous les fichiers du compte. Filtrez, recherchez, exportez."
        action={<ArchiveBulkExportButton />}
      />

      {/* Stats hero — toujours globales (pas filtrées) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiHero
          value={globalAggregation.total.toLocaleString('fr-FR')}
          label="Fichiers"
          hint="Photos, audio, documents et exports cumulés"
        />
        <KpiHero
          value={formatBytesShort(totalBytes)}
          label="Volume utilisé"
          hint="Calculé sur les 200 fichiers les plus récents"
        />
        <KpiHero
          value={formatRelative(lastFileAt)}
          label="Dernier ajout"
          hint={lastFileAt ? 'Photo, doc ou audio uploadé' : 'Aucun fichier pour le moment'}
        />
      </div>

      <ArchiveFilters clients={clients} />

      <ArchiveTable
        files={filteredAggregation.files}
        total={filteredAggregation.total}
        page={filteredAggregation.page}
        limit={query.limit}
        hasMore={filteredAggregation.hasMore}
        baseQueryString={baseQuery.toString()}
      />
    </div>
  )
}
