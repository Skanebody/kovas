'use client'

/**
 * CheckoutScreen — écran plein écran avant de quitter le terrain.
 *
 * UX :
 *  - fixed inset-0 bg-sage, scrollable
 *  - KPI hero serif italic monospace : `covered / total`
 *  - barre progression chartreuse
 *  - sections COMPLET (success) / INCOMPLET (warning border-l-2)
 *  - photos manquantes (info)
 *  - 3 boutons bottom sticky :
 *      "Compléter maintenant" (chartreuse, si missing_critical > 0)
 *      "Partir quand même" (outline, demande confirmation si critical > 0)
 *      "Annuler — Continuer" (ghost)
 *
 * Avatar Benjamin Bel : ton sobre, vouvoiement, pas d'emoji marketing.
 */

import { Button } from '@/components/ui/button'
import type { CompletionStatus } from '@/lib/local-ai/checklist-tracker'
import { ROOM_LABEL_FR } from '@/lib/local-ai/room-transition-detector'
import { cn } from '@/lib/utils'
import { AlertTriangle, Camera, Check, ChevronLeft, X } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'

interface CheckoutScreenProps {
  status: CompletionStatus
  /** Le diagnostiqueur souhaite continuer la capture. */
  onContinue: () => void
  /** Le diagnostiqueur retourne compléter un item spécifique. */
  onComplete: () => void
  /** Le diagnostiqueur valide la sortie (avec confirmation si gaps critiques). */
  onConfirmLeave: () => void
  className?: string
}

