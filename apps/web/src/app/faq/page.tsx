import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { Button } from '@/components/ui/button'
import { FAQ_CATEGORIES, FAQ_LANDING } from '@/lib/faq-data'
import { buildMetadata } from '@/lib/seo/metadata'
import Link from 'next/link'
import Script from 'next/script'
import { FaqExplorer } from './faq-explorer'

export const metadata = buildMetadata({
  title: 'Questions fréquentes',
  description:
    'Toutes les réponses sur KOVAS, le diagnostic immobilier, le DPE, les obligations légales 2026 et la conformité. Filtrage par catégorie.',
  path: '/faq',
})

function buildFaqJsonLd() {
  const all = [...FAQ_LANDING, ...FAQ_CATEGORIES.flatMap((c) => c.questions)]
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: all.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer.replace(/\*\*/g, ''),
      },
    })),
  }
}

export default function FaqPage() {
  const jsonLd = buildFaqJsonLd()

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <Script
        id="faq-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PublicHeader />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12 py-16">
        <div className="max-w-3xl mb-12 space-y-4">
          <p className="text-xs uppercase tracking-wider font-mono text-ink-mute">
            Questions fréquentes
          </p>
          <h1
            className="font-sans font-medium tracking-tight text-ink leading-[1.05]"
            style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}
          >
            Tout ce que tu veux savoir sur KOVAS et le{' '}
            <span className="font-serif italic font-normal text-chartreuse-deep">
              diagnostic immobilier
            </span>
            .
          </h1>
          <p className="text-ink-mute text-lg">
            Filtre par catégorie pour aller plus vite. Pour les diagnostiqueurs, les propriétaires,
            les vendeurs et les locataires.
          </p>
        </div>

        <FaqExplorer />

        <div className="mt-16 pt-8 border-t border-rule/60 text-center space-y-4">
          <p className="text-sm text-ink-mute">
            Pas de réponse à ta question ? Contacte-nous directement.
          </p>
          <Button asChild variant="accent">
            <Link href="/contact">Nous contacter</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
