/**
 * KOVAS — Pré-export · `AnalysisSection`
 *
 * Section d'analyse regroupant les findings d'une catégorie (conformity,
 * coherence, etc.). Affiche un en-tête avec compteur et la liste des cards.
 */

import type { Finding, FindingCategory } from '@/lib/pre-export/types'
import { CheckCircle2 } from 'lucide-react'
import { FindingCard } from './FindingCard'

interface AnalysisSectionProps {
  title: string
  description?: string
  /** Score local (sur l'échelle de la catégorie, ex 38/40). */
  scoreLabel?: string
  category: FindingCategory
  findings: Finding[]
  onFindingAction?: (finding: Finding) => void
}

export function AnalysisSection({
  title,
  description,
  scoreLabel,
  category: _category,
  findings,
  onFindingAction,
}: AnalysisSectionProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-[17px] font-semibold text-ink leading-tight">{title}</h3>
          {description ? <p className="text-[12px] text-ink-mute mt-0.5">{description}</p> : null}
        </div>
        {scoreLabel ? (
          <span className="label-mono text-ink-mute" aria-label="Score de la section">
            {scoreLabel}
          </span>
        ) : null}
      </div>

      {findings.length === 0 ? (
        <div className="rounded-lg bg-paper border border-rule p-5 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-success shrink-0" aria-hidden />
          <p className="text-[13px] text-ink-soft">Aucun point d'attention sur cette section.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {findings.map((f) => (
            <FindingCard key={f.code} finding={f} onAction={onFindingAction} />
          ))}
        </div>
      )}
    </section>
  )
}
