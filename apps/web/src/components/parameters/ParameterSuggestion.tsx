'use client'

/**
 * KOVAS — <ParameterSuggestion>
 *
 * Composant client intégré sous chaque champ "à interprétation" lors de la saisie
 * d'une mission (Module 2 — Standardisation IA).
 *
 * À mount, appelle le relay `/api/parameters/suggest` (qui forward vers l'Edge
 * Function `parameter-suggest`). Affiche :
 *   - Suggestion + score confiance
 *   - Stats "X% des diagnostiqueurs choisissent cette option"
 *   - Justification courte + référence réglementaire
 *   - 3 actions : Accepter | Choisir autre | Justifier mon choix (déviation)
 *
 * Si l'utilisateur dévie : INSERT `parameter_suggestions.user_chosen_value`
 * + `user_reason_for_deviation` (audit + apprentissage IA).
 *
 * Authority : CLAUDE.md §3 + §7bis.
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import type {
  ParameterName,
  SuggestionContext,
  SuggestionOutput,
} from '@/lib/parameters/parameter-types'
import { ChevronDown, ExternalLink, Lightbulb } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

export interface ParameterSuggestionProps {
  parameterName: ParameterName
  context: SuggestionContext
  /** UUID mission optionnel — alimente l'audit. */
  missionId?: string
  /** Appelé quand l'utilisateur accepte la suggestion. */
  onAccept: (value: string, suggestion: SuggestionOutput) => void
  /** Appelé quand l'utilisateur choisit une valeur différente (alt ou custom). */
  onCustom: (value: string, suggestion: SuggestionOutput, reason?: string) => void
  /** Désactive l'interaction (lecture seule). */
  disabled?: boolean
  className?: string
}

type FetchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: SuggestionOutput }

const PARAMETER_LABELS: Record<ParameterName, string> = {
  type_ventilation: 'Type de ventilation',
  type_chauffage: 'Type de chauffage',
  type_ecs: "Type d'eau chaude sanitaire",
  type_isolation_murs: "Type d'isolation des murs",
  type_isolation_toiture: "Type d'isolation toiture",
  type_menuiseries: 'Type de menuiseries',
  type_climatisation: 'Type de climatisation',
}

