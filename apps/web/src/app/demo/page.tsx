/**
 * /demo — Réservation démo personnalisée KOVAS.
 *
 * B71 (2026-05-26) : harmonisation chrome au style home V5 sobre :
 *   - PublicHeader + SiteFooter
 *   - bg-sage + ink #0F1419 + sections px-5 sm:px-12 py-20 sm:py-28
 *   - H1 clamp(40,7vw,104) + H2 clamp(32,4vw,56) Urbanist medium + serif italic
 *   - eyebrow font-mono uppercase tracking-wider text-[11px]
 *   - cards rounded-2xl border [#0F1419]/[0.08] bg-paper
 *   - vouvoiement strict
 *
 * Préserve : JSON-LD WebPage + ReserveAction (B68), DemoForm client.
 */

import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { DemoForm } from '@/components/public/pros/DemoForm'
import { JsonLd } from '@/components/seo/JsonLd'
import { Button } from '@/components/ui/button'
import { buildMetadata } from '@/lib/seo/metadata'
import { KOVAS_BASE_URL, buildBreadcrumbList } from '@/lib/seo/schema-org'
import { ArrowRight, Calendar, Clock, Headset } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = buildMetadata({
  title: 'Démo KOVAS personnalisée pour diagnostiqueur immobilier | KOVAS',
  description:
    'Réserve ta démo KOVAS personnalisée en visio 45 min avec un membre de l’équipe. Démonstration adaptée à ton cabinet et ton logiciel actuel. Réponse sous 48 h ouvrées.',
  path: '/demo',
  // OG image : générée dynamiquement par `opengraph-image.tsx` collocaté (Lot B88).
})

export default function DemoPage() {
  const breadcrumb = buildBreadcrumbList([
    { name: 'Accueil', path: '/' },
    { name: 'Démo personnalisée', path: '/demo' },
  ])

  const webPageSchema = {
    '@context': 'https://schema.org' as const,
    '@type': 'WebPage' as const,
    '@id': `${KOVAS_BASE_URL}/demo#webpage`,
    url: `${KOVAS_BASE_URL}/demo`,
    name: 'Démo KOVAS personnalisée pour diagnostiqueur immobilier',
    description:
      "Réserve une démo personnalisée de KOVAS en visio (45 min) avec un membre de l'équipe.",
    inLanguage: 'fr-FR' as const,
    isPartOf: { '@id': `${KOVAS_BASE_URL}/#website` },
    primaryImageOfPage: {
      '@type': 'ImageObject' as const,
      // OG image générée dynamiquement par `opengraph-image.tsx` collocaté (Lot B88).
      url: `${KOVAS_BASE_URL}/demo/opengraph-image`,
    },
    potentialAction: {
      '@type': 'ReserveAction' as const,
      name: 'Réserver une démo',
      target: `${KOVAS_BASE_URL}/demo`,
    },
  }

  const cards: ReadonlyArray<{
    icon: React.ReactElement
    title: string
    body: string
  }> = [
    {
      icon: <Calendar className="size-5" aria-hidden />,
      title: '48 h ouvrées',
      body: 'Délai de planification garanti à compter de ta demande.',
    },
    {
      icon: <Clock className="size-5" aria-hidden />,
      title: '45 minutes',
      body: 'Durée standard, ajustable selon tes questions. Présentation puis Q&R.',
    },
    {
      icon: <Headset className="size-5" aria-hidden />,
      title: 'Sans engagement',
      body: "Aucune obligation à l'issue de la démo. Tu repars avec tes questions répondues.",
    },
  ]

  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <JsonLd data={[webPageSchema, breadcrumb]} id="demo" />
      <PublicHeader />
      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 sm:px-12 pt-16 sm:pt-24 pb-12 sm:pb-20 animate-fade-in motion-reduce:animate-none">
          <div className="max-w-[1240px] mx-auto">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-6">
              Démo personnalisée
            </p>
            <h1
              className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.02] max-w-[1100px]"
              style={{ fontSize: 'clamp(40px, 7vw, 104px)' }}
            >
              Voir KOVAS en <span className="font-serif italic font-normal">situation réelle</span>.
            </h1>
            <p className="mt-8 max-w-2xl text-[15px] sm:text-[18px] text-[#0F1419]/72 leading-relaxed">
              45 minutes en visio avec un membre de notre équipe. Démonstration adaptée à ton
              cabinet, tes diagnostics types, ton logiciel actuel.
            </p>
          </div>
        </section>

        {/* 3 caractéristiques */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08] bg-[#F5F7F4]/60">
          <div className="max-w-[1240px] mx-auto">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {cards.map((c) => (
                <div
                  key={c.title}
                  className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 space-y-3"
                >
                  <div className="text-[#0F1419]/55">{c.icon}</div>
                  <h2 className="text-lg font-semibold text-[#0F1419] tracking-tight">{c.title}</h2>
                  <p className="text-[14px] text-[#0F1419]/72 leading-relaxed">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Formulaire réservation */}
        <section className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0F1419]/[0.08]">
          <div className="max-w-[920px] mx-auto space-y-10">
            <div className="space-y-3 max-w-2xl">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Réservation
              </p>
              <h2
                className="font-sans font-medium tracking-tight text-[#0F1419] leading-[1.05]"
                style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
              >
                Réserve <span className="font-serif italic font-normal">ta démo</span>.
              </h2>
              <p className="text-[15px] text-[#0F1419]/72 leading-relaxed">
                Tu reçois une confirmation par email sous 48 h ouvrées avec un créneau adapté à ton
                agenda. Tu gardes la main pour reporter ou annuler.
              </p>
            </div>
            <div className="rounded-2xl border border-[#0F1419]/[0.08] bg-paper px-6 py-7 sm:px-8 sm:py-9">
              <DemoForm />
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="px-5 sm:px-12 py-24 sm:py-32 border-t border-[#0F1419]/[0.08] bg-[#0F1419] text-paper">
          <div className="max-w-[920px] mx-auto text-center space-y-8">
            <p className="font-mono uppercase tracking-wider text-[11px] text-paper/55">
              Pas le temps d&apos;attendre
            </p>
            <h2
              className="font-sans font-medium tracking-tight text-paper leading-[1.05]"
              style={{ fontSize: 'clamp(32px, 4vw, 56px)' }}
            >
              Testez KOVAS pendant{' '}
              <span className="font-serif italic font-normal text-chartreuse">30 jours</span> dès
              maintenant.
            </h2>
            <p className="text-lg text-paper/72 max-w-xl mx-auto leading-relaxed">
              Sans assistance commerciale. Carte bancaire requise à l&apos;inscription, aucun débit
              avant J+30.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button size="lg" variant="accent" asChild>
                <Link href="/signup">
                  Démarrer mon essai 30 jours <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/tarifs">Voir les tarifs</Link>
              </Button>
            </div>
            <p className="text-[12px] text-paper/55 pt-2">
              Voir aussi le{' '}
              <Link href="/comparatif" className="text-paper underline underline-offset-2">
                comparatif Liciel
              </Link>{' '}
              ou les{' '}
              <Link href="/temoignages" className="text-paper underline underline-offset-2">
                témoignages diagnostiqueurs
              </Link>
              .
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
