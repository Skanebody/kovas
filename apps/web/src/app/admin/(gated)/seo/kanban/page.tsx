/**
 * /admin/seo/kanban — Pipeline éditorial SEO (Mission D4).
 *
 * Server Component : charge tous les drafts groupés par status via service_role,
 * passe au Client Component pour interactivité (changer status, générer batch).
 *
 * Note : tables seo_* créées par mission D1 en parallèle (pas encore dans
 * Database.types) — casts `as unknown as` cohérents avec les autres pages.
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { SeoKanbanBoard, type SeoDraftWithKeyword, type SeoDraftStatus } from './SeoKanbanBoard'

export const metadata: Metadata = {
  title: 'Pipeline SEO — Kanban',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface DraftJoinedRow {
  id: string
  title: string
  slug: string | null
  status: SeoDraftStatus
  eeat_score: number | null
  eeat_validations: Record<string, boolean> | null
  assigned_to: string | null
  revision_count: number | null
  updated_at: string | null
  created_at: string | null
  keyword_id: string
  seo_keywords?:
    | {
        id: string
        keyword_display: string
        score: number | null
        category: string | null
      }
    | null
}

async function fetchAllDrafts(): Promise<SeoDraftWithKeyword[]> {
  const supabase = createAdminClient()

  const { data, error } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          order: (
            col: string,
            opts: { ascending: boolean },
          ) => Promise<{ data: DraftJoinedRow[] | null; error: { message: string } | null }>
        }
      }
    }
  )
    .from('seo_drafts')
    .select(
      'id, title, slug, status, eeat_score, eeat_validations, assigned_to, revision_count, updated_at, created_at, keyword_id, seo_keywords(id, keyword_display, score, category)',
    )
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('fetchAllDrafts error:', error.message)
    return []
  }

  const rows = (data ?? []) as DraftJoinedRow[]
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    status: r.status,
    eeatScore: r.eeat_score,
    eeatValidations: r.eeat_validations,
    assignedTo: r.assigned_to,
    revisionCount: r.revision_count ?? 0,
    updatedAt: r.updated_at,
    keyword: r.seo_keywords
      ? {
          id: r.seo_keywords.id,
          display: r.seo_keywords.keyword_display,
          score: r.seo_keywords.score,
          category: r.seo_keywords.category,
        }
      : null,
  }))
}

export default async function SeoKanbanPage() {
  const drafts = await fetchAllDrafts()
  return <SeoKanbanBoard initialDrafts={drafts} />
}
