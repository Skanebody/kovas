/**
 * <HealthScoreHero> — Hero "Surveiller la santé du cabinet" style Apple Santé.
 *
 * Affiche un score composite 0-100 en gros (Instrument Serif italic), un statut
 * texte (Excellent / Bon / À surveiller / Critique), une évolution mini vs mois
 * précédent et 2-3 diagnostics auto si problèmes détectés.
 *
 * DS v5 strict : Card variant `opaque` radius 24, pas de gradient flashy,
 * couleurs sémantiques discrètes selon statut.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

export type HealthScoreStatus = 'excellent' | 'good' | 'watch' | 'critical'

export interface HealthScoreDiagnostic {
  /** Message court (1 phrase sobre). */
  message: string
  /** Niveau sémantique du diagnostic. */
  level: 'info' | 'warning' | 'danger'
}

interface HealthScoreHeroProps {
  /** Score composite 0-100. */
  score: number
  /** Score du mois précédent (pour calcul delta). */
  previousScore?: number | null
  /** Diagnostics auto à afficher (max 3 — au-delà tronqué). */
  diagnostics?: HealthScoreDiagnostic[]
  /** Sous-titre méthodologique court. */
  methodologyHint?: string
}

function classifyScore(score: number): HealthScoreStatus {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'good'
  if (score >= 50) return 'watch'
  return 'critical'
}

function statusLabel(status: HealthScoreStatus): string {
  switch (status) {
    case 'excellent':
      return 'Excellent'
    case 'good':
      return 'Bon'
    case 'watch':
      return 'À surveiller'
    case 'critical':
      return 'Critique'
  }
}

/** Couleur sémantique du score (rgb pour usage style inline). */
function statusColor(status: HealthScoreStatus): { dot: string; text: string; bg: string } {
  switch (status) {
    case 'excellent':
      return {
        dot: 'bg-success',
        text: 'text-success',
        bg: 'bg-success/10',
      }
    case 'good':
      return {
        dot: 'bg-chartreuse-deep',
        text: 'text-chartreuse-deep',
        bg: 'bg-chartreuse/15',
      }
    case 'watch':
      return {
        dot: 'bg-warning',
        text: 'text-warning',
        bg: 'bg-warning/10',
      }
    case 'critical':
      return {
        dot: 'bg-danger',
        text: 'text-danger',
        bg: 'bg-danger/10',
      }
  }
}

function diagnosticLevelClass(level: HealthScoreDiagnostic['level']): string {
  switch (level) {
    case 'info':
      return 'text-ink-mute'
    case 'warning':
      return 'text-warning'
    case 'danger':
      return 'text-danger'
  }
}

export function HealthScoreHero({
  score,
  previousScore = null,
  diagnostics = [],
  methodologyHint,
}: HealthScoreHeroProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)))
  const status = classifyScore(safeScore)
  const colors = statusColor(status)
  const delta = previousScore != null ? safeScore - Math.round(previousScore) : null

  const TrendIcon = delta == null ? Minus : delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus
  const trendLabel =
    delta == null
      ? 'Pas de comparatif disponible'
      : delta > 0
        ? `+${delta} vs mois dernier`
        : delta < 0
          ? `${delta} vs mois dernier`
          : 'Stable vs mois dernier'

  const visibleDiagnostics = diagnostics.slice(0, 3)

  return (
    <Card variant="opaque" padding="none" className="rounded-[24px] overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-rule/60 px-6 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-semibold text-ink">
          Santé du cabinet
        </p>
        <span
          className={cn(
            'inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em]',
            colors.bg,
            colors.text,
          )}
        >
          <span className={cn('size-1.5 rounded-full', colors.dot)} aria-hidden />
          {statusLabel(status)}
        </span>
      </div>

      <div className="px-6 py-8 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8 items-center">
        {/* Score en gros */}
        <div className="flex flex-col items-start">
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                'font-serif italic font-normal text-[88px] sm:text-[112px] leading-none tracking-tight',
                colors.text,
              )}
            >
              {safeScore}
            </span>
            <span className="font-mono text-[12px] text-ink-mute tracking-[0.05em]">/100</span>
          </div>
          <span
            className={cn(
              'mt-2 inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.05em]',
              delta == null ? 'text-ink-mute' : delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-ink-mute',
            )}
          >
            <TrendIcon className="size-3" aria-hidden />
            {trendLabel}
          </span>
        </div>

        {/* Diagnostics auto */}
        <div className="space-y-3 min-w-0">
          {visibleDiagnostics.length === 0 ? (
            <p className="text-sm text-ink-mute italic">
              Aucune alerte particulière ce mois. Continuez sur cette dynamique.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {visibleDiagnostics.map((d, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ink"
                >
                  <AlertTriangle
                    className={cn('size-3.5 shrink-0 mt-0.5', diagnosticLevelClass(d.level))}
                    aria-hidden
                  />
                  <span>{d.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {methodologyHint ? (
        <div className="border-t border-rule/60 px-6 py-3">
          <p className="font-mono text-[10px] text-ink-mute leading-relaxed">{methodologyHint}</p>
        </div>
      ) : null}
    </Card>
  )
}
