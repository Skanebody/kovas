/**
 * /dashboard/veille/articles/[slug] — Page article SEO longue forme.
 *
 * Server Component. Rend l'article complet (Markdown → HTML) avec metadata
 * SEO complète, JSON-LD Article schema.org, lien retour vers la liste.
 */

import { ArticleMarkdown } from '@/components/veille/ArticleMarkdown'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_LABELS } from '@/lib/veille/types'
import type { VeilleCategory } from '@/lib/veille/seo-keywords'
import { ArrowLeft, BookOpen, CalendarClock, Link as LinkIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import Script from 'next/script'

interface ArticleFullRow {
  id: string
  slug: string
  title: string
  meta_title: string | null
  meta_description: string | null
  content_markdown: string
  excerpt: string | null
  category: VeilleCategory
  target_keyword: string
  published_at: string | null
  word_count: number
  internal_links_count: number
  source_citations_count: number
  faq_questions_count: number
  ai_model: string
  tags: string[] | null
}

interface PageParams {
  slug: string
}

async function loadArticle(slug: string): Promise<ArticleFullRow | null> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  const { data, error } = await (supabase as any)
    .from('veille_articles_draft')
    .select(
      'id, slug, title, meta_title, meta_description, content_markdown, excerpt, category, target_keyword, published_at, word_count, internal_links_count, source_citations_count, faq_questions_count, ai_model, tags',
    )
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error || !data) return null
  return data as ArticleFullRow
}

async function loadRelatedArticles(
  category: VeilleCategory,
  currentSlug: string,
): Promise<
  Array<{ id: string; slug: string; title: string; excerpt: string | null }>
> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  const { data } = await (supabase as any)
    .from('veille_articles_draft')
    .select('id, slug, title, excerpt')
    .eq('status', 'published')
    .eq('category', category)
    .neq('slug', currentSlug)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(3)

  return (data ?? []) as Array<{
    id: string
    slug: string
    title: string
    excerpt: string | null
  }>
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>
}): Promise<Metadata> {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) return { title: 'Article introuvable — KOVAS' }

  return {
    title: article.meta_title ?? article.title,
    description: article.meta_description ?? article.excerpt ?? undefined,
    alternates: {
      canonical: `https://kovas.fr/dashboard/veille/articles/${article.slug}`,
    },
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatIsoDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toISOString().slice(0, 10)
}

function readingTime(words: number): number {
  // 220 mots/min en moyenne pour la lecture pro FR
  return Math.max(1, Math.round(words / 220))
}

export default async function VeilleArticlePage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) notFound()

  const related = await loadRelatedArticles(article.category, article.slug)

  // JSON-LD Article schema.org
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.meta_description ?? article.excerpt ?? undefined,
    datePublished: article.published_at ?? undefined,
    dateModified: article.published_at ?? undefined,
    keywords: [article.target_keyword, ...(article.tags ?? [])].join(', '),
    inLanguage: 'fr-FR',
    isAccessibleForFree: true,
    publisher: {
      '@type': 'Organization',
      name: 'KOVAS',
      url: 'https://kovas.fr',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://kovas.fr/dashboard/veille/articles/${article.slug}`,
    },
  }

  return (
    <div className="max-w-3xl mx-auto w-full space-y-8 pb-16">
      <Script
        id="article-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />

      {/* Breadcrumb retour */}
      <Link
        href="/dashboard/veille/articles"
        className="inline-flex items-center gap-2 text-sm text-ink-mute hover:text-ink underline-offset-4 hover:underline"
      >
        <ArrowLeft className="size-4" />
        Tous les articles
      </Link>

      {/* Header article */}
      <header className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant="muted">{CATEGORY_LABELS[article.category]}</Badge>
          <span className="text-xs font-mono text-ink-faint inline-flex items-center gap-1.5">
            <CalendarClock className="size-3" aria-hidden />
            <time dateTime={formatIsoDate(article.published_at)}>
              Mise à jour : {formatDate(article.published_at)}
            </time>
          </span>
          <span className="text-xs font-mono text-ink-faint inline-flex items-center gap-1.5">
            <BookOpen className="size-3" aria-hidden />
            {readingTime(article.word_count)} min de lecture
          </span>
        </div>
      </header>

      {/* Corps article */}
      <ArticleMarkdown markdown={article.content_markdown} />

      {/* Encart métadonnées éditoriales */}
      <Card className="p-5 bg-cream-deep border-rule">
        <div className="grid sm:grid-cols-3 gap-4 text-xs text-ink-mute">
          <div>
            <p className="font-mono uppercase tracking-wider text-[10px] text-ink-faint mb-1">
              Mot-clé cible
            </p>
            <p className="text-sm text-ink font-medium">{article.target_keyword}</p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-wider text-[10px] text-ink-faint mb-1">
              Sources citées
            </p>
            <p className="text-sm text-ink font-medium inline-flex items-center gap-1.5">
              <LinkIcon className="size-3" aria-hidden />
              {article.source_citations_count} liens externes
            </p>
          </div>
          <div>
            <p className="font-mono uppercase tracking-wider text-[10px] text-ink-faint mb-1">
              Volume éditorial
            </p>
            <p className="text-sm text-ink font-medium">
              {article.word_count.toLocaleString('fr-FR')} mots
            </p>
          </div>
        </div>
      </Card>

      {/* Articles connexes */}
      {related.length > 0 ? (
        <section aria-label="Articles connexes" className="space-y-4">
          <h2 className="font-sans font-bold text-xl tracking-tight">
            Sur le même sujet
          </h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {related.map((r) => (
              <Link key={r.id} href={`/dashboard/veille/articles/${r.slug}`}>
                <Card className="p-4 hover:shadow-glass transition-shadow h-full">
                  <h3 className="font-semibold text-sm text-ink mb-2 leading-snug">
                    {r.title}
                  </h3>
                  {r.excerpt ? (
                    <p className="text-xs text-ink-mute line-clamp-3">{r.excerpt}</p>
                  ) : null}
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
