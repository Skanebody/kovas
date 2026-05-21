'use client'

import { cn } from '@/lib/utils'

interface PrevalidationProgressProps {
  current: 1 | 2 | 3
  className?: string
}

const STEPS = [
  { num: 1 as const, label: 'Bien' },
  { num: 2 as const, label: 'DPE prévu' },
  { num: 3 as const, label: 'Cohérence' },
]

/**
 * Stepper de pré-validation ADEME — 3 dots numérotés liés par flèches.
 *
 * Style miroir de `dossiers/new/wizard-progress` (DS v5 strict) :
 *  - Étape active  : pastille chartreuse + label gras ink
 *  - Étape passée  : pastille ink plein + label sombre
 *  - Étape future  : pastille ink-mute pâle + label pâle
 *
 * Le label "1 · Bien" complet est affiché sur sm+, masqué en mobile
 * (pastille seule pour préserver la largeur sur écrans étroits).
 */
export function PrevalidationProgress({ current, className }: PrevalidationProgressProps) {
  return (
    <div className={cn('pt-1 pb-6', className)}>
      <ol className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
        {STEPS.map((step) => {
          const isActive = step.num === current
          const isDone = step.num < current
          return (
            <li key={step.num} className="flex items-center gap-3 sm:gap-6">
              <span
                className={cn(
                  'inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em]',
                  isActive
                    ? 'text-[#0F1419] font-bold'
                    : isDone
                      ? 'text-[#0F1419]/72'
                      : 'text-[#0F1419]/35',
                )}
              >
                <span
                  className={cn(
                    'size-6 rounded-full inline-flex items-center justify-center font-mono text-xs',
                    isActive
                      ? 'bg-chartreuse text-[#0F1419]'
                      : isDone
                        ? 'bg-[#0F1419] text-white'
                        : 'bg-[#0F1419]/[0.08] text-[#0F1419]/55',
                  )}
                >
                  {step.num}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </span>
              {step.num < 3 && (
                <span aria-hidden className="text-[#0F1419]/15">
                  →
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
