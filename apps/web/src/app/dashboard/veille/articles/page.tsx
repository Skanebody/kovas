/**
 * /dashboard/veille/articles — Articles SEO éditoriaux longue forme
 * (méthode Amandine Bart), distincts de la timeline réglementaire.
 *
 * Server Component : liste les drafts status='published' triés par
 * `published_at` DESC, regroupés par catégorie via filtre query param.
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'
import { CATEGORY_LABELS } from '@/lib/veille/types'
import type { VeilleCategory } from '@/lib/veille/seo-keywords'
import { CalendarClock, FileText } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Articles de veille — KOVAS',
  description:
    'Articles éditoriaux longue forme sur la réglementation du diagnostic immobilier en France. Sources Légifrance, ADEME, INSEE.',
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface PublishedArticleRow {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: VeilleCategory
  target_keyword: string
  published_at: string | null
  word_count: number
  source_citations_count: number
}

interface PageProps {
  searchParams: Promise<{ category?: string }>
}

const ALL_CATEGORIES: ReadonlyArray<VeilleCategory> = [
  'reglementaire',
  'pratique',
  'technique',
  'marche',
  'jurisprudence',
]

function isCategory(value: string | undefined): value is VeilleCategory {
  return typeof value === 'string' && (ALL_CATEGORIES as ReadonlyArray<string>).includes(value)
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export default async function VeilleArticlesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const filterCategory = isCategory(sp.category) ? sp.category : null

  const supabase = await createClient()

  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  let qb = (supabase as any)
    .from('veille_articles_draft')
    .select(
      'id, slug, title, excerpt, category, target_keyword, published_at, word_count, source_citations_count',
    )
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(30)

  if (filterCategory) {
    qb = qb.eq('category', filterCategory)
  }

  const { data, error } = await qb
  const articles = ((error ? [] : data) ?? []) as PublishedArticleRow[]

  return (
    <div className="space-y-7 max-w-5xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-2 min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Veille · Articles éditoriaux
          </p>
          <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
            Actualité réglementaire diagnostic immobilier.
          </h1>
          <p className="text-sm text-ink-mute max-w-xl">
            Analyses longue forme sur les évolutions législatives, les
            pratiques métier et les décisions de justice. Sources officielles
            Légifrance, ADEME et INSEE — mises à jour chaque semaine.
          </p>
        </div>
        <Link
          href="/dashboard/veille"
          className="text-sm text-ink-mute hover:text-ink underline-offset-4 hover:underline"
        >
          Timeline réglementaire →
        </Link>
      </header>

      {/* Filtres catégorie */}
      <nav
        aria-label="Filtrer par catégorie"
        className="flex flex-wrap gap-2"
      >
        <Link
          href="/dashboard/veille/articles"
          className={
            filterCategory === null
              ? 'rounded-pill bg-cta text-cta-foreground px-4 py-1.5 text-xs font-mono uppercase tracking-wider'
              : 'rounded-pill border border-rule text-ink-mute px-4 py-1.5 text-xs font-mono uppercase tracking-wider hover:border-ink hover:text-ink transition-colors'
          }
        >
          Tout
        </Link>
        {ALL_CATEGORIES.map((cat) => (
          <Link
            key={cat}
            href={`/dashboard/veille/articles?category=${cat}`}
            className={
              filterCategory === cat
                ? 'rounded-pill bg-cta text-cta-foreground px-4 py-1.5 text-xs font-mono uppercase tracking-wider'
                : 'rounded-pill border border-rule text-ink-mute px-4 py-1.5 text-xs font-mono uppercase tracking-wider hover:border-ink hover:text-ink transition-colors'
            }
          >
            {CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </nav>

      {/* Grille articles */}
      {articles.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="size-10 mx-auto mb-4 text-ink-faint" aria-hidden />
          <p className="text-ink-mute mb-2">
            Aucun article publié dans cette catégorie pour le moment.
          </p>
          <p className="text-xs text-ink-faint">
            La rédaction publie deux articles par semaine — les mardis matin.
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/dashboard/veille/articles/${article.slug}`}
              className="group"
            >
              <Card className="p-5 h-full hover:shadow-glass transition-shadow flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="muted" className="text-[10px]">
                    {CATEGORY_LABELS[article.category]}
                  </Badge>
                  <span className="text-[11px] font-mono text-ink-faint">
                    {article.word_count.toLocaleString('fr-FR')} mots
                  </span>
                </div>
                <h2 className="font-semibold text-ink text-base mb-2 group-hover:underline underline-offset-4 leading-snug">
                  {article.title}
                </h2>
                {article.excerpt ? (
                  <p className="text-sm text-ink-mute leading-relaxed line-clamp-3 mb-4 flex-1">
                    {article.excerpt}
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2 text-[11px] text-ink-faint mt-auto pt-3 border-t border-rule">
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <CalendarClock className="size-3" aria-hidden />
                    {formatDate(article.published_at)}
                  </span>
                  <span className="text-ink-mute">
                    {article.source_citations_count} sources
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