export function CheckoutScreen({
  status,
  onContinue,
  onComplete,
  onConfirmLeave,
  className,
}: CheckoutScreenProps) {
  const [showConfirmLeave, setShowConfirmLeave] = useState(false)

  const totalCovered = status.covered.length
  const totalRequired =
    totalCovered + status.missing_critical.length + status.missing_important.length

  const hasCriticalGaps = status.missing_critical.length > 0
  const hasPhotoGaps = status.photos_missing.length > 0

  const handleLeaveClick = (): void => {
    if (hasCriticalGaps) {
      setShowConfirmLeave(true)
    } else {
      onConfirmLeave()
    }
  }

  return (
    <div
      className={cn('fixed inset-0 z-50 bg-sage overflow-y-auto pb-32 animate-fade-in', className)}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 bg-sage/95 backdrop-blur-sm border-b border-rule px-4 py-3 flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onContinue}
          aria-label="Retour à la capture"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="label-mono text-ink-mute">Garde-fou — bilan avant départ</p>
          <h1 className="text-[18px] font-semibold text-ink leading-tight">
            Vérification de la mission
          </h1>
        </div>
      </div>

      {/* KPI Hero */}
      <div className="px-4 py-8">
        <div className="bg-paper rounded-xl border border-rule p-6 shadow-sm">
          <p className="label-mono text-ink-mute mb-2">Items couverts</p>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="kpi-hero text-navy-deep tabular-nums">{totalCovered}</span>
            <span className="text-2xl text-ink-mute font-mono">/ {totalRequired}</span>
          </div>
          <div className="h-2 bg-sage-alt rounded-full overflow-hidden">
            <div
              className="h-full bg-chartreuse transition-all duration-base"
              style={{ width: `${status.percentage}%` }}
              role="progressbar"
              aria-valuenow={status.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="mt-2 text-[12px] text-ink-mute font-mono tabular-nums">
            {status.percentage}% complété
          </p>
        </div>
      </div>

      {/* Items critiques manquants */}
      {hasCriticalGaps && (
        <Section title="À compléter" tone="warning">
          <p className="text-[13px] text-ink-soft mb-3 leading-snug">
            {status.missing_critical.length} élément
            {status.missing_critical.length > 1 ? 's' : ''} critique
            {status.missing_critical.length > 1 ? 's' : ''} restent à saisir avant l\'export.
          </p>
          <ul className="space-y-2">
            {status.missing_critical.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 text-[14px] text-ink-soft bg-paper p-3 rounded-lg border border-rule"
              >
                <AlertTriangle className="size-4 text-warning mt-0.5 shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-ink leading-snug">{item.description_short}</p>
                  <p className="text-[12px] text-ink-mute leading-snug mt-0.5">
                    {item.description_full}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Photos manquantes */}
      {hasPhotoGaps && (
        <Section title="Photos manquantes" tone="info">
          <p className="text-[13px] text-ink-soft mb-3 leading-snug">
            {status.photos_missing.length} élément
            {status.photos_missing.length > 1 ? 's' : ''} nécessitent une photo.
          </p>
          <ul className="space-y-2">
            {status.photos_missing.slice(0, 10).map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-2 text-[14px] text-ink-soft bg-paper p-3 rounded-lg border border-rule"
              >
                <Camera className="size-4 text-info mt-0.5 shrink-0" aria-hidden />
                <p className="font-medium text-ink leading-snug">{item.description_short}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Sections complètes */}
      {status.by_section.filter((s) => s.remaining_required.length === 0).length > 0 && (
        <Section title="Sections complètes" tone="success">
          <ul className="space-y-1">
            {status.by_section
              .filter((s) => s.remaining_required.length === 0)
              .map((s) => (
                <li
                  key={`${s.diagnostic}::${s.section_id}`}
                  className="flex items-center gap-2 text-[13px] text-ink-soft"
                >
                  <Check className="size-3.5 text-success shrink-0" aria-hidden />
                  <span>{s.section_label}</span>
                  <span className="ml-auto font-mono text-[11px] text-ink-mute tabular-nums">
                    {s.covered_count}/{s.total_count}
                  </span>
                </li>
              ))}
          </ul>
        </Section>
      )}

      {/* Pièces visitées */}
      {status.rooms_visited.length > 0 && (
        <Section title="Pièces visitées" tone="neutral">
          <div className="flex flex-wrap gap-2">
            {status.rooms_visited.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill bg-paper border border-rule text-[12px] text-ink-soft"
              >
                {ROOM_LABEL_FR[r]}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Bottom sticky actions */}
      <div className="fixed bottom-0 inset-x-0 bg-paper border-t border-rule p-4 space-y-2 shadow-md">
        {hasCriticalGaps && (
          <Button type="button" variant="accent" size="lg" className="w-full" onClick={onComplete}>
            Compléter maintenant
          </Button>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="default"
            className="flex-1"
            onClick={handleLeaveClick}
          >
            Partir quand même
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="default"
            className="flex-1"
            onClick={onContinue}
          >
            Continuer la capture
          </Button>
        </div>
      </div>

      {/* Modal confirmation départ avec gaps critiques */}
      {showConfirmLeave && (
        <div
          className="fixed inset-0 z-50 bg-navy-deep/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-paper rounded-xl border border-rule shadow-md max-w-md w-full p-5 animate-slide-up">
            <div className="flex items-start gap-3 mb-3">
              <div className="size-10 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5 text-warning" aria-hidden />
              </div>
              <div>
                <h2 className="text-[16px] font-semibold text-ink leading-snug">
                  Confirmer le départ ?
                </h2>
                <p className="text-[13px] text-ink-soft leading-snug mt-1">
                  Il reste {status.missing_critical.length} élément
                  {status.missing_critical.length > 1 ? 's' : ''} critique
                  {status.missing_critical.length > 1 ? 's' : ''} non saisi
                  {status.missing_critical.length > 1 ? 's' : ''}. L\'export sera bloqué tant que
                  ces éléments ne seront pas complétés.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmLeave(false)}
                className="text-ink-mute hover:text-ink p-1"
                aria-label="Annuler"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row mt-4">
              <Button
                type="button"
                variant="outline"
                size="default"
                className="flex-1"
                onClick={() => {
                  setShowConfirmLeave(false)
                  onConfirmLeave()
                }}
              >
                Quitter quand même
              </Button>
              <Button
                type="button"
                variant="accent"
                size="default"
                className="flex-1"
                onClick={() => {
                  setShowConfirmLeave(false)
                  onComplete()
                }}
              >
                Rester et compléter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'warning' | 'info' | 'success' | 'neutral'
  children: React.ReactNode
}) {
  return (
    <section className="px-4 py-4">
      <div
        className={cn(
          'rounded-xl border border-rule bg-paper/60 p-4',
          tone === 'warning' && 'border-l-2 border-l-warning',
          tone === 'info' && 'border-l-2 border-l-info',
          tone === 'success' && 'border-l-2 border-l-success',
        )}
      >
        <p className="label-mono text-ink-mute mb-3">{title}</p>
        {children}
      </div>
    </section>
  )
}
