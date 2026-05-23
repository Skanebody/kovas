'use client'

/**
 * KOVAS — Bannière coral inline pour transcription incohérente (MISSION-E niveau 4 local).
 *
 * Affichée DANS la bulle USER quand `checkTranscriptCoherence()` a détecté
 * une ou plusieurs valeurs aberrantes (surface > 1000m², année > 2028, etc.).
 *
 * 3 actions exposées au diagnostiqueur :
 *   - Ignorer : la transcription est gardée telle quelle (cas légitime rare)
 *   - Refaire le vocal : ré-enregistre le segment (callback parent)
 *   - Corriger manuellement : ouvre un input éditable
 *
 * Authority : MISSION-E niveau 4 (cross-check métier).
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CoherenceIssue } from '@/lib/voice/transcription-coherence'
import { AlertTriangle, Mic, Pencil, X } from 'lucide-react'

interface TranscriptCoherenceBannerProps {
  issues: CoherenceIssue[]
  onIgnore: () => void
  onRedo?: () => void
  onEditManually?: () => void
  className?: string
}

export function TranscriptCoherenceBanner({
  issues,
  onIgnore,
  onRedo,
  onEditManually,
  className,
}: TranscriptCoherenceBannerProps): React.ReactElement | null {
  if (issues.length === 0) return null

  return (
    <div
      className={cn(
        'mt-2 rounded-lg border border-status-coral/40 bg-status-coral/5',
        'p-2.5 flex flex-col gap-2',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-2 text-[12px] text-status-coral">
        <AlertTriangle className="size-3.5 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold mb-0.5">Transcription suspecte</p>
          <ul className="space-y-0.5 list-none">
            {issues.map((issue) => (
              <li key={`${issue.field}-${issue.value}`} className="text-[11px] leading-tight">
                <strong>{issue.message}</strong>
                {issue.hint ? (
                  <span className="block text-ink-mute text-[10px] mt-0.5">{issue.hint}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onIgnore}
          className="h-7 px-2 text-[11px] text-ink-mute hover:text-ink"
        >
          <X className="size-3 mr-1" aria-hidden />
          Ignorer
        </Button>
        {onRedo ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRedo}
            className="h-7 px-2 text-[11px]"
          >
            <Mic className="size-3 mr-1" aria-hidden />
            Refaire le vocal
          </Button>
        ) : null}
        {onEditManually ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onEditManually}
            className="h-7 px-2 text-[11px]"
          >
            <Pencil className="size-3 mr-1" aria-hidden />
            Corriger
          </Button>
        ) : null}
      </div>
    </div>
  )
}
