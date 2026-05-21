import { cn } from '@/lib/utils'

interface HowStep {
  title: string
  description: string
}

interface HowItWorksProps {
  title: string
  subtitle?: string
  steps: HowStep[]
  variant?: 'b2c' | 'b2b'
}

/**
 * Section "Comment ça marche" en 3 étapes numérotées.
 * Utilisable B2C ou B2B avec brand cohérent.
 */
export function HowItWorks({ title, subtitle, steps, variant = 'b2c' }: HowItWorksProps) {
  return (
    <section
      id="how-it-works"
      className={cn(
        'px-6 py-20 md:py-24',
        variant === 'b2c' ? 'bg-cream' : 'bg-sage',
      )}
    >
      <div className="mx-auto max-w-6xl space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <p className="text-xs font-mono uppercase tracking-wider text-ink-faint">
            01 · Workflow
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-ink-mute leading-relaxed">{subtitle}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule/60 rounded-xl overflow-hidden border border-rule/60">
          {steps.map((step, i) => (
            <article
              key={step.title}
              className={cn(
                'p-7 space-y-3',
                variant === 'b2c' ? 'bg-paper' : 'bg-paper',
              )}
            >
              <div className="flex items-baseline gap-3">
                <span className="font-serif italic text-4xl text-ink-faint leading-none">
                  0{i + 1}
                </span>
                <h3 className="text-lg font-bold text-ink">{step.title}</h3>
              </div>
              <p className="text-sm text-ink-mute leading-relaxed">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
