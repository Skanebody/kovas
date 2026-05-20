'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { Alternative } from '@/lib/scheduling/alternative-generator'
import { cn } from '@/lib/utils'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'

interface AlternativeSuggestionsProps {
  alternatives: Alternative[]
  loading: boolean
  /** Quand l'user clique "Choisir ce créneau". */
  onAcceptAlternative: (alt: Alternative) => void
  className?: string
}

/**
 * Affichage de 3 cards alternatives quand un conflit est détecté.
 *
 * Chaque card montre : date+heure formatées FR, reasoning métier (texte sobre
 * généré côté backend), score sous forme de badge, bouton "Choisir ce créneau"
 * en chartreuse (signature v5 — l'accept est l'action prioritaire).
 */
export function AlternativeSuggestions({
  alternatives,
  loading,
  onAcceptAlternative,
  className,
}: AlternativeSuggestionsProps) {
  if (!loading && alternatives.length === 0) return null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-ink-mute" />
        <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute">
          Créneaux alternatifs suggérés
        </span>
        {loading && <Loader2 className="size-3.5 animate-spin text-ink-faint" />}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {alternatives.map((alt, i) => (
          <Card
            key={`${alt.startAt}-${i}`}
            variant="opaque"
            padding="sm"
            className="flex flex-col justify-between gap-2"
          >
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-medium text-ink">{formatDate(alt.startAt)}</span>
                <Badge variant="muted" className="text-[10px]">
                  Score {alt.score}
                </Badge>
              </div>
              <p className="font-mono text-[12px] text-ink-mute tabular-nums">
                {formatTime(alt.startAt)} – {formatTime(alt.endAt)}
              </p>
              <p className="text-[12px] text-ink-mute italic">{alt.reasoning}</p>
            </div>
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={() => onAcceptAlternative(alt)}
            >
              <CheckCircle2 className="size-3.5" />
              Choisir ce créneau
            </Button>
          </Card>
        ))}
      </div>
    </div>
  )
}

function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d)
}

function formatTime(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}
