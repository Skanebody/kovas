import { cn } from '@/lib/utils'

export interface FaqItem {
  question: string
  answer: string
}

interface FaqAccordionProps {
  eyebrow?: string
  title: string
  items: FaqItem[]
  variant?: 'b2c' | 'b2b'
}

/**
 * FAQ accordion <details>/<summary> natifs accessibles.
 */
export function FaqAccordion({ eyebrow, title, items, variant = 'b2c' }: FaqAccordionProps) {
  return (
    <section
      id="faq"
      className={cn(
        'px-6 py-20 md:py-24',
        variant === 'b2c' ? 'bg-paper' : 'bg-paper',
      )}
    >
      <div className="mx-auto max-w-3xl space-y-10">
        <div className="text-center space-y-3">
          {eyebrow && (
            <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">{eyebrow}</p>
          )}
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">{title}</h2>
        </div>

        <ul className="divide-y divide-rule/60 border-y border-rule/60">
          {items.map((q) => (
            <li key={q.question}>
              <details className="group">
                <summary className="cursor-pointer list-none py-5 flex items-start justify-between gap-4">
                  <h3 className="text-base font-semibold text-ink flex-1">{q.question}</h3>
                  <span
                    aria-hidden
                    className="text-ink-faint shrink-0 transition-transform group-open:rotate-180 text-lg leading-none"
                  >
                    ▾
                  </span>
                </summary>
                <div className="pb-5 pr-8 text-sm text-ink-mute leading-relaxed whitespace-pre-line">
                  {q.answer}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
