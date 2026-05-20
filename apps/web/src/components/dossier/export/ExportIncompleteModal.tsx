'use client'

import { Button } from '@/components/ui/button'
import { DiagChip } from '@/components/ui/diag-chip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DiagnosticType } from '@/lib/mission/types'
/**
 * KOVAS — Modale "Exporter un dossier incomplet ?" (Partition D).
 *
 * Affichée quand l'utilisateur tente un export alors que `missingFields.length > 0`.
 * Le serveur renvoie 409 INCOMPLETE → la modale liste les manques + conséquences.
 * Confirmation = retry de l'export avec `?confirmIncomplete=true`.
 *
 * Authority : CLAUDE.md §3 features 5+7 (check-lists + validation cohérence).
 */
import { AlertTriangle, Check, Info, X } from 'lucide-react'
import { useState } from 'react'

export interface IncompleteMissingField {
  diagnostic: DiagnosticType
  label: string
}

export interface IncompleteConsequence {
  type: 'warning' | 'info' | 'ok'
  text: string
}

interface ExportIncompleteModalProps {
  open: boolean
  destinationLabel: string
  missingFields: IncompleteMissingField[]
  consequences: IncompleteConsequence[]
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
}

function diagnosticToChipType(d: DiagnosticType): string {
  return d === 'ELEC' ? 'ELECTRICITE' : d
}

export function ExportIncompleteModal({
  open,
  destinationLabel,
  missingFields,
  consequences,
  onOpenChange,
  onConfirm,
}: ExportIncompleteModalProps) {
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-6 text-accent-orange shrink-0" />
            <DialogTitle>Exporter un dossier incomplet&nbsp;?</DialogTitle>
          </div>
          <DialogDescription>
            Tu vas exporter vers <span className="font-medium text-ink">{destinationLabel}</span>{' '}
            alors que des champs réglementaires manquent.
          </DialogDescription>
        </DialogHeader>

        {/* Manques détectés */}
        <section className="space-y-2">
          <h4 className="text-[12px] font-mono uppercase tracking-wider text-ink-mute">
            Manques détectés ({missingFields.length})
          </h4>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {missingFields.map((f, idx) => (
              <li
                key={`${f.diagnostic}-${f.label}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-md border border-rule/60 bg-paper/60 px-3 py-2 text-[13px]"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <X className="size-3.5 text-accent-red shrink-0" />
                  <span className="text-ink truncate">{f.label}</span>
                </span>
                <DiagChip type={diagnosticToChipType(f.diagnostic) as never} short />
              </li>
            ))}
          </ul>
        </section>

        {/* Conséquences */}
        {consequences.length > 0 && (
          <section className="space-y-2">
            <h4 className="text-[12px] font-mono uppercase tracking-wider text-ink-mute">
              Conséquences
            </h4>
            <ul className="space-y-1.5">
              {consequences.map((c) => {
                const Icon = c.type === 'ok' ? Check : c.type === 'warning' ? AlertTriangle : Info
                const color =
                  c.type === 'ok'
                    ? 'text-accent-green'
                    : c.type === 'warning'
                      ? 'text-accent-orange'
                      : 'text-ink-faint'
                return (
                  <li
                    key={`${c.type}-${c.text}`}
                    className="flex items-start gap-2 text-[13px] text-ink-mute leading-snug"
                  >
                    <Icon className={`size-3.5 shrink-0 mt-0.5 ${color}`} />
                    <span>{c.text}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              void handleConfirm()
            }}
            disabled={submitting}
          >
            Exporter quand même
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
