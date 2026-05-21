import { cn } from '@/lib/utils'
import { Star } from 'lucide-react'

export interface Testimonial {
  quote: string
  name: string
  meta: string
}

interface TestimonialsProps {
  eyebrow?: string
  title: string
  items: Testimonial[]
  variant?: 'b2c' | 'b2b'
}

/**
 * Grille 3 témoignages avec étoiles 5/5.
 */
export function Testimonials({ eyebrow, title, items, variant = 'b2c' }: TestimonialsProps) {
  return (
    <section
      className={cn(
        'px-6 py-20 md:py-24',
        variant === 'b2c' ? 'bg-cream' : 'bg-sage',
      )}
    >
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          {eyebrow && (
            <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">{eyebrow}</p>
          )}
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">{title}</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {items.map((t) => (
            <article
              key={t.name}
              className="bg-paper border border-rule/60 rounded-xl p-6 space-y-4 shadow-sm"
            >
              <div className="flex items-center gap-0.5" aria-label="5 étoiles sur 5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3.5 fill-amber text-amber"
                    aria-hidden
                  />
                ))}
              </div>
              <blockquote className="text-sm text-ink-soft leading-relaxed">
                &laquo; {t.quote} &raquo;
              </blockquote>
              <footer className="text-xs text-ink-faint pt-2 border-t border-rule/40">
                <span className="font-semibold text-ink-mute">{t.name}</span>
                <span> · {t.meta}</span>
              </footer>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
