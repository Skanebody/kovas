import { cn } from '@/lib/utils'
import { Calendar, Check, FileCheck, Home, Send, Wrench } from 'lucide-react'
import type { ComponentType } from 'react'

/**
 * WorkflowStepper v4 — visualisation 2×3 du parcours dossier (6 étapes canoniques).
 * Cf. docs/design/KOVAS_UIUX_App_Complete_v4.md §6.1.
 *
 * 6 étapes KOVAS canoniques :
 * 1. Identité bien        — adresse, surface, année
 * 2. Pré-visite           — RDV pris, docs demandés, matériel préparé
 * 3. Pièces               — configuration pièces à diagnostiquer
 * 4. Saisie terrain       — mode mission (drawer) : photos, notes, mesures
 * 5. Relevés spécifiques  — calculs DPE, validations cohérence
 * 6. Validation & livraison — relecture, génération rapport, envoi client
 *
 * Statuts :
 * - `done`      : ✓ étape complétée (icône check, bordure verte)
 * - `current`   : étape en cours (bordure cyan animée)
 * - `at-risk`   : à risque retard (bordure coral pointillé)
 * - `pending`   : à venir (texte muted, bordure neutre)
 */

export type StepStatus = 'done' | 'current' | 'at-risk' | 'pending'

export interface WorkflowStep {
  id: string
  label: string
  status: StepStatus
  meta?: string
}

interface WorkflowStepperProps {
  steps: WorkflowStep[]
  className?: string
}

const STEP_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  '1': Home,
  '2': Calendar,
  '3': Wrench,
  '4': FileCheck,
  '5': FileCheck,
  '6': Send,
}

/**
 * 6 étapes canoniques. Le `id` détermine l'icône (1-6).
 */
export const DEFAULT_KOVAS_STEPS_LABELS: Record<string, string> = {
  '1': 'Identité du bien',
  '2': 'Pré-visite',
  '3': 'Pièces',
  '4': 'Saisie terrain',
  '5': 'Relevés spécifiques',
  '6': 'Validation & livraison',
}

const STATUS_STYLES: Record<StepStatus, { card: string; iconBg: string; iconColor: string; label: string }> = {
  done: {
    card: 'bg-white border-success/30 shadow-glass-sm',
    iconBg: 'bg-success/10',
    iconColor: 'text-success',
    label: 'text-ink',
  },
  current: {
    card: 'bg-white border-info/40 shadow-md ring-2 ring-info/15',
    iconBg: 'bg-info/10',
    iconColor: 'text-info',
    label: 'text-ink font-semibold',
  },
  'at-risk': {
    card: 'bg-white border-danger/40 border-dashed shadow-glass-sm',
    iconBg: 'bg-danger/10',
    iconColor: 'text-danger',
    label: 'text-ink',
  },
  pending: {
    card: 'bg-white/50 border-rule border-dashed',
    iconBg: 'bg-rule/20',
    iconColor: 'text-ink-faint',
    label: 'text-ink-faint',
  },
}

export function WorkflowStepper({ steps, className }: WorkflowStepperProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-3', className)} role="list">
      {steps.map((step) => {
        const Icon = STEP_ICONS[step.id] ?? Home
        const styles = STATUS_STYLES[step.status]
        return (
          <div
            key={step.id}
            role="listitem"
            aria-current={step.status === 'current' ? 'step' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3.5 transition-all duration-base',
              styles.card,
            )}
          >
            <span
              aria-hidden
              className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-full',
                styles.iconBg,
              )}
            >
              {step.status === 'done' ? (
                <Check className={cn('size-4', styles.iconColor)} strokeWidth={2.5} />
              ) : (
                <Icon className={cn('size-4', styles.iconColor)} />
              )}
            </span>
            <div className="min-w-0">
              <p className={cn('text-[13px] leading-tight', styles.label)}>{step.label}</p>
              {step.meta && (
                <p className="text-[11px] text-ink-mute mt-0.5 truncate">{step.meta}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Helper : construit les 6 étapes canoniques KOVAS depuis un statut dossier.
 * À utiliser depuis page dossier-detail.
 */
export function buildKovasSteps(currentStep: 1 | 2 | 3 | 4 | 5 | 6, atRisk: number[] = []): WorkflowStep[] {
  return ([1, 2, 3, 4, 5, 6] as const).map((n) => {
    let status: StepStatus
    if (atRisk.includes(n)) status = 'at-risk'
    else if (n < currentStep) status = 'done'
    else if (n === currentStep) status = 'current'
    else status = 'pending'
    return {
      id: String(n),
      label: DEFAULT_KOVAS_STEPS_LABELS[String(n)],
      status,
    }
  })
}
