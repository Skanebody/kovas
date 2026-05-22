'use client'

/**
 * PhotoSuggestionBubble — bulle in-flow suggérant la prise d'une photo
 * pour un item required (`requires_photo: true`) qui reste non couvert.
 *
 * UX :
 *  - bordure gauche info (2px)
 *  - icône Camera info, libellé item description_full
 *  - CTA "Prendre la photo" (chartreuse) + "Ignorer" (ghost)
 */

import { Button } from '@/components/ui/button'
import type { ChecklistItem } from '@/lib/local-ai/checklists/types'
import { cn } from '@/lib/utils'
import { Camera, X } from 'lucide-react'

interface PhotoSuggestionBubbleProps {
  item: ChecklistItem
  onTakePhoto: () => void
  onDismiss: () => void
  className?: string
}

export function PhotoSuggestionBubble({
  item,
  onTakePhoto,
  onDismiss,
  className,
}: PhotoSuggestionBubbleProps) {
  return (
    <div
      className={cn(
        'relative bg-paper border border-rule border-l-2 border-l-info rounded-lg shadow-sm',
        'p-4 animate-fade-in',
        className,
      )}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute top-2 right-2 text-ink-mute hover:text-ink rounded-full p-1"
        aria-label="Fermer la suggestion"
      >
        <X className="size-3.5" aria-hidden />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="size-8 rounded-full bg-info/10 flex items-center justify-center shrink-0">
          <Camera className="size-4 text-info" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="label-mono text-ink-mute mb-1">Photo recommandée</p>
          <p className="text-[14px] font-medium text-ink leading-snug mb-1">
            {item.description_short}
          </p>
          <p className="text-[13px] text-ink-soft leading-snug mb-3">{item.description_full}</p>
          <div className="flex gap-2">
            <Button type="button" variant="accent" size="sm" onClick={onTakePhoto}>
              Prendre la photo
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Ignorer
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
