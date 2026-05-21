import { PublicFooter } from '@/components/public/PublicFooter'
import { PublicNav } from '@/components/public/PublicNav'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  KOVAS_BASE_URL,
  buildBreadcrumbList,
} from '@/lib/seo/schema-org'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * `/conseils` — Liste publique des articles SEO publiés.
 *
 * Lit `seo_publications` (Phase D pipeline) triée par date de publication
 * décroissante, joint le draft pour récupérer le slug propre et le snippet.
 * Brand publique navy + cream (registre B2C cohérent avec la home).
 */

export const metadata: Metadata = {
  title: 'Conseils & expertises diagnostics immobiliers',
  description:
    'Guides et conseils pour comprendre le DPE, amiante, plomb, gaz, électricité et ERP. Rédigés par les experts KOVAS.',
  alternates: { canonical: `${KOVAS_BASE_URL}/conseils` },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: `${KOVAS_BASE_URL}/conseils`,
    siteName: 'KOVAS',
    title: 'Conseils & expertises diagnostics immobiliers — KOVAS',
    description:
      'Guides et conseils pour comprendre vos diagnostics immobiliers obligatoires.',
  },
}

interface PublicationListItem {
  readonly id: string
  readonly publishedUrl: string
  readonly seoTitle: string
  readonly seoDescription: string
  readonly publishedAt: string
  readonly slug: string
}

async function fetchPublications(): Promise<PublicationListItem[]> {
  const supabase = await createClient()
  // Type Database ne contient pas encore seo_publications/seo_drafts (générés ailleurs).
  // biome-ignore lint/suspicious/noExplicitAny: Phase D crée la table, type pas encore régénéré.
  const { data, error } = await (supabase as any)
    .from('seo_publications')
    .select('id, published_url, seo_title, seo_description, published_at, draft_id')
    .order('published_at', { ascending: false })
    .limit(24)

  if (error || !data) return []

  // biome-ignore lint/suspicious/noExplicitAny: row shape minimal.
  return (data as any[]).map((row): PublicationListItem => {
    const publishedUrl = String(row.published_url ?? '')
    const slug = publishedUrl.startsWith('/conseils/')
      ? publishedUrl.slice('/conseils/'.length)
      : publishedUrl.split('/').filter(Boolean).pop() ?? ''
    return {
      id: String(row.id),
      publishedUrl,
      seoTitle: String(row.seo_title ?? ''),
      seoDescription: String(row.seo_description ?? ''),
      publishedAt: String(row.published_at ?? ''),
      slug,
    }
  })
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

export default async function ConseilsListPage() {
  const items = await fetchPublications()

  return (
    <div className="min-h-dvh flex flex-col bg-cream text-ink font-sans">
      <JsonLd
        id="conseils-breadcrumb"
        data={buildBreadcrumbList([
          { name: 'Accueil', path: '/' },
          { name: 'Conseils', path: '/conseils' },
        ])}
      />
      <PublicNav variant="b2c" />
      <main className="flex-1">
        <section className="max-w-[1200px] mx-auto px-6 pt-16 sm:pt-24 pb-12">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink/55 font-medium mb-6">
            Ressources éditoriales
          </p>
          <h1 className="font-sans font-semibold text-[44px] sm:text-[64px] md:text-[80px] leading-[1.02] tracking-[-0.03em] mb-6">
            Conseils &amp;{' '}
            <span className="font-serif italic font-normal text-ink/72">
              expertises.
            </span>
          </h1>
          <p className="text-[17px] sm:text-[19px] text-ink/72 max-w-[720px] leading-relaxed">
            Guides clairs sur le DPE, l'amiante, le plomb, le gaz, l'électricité,
            les termites, les surfaces Carrez/Boutin et les ERP. Rédigés par
            l'équipe KOVAS sur la base des textes ADEME et DHUP en vigueur.
          </p>
        </section>

        <section className="max-w-[1200px] mx-auto px-6 pb-24">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-rule/60 bg-paper p-12 text-center">
              <h2 className="text-2xl font-semibold mb-3">
                Articles bientôt disponibles
              </h2>
              <p className="text-ink/72 max-w-[520px] mx-auto">
                Notre équipe rédige actuellement les premiers guides. Revenez
                dans quelques jours, ou consultez l'annuaire des diagnostiqueurs
                pour obtenir un devis dès maintenant.
              </p>
              <Link
                href="/diagnostiqueurs"
                className="inline-block mt-6 px-6 py-3 rounded-full bg-navy text-cream font-medium hover:bg-navy/90 transition-colors"
              >
                Voir l'annuaire
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={`/conseils/${item.slug}`}
                  className="group flex flex-col rounded-2xl border border-rule/60 bg-paper p-6 hover:border-ink/40 transition-colors"
                >
                  <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-3">
                    {formatPublishedDate(item.publishedAt)}
                  </p>
                  <h2 className="font-sans text-[22px] font-semibold leading-snug tracking-tight mb-3 group-hover:underline underline-offset-4">
                    {item.seoTitle}
                  </h2>
                  <p className="text-[15px] text-ink/72 leading-relaxed flex-1">
                    {item.seoDescription}
                  </p>
                  <p className="mt-5 text-sm font-medium text-navy">
                    Lire l'article →
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <PublicFooter />
    </div>
  )
}
