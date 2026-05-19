import { cn } from '@/lib/utils'

interface OnboardingProgressProps {
  current: number
  total: number
  className?: string
}

/**
 * OnboardingProgress — indicateur 1/4, 2/4, etc.
 * Pattern v4 wireframes §2 : pill mono uppercase + dots progression.
 */
export function OnboardingProgress({ current, total, className }: OnboardingProgressProps) {
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
        Étape {current} / {total}
      </span>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const stepNumber = i + 1
          return (
            <span
              key={stepNumber}
              className={cn(
                'block h-1 w-6 rounded-full transition-colors duration-base',
                stepNumber <= current ? 'bg-navy-800' : 'bg-rule',
              )}
            />
          )
        })}
      </div>
    </div>
  )
}
