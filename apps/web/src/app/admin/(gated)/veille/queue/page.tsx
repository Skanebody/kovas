/**
 * /admin/veille/queue — File de validation des articles de veille SEO
 * (méthode Amandine Bart) générés automatiquement par cron Claude Haiku.
 *
 * Server Component : liste tous les drafts en status='pending_review',
 * triés par eeat_score DESC. Passe les données à un Client Component pour
 * interactivité (approuver, rejeter, regenerate, éditer).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { VeilleCategory } from '@/lib/veille/seo-keywords'
import type { Metadata } from 'next'
import { VeilleQueueBoard } from './VeilleQueueBoard'

export const metadata: Metadata = {
  title: 'Veille — Queue de validation',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface VeilleQueueArticle {
  readonly id: string
  readonly title: string
  readonly slug: string
  readonly topic: string
  readonly targetKeyword: string
  readonly category: VeilleCategory
  readonly contentMarkdown: string
  readonly excerpt: string | null
  readonly metaTitle: string | null
  readonly metaDescription: string | null
  readonly status: 'pending_review' | 'approved' | 'published' | 'rejected'
  readonly eeatScore: number
  readonly eeatExperience: number
  readonly eeatExpertise: number
  readonly eeatAuthoritativeness: number
  readonly eeatTrustworthiness: number
  readonly wordCount: number
  readonly internalLinksCount: number
  readonly sourceCitationsCount: number
  readonly faqQuestionsCount: number
  readonly h2Count: number
  readonly h3Count: number
  readonly aiModel: string
  readonly aiCostEur: number
  readonly aiGeneratedAt: string
  readonly createdAt: string
}

interface DraftRow {
  id: string
  title: string
  slug: string
  topic: string
  target_keyword: string
  category: VeilleCategory
  content_markdown: string
  excerpt: string | null
  meta_title: string | null
  meta_description: string | null
  status: 'pending_review' | 'approved' | 'published' | 'rejected'
  eeat_score: number
  eeat_experience: number
  eeat_expertise: number
  eeat_authoritativeness: number
  eeat_trustworthiness: number
  word_count: number
  internal_links_count: number
  source_citations_count: number
  faq_questions_count: number
  h2_count: number
  h3_count: number
  ai_model: string
  ai_cost_eur: number
  ai_generated_at: string
  created_at: string
}

async function fetchPendingArticles(): Promise<VeilleQueueArticle[]> {
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('veille_articles_draft')
    .select(
      'id, title, slug, topic, target_keyword, category, content_markdown, excerpt, meta_title, meta_description, status, eeat_score, eeat_experience, eeat_expertise, eeat_authoritativeness, eeat_trustworthiness, word_count, internal_links_count, source_citations_count, faq_questions_count, h2_count, h3_count, ai_model, ai_cost_eur, ai_generated_at, created_at',
    )
    .eq('status', 'pending_review')
    .order('eeat_score', { ascending: false })

  if (error) {
    console.error('fetchPendingArticles error:', error.message)
    return []
  }

  const rows = (data ?? []) as DraftRow[]
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    topic: r.topic,
    targetKeyword: r.target_keyword,
    category: r.category,
    contentMarkdown: r.content_markdown,
    excerpt: r.excerpt,
    metaTitle: r.meta_title,
    metaDescription: r.meta_description,
    status: r.status,
    eeatScore: r.eeat_score,
    eeatExperience: r.eeat_experience,
    eeatExpertise: r.eeat_expertise,
    eeatAuthoritativeness: r.eeat_authoritativeness,
    eeatTrustworthiness: r.eeat_trustworthiness,
    wordCount: r.word_count,
    internalLinksCount: r.internal_links_count,
    sourceCitationsCount: r.source_citations_count,
    faqQuestionsCount: r.faq_questions_count,
    h2Count: r.h2_count,
    h3Count: r.h3_count,
    aiModel: r.ai_model,
    aiCostEur: r.ai_cost_eur,
    aiGeneratedAt: r.ai_generated_at,
    createdAt: r.created_at,
  }))
}

async function fetchAggregateStats(): Promise<{
  pending: number
  published30d: number
  rejected30d: number
  totalCost30dEur: number
}> {
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()

  // biome-ignore lint/suspicious/noExplicitAny: tables pas dans Database.types
  const { count: pending } = await (supabase as any)
    .from('veille_articles_draft')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending_review')

  // biome-ignore lint/suspicious/noExplicitAny: tables pas dans Database.types
  const { count: published30d } = await (supabase as any)
    .from('veille_articles_draft')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .gte('published_at', cutoff)

  // biome-ignore lint/suspicious/noExplicitAny: tables pas dans Database.types
  const { count: rejected30d } = await (supabase as any)
    .from('veille_articles_draft')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'rejected')
    .gte('reviewed_at', cutoff)

  // biome-ignore lint/suspicious/noExplicitAny: tables pas dans Database.types
  const { data: costRows } = await (supabase as any)
    .from('veille_articles_draft')
    .select('ai_cost_eur')
    .gte('ai_generated_at', cutoff)

  const totalCost30dEur = ((costRows ?? []) as Array<{ ai_cost_eur: number }>).reduce(
    (acc, r) => acc + (r.ai_cost_eur ?? 0),
    0,
  )

  return {
    pending: pending ?? 0,
    published30d: published30d ?? 0,
    rejected30d: rejected30d ?? 0,
    totalCost30dEur: Math.round(totalCost30dEur * 100) / 100,
  }
}

export default async function VeilleQueuePage() {
  const [articles, stats] = await Promise.all([fetchPendingArticles(), fetchAggregateStats()])

  return <VeilleQueueBoard articles={articles} stats={stats} />
}
