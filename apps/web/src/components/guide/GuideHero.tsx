import type { Guide } from '@/lib/guides/types'
import { cn } from '@/lib/utils'
import { Clock, FileText, RefreshCw } from 'lucide-react'

interface GuideHeroProps {
  readonly guide: Guide
  readonly className?: string
}

/**
 * Hero d'une page guide.
 *
 * Stratégie typographique v5 : H1 en font-sans Urbanist 800 avec un fragment
 * éditorial en font-serif italic (Instrument Serif) pour marquer le ton
 * "guide complet". Eyebrow mono JetBrains pour la catégorie. Métadonnées en
 * pilule (lecture, mots, dernière mise à jour) sous le sous-titre.
 */
export function GuideHero({ guide, className }: GuideHeroProps) {
  // Date au format FR long ("22 mai 2026") pour la lisibilité.
  const updatedAtLabel = new Date(guide.updatedAt).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  // Sépare le titre en partie principale + accent éditorial italique.
  // Heuristique : si " : " est présent, on met la partie après en italique.
  const [titleMain, titleAccent] = guide.title.split(' : ')

  return (
    <section
      className={cn('relative isolate overflow-hidden border-b border-rule/40 bg-sage', className)}
    >
      <div className="mx-auto max-w-screen-xl px-4 py-16 md:px-6 md:py-24">
        <p className="mb-4 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-mute">
          Guide complet · {guide.shortTitle}
        </p>
        <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl md:text-6xl">
          {titleMain}{' '}
          <span className="block font-serif italic font-normal text-ink-soft">
            {titleAccent ?? 'guide complet 2026'}
          </span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-mute">{guide.tagline}</p>
        <div className="mt-8 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2 rounded-pill border border-rule/60 bg-paper px-3 py-1.5 font-mono text-xs text-ink-mute">
            <Clock className="size-3.5" aria-hidden />
            {guide.readingTimeMinutes} min de lecture
          </span>
          <span className="inline-flex items-center gap-2 rounded-pill border border-rule/60 bg-paper px-3 py-1.5 font-mono text-xs text-ink-mute">
            <FileText className="size-3.5" aria-hidden />
            {guide.wordCount.toLocaleString('fr-FR')} mots
          </span>
          <span className="inline-flex items-center gap-2 rounded-pill border border-rule/60 bg-paper px-3 py-1.5 font-mono text-xs text-ink-mute">
            <RefreshCw className="size-3.5" aria-hidden />
            Mis à jour le {updatedAtLabel}
          </span>
        </div>
      </div>
    </section>
  )
}
