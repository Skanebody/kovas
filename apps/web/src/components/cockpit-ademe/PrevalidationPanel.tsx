'use client'

/**
 * KOVAS — PrevalidationPanel (Game Changer 1).
 *
 * Affiche le score conformité pré-export (A1.3.3) :
 *   - Score 0-100 en chiffre Instrument Serif italic 80px
 *   - 4 sous-scores en cards (Cohérence, Risque ADEME, Litigation, Complétude)
 *   - ≤5 anomalies en cards bordure 1px navy
 *   - ≤3 opportunités en cards bordure chartreuse
 *
 * Brand V5 strict app : sage `#F5F7F4` + navy `#0F1419` + chartreuse `#D4F542`.
 * Aucun gradient/ombre. Bordures 1px max.
 * Authority : REFONTE-ACQUI-TARGET-V2 chapitre 6.2.
 */

import type { ConformityScoreResult } from '@/lib/algos/conformity-score'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle2, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PrevalidationPanelProps {
  missionId: string
  onApplySuggestion?: (suggestionId: string) => void
  onDismissAnomaly?: (anomalyId: string) => void
}

interface ApiResponse {
  ok: boolean
  score: ConformityScoreResult
  address?: string
  partial_failures?: string[]
  error?: string
}

export function PrevalidationPanel({
  missionId,
  onApplySuggestion,
  onDismissAnomaly,
}: PrevalidationPanelProps): React.ReactElement {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/missions/${missionId}/prevalidation-score`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return (await r.json()) as ApiResponse
      })
      .then((d) => {
        if (cancelled) return
        if (!d.ok) {
          setError(d.error ?? 'unknown error')
        } else {
          setData(d)
        }
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'fetch failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [missionId])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="size-6 animate-spin text-ink-mute" aria-hidden />
        <p className="text-[13px] text-ink-soft">Analyse de votre mission…</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border border-accent-red/30 bg-accent-red/5 px-4 py-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="size-4 mt-0.5 text-accent-red" aria-hidden />
          <div className="text-[13px] text-ink">
            <p className="font-medium">Pré-validation indisponible</p>
            <p className="text-ink-soft">{error ?? 'Réessayez dans un instant.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const { score } = data
  const tone = score.global_score >= 80 ? 'good' : score.global_score >= 60 ? 'mid' : 'low'

  return (
    <div className="space-y-6">
      {/* Score global hero — Instrument Serif italic */}
      <section
        className={cn(
          'rounded-2xl border bg-paper px-6 py-8 text-center',
          tone === 'good' && 'border-accent-green/30',
          tone === 'mid' && 'border-accent-warm/40',
          tone === 'low' && 'border-accent-red/30',
        )}
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute mb-2">
          Score conformité
        </p>
        <p
          className={cn(
            'font-serif italic leading-none',
            'text-[80px] sm:text-[96px]',
            tone === 'good' && 'text-accent-green',
            tone === 'mid' && 'text-accent-warm',
            tone === 'low' && 'text-accent-red',
          )}
        >
          {score.global_score}
        </p>
        <p className="font-mono text-[11px] text-ink-mute mt-1">/ 100</p>
      </section>

      {/* Breakdown 4 axes */}
      <section>
        <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-3">
          Décomposition
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <BreakdownCard label="Cohérence" value={score.breakdown.coherence} weight="30%" />
          <BreakdownCard label="Risque ADEME" value={score.breakdown.ademe_risk} weight="30%" />
          <BreakdownCard label="Litigation" value={score.breakdown.litigation_risk} weight="20%" />
          <BreakdownCard label="Complétude" value={score.breakdown.completude} weight="20%" />
        </div>
      </section>

      {/* Anomalies max 5 */}
      {score.anomalies.length > 0 ? (
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-3 flex items-center gap-2">
            <AlertCircle className="size-3" aria-hidden />À corriger ({score.anomalies.length})
          </h3>
          <ul className="space-y-2">
            {score.anomalies.map((a) => (
              <li
                key={a.id}
                className={cn(
                  'rounded-lg border bg-paper px-3 py-2.5',
                  a.severity === 'danger' && 'border-accent-red/40',
                  a.severity === 'warning' && 'border-accent-warm/40',
                  a.severity === 'info' && 'border-rule/60',
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[13px] font-semibold text-ink">{a.title}</p>
                  <span
                    className={cn(
                      'font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded',
                      a.severity === 'danger' && 'bg-accent-red/10 text-accent-red',
                      a.severity === 'warning' && 'bg-accent-warm/10 text-accent-warm',
                      a.severity === 'info' && 'bg-ink/5 text-ink-mute',
                    )}
                  >
                    {a.severity}
                  </span>
                </div>
                <p className="text-[13px] text-ink-soft leading-relaxed mb-1.5">{a.description}</p>
                <p className="text-[12px] text-ink-mute">{a.suggested_action}</p>
                {onDismissAnomaly ? (
                  <button
                    type="button"
                    onClick={() => onDismissAnomaly(a.id)}
                    className="mt-2 text-[11px] font-mono text-ink-mute hover:text-ink underline"
                  >
                    Ignorer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section>
          <div className="rounded-lg border border-accent-green/30 bg-accent-green/5 px-3 py-2.5 flex items-start gap-2">
            <CheckCircle2 className="size-4 mt-0.5 text-accent-green" aria-hidden />
            <p className="text-[13px] text-ink">Aucune anomalie détectée.</p>
          </div>
        </section>
      )}

      {/* Opportunités max 3 */}
      {score.opportunities.length > 0 ? (
        <section>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute mb-3 flex items-center gap-2">
            <TrendingUp className="size-3" aria-hidden />
            Opportunités ({score.opportunities.length})
          </h3>
          <ul className="space-y-2">
            {score.opportunities.map((o) => (
              <li
                key={o.id}
                className="rounded-lg border border-chartreuse/30 bg-paper px-3 py-2.5"
              >
                <div className="flex items-start gap-2 mb-1">
                  <Sparkles className="size-3.5 mt-0.5 text-chartreuse-deep shrink-0" aria-hidden />
                  <p className="text-[13px] font-semibold text-ink">{o.title}</p>
                </div>
                <p className="text-[12px] text-ink-mute mb-1">{o.estimated_gain}</p>
                <p className="text-[13px] text-ink-soft leading-relaxed">{o.action}</p>
                {onApplySuggestion ? (
                  <button
                    type="button"
                    onClick={() => onApplySuggestion(o.id)}
                    className="mt-2 inline-flex items-center gap-1 rounded-full bg-chartreuse text-ink px-3 py-1 text-[11px] font-medium hover:bg-chartreuse/80 transition-colors"
                  >
                    Appliquer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Meta footer */}
      {data.partial_failures && data.partial_failures.length > 0 ? (
        <p className="font-mono text-[10px] text-ink-mute text-center">
          Sources partielles : {data.partial_failures.join(', ')}
        </p>
      ) : null}
    </div>
  )
}

function BreakdownCard({
  label,
  value,
  weight,
}: {
  label: string
  value: number
  weight: string
}) {
  const tone = value >= 80 ? 'good' : value >= 60 ? 'mid' : 'low'
  return (
    <div className="rounded-lg border border-rule/60 bg-paper px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wide text-ink-mute mb-1">
        {label} <span className="text-ink-faint">· {weight}</span>
      </p>
      <p
        className={cn(
          'font-serif italic text-[28px] leading-none',
          tone === 'good' && 'text-accent-green',
          tone === 'mid' && 'text-accent-warm',
          tone === 'low' && 'text-accent-red',
        )}
      >
        {value}
      </p>
    </div>
  )
}