export function ParameterSuggestion({
  parameterName,
  context,
  missionId,
  onAccept,
  onCustom,
  disabled,
  className,
}: ParameterSuggestionProps) {
  const [state, setState] = useState<FetchState>({ status: 'idle' })
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [showReasonForm, setShowReasonForm] = useState(false)
  const [pendingValue, setPendingValue] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  const fetchSuggestion = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const res = await fetch('/api/parameters/suggest', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ parameterName, context, missionId }),
      })
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(err?.error ?? `HTTP ${res.status}`)
      }
      const data = (await res.json()) as SuggestionOutput
      setState({ status: 'ready', data })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'erreur inconnue'
      setState({ status: 'error', message })
    }
  }, [parameterName, context, missionId])

  useEffect(() => {
    void fetchSuggestion()
  }, [fetchSuggestion])

  const reportDeviation = useCallback(
    async (value: string, reasonText: string | undefined, suggestion: SuggestionOutput) => {
      // Best-effort : tracker la déviation pour apprentissage IA (cf. CLAUDE.md §7bis).
      try {
        await fetch('/api/parameters/suggest/deviation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            cacheKey: suggestion.cacheKey,
            parameterName: suggestion.parameterName,
            suggestedValue: suggestion.suggestedValue,
            userChosenValue: value,
            userReasonForDeviation: reasonText ?? null,
            missionId: missionId ?? null,
          }),
        })
      } catch {
        // Silent — non-bloquant pour l'UX terrain.
      }
    },
    [missionId],
  )

  const handleAccept = () => {
    if (state.status !== 'ready' || disabled) return
    onAccept(state.data.suggestedValue, state.data)
  }

  const handlePickAlternative = (value: string) => {
    if (state.status !== 'ready' || disabled) return
    setPendingValue(value)
    setShowAlternatives(false)
    setShowReasonForm(true)
  }

  const handleSubmitReason = () => {
    if (state.status !== 'ready' || !pendingValue) return
    onCustom(pendingValue, state.data, reason.trim() || undefined)
    void reportDeviation(pendingValue, reason.trim() || undefined, state.data)
    setShowReasonForm(false)
    setReason('')
    setPendingValue(null)
  }

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <Card variant="opaque" padding="sm" className={className}>
        <div className="flex items-start gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </Card>
    )
  }

  if (state.status === 'error') {
    return (
      <Card variant="opaque" padding="sm" className={className}>
        <p className="text-[12px] text-ink-mute">Suggestion KOVAS indisponible — {state.message}</p>
      </Card>
    )
  }

  const { data } = state
  const label = PARAMETER_LABELS[parameterName] ?? parameterName
  const confidencePct = Math.round(data.confidenceScore * 100)
  const topAlternative = data.alternatives[0]
  const popularityPct = topAlternative ? Math.round(topAlternative.probability * 100) : null

  return (
    <Card variant="opaque" padding="sm" className={className}>
      <div className="flex items-start gap-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-chartreuse/20 shrink-0">
          <Lightbulb className="size-4 text-ink" strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-[11px] uppercase tracking-wider text-ink-mute font-medium font-mono">
              Suggestion KOVAS · {label}
            </p>
            <Badge variant="muted">{confidencePct}% de confiance</Badge>
          </div>
          <p className="mt-1 text-[15px] font-semibold text-ink">{data.suggestedValue}</p>
          {popularityPct !== null && data.similarCasesCount > 0 ? (
            <p className="mt-1 text-[12px] text-ink-mute">
              {popularityPct}% des diagnostiqueurs choisissent cette option pour des logements
              similaires ({data.similarCasesCount} cas).
            </p>
          ) : null}
          {data.justification ? (
            <p className="mt-2 text-[12px] text-ink-soft leading-relaxed">{data.justification}</p>
          ) : null}
          {data.reglementaryReferences.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {data.reglementaryReferences.slice(0, 3).map((ref) => (
                <li key={ref.url} className="text-[11px]">
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-ink-mute hover:text-ink underline-offset-2 hover:underline"
                  >
                    {ref.label}
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="accent"
              size="sm"
              onClick={handleAccept}
              disabled={disabled}
            >
              Accepter
            </Button>
            {data.alternatives.length > 0 ? (
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAlternatives((v) => !v)}
                  disabled={disabled}
                >
                  Choisir autre
                  <ChevronDown className="size-3.5" aria-hidden />
                </Button>
                {showAlternatives ? (
                  <div className="absolute left-0 top-full z-30 mt-1 min-w-[220px] rounded-lg border border-rule bg-paper shadow-glass-sm">
                    <ul className="py-1.5">
                      {data.alternatives.map((alt) => (
                        <li key={alt.value}>
                          <button
                            type="button"
                            onClick={() => handlePickAlternative(alt.value)}
                            className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[12px] text-ink hover:bg-cream-deep"
                          >
                            <span>{alt.value}</span>
                            <span className="text-[11px] text-ink-mute font-mono">
                              {Math.round(alt.probability * 100)}%
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {
                setPendingValue(null)
                setShowReasonForm((v) => !v)
              }}
              disabled={disabled}
            >
              Justifier mon choix
            </Button>
          </div>

          {showReasonForm ? (
            <div className="mt-3 space-y-2">
              {pendingValue === null ? (
                <p className="text-[12px] text-ink-mute">
                  Saisissez la valeur retenue ci-dessous puis votre justification.
                </p>
              ) : (
                <p className="text-[12px] text-ink-soft">
                  Valeur retenue : <strong>{pendingValue}</strong>
                </p>
              )}
              {pendingValue === null ? (
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setPendingValue(e.target.value)}
                  placeholder="Valeur retenue (ex: VMC double flux)"
                  className="flex w-full min-h-[40px] rounded-md border border-rule bg-paper px-3 py-2 text-[13px] text-ink"
                />
              ) : null}
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Raison de la déviation (ex: équipement constaté sur place différent du parc local)"
                rows={3}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  onClick={handleSubmitReason}
                  disabled={!pendingValue || reason.trim().length === 0}
                >
                  Enregistrer
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowReasonForm(false)
                    setReason('')
                    setPendingValue(null)
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
