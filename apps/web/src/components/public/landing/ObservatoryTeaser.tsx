import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

type Kpi = {
  id: string
  value: string
  label: string
}

const OBSERVATORY_KPIS: readonly Kpi[] = [
  { id: 'fg-share', value: '32%', label: 'des biens vendus 2026 classés F ou G' },
  { id: 'median-price', value: '145€', label: 'prix médian DPE France' },
  { id: 'lead-time', value: '12 jours', label: 'délai médian demande → signature' },
] as const

/**
 * Section 4 — Observatoire teaser.
 * Trois KPI hero Instrument Serif italic XXL (clamp 60-100px).
 * Pattern signature v5 : drama mode sur chiffres, sobre sur le reste.
 */
export function ObservatoryTeaser() {
  return (
    <section className="bg-paper py-20 md:py-28 px-4 sm:px-6 md:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl space-y-14">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">Observatoire</p>
          <h2
            className="font-sans font-medium tracking-tight text-ink leading-[1.05]"
            style={{ fontSize: 'clamp(34px, 5vw, 68px)' }}
          >
            L&apos;observatoire{' '}
            <span className="font-serif italic font-normal text-chartreuse-deep">KOVAS</span>
          </h2>
          <p className="text-ink-mute text-base md:text-lg leading-relaxed">
            Toutes les data publiques du diagnostic immobilier en France, mises à jour chaque mois.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {OBSERVATORY_KPIS.map((k) => (
            <div
              key={k.id}
              className="text-center md:border-r last:md:border-r-0 md:border-rule md:px-6"
            >
              <div
                className="font-serif italic text-ink leading-none tracking-tight"
                style={{ fontSize: 'clamp(60px, 9vw, 100px)' }}
              >
                {k.value}
              </div>
              <p className="text-sm text-ink-mute mt-4 leading-snug max-w-[16ch] mx-auto">
                {k.label}
              </p>
            </div>
          ))}
        </div>

        <div className="flex justify-center">
          <Button size="lg" variant="outline" asChild>
            <Link href="/observatoire">
              Explorer l&apos;observatoire <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
