/**
 * KOVAS — Pré-export · `ScoreHero`
 *
 * Affichage hero du score global de pré-vérification 0-100 + interprétation
 * textuelle + barre de progression sémantique. Pattern signature v5 :
 * KPI Instrument Serif italic + label monospace.
 */

import { cn } from '@/lib/utils'
import { INTERPRETATION_LABEL } from '@/lib/pre-export/types'
import type { PreExportInterpretation } from '@/lib/pre-export/types'

interface ScoreHeroProps {
  score: number
  interpretation: PreExportInterpretation
  /** Compteurs findings pour mention complémentaire. */
  counters: {
    critical: number
    warning: number
    suggestion: number
    info: number
  }
  className?: string
}

function getScoreColor(score: number): { bar: string; text: string } {
  if (score >= 75) return { bar: 'bg-success', text: 'text-success' }
  if (score >= 60) return { bar: 'bg-chartreuse-deep', text: 'text-ink' }
  if (score >= 40) return { bar: 'bg-warning', text: 'text-warning' }
  return { bar: 'bg-danger', text: 'text-danger' }
}

export function ScoreHero({ score, interpretation, counters, className }: ScoreHeroProps) {
  const color = getScoreColor(score)
  const pct = Math.max(0, Math.min(100, score))

  return (
    <div
      className={cn(
        'rounded-xl bg-paper shadow-sm p-8 md:p-10',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
        {/* Bloc score */}
        <div>
          <p className="label-mono text-ink-mute mb-3">CONFORMITÉ</p>
          <div className="flex items-baseline gap-4 mb-6">
            <span className={cn('kpi-hero tracking-tight', color.text)}>{score}</span>
            <span className="text-ink-mute text-xl font-medium">/ 100</span>
          </div>

          {/* Barre de progression sémantique */}
          <div className="relative h-2 bg-ink/5 rounded-full overflow-hidden mb-4">
            <div
              className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-slow', color.bar)}
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>

          {/* Interprétation */}
          <p className="text-display-serif text-2xl md:text-3xl text-ink leading-tight">
            {INTERPRETATION_LABEL[interpretation]}
          </p>
        </div>

        {/* Compteurs findings */}
        <div className="flex md:flex-col gap-4 md:gap-3">
          <div>
            <p className="label-mono text-ink-mute mb-1">CRITIQUE</p>
            <p className="text-2xl font-semibold text-danger">{counters.critical}</p>
          </div>
          <div>
            <p className="label-mono text-ink-mute mb-1">AVERTISSEMENT</p>
            <p className="text-2xl font-semibold text-warning">{counters.warning}</p>
          </div>
          <div>
            <p className="label-mono text-ink-mute mb-1">SUGGESTION</p>
            <p className="text-2xl font-semibold text-info">{counters.suggestion}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
