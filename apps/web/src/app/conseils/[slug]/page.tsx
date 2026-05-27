import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { JsonLd } from '@/components/seo/JsonLd'
import { MarkdownArticle } from '@/components/seo/MarkdownArticle'
import { KOVAS_BASE_URL, buildArticleSchema, buildBreadcrumbList } from '@/lib/seo/schema-org'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

type RouteParams = {
  slug: string
}

type PageProps = {
  params: Promise<RouteParams>
}

interface PublicationArticle {
  readonly id: string
  readonly slug: string
  readonly publishedUrl: string
  readonly seoTitle: string
  readonly seoDescription: string
  readonly publishedAt: string
  readonly canonicalUrl: string | null
  readonly contentMarkdown: string | null
  readonly contentHtml: string | null
}

async function fetchPublicationBySlug(slug: string): Promise<PublicationArticle | null> {
  const supabase = await createClient()
  const publishedUrl = `/conseils/${slug}`

  // biome-ignore lint/suspicious/noExplicitAny: Phase D crée les tables, type pas encore régénéré.
  const { data, error } = await (supabase as any)
    .from('seo_publications')
    .select(
      'id, published_url, seo_title, seo_description, published_at, canonical_url, draft_id, seo_drafts:draft_id(content_markdown, content_html, slug)',
    )
    .eq('published_url', publishedUrl)
    .maybeSingle()

  if (error || !data) return null

  // biome-ignore lint/suspicious/noExplicitAny: shape dynamique post-join.
  const row = data as any
  // biome-ignore lint/suspicious/noExplicitAny: shape dynamique embedded.
  const draft = (row.seo_drafts ?? null) as any

  return {
    id: String(row.id),
    slug: String(draft?.slug ?? slug),
    publishedUrl: String(row.published_url ?? publishedUrl),
    seoTitle: String(row.seo_title ?? ''),
    seoDescription: String(row.seo_description ?? ''),
    publishedAt: String(row.published_at ?? ''),
    canonicalUrl:
      typeof row.canonical_url === 'string' && row.canonical_url.length > 0
        ? row.canonical_url
        : null,
    contentMarkdown: typeof draft?.content_markdown === 'string' ? draft.content_markdown : null,
    contentHtml: typeof draft?.content_html === 'string' ? draft.content_html : null,
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article = await fetchPublicationBySlug(slug)

  if (!article) {
    return {
      title: 'Article introuvable',
      robots: { index: false, follow: false },
    }
  }

  const canonical = article.canonicalUrl ?? `${KOVAS_BASE_URL}${article.publishedUrl}`

  return {
    title: article.seoTitle,
    description: article.seoDescription,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: 'KOVAS',
      locale: 'fr_FR',
      title: article.seoTitle,
      description: article.seoDescription,
      publishedTime: article.publishedAt,
    },
    twitter: {
      card: 'summary',
      title: article.seoTitle,
      description: article.seoDescription,
    },
  }
}

function formatPublishedDate(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

export default async function ConseilArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article = await fetchPublicationBySlug(slug)

  if (!article) notFound()

  const publishedLabel = formatPublishedDate(article.publishedAt)

  return (
    <div className="min-h-dvh flex flex-col bg-cream text-ink font-sans">
      <JsonLd
        id={`conseil-${article.slug}`}
        data={[
          buildArticleSchema({
            headline: article.seoTitle,
            description: article.seoDescription,
            slug: article.slug,
            datePublished: article.publishedAt,
            authorName: 'KOVAS',
          }),
          buildBreadcrumbList([
            { name: 'Accueil', path: '/' },
            { name: 'Conseils', path: '/conseils' },
            { name: article.seoTitle, path: article.publishedUrl },
          ]),
        ]}
      />
      <PublicHeader />

      <main className="flex-1">
        <article className="max-w-[760px] mx-auto px-6 pt-16 sm:pt-24 pb-16">
          <nav
            aria-label="Fil d'Ariane"
            className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink/55 mb-6 flex items-center gap-2 flex-wrap"
          >
            <Link href="/" className="hover:text-ink transition-colors">
              Accueil
            </Link>
            <span aria-hidden>/</span>
            <Link href="/conseils" className="hover:text-ink transition-colors">
              Conseils
            </Link>
          </nav>

          <header className="mb-10">
            <h1 className="font-sans font-semibold text-[36px] sm:text-[48px] md:text-[56px] leading-[1.04] tracking-[-0.025em] mb-6">
              {article.seoTitle}
            </h1>
            <p className="text-[18px] sm:text-[20px] text-ink/72 leading-relaxed mb-5">
              {article.seoDescription}
            </p>
            {publishedLabel ? (
              <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-ink/55">
                Publié le {publishedLabel}
              </p>
            ) : null}
          </header>

          <MarkdownArticle html={article.contentHtml} markdown={article.contentMarkdown} />
        </article>

        <section className="border-t border-rule/60 bg-paper">
          <div className="max-w-[760px] mx-auto px-6 py-14 sm:py-20 text-center">
            <h2 className="font-sans text-[26px] sm:text-[34px] font-semibold leading-snug tracking-tight mb-4">
              Tu as besoin d'un diagnostic ?
            </h2>
            <p className="text-ink/72 leading-relaxed max-w-[560px] mx-auto mb-7">
              Obtiens un devis gratuit en moins de 2 minutes auprès d'un diagnostiqueur immobilier
              certifié près de chez toi.
            </p>
            <Link
              href="/trouver-un-diagnostiqueur"
              className="inline-block px-7 py-3.5 rounded-full bg-navy text-cream font-semibold hover:bg-navy/90 transition-colors"
            >
              Demander un devis particulier
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
