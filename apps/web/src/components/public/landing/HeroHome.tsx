import { Button } from '@/components/ui/button'
import { type PublicStats, formatStatNumber } from '@/lib/public-stats'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

type HeroHomeProps = {
  stats: PublicStats
}

/**
 * Section 1 — Hero plein écran (h-screen desktop).
 * Mêle Urbanist medium + Instrument Serif italic chartreuse-deep pour le segment
 * "diagnostic immobilier" (pattern signature v5 — accent éditorial).
 */
export function HeroHome({ stats }: HeroHomeProps) {
  return (
    <section
      className={
        'relative bg-background ' +
        'h-auto min-h-[88vh] md:h-[80vh] lg:h-screen ' +
        'flex flex-col items-center justify-center ' +
        'px-4 sm:px-6 md:px-8 lg:px-12 py-20 md:py-24 ' +
        'overflow-hidden animate-fade-in motion-reduce:animate-none'
      }
    >
      <div className="mx-auto max-w-5xl text-center space-y-10">
        <h1
          className="font-sans font-medium tracking-tight text-ink leading-[1.02]"
          style={{ fontSize: 'clamp(50px, 8vw, 120px)' }}
        >
          La plateforme du{' '}
          <span className="font-serif italic font-normal text-chartreuse-deep">
            diagnostic immobilier
          </span>{' '}
          qui pense pour toi
        </h1>

        <p className="font-sans text-base sm:text-lg md:text-xl text-ink-mute max-w-3xl mx-auto leading-relaxed">
          L&apos;outil quotidien de 15 000 diagnostiqueurs certifiés. Le bon réflexe pour les
          particuliers qui cherchent un pro de confiance.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Button size="lg" variant="accent" asChild>
            <Link href="/calculateur-dpe-gratuit">
              Estimer mon DPE gratuitement <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/pros">Je suis diagnostiqueur</Link>
          </Button>
        </div>
      </div>

      {/* Bottom proof — chargé Supabase RPC, fallback statique si indisponible */}
      <div
        className={
          'absolute bottom-8 left-1/2 -translate-x-1/2 ' +
          'w-full px-4 sm:px-6 md:px-8 lg:px-12 ' +
          'text-center text-xs sm:text-sm text-ink-faint font-mono uppercase tracking-wider'
        }
      >
        {formatStatNumber(stats.missionsLast30Days)} missions traitées chaque mois ·{' '}
        {formatStatNumber(stats.diagnosticiensInscrits)} diagnostiqueurs certifiés inscrits
      </div>
    </section>
  )
}
