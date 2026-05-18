'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { WorkflowStepRun } from '@/lib/dossier-workflow'
import { cn } from '@/lib/utils'
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  ListChecks,
} from 'lucide-react'
import { useState, useTransition } from 'react'
import { toggleDossierStepItemAction } from './actions'

interface WorkflowStepperProps {
  dossierId: string
  steps: WorkflowStepRun[]
  overallProgress: number
}

export function WorkflowStepper({ dossierId, steps, overallProgress }: WorkflowStepperProps) {
  // Default-open the first non-completed step
  const firstIncomplete = steps.findIndex((s) => !s.completed)
  const [openStep, setOpenStep] = useState<string>(
    firstIncomplete >= 0 ? steps[firstIncomplete]!.id : (steps[0]?.id ?? ''),
  )
  const [, startTransition] = useTransition()

  function handleToggle(itemId: string, current: boolean) {
    startTransition(async () => {
      await toggleDossierStepItemAction(dossierId, itemId, !current)
    })
  }

  const overallPercent = Math.round(overallProgress * 100)

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <ListChecks className="size-4" />
            Workflow — {overallPercent}% complet
          </h2>
          {overallPercent === 100 ? (
            <Badge variant="green">
              <CheckCircle2 className="size-3 mr-1" /> Prêt à exporter
            </Badge>
          ) : (
            <Badge variant="muted">
              {steps.filter((s) => s.completed).length}/{steps.length} étapes
            </Badge>
          )}
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-cta transition-all" style={{ width: `${overallPercent}%` }} />
        </div>

        <ol className="space-y-2">
          {steps.map((step, idx) => {
            const isOpen = openStep === step.id
            const percent = Math.round(step.progress * 100)
            return (
              <li
                key={step.id}
                className={cn(
                  'rounded-lg border transition-colors',
                  isOpen && 'border-cta/30 bg-card/60',
                  !isOpen && step.completed && 'border-accent-green/20 bg-accent-green/5',
                  !isOpen && !step.completed && 'border-border',
                )}
              >
                <button
                  type="button"
                  onClick={() => setOpenStep(isOpen ? '' : step.id)}
                  aria-expanded={isOpen}
                  aria-controls={`step-${step.id}-body`}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <span
                    className={cn(
                      'shrink-0 size-7 rounded-full flex items-center justify-center text-xs font-semibold',
                      step.completed
                        ? 'bg-accent-green text-white'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {step.completed ? <CheckCircle2 className="size-4" /> : idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{step.title}</span>
                      <Badge variant={step.completed ? 'green' : 'muted'} className="text-[10px]">
                        {percent}%
                      </Badge>
                    </div>
                    {isOpen && (
                      <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                    )}
                  </div>
                  {isOpen ? (
                    <ChevronDown className="size-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>

                {isOpen && (
                  <div id={`step-${step.id}-body`} className="px-4 pb-4 space-y-1.5">
                    {step.items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">
                        Aucun item applicable pour les diagnostics inclus.
                      </p>
                    ) : (
                      step.items.map((item) => {
                        const isDone =
                          item.status === 'auto_ok' ||
                          (item.status === 'manual' && item.checked === true)
                        const isManual = item.status === 'manual'
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => isManual && handleToggle(item.id, item.checked ?? false)}
                            disabled={!isManual}
                            className={cn(
                              'w-full flex items-start gap-2 text-left rounded-md px-2 py-1.5 text-sm transition-colors',
                              isManual ? 'hover:bg-card cursor-pointer' : 'cursor-default',
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="size-4 mt-0.5 shrink-0 text-accent-green" />
                            ) : (
                              <Circle className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
                            )}
                            <span
                              className={cn(
                                'flex-1',
                                isDone ? 'text-muted-foreground line-through' : '',
                                item.required && !isDone ? 'font-medium' : '',
                              )}
                            >
                              {item.label}
                              {item.required && !isDone && (
                                <span className="text-accent-red ml-1">*</span>
                              )}
                            </span>
                            {item.status === 'auto_ok' && (
                              <Badge variant="muted" className="text-[10px] shrink-0">
                                auto
                              </Badge>
                            )}
                          </button>
                        )
                      })
                    )}

                    {!step.completed && idx < steps.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setOpenStep(steps[idx + 1]!.id)}
                        className="text-xs text-muted-foreground hover:text-foreground mt-2 flex items-center gap-1"
                      >
                        Étape suivante <ArrowRight className="size-3" />
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
