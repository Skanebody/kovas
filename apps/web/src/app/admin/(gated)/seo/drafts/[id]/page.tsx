/**
 * /admin/seo/drafts/[id] — Éditeur d'un draft SEO (Mission D4).
 *
 * Server Component : récupère le draft + keyword + dernière version,
 * passe au Client Component qui gère TipTap (ou fallback textarea) + EEAT live.
 *
 * Note : tables seo_* créées par mission D1 (pas encore dans Database.types).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SeoDraftEditor, type SeoDraftEditorPayload } from './SeoDraftEditor'

export const metadata: Metadata = {
  title: 'Editor — Draft SEO',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface DraftRow {
  id: string
  title: string
  slug: string | null
  meta_description: string | null
  content_markdown: string | null
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived' | 'rejected'
  eeat_score: number | null
  eeat_validations: Record<string, boolean> | null
  revision_count: number | null
  published_url: string | null
  target_url: string | null
  keyword_id: string
  updated_at: string | null
  seo_keywords?: {
    id: string
    keyword_display: string
    category: string | null
    geo_scope: string | null
    score: number | null
  } | null
}

async function fetchDraft(id: string): Promise<SeoDraftEditorPayload | null> {
  const supabase = createAdminClient()

  const { data, error } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (
            col: string,
            val: string,
          ) => {
            maybeSingle: () => Promise<{
              data: DraftRow | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  )
    .from('seo_drafts')
    .select(
      'id, title, slug, meta_description, content_markdown, status, eeat_score, eeat_validations, revision_count, published_url, target_url, keyword_id, updated_at, seo_keywords(id, keyword_display, category, geo_scope, score)',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    metaDescription: data.meta_description,
    contentMarkdown: data.content_markdown ?? '',
    status: data.status,
    eeatScore: data.eeat_score,
    eeatValidations: data.eeat_validations,
    revisionCount: data.revision_count ?? 0,
    publishedUrl: data.published_url,
    keyword: data.seo_keywords
      ? {
          id: data.seo_keywords.id,
          display: data.seo_keywords.keyword_display,
          category: data.seo_keywords.category,
          geoScope: data.seo_keywords.geo_scope,
          score: data.seo_keywords.score,
        }
      : null,
    updatedAt: data.updated_at,
  }
}

export default async function SeoDraftPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const payload = await fetchDraft(id)

  if (!payload) {
    notFound()
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="text-[12px] text-ink-mute">
        <Link
          href="/admin/seo/kanban"
          className="hover:text-ink underline-offset-2 hover:underline"
        >
          ← Retour au Kanban
        </Link>
      </div>
      <SeoDraftEditor initialDraft={payload} />
    </div>
  )
}
