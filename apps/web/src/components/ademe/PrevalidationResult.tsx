'use client'

/**
 * KOVAS — Résultat de pré-validation ADEME (verdict + détail).
 *
 * Verdict gros badge Instrument Serif italic 48px green/yellow/red.
 * Détail 4 axes (volume / distance / coherence / statistical) avec sous-scores.
 * Warnings groupées par sévérité.
 *
 * CTA conditionnels :
 *   - green → "Publier le DPE" (chartreuse)
 *   - yellow → "Retravailler" (dark) + "Publier quand même" (link)
 *   - red → "Annuler" (chartreuse) + "Voir les corrections suggérées" (link)
 *
 * Loggue la décision via PATCH /api/ademe/prevalidate/:id/decision : le route
 * handler marque la prévalidation comme acquittée (acknowledged) et enregistre
 * le libellé de la décision côté DB (audit).
 */

import { AlertTriangle, ArrowRight, CheckCircle2, Info, Lock, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

export type RiskVerdict = 'green' | 'yellow' | 'red'

export interface PrevalidationResultProps {
  /** Id du record `ademe_prevalidations` créé par l'API. */
  prevalidationId: string | null
  verdict: RiskVerdict
  globalScore: number
  axisScores: {
    volume: number
    distance: number
    coherence: number
    statistical: number
    history: number
  }
  warnings: Array<{
    axis: string
    severity: 'info' | 'warning' | 'error' | 'blocking'
    code: string
    message: string
    suggested_fix?: string
  }>
  /** Freemium : détail des corrections verrouillé (réservé Pack Conformité). */
  detailLocked?: boolean
  /** Nombre total de points détectés (affiché même quand le détail est verrouillé). */
  issuesCount?: number
  onReset: () => void
}

const VERDICT_META: Record<
  RiskVerdict,
  { label: string; serif: string; classes: string; iconColor: string }
> = {
  green: {
    label: 'Validation OK',
    serif: 'Conforme',
    classes: 'bg-accent-green/15 text-accent-green border-accent-green/30',
    iconColor: 'text-success',
  },
  yellow: {
    label: 'À surveiller',
    serif: 'Vigilance',
    classes: 'bg-accent-orange/15 text-accent-orange border-accent-orange/40',
    iconColor: 'text-warning',
  },
  red: {
    label: 'Risque élevé',
    serif: 'Bloquant',
    classes: 'bg-accent-red/15 text-accent-red border-accent-red/40',
    iconColor: 'text-danger',
  },
}

const AXIS_LABEL: Record<string, string> = {
  volume: 'Volume',
  distance: 'Distance',
  coherence: 'Cohérence',
  statistical: 'Statistique',
  history: 'Historique',
}

const SEVERITY_META: Record<
  'info' | 'warning' | 'error' | 'blocking',
  { variant: 'blue' | 'yellow' | 'orange' | 'red'; icon: typeof Info }
> = {
  info: { variant: 'blue', icon: Info },
  warning: { variant: 'yellow', icon: AlertTriangle },
  error: { variant: 'orange', icon: AlertTriangle },
  blocking: { variant: 'red', icon: XCircle },
}

export function PrevalidationResult({
  prevalidationId,
  verdict,
  globalScore,
  axisScores,
  warnings,
  detailLocked = false,
  issuesCount = 0,
  onReset,
}: PrevalidationResultProps) {
  const [decisionPending, setDecisionPending] = useState<string | null>(null)
  const meta = VERDICT_META[verdict]

  async function logDecision(decision: 'published' | 'reworked' | 'cancelled' | 'overridden') {
    if (!prevalidationId) return
    setDecisionPending(decision)
    try {
      const res = await fetch(`/api/ademe/prevalidate/${prevalidationId}/decision`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      toast.success('Décision enregistrée')
    } catch {
      toast.error('Décision non enregistrée — réessayez')
    } finally {
      setDecisionPending(null)
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Verdict hero */}
      <Card
        variant="opaque"
        padding="default"
        className={cn('flex flex-col gap-4 border', meta.classes)}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1.5">
            <Badge
              variant={verdict === 'green' ? 'green' : verdict === 'yellow' ? 'yellow' : 'red'}
            >
              {meta.label}
            </Badge>
            <p className="font-serif italic text-4xl md:text-5xl leading-none">{meta.serif}</p>
            <p className="text-[12px] text-[#0F1419]/72">Score global {globalScore} / 100</p>
          </div>
          <div className={cn('shrink-0', meta.iconColor)}>
            {verdict === 'green' ? (
              <CheckCircle2 className="size-12" />
            ) : verdict === 'red' ? (
              <XCircle className="size-12" />
            ) : (
              <AlertTriangle className="size-12" />
            )}
          </div>
        </div>

        {/* CTA selon verdict */}
        <div className="flex flex-wrap items-center gap-3 border-t border-current/15 pt-4">
          {verdict === 'green' ? (
            <>
              <Button
                variant="accent"
                size="lg"
                disabled={decisionPending !== null}
                onClick={() => logDecision('published')}
              >
                Publier le DPE <ArrowRight className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onReset}>
                Nouvelle pré-validation
              </Button>
            </>
          ) : null}

          {verdict === 'yellow' ? (
            <>
              <Button
                variant="default"
                size="lg"
                disabled={decisionPending !== null}
                onClick={() => logDecision('reworked')}
              >
                Retravailler le DPE
              </Button>
              <Button
                variant="link"
                size="sm"
                disabled={decisionPending !== null}
                onClick={() => logDecision('overridden')}
              >
                Publier quand même
              </Button>
            </>
          ) : null}

          {verdict === 'red' ? (
            <>
              <Button
                variant="accent"
                size="lg"
                disabled={decisionPending !== null}
                onClick={() => logDecision('cancelled')}
              >
                Annuler la publication
              </Button>
              <Button variant="ghost" size="sm" onClick={onReset}>
                Voir les corrections suggérées
              </Button>
            </>
          ) : null}
        </div>
      </Card>

      {/* Sous-scores par axe */}
      <Card variant="opaque" padding="default" className="space-y-4">
        <h3 className="text-[15px] font-semibold text-[#0F1419]">Détail par axe</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['volume', 'distance', 'coherence', 'statistical', 'history'] as const).map((axis) => {
            const score = axisScores[axis]
            const tone = score >= 70 ? 'red' : score >= 40 ? 'yellow' : 'green'
            return (
              <div
                key={axis}
                className="rounded-md border border-[#0F1419]/[0.08] bg-paper p-3 space-y-1"
              >
                <p className="text-[10px] uppercase tracking-wider font-mono text-[#0F1419]/72">
                  {AXIS_LABEL[axis]}
                </p>
                <p
                  className={cn(
                    'font-serif italic text-3xl leading-none',
                    tone === 'green' && 'text-success',
                    tone === 'yellow' && 'text-warning',
                    tone === 'red' && 'text-danger',
                  )}
                >
                  {score}
                </p>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Freemium : détail verrouillé → paywall Pack Conformité */}
      {detailLocked && issuesCount > 0 ? (
        <Card variant="opaque" padding="default" className="space-y-3 border border-accent-warm/30">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-full bg-accent-warm/15 p-2 text-accent-warm">
              <Lock className="size-4" />
            </div>
            <div className="flex-1 space-y-1">
              <h3 className="text-[15px] font-semibold text-[#0F1419]">
                {issuesCount} point{issuesCount > 1 ? 's' : ''} à corriger détecté
                {issuesCount > 1 ? 's' : ''}
              </h3>
              <p className="text-[13px] text-[#0F1419]/72">
                Le verdict est gratuit. Le détail des corrections (quel champ revoir, comment) est
                inclus dans le Pack Conformité.
              </p>
            </div>
          </div>
          <Button variant="warm" size="sm" asChild className="w-fit">
            <Link href="/dashboard/decouvrir#decouvrir-addons">Débloquer le détail</Link>
          </Button>
        </Card>
      ) : null}

      {/* Warnings */}
      {!detailLocked && warnings.length > 0 ? (
        <Card variant="opaque" padding="default" className="space-y-3">
          <h3 className="text-[15px] font-semibold text-[#0F1419]">
            {warnings.length} avertissement{warnings.length > 1 ? 's' : ''}
          </h3>
          <ul className="space-y-2">
            {warnings.map((w, idx) => {
              const sev = SEVERITY_META[w.severity]
              const Icon = sev.icon
              return (
                <li
                  key={`${w.code}-${idx}`}
                  className="rounded-md border border-[#0F1419]/[0.08] bg-paper p-3 space-y-2"
                >
                  <div className="flex items-start gap-2.5">
                    <Icon className="size-4 shrink-0 mt-0.5 text-[#0F1419]/72" />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={sev.variant}>{w.severity}</Badge>
                        <span className="text-[10px] font-mono text-[#0F1419]/72">
                          {AXIS_LABEL[w.axis] ?? w.axis}
                        </span>
                        <span className="text-[10px] font-mono text-[#0F1419]/55">{w.code}</span>
                      </div>
                      <p className="text-[13px] text-[#0F1419]">{w.message}</p>
                      {w.suggested_fix ? (
                        <p className="text-[11px] text-[#0F1419]/72">
                          <span className="font-semibold">Correction : </span>
                          {w.suggested_fix}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}
    </div>
  )
}
