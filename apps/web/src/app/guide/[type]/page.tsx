import { GuideCalculatorCTA } from '@/components/guide/GuideCalculatorCTA'
import { GuideFAQ } from '@/components/guide/GuideFAQ'
import { GuideHero } from '@/components/guide/GuideHero'
import { GuideLocalSearch } from '@/components/guide/GuideLocalSearch'
import { GuideSection } from '@/components/guide/GuideSection'
import { GuideTOC } from '@/components/guide/GuideTOC'
import { GuideSources } from '@/components/guides/GuideSources'
import { RelatedGuides } from '@/components/guides/RelatedGuides'
import { JsonLd } from '@/components/seo/JsonLd'
import { getMergedRelatedGuides } from '@/data/guides/internal-linking'
import { GUIDE_SLUGS, getGuideBySlug } from '@/lib/guides/registry'
import { buildGuideSchemaGraph } from '@/lib/guides/schema'
import { buildMetadata } from '@/lib/seo/metadata'
import { ArrowRight, BookOpen } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface PageParams {
  readonly type: string
}

interface PageProps {
  readonly params: Promise<PageParams>
}

/**
 * Generate les 9 pages statiquement au build (SSG).
 * Aucune dépendance dynamique : les guides sont in-memory dans le bundle.
 */
export function generateStaticParams(): ReadonlyArray<PageParams> {
  return GUIDE_SLUGS.map((slug) => ({ type: slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { type } = await params
  const guide = getGuideBySlug(type)
  if (!guide) {
    return {
      title: 'Guide introuvable',
      robots: { index: false, follow: false },
    }
  }
  return buildMetadata({
    title: guide.title,
    description: guide.metaDescription,
    path: `/guide/${guide.slug}`,
    ogType: 'article',
    publishedTime: guide.publishedAt,
    modifiedTime: guide.updatedAt,
    authorName: 'Équipe KOVAS',
  })
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { type } = await params
  const guide = getGuideBySlug(type)
  if (!guide) {
    notFound()
  }

  // Maillage interne curé (méthode Amandine Bart) : combine
  // `INTERNAL_LINKING_MAP` + fallback historique `Guide.relatedTypes`.
  const relatedGuides = getMergedRelatedGuides(guide, 4)
  const schemaGraph = buildGuideSchemaGraph(guide)

  // Heuristique d'insertion CTA :
  //  - calculator CTA après la section 3 ("règles 2026") pour engager tôt
  //  - calculator CTA dupliqué avant la FAQ
  //  - local search CTA en toute fin
  const sectionsBeforeMidCTA = guide.sections.slice(0, 3)
  const sectionsAfterMidCTA = guide.sections.slice(3)

  return (
    <>
      <JsonLd data={schemaGraph} id={`guide-${guide.slug}`} />

      <GuideHero guide={guide} />

      <div className="mx-auto max-w-screen-xl px-4 py-12 md:px-6 md:py-16">
        <nav
          aria-label="Fil d'Ariane"
          className="mb-8 font-mono text-[11px] uppercase tracking-wider text-ink-mute"
        >
          <Link href="/" className="hover:text-ink">
            Accueil
          </Link>
          <span className="mx-2 text-ink-faint" aria-hidden>
            /
          </span>
          <Link href="/guide" className="hover:text-ink">
            Guides
          </Link>
          <span className="mx-2 text-ink-faint" aria-hidden>
            /
          </span>
          <span className="text-ink">{guide.shortTitle}</span>
        </nav>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          {/* Sidebar TOC + related — desktop only sticky */}
          <aside className="lg:col-span-3">
            <GuideTOC sections={guide.sections} />

            {relatedGuides.length > 0 && (
              <div className="mt-6 rounded-lg border border-rule/40 bg-paper p-5">
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
                  Guides connexes
                </p>
                <ul className="space-y-2">
                  {relatedGuides.map((related) => (
                    <li key={related.type}>
                      <Link
                        href={`/guide/${related.slug}`}
                        className="group flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-ink-mute transition-colors hover:bg-ink/[0.03] hover:text-ink"
                      >
                        <span className="flex items-center gap-2">
                          <BookOpen className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                          {related.shortTitle}
                        </span>
                        <ArrowRight
                          className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>

          {/* Corps du guide */}
          <article className="lg:col-span-9">
            {sectionsBeforeMidCTA.map((section, idx) => (
              <GuideSection key={section.id} section={section} index={idx} />
            ))}

            <GuideCalculatorCTA type={guide.type} shortTitle={guide.shortTitle} />

            {sectionsAfterMidCTA.map((section, idx) => (
              <GuideSection
                key={section.id}
                section={section}
                index={idx + sectionsBeforeMidCTA.length}
              />
            ))}

            <GuideCalculatorCTA type={guide.type} shortTitle={guide.shortTitle} />

            <section id="faq" className="mt-16 scroll-mt-28" aria-labelledby="faq-heading">
              <h2
                id="faq-heading"
                className="font-display text-2xl font-bold leading-tight tracking-tight text-ink sm:text-3xl md:text-4xl"
              >
                <span className="mr-3 font-mono text-sm font-medium text-ink-faint">
                  {String(guide.sections.length + 1).padStart(2, '0')}
                </span>
                Questions fréquentes
              </h2>
              <p className="mt-3 text-base leading-relaxed text-ink-soft md:text-[17px]">
                Les réponses aux {guide.faq.length} questions les plus fréquentes concernant le{' '}
                {guide.shortTitle.toLowerCase()}.
              </p>
              <div className="mt-8">
                <GuideFAQ items={guide.faq} />
              </div>
            </section>

            <GuideLocalSearch diagnosticLabel={guide.shortTitle} />

            {/* Sources externes officielles (méthode E-E-A-T) — affichées
               uniquement si le guide a déclaré ses sources. */}
            {guide.sources && guide.sources.length > 0 && <GuideSources sources={guide.sources} />}

            {/* "Pour aller plus loin" — maillage interne curé via
               `INTERNAL_LINKING_MAP`. Remplace l'ancienne section
               "Continuer la lecture" hard-codée. */}
            <RelatedGuides guide={guide} />
          </article>
        </div>
      </div>
    </>
  )
}
