import { FaqAnswer } from '@/components/faq-answer'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FAQ_CATEGORIES, FAQ_LANDING } from '@/lib/faq-data'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import { SiteFooter } from '@/components/site-footer'
import Link from 'next/link'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'Questions fréquentes — KOVAS',
  description:
    'Toutes les réponses sur KOVAS, le diagnostic immobilier, le DPE, les obligations légales 2026 et la conformité. 53 questions classées en 8 catégories.',
  alternates: { canonical: 'https://kovas.fr/faq' },
}

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
        // Plain text answer (schema.org tolère le markdown light, mais on
        // strip le bold pour rester propre côté SEO).
        text: q.answer.replace(/\*\*/g, ''),
      },
    })),
  }
}

export default function FaqPage() {
  const jsonLd = buildFaqJsonLd()

  return (
    <div className="min-h-dvh">
      {/* JSON-LD FAQPage pour rich snippets Google */}
      <Script
        id="faq-jsonld"
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: schema.org JSON
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="glass-header sticky top-0 z-40">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-navy shadow-accent" aria-hidden />
            <span className="text-base font-bold tracking-tight">KOVAS</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" /> Retour
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="max-w-2xl mb-12 space-y-3">
          <p className="text-xs uppercase tracking-wider font-semibold text-ink-mute">
            Questions fréquentes
          </p>
          <h1 className="font-sans font-light text-display-m tracking-tight text-ink leading-[1.1]">
            Tout ce que vous voulez savoir sur KOVAS et le{' '}
            <span className="font-serif italic font-normal">diagnostic immobilier</span>.
          </h1>
          <p className="text-ink-mute">
            53 réponses détaillées classées en 8 catégories. Pour les diagnostiqueurs, les
            propriétaires, les vendeurs et les locataires.
          </p>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-10">
          {/* TOC sticky desktop */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1" aria-label="Catégories">
              <p className="text-[10px] uppercase tracking-wider font-semibold text-ink-mute px-3 py-2">
                Catégories
              </p>
              <a
                href="#essentiel"
                className="block rounded-md px-3 py-2 text-sm hover:bg-ink/5 transition-colors"
              >
                L&apos;essentiel
              </a>
              {FAQ_CATEGORIES.map((cat) => (
                <a
                  key={cat.id}
                  href={`#${cat.id}`}
                  className="block rounded-md px-3 py-2 text-sm hover:bg-ink/5 transition-colors"
                >
                  {cat.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-12 min-w-0">
            {/* L'essentiel (5 questions landing) */}
            <section id="essentiel" className="scroll-mt-24 space-y-4">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold tracking-tight">L&apos;essentiel</h2>
                <p className="text-sm text-ink-mute">
                  Les 5 questions les plus posées sur KOVAS, avant de plonger dans les détails.
                </p>
              </div>
              <div className="space-y-3">
                {FAQ_LANDING.map((q) => (
                  <FaqItem key={q.id} id={q.id} question={q.question} answer={q.answer} />
                ))}
              </div>
            </section>

            {/* 8 catégories */}
            {FAQ_CATEGORIES.map((cat) => (
              <section key={cat.id} id={cat.id} className="scroll-mt-24 space-y-4">
                <div className="space-y-1">
                  <h2 className="font-display font-light text-2xl tracking-tight text-ink">{cat.title}</h2>
                  <p className="text-sm text-ink-mute">{cat.description}</p>
                </div>
                <div className="space-y-3">
                  {cat.questions.map((q) => (
                    <FaqItem key={q.id} id={q.id} question={q.question} answer={q.answer} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-rule text-center space-y-4">
          <p className="text-sm text-ink-mute">
            Votre question n&apos;est pas dans la liste ? Écrivez-nous à{' '}
            <a
              href="mailto:contact@kovas.fr"
              className="text-navy underline-offset-4 hover:underline"
            >
              contact@kovas.fr
            </a>
          </p>
          <Button asChild variant="accent">
            <Link href="/signup">Commencer mon essai 14 jours</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function FaqItem({ id, question, answer }: { id: string; question: string; answer: string }) {
  return (
    <Card variant="opaque" padding="none" className="overflow-hidden">
      <details className="group">
        <summary
          id={id}
          className="cursor-pointer list-none px-5 py-4 flex items-start justify-between gap-3 hover:bg-ink/5 transition-colors scroll-mt-24"
        >
          <h3 className="text-base font-semibold flex-1 min-w-0">{question}</h3>
          <span
            aria-hidden
            className="text-ink-mute shrink-0 transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </summary>
        <div className="px-5 pb-5 pt-1 border-t border-rule/50">
          <FaqAnswer markdown={answer} />
        </div>
      </details>
    </Card>
  )
}
