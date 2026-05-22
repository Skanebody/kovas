'use client'

/**
 * MissingFieldQuestion — bulle système posant une question automatique
 * pour un item resté overdue (non couvert au-delà de son délai).
 *
 * UX :
 *  - Avatar Benjamin Bel : vouvoiement, sobre
 *  - Affiche `trigger_question_text` de l'item
 *  - Champ libre + 2 CTA : "Répondre par voix" (chartreuse) ·
 *    "Ignorer (déjà saisi ailleurs)" (ghost)
 */

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { OverdueItem } from '@/lib/local-ai/checklist-tracker'
import { ROOM_LABEL_FR } from '@/lib/local-ai/room-transition-detector'
import { cn } from '@/lib/utils'
import { HelpCircle, Mic } from 'lucide-react'
import { useState } from 'react'

interface MissingFieldQuestionProps {
  overdue: OverdueItem
  onAnswerText: (text: string) => void
  onAnswerVoice: () => void
  onDismiss: () => void
  className?: string
}

export function MissingFieldQuestion({
  overdue,
  onAnswerText,
  onAnswerVoice,
  onDismiss,
  className,
}: MissingFieldQuestionProps) {
  const [answer, setAnswer] = useState('')

  const elapsedMin = Math.floor(overdue.elapsed_ms / 60_000)
  const roomLabel = overdue.room ? ROOM_LABEL_FR[overdue.room] : null

  const handleSubmit = (): void => {
    if (answer.trim().length === 0) {
      onDismiss()
      return
    }
    onAnswerText(answer.trim())
    setAnswer('')
  }

  return (
    <div
      className={cn(
        'relative bg-paper border border-rule border-l-2 border-l-info rounded-lg shadow-sm',
        'p-4 animate-fade-in',
        className,
      )}
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="size-8 rounded-full bg-info/10 flex items-center justify-center shrink-0">
          <HelpCircle className="size-4 text-info" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="label-mono text-ink-mute mb-1">
            Élément à compléter
            {roomLabel ? ` · ${roomLabel}` : ''}
            {elapsedMin > 0 ? ` · ${elapsedMin} min` : ''}
          </p>
          <p className="text-[14px] font-medium text-ink leading-snug">
            {overdue.item.trigger_question_text}
          </p>
        </div>
      </div>

      <Textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Votre réponse…"
        className="text-[14px] mb-3"
        rows={2}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="accent" size="sm" onClick={handleSubmit}>
          Envoyer la réponse
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onAnswerVoice}>
          <Mic className="size-3.5" aria-hidden />
          Répondre par voix
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
          Déjà saisi
        </Button>
      </div>
    </div>
  )
}
