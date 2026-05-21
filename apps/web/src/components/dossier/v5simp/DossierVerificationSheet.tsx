'use client'

import { BottomSheet } from '@/components/ui/bottom-sheet'
import { Button } from '@/components/ui/button'
import type { CoherenceWarning } from '@/lib/coherence-validation'
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'

export interface VerificationChecklistItem {
  id: string
  label: string
  done: boolean
}

interface DossierVerificationSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Items checklist agrégés (overview du dossier). */
  checklistItems: VerificationChecklistItem[]
  /** Warnings IA / cohérence. */
  warnings: CoherenceWarning[]
  /** Score qualité EEAT — V1 mock, 0-100. */
  eeatScore: number
  /** Au clic envoi rapport. Disabled si checklist incomplète. */
  onSendReport: () => void
  /** Ferme la sheet pour reprendre la rédaction. */
  onContinueWriting: () => void
}

/**
 * Bottom sheet "Bilan avant envoi" — ouverte depuis bouton Vérifier du context bar.
 * Affiche checklist agrégée, warnings cohérence, score EEAT mock, CTAs.
 */
export function DossierVerificationSheet({
  open,
  onOpenChange,
  checklistItems,
  warnings,
  eeatScore,
  onSendReport,
  onContinueWriting,
}: DossierVerificationSheetProps) {
  const totalItems = checklistItems.length
  const doneItems = checklistItems.filter((i) => i.done).length
  const allDone = totalItems > 0 && doneItems === totalItems
  const hasBlockingWarnings = warnings.some((w) => w.severity === 'error')

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bilan avant envoi"
      description="Vérifiez la complétude et la cohérence du dossier."
    >
      <div className="space-y-5">
        {/* Score EEAT */}
        <section>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-2">
            Score qualité
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-serif italic text-4xl text-ink leading-none">{eeatScore}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              / 100
            </span>
          </div>
        </section>

        {/* Checklist */}
        <section>
          <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-2">
            Checklist ({doneItems}/{totalItems})
          </div>
          <ul className="space-y-1.5">
            {checklistItems.map((item) => (
              <li key={item.id} className="flex items-center gap-2.5 text-[13px]">
                {item.done ? (
                  <CheckCircle2 className="size-4 text-chartreuse shrink-0" />
                ) : (
                  <Circle className="size-4 text-ink-mute/40 shrink-0" />
                )}
                <span className={cn(item.done ? 'text-ink' : 'text-ink-mute')}>{item.label}</span>
              </li>
            ))}
            {totalItems === 0 && (
              <li className="text-[13px] text-ink-mute">Aucun item de checklist à afficher.</li>
            )}
          </ul>
        </section>

        {/* Warnings */}
        {warnings.length > 0 && (
          <section>
            <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute mb-2 flex items-center gap-1.5">
              <AlertTriangle className="size-3.5" />
              Cohérence ({warnings.length})
            </div>
            <ul className="space-y-1.5">
              {warnings.map((w) => (
                <li
                  key={w.id}
                  className={cn(
                    'text-[13px] flex items-start gap-2',
                    w.severity === 'error'
                      ? 'text-accent-red'
                      : w.severity === 'warning'
                        ? 'text-accent-orange'
                        : 'text-ink-mute',
                  )}
                >
                  <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                  <span>{w.message}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* CTAs */}
        <div className="flex flex-col gap-2 pt-2">
          <Button
            variant="default"
            onClick={onSendReport}
            disabled={!allDone || hasBlockingWarnings}
            aria-disabled={!allDone || hasBlockingWarnings}
          >
            Envoyer le rapport
          </Button>
          <Button variant="ghost" onClick={onContinueWriting}>
            Continuer la rédaction
          </Button>
        </div>
      </div>
    </BottomSheet>
  )
}
