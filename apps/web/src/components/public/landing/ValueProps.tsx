import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface ValueProp {
  icon: LucideIcon
  title: string
  description: string
}

interface ValuePropsProps {
  eyebrow?: string
  title: string
  subtitle?: string
  items: ValueProp[]
  variant?: 'b2c' | 'b2b'
}

/**
 * Grille 4 colonnes de propositions de valeur (icon + titre + description).
 */
export function ValueProps({ eyebrow, title, subtitle, items, variant = 'b2c' }: ValuePropsProps) {
  return (
    <section
      className={cn(
        'px-6 py-20 md:py-24',
        variant === 'b2c' ? 'bg-paper' : 'bg-paper',
      )}
    >
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          {eyebrow && (
            <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">{eyebrow}</p>
          )}
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-ink-mute leading-relaxed">{subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((v) => (
            <article key={v.title} className="space-y-3">
              <div
                className={cn(
                  'size-10 rounded-md flex items-center justify-center',
                  variant === 'b2c' ? 'bg-navy/5 text-navy' : 'bg-chartreuse-soft text-chartreuse-deep',
                )}
              >
                <v.icon className="size-5" />
              </div>
              <h3 className="text-base font-bold text-ink">{v.title}</h3>
              <p className="text-sm text-ink-mute leading-relaxed">{v.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
