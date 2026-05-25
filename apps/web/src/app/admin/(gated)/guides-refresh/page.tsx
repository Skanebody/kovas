/**
 * /admin/guides-refresh — Validation des drafts d'auto-update des 9 guides
 * longs `/guide/*` (Lot B65).
 *
 * Server Component : liste les drafts en `status='draft_ready'` + dernière
 * version publiée de chaque slug (pour diff side-by-side). Passe les données
 * à un Client Component pour interactivité (Approuver / Rejeter / Régénérer).
 *
 * Workflow rappel :
 *   1. Cron `refresh-guides-content` produit un draft (status='draft_ready')
 *   2. Admin valide ici → INSERT dans internal.guide_versions + status='approved'
 *   3. Frontend `/guide/[type]` lit la version la plus récente (ou fallback
 *      sur le registry hardcodé si aucune version DB).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { GuidesRefreshBoard } from './GuidesRefreshBoard'

export const metadata: Metadata = {
  title: 'Guides — Refresh queue (Lot B65)',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

type GuideSlug =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'
  | 'audit-energetique'

export const SUPPORTED_GUIDE_SLUGS: ReadonlyArray<GuideSlug> = [
  'dpe',
  'amiante',
  'plomb',
  'gaz',
  'electricite',
  'termites',
  'carrez',
  'erp',
  'audit-energetique',
]

export interface RefreshDraft {
  readonly id: string
  readonly guideSlug: GuideSlug
  readonly status: 'pending' | 'processing' | 'draft_ready' | 'approved' | 'failed'
  readonly createdAt: string
  readonly processedAt: string | null
  readonly draftTitle: string | null
  readonly draftContentMd: string | null
  readonly draftMetaTitle: string | null
  readonly draftMetaDescription: string | null
  readonly draftWordCount: number
  readonly sourcesFetched: ReadonlyArray<{
    title: string
    url: string
    organization: string
    published_at: string | null
    excerpt: string
  }>
  readonly keyFigures: ReadonlyArray<{
    figure: string
    context: string
    source_url: string
    source_org: string
  }>
  readonly aiCostEur: number
  readonly aiInputTokens: number
  readonly aiOutputTokens: number
  readonly aiCacheReadTokens: number
  readonly errorLog: string | null
}

export interface CurrentVersion {
  readonly guideSlug: GuideSlug
  readonly versionNumber: number
  readonly contentMd: string
  readonly wordCount: number
  readonly publishedAt: string
}

export interface RefreshStats {
  readonly drafts_ready: number
  readonly approved_30d: number
  readonly failed_30d: number
  readonly total_cost_30d_eur: number
}

interface QueueRow {
  id: string
  guide_slug: GuideSlug
  status: 'pending' | 'processing' | 'draft_ready' | 'approved' | 'failed'
  created_at: string
  processed_at: string | null
  draft_content: {
    title?: string
    content_md?: string
    meta_title?: string
    meta_description?: string
    word_count?: number
  } | null
  sources_fetched: unknown
  key_figures: unknown
  ai_cost_eur: number | null
  ai_input_tokens: number | null
  ai_output_tokens: number | null
  ai_cache_read_tokens: number | null
  error_log: string | null
}

interface VersionRow {
  guide_slug: GuideSlug
  version_number: number
  content_md: string
  word_count: number
  published_at: string
}

async function fetchPendingDrafts(): Promise<RefreshDraft[]> {
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { data, error } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .select(
      'id, guide_slug, status, created_at, processed_at, draft_content, sources_fetched, key_figures, ai_cost_eur, ai_input_tokens, ai_output_tokens, ai_cache_read_tokens, error_log',
    )
    .eq('status', 'draft_ready')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[guides-refresh] fetchPendingDrafts:', error.message)
    return []
  }

  const rows = (data ?? []) as QueueRow[]
  return rows.map((r) => ({
    id: r.id,
    guideSlug: r.guide_slug,
    status: r.status,
    createdAt: r.created_at,
    processedAt: r.processed_at,
    draftTitle: r.draft_content?.title ?? null,
    draftContentMd: r.draft_content?.content_md ?? null,
    draftMetaTitle: r.draft_content?.meta_title ?? null,
    draftMetaDescription: r.draft_content?.meta_description ?? null,
    draftWordCount: r.draft_content?.word_count ?? 0,
    sourcesFetched: Array.isArray(r.sources_fetched)
      ? (r.sources_fetched as RefreshDraft['sourcesFetched'])
      : [],
    keyFigures: Array.isArray(r.key_figures) ? (r.key_figures as RefreshDraft['keyFigures']) : [],
    aiCostEur: r.ai_cost_eur ?? 0,
    aiInputTokens: r.ai_input_tokens ?? 0,
    aiOutputTokens: r.ai_output_tokens ?? 0,
    aiCacheReadTokens: r.ai_cache_read_tokens ?? 0,
    errorLog: r.error_log,
  }))
}

async function fetchCurrentVersions(): Promise<Record<GuideSlug, CurrentVersion | null>> {
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { data, error } = await (supabase as any)
    .schema('internal')
    .from('guide_versions')
    .select('guide_slug, version_number, content_md, word_count, published_at')
    .order('guide_slug', { ascending: true })
    .order('version_number', { ascending: false })

  const result = {} as Record<GuideSlug, CurrentVersion | null>
  for (const slug of SUPPORTED_GUIDE_SLUGS) {
    result[slug] = null
  }

  if (error || !data) return result

  const rows = data as VersionRow[]
  for (const r of rows) {
    if (!result[r.guide_slug]) {
      result[r.guide_slug] = {
        guideSlug: r.guide_slug,
        versionNumber: r.version_number,
        contentMd: r.content_md,
        wordCount: r.word_count,
        publishedAt: r.published_at,
      }
    }
  }
  return result
}

async function fetchStats(): Promise<RefreshStats> {
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { count: drafts_ready } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'draft_ready')

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { count: approved_30d } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gte('reviewed_at', cutoff)

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { count: failed_30d } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'failed')
    .gte('reviewed_at', cutoff)

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { data: costRows } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .select('ai_cost_eur')
    .gte('created_at', cutoff)

  const total_cost_30d_eur = ((costRows ?? []) as Array<{ ai_cost_eur: number | null }>).reduce(
    (acc, r) => acc + (r.ai_cost_eur ?? 0),
    0,
  )

  return {
    drafts_ready: drafts_ready ?? 0,
    approved_30d: approved_30d ?? 0,
    failed_30d: failed_30d ?? 0,
    total_cost_30d_eur: Math.round(total_cost_30d_eur * 10000) / 10000,
  }
}

export default async function GuidesRefreshPage() {
  const [drafts, currentVersions, stats] = await Promise.all([
    fetchPendingDrafts(),
    fetchCurrentVersions(),
    fetchStats(),
  ])

  return <GuidesRefreshBoard drafts={drafts} currentVersions={currentVersions} stats={stats} />
}
