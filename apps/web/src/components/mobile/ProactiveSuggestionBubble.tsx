'use client'

/**
 * ProactiveSuggestionBubble — affiche une suggestion contextuelle issue
 * de `ProactiveSuggester` (règles métier déterministes).
 *
 * UX :
 *  - bordure gauche colorée selon priority (critical=danger, high=warning,
 *    medium=info, low=ink-mute)
 *  - libellé titre + message complet
 *  - 2 CTA : `cta_label` (chartreuse) + "Ignorer" (ghost) — ou 1 seul si info_only
 */

import { Button } from '@/components/ui/button'
import type { Suggestion, SuggestionPriority } from '@/lib/local-ai/proactive-suggester'
import { cn } from '@/lib/utils'
import { AlertCircle, AlertTriangle, Info, Lightbulb } from 'lucide-react'

interface ProactiveSuggestionBubbleProps {
  suggestion: Suggestion
  onAccept: () => void
  onDismiss: () => void
  className?: string
}

const PRIORITY_STYLES: Record<
  SuggestionPriority,
  { borderClass: string; iconBgClass: string; iconColorClass: string; icon: typeof AlertCircle }
> = {
  critical: {
    borderClass: 'border-l-danger',
    iconBgClass: 'bg-danger/10',
    iconColorClass: 'text-danger',
    icon: AlertCircle,
  },
  high: {
    borderClass: 'border-l-warning',
    iconBgClass: 'bg-warning/10',
    iconColorClass: 'text-warning',
    icon: AlertTriangle,
  },
  medium: {
    borderClass: 'border-l-info',
    iconBgClass: 'bg-info/10',
    iconColorClass: 'text-info',
    icon: Info,
  },
  low: {
    borderClass: 'border-l-rule',
    iconBgClass: 'bg-sage-alt',
    iconColorClass: 'text-ink-mute',
    icon: Lightbulb,
  },
}

const PRIORITY_LABEL_FR: Record<SuggestionPriority, string> = {
  critical: 'Obligation réglementaire',
  high: 'Recommandation forte',
  medium: 'Information',
  low: 'Anticipation',
}

export function ProactiveSuggestionBubble({
  suggestion,
  onAccept,
  onDismiss,
  className,
}: ProactiveSuggestionBubbleProps) {
  const styles = PRIORITY_STYLES[suggestion.priority]
  const Icon = styles.icon

  return (
    <div
      className={cn(
        'relative bg-paper border border-rule border-l-2 rounded-lg shadow-sm p-4 animate-fade-in',
        styles.borderClass,
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'size-8 rounded-full flex items-center justify-center shrink-0',
            styles.iconBgClass,
          )}
        >
          <Icon className={cn('size-4', styles.iconColorClass)} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="label-mono text-ink-mute mb-1">{PRIORITY_LABEL_FR[suggestion.priority]}</p>
          <p className="text-[14px] font-semibold text-ink leading-snug mb-1">{suggestion.title}</p>
          <p className="text-[13px] text-ink-soft leading-snug mb-3">{suggestion.message}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={suggestion.info_only ? 'outline' : 'accent'}
              size="sm"
              onClick={suggestion.info_only ? onDismiss : onAccept}
            >
              {suggestion.cta_label}
            </Button>
            {!suggestion.info_only && (
              <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
                Ignorer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
