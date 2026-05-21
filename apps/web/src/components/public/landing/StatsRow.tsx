import { cn } from '@/lib/utils'

export interface Stat {
  value: string
  label: string
}

interface StatsRowProps {
  items: Stat[]
  variant?: 'b2c' | 'b2b'
}

/**
 * Bandeau 4 KPIs social proof avec valeurs serif italic dramatisées.
 */
export function StatsRow({ items, variant = 'b2c' }: StatsRowProps) {
  return (
    <section
      className={cn(
        'px-6 py-16',
        variant === 'b2c' ? 'bg-cream' : 'bg-sage',
      )}
    >
      <div className="mx-auto max-w-6xl">
        <ul
          className={cn(
            'grid grid-cols-2 lg:grid-cols-4 gap-px rounded-xl overflow-hidden border',
            variant === 'b2c' ? 'border-rule/60 bg-rule/40' : 'border-ink/10 bg-ink/10',
          )}
        >
          {items.map((s) => (
            <li
              key={s.label}
              className={cn(
                'p-8 text-center space-y-2',
                variant === 'b2c' ? 'bg-paper' : 'bg-paper',
              )}
            >
              <p className="font-serif italic text-5xl sm:text-6xl text-ink leading-none">
                {s.value}
              </p>
              <p className="text-xs text-ink-mute leading-relaxed">{s.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
