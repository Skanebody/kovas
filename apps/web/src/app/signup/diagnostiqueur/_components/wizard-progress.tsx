import { cn } from '@/lib/utils'

const STEPS: { id: number; label: string; short: string }[] = [
  { id: 1, label: 'Bienvenue', short: 'Compte' },
  { id: 2, label: 'Formule', short: 'Formule' },
  { id: 3, label: 'Identité civile', short: 'Identité' },
  { id: 4, label: 'Certification COFRAC', short: 'COFRAC' },
  { id: 5, label: 'Assurance RC Pro', short: 'RC Pro' },
  { id: 6, label: 'Entreprise', short: 'Entreprise' },
  { id: 7, label: 'Confirmation', short: 'Confirmation' },
]

/**
 * Progress bar du wizard 7 étapes — visible en haut de chaque step.
 * Mode mobile : juste step courant / total + barre fine.
 * Mode desktop : labels visibles sur les étapes franchies.
 */
export function WizardProgress({ currentStep }: { currentStep: number }) {
  const pct = Math.round(((currentStep - 1) / (STEPS.length - 1)) * 100)

  return (
    <div className="mb-8 space-y-3">
      <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-[0.08em]">
        <span className="text-[#0F1419]/55">
          Étape {currentStep} sur {STEPS.length}
        </span>
        <span className="text-[#0F1419] font-semibold">{STEPS[currentStep - 1]?.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#0F1419]/[0.08] overflow-hidden">
        <div
          className="h-full bg-[#0F1419] transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
          aria-label={`Progression onboarding ${pct}%`}
        />
      </div>
      {/* Desktop : pas-à-pas avec labels */}
      <ol className="hidden md:flex items-center justify-between text-[11px]">
        {STEPS.map((step) => {
          const isPast = step.id < currentStep
          const isCurrent = step.id === currentStep
          return (
            <li
              key={step.id}
              className={cn(
                'flex items-center gap-1.5',
                isPast || isCurrent ? 'text-[#0F1419]' : 'text-[#0F1419]/40',
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center size-5 rounded-full text-[10px] font-bold border',
                  isCurrent && 'bg-[#0F1419] text-white border-[#0F1419]',
                  isPast && 'bg-[#0F1419]/10 text-[#0F1419] border-[#0F1419]/20',
                  !isCurrent && !isPast && 'border-[#0F1419]/15 text-[#0F1419]/40',
                )}
              >
                {isPast ? '✓' : step.id}
              </span>
              <span className="hidden lg:inline">{step.short}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
