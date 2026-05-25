import { Card } from '@/components/ui/card'
import {
  DEFAULT_RELATED_GUIDES_LIMIT,
  getMergedRelatedGuides,
} from '@/data/guides/internal-linking'
import type { Guide } from '@/lib/guides/types'
import { cn } from '@/lib/utils'
import { ArrowRight, BookOpen, Clock } from 'lucide-react'
import Link from 'next/link'

interface RelatedGuidesProps {
  readonly guide: Guide
  readonly limit?: number
  readonly className?: string
  readonly headingLabel?: string
}

/**
 * Section "Pour aller plus loin" — cards des guides connexes.
 *
 * Server Component consommant `getMergedRelatedGuides()` qui combine le
 * mapping curé `INTERNAL_LINKING_MAP` et le fallback historique
 * `Guide.relatedTypes`. Pas de fetch, pas d'état.
 *
 * UI sobre V5 : cards `opaque`, accent navy soft sur l'arrow CTA, eyebrow
 * mono "Guide connexe" + estimated reading time en pilule.
 *
 * Retourne `null` si aucun guide connexe trouvé — la page reste valide.
 */
export function RelatedGuides({
  guide,
  limit = DEFAULT_RELATED_GUIDES_LIMIT,
  className,
  headingLabel = 'Pour aller plus loin',
}: RelatedGuidesProps) {
  const related = getMergedRelatedGuides(guide, limit)
  if (related.length === 0) return null

  return (
    <section aria-labelledby="related-guides-heading" className={cn('mt-16', className)}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2
          id="related-guides-heading"
          className="font-display text-xl font-bold text-ink md:text-2xl"
        >
          {headingLabel}
        </h2>
        <Link
          href="/guide"
          className="hidden font-mono text-[11px] uppercase tracking-wider text-ink-mute transition-colors hover:text-ink sm:inline-flex sm:items-center sm:gap-1"
        >
          Tous les guides
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {related.map((relatedGuide) => (
          <Card
            key={relatedGuide.type}
            variant="opaque"
            padding="default"
            className="group transition-all hover:-translate-y-px hover:shadow-md"
          >
            <Link href={`/guide/${relatedGuide.slug}`} className="flex h-full flex-col">
              <div className="flex items-center gap-2">
                <BookOpen className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
                <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-ink-mute">
                  Guide connexe
                </p>
              </div>
              <h3 className="mt-2 font-display text-lg font-bold leading-snug text-ink">
                {relatedGuide.shortTitle}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-soft">
                {relatedGuide.teaser}
              </p>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-mute">
                  <Clock className="size-3" aria-hidden />
                  {relatedGuide.readingTimeMinutes} min
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-navy-700 transition-transform group-hover:translate-x-0.5">
                  Lire le guide
                  <ArrowRight className="size-3" aria-hidden />
                </span>
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </section>
  )
}
