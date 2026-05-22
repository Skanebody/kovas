import { Button } from '@/components/ui/button'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { FAQ_CATEGORIES, FAQ_LANDING } from '@/lib/faq-data'
import { buildMetadata } from '@/lib/seo/metadata'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Script from 'next/script'
import { FaqExplorer } from './faq-explorer'

export const metadata = buildMetadata({
  title: 'Questions fréquentes',
  description:
    "Toutes les réponses sur KOVAS, le diagnostic immobilier, le DPE, les obligations légales 2026 et la conformité. Filtrage par catégorie.",
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
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <Script
        id="faq-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON-LD
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="sticky top-0 z-30 bg-[#F5F7F4]/86 backdrop-blur-xl border-b border-[#0F1419]/[0.08]">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="font-semibold tracking-[0.22em] text-[15px] text-[#0F1419]"
          >
            KOVAS
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" /> Retour
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-6xl px-6 py-12 w-full">
        <div className="max-w-2xl mb-12 space-y-3">
          <p className="text-xs uppercase tracking-wider font-mono text-[#0F1419]/55">
            Questions fréquentes
          </p>
          <h1
            className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
            style={{ fontSize: 'clamp(40px, 5vw, 72px)' }}
          >
            Tout ce que vous voulez savoir sur KOVAS et le{' '}
            <span className="font-serif italic font-normal">diagnostic immobilier</span>.
          </h1>
          <p className="text-[#0F1419]/72">
            Filtrez par catégorie pour aller plus vite. Pour les diagnostiqueurs, les
            propriétaires, les vendeurs et les locataires.
          </p>
        </div>

        <FaqExplorer />

        <div className="mt-16 pt-8 border-t border-[#0F1419]/[0.08] text-center space-y-4">
          <p className="text-sm text-[#0F1419]/72">
            Pas de réponse à votre question ? Contactez-nous directement.
          </p>
          <Button asChild variant="accent">
            <Link href="/contact">Nous contacter</Link>
          </Button>
        </div>
      </main>
      <LandingFooter />
    </div>
  )
}
