import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowRight, Calculator, MapPin } from 'lucide-react'
import Link from 'next/link'

type Testimonial = {
  id: string
  firstName: string
  commune: string
  quote: string
}

const B2C_TESTIMONIALS: readonly Testimonial[] = [
  {
    id: 'sophie-rennes',
    firstName: 'Sophie',
    commune: 'Rennes',
    quote:
      'Le calculateur DPE m’a donné une fourchette réaliste en 2 minutes. J’ai vendu sans surprise sur la classe.',
  },
  {
    id: 'marc-bordeaux',
    firstName: 'Marc',
    commune: 'Bordeaux',
    quote:
      'Trouver un diagnostiqueur certifié près de chez moi, vérifié, c’est exactement ce qui me manquait avant la location.',
  },
  {
    id: 'claire-lille',
    firstName: 'Claire',
    commune: 'Lille',
    quote:
      'Devis sous 24h, intervention sous 5 jours, rapport reçu par mail. Le standard que j’attendais.',
  },
] as const

/**
 * Section 2 — B2C strip cream-deep.
 * 3 colonnes : pitch vendre/louer + mockup calculateur + carte annuaire + bande témoignages.
 */
export function B2CStrip() {
  return (
    <section className="bg-cream-deep/40 py-20 md:py-28 px-4 sm:px-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-stretch">
          {/* Col 1 — Pitch éditorial */}
          <div className="flex flex-col justify-center space-y-5">
            <h2
              className="font-sans font-medium tracking-tight text-ink leading-[1.05]"
              style={{ fontSize: 'clamp(32px, 4.5vw, 56px)' }}
            >
              Vous{' '}
              <span className="font-serif italic font-normal text-chartreuse-deep">
                vendez ou louez
              </span>{' '}
              votre bien ?
            </h2>
            <p className="text-ink-mute leading-relaxed">
              Le DPE est obligatoire avant toute mise en vente ou location. Selon l&apos;année et la
              nature du bien, d&apos;autres diagnostics s&apos;ajoutent : amiante, plomb,
              électricité, gaz, termites ou Carrez.
            </p>
            <p className="text-ink-mute leading-relaxed">
              Pour les biens classés F ou G, un audit énergétique est désormais requis. Nous vous
              aidons à voir clair, gratuitement.
            </p>
          </div>

          {/* Col 2 — Mockup calculateur DPE */}
          <Card variant="flat" padding="default" className="flex flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-pill bg-chartreuse px-3 py-1 text-xs font-mono uppercase tracking-wider text-ink font-medium">
                Gratuit
              </div>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-sage flex items-center justify-center text-ink shrink-0">
                  <Calculator className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Calculateur DPE</h3>
                  <p className="text-sm text-ink-mute mt-1">
                    Estimez la classe énergétique de votre bien en répondant à 8 questions.
                  </p>
                </div>
              </div>
              {/* Mini-mockup classe DPE A-G — sobre, pas d'animation */}
              <div className="space-y-1.5 pt-2">
                {[
                  { letter: 'A', width: 'w-2/12', tone: 'bg-success/80' },
                  { letter: 'B', width: 'w-3/12', tone: 'bg-success/60' },
                  { letter: 'C', width: 'w-5/12', tone: 'bg-chartreuse/70' },
                  { letter: 'D', width: 'w-7/12', tone: 'bg-warning/60' },
                  { letter: 'E', width: 'w-9/12', tone: 'bg-warning/80' },
                  { letter: 'F', width: 'w-10/12', tone: 'bg-amber/80' },
                  { letter: 'G', width: 'w-11/12', tone: 'bg-danger/70' },
                ].map((row) => (
                  <div key={row.letter} className="flex items-center gap-2">
                    <span className="w-4 text-[10px] font-mono text-ink-faint">{row.letter}</span>
                    <div className={`${row.width} h-2 rounded-pill ${row.tone}`} aria-hidden />
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-6">
              <Button variant="accent" size="default" className="w-full" asChild>
                <Link href="/calculateur-dpe-gratuit">
                  Estimer en 2 minutes <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </Card>

          {/* Col 3 — Annuaire vérifié */}
          <Card variant="flat" padding="default" className="flex flex-col justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-pill bg-sage-alt px-3 py-1 text-xs font-mono uppercase tracking-wider text-ink-mute font-medium">
                Annuaire vérifié
              </div>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-md bg-sage flex items-center justify-center text-ink shrink-0">
                  <MapPin className="size-5" aria-hidden />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-ink">Diagnostiqueurs près de vous</h3>
                  <p className="text-sm text-ink-mute mt-1">
                    Certifications vérifiées, avis publiés, devis en ligne sous 24h.
                  </p>
                </div>
              </div>
              {/* Mini-carte France stylisée — 5 points repère sage */}
              <div className="relative aspect-[5/4] rounded-md bg-sage/60 overflow-hidden">
                <svg
                  viewBox="0 0 200 160"
                  className="absolute inset-0 size-full"
                  role="img"
                  aria-label="Carte de France stylisée"
                >
                  <title>Carte de France stylisée</title>
                  {/* Silhouette France ultra-simplifiée */}
                  <path
                    d="M70 30 L120 25 L145 45 L155 80 L140 115 L110 130 L80 125 L55 105 L50 75 L60 50 Z"
                    fill="hsl(var(--background))"
                    stroke="hsl(var(--border))"
                    strokeWidth="1"
                  />
                  {/* 5 points pulse-soft */}
                  {[
                    { cx: 95, cy: 60 },
                    { cx: 75, cy: 85 },
                    { cx: 120, cy: 70 },
                    { cx: 110, cy: 105 },
                    { cx: 85, cy: 110 },
                  ].map((dot) => (
                    <circle
                      key={`${dot.cx}-${dot.cy}`}
                      cx={dot.cx}
                      cy={dot.cy}
                      r="3"
                      className="fill-chartreuse-deep animate-pulse-soft motion-reduce:animate-none"
                    />
                  ))}
                </svg>
              </div>
            </div>
            <div className="pt-6">
              <Button variant="accent" size="default" className="w-full" asChild>
                <Link href="/diagnostiqueurs">
                  Trouver un diagnostiqueur près de chez moi{' '}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </div>
          </Card>
        </div>

        {/* Bande témoignages courts particuliers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16 md:mt-20">
          {B2C_TESTIMONIALS.map((t) => (
            <figure key={t.id} className="space-y-3">
              <blockquote className="text-sm text-ink leading-relaxed">
                «&nbsp;{t.quote}&nbsp;»
              </blockquote>
              <figcaption className="text-xs font-mono uppercase tracking-wider text-ink-faint">
                {t.firstName} · {t.commune}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
