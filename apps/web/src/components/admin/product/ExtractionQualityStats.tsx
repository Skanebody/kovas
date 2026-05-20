/**
 * 3 mini-cards : confiance moyenne Vision IA + % validés + % conflits.
 *
 * Pas de chart : la valeur est plus parlante en italic Instrument Serif.
 */

import { Card } from '@/components/ui/card'
import type { ExtractionQualityStats as QualityStats } from '@/lib/admin/product-analytics'
import { CheckCircle2, Gauge, GitMerge } from 'lucide-react'

export interface ExtractionQualityStatsProps {
  stats: QualityStats
}

export function ExtractionQualityStats({ stats }: ExtractionQualityStatsProps) {
  const noData = stats.totalFields === 0
  // confidence stored 0-1 → display %.
  const confidencePct = stats.avgConfidence * 100

  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Qualité d&apos;extraction Vision IA
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Sur {stats.totalFields} champs extraits depuis source_type=photo_vision.
          </p>
        </div>
      </div>

      {noData ? (
        <p className="text-sm text-ink-mute py-4">Aucun champ extrait à analyser.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-lg border border-rule/40 bg-sage/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Confiance moy.
              </span>
              <Gauge className="size-3.5 text-ink-faint" aria-hidden />
            </div>
            <p className="font-serif italic font-normal text-3xl tracking-tight text-ink leading-none">
              {confidencePct.toFixed(1)}%
            </p>
            <p className="mt-2 text-[11px] text-ink-faint">cible ≥ 85%</p>
          </div>

          <div className="rounded-lg border border-rule/40 bg-sage/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Validés user
              </span>
              <CheckCircle2 className="size-3.5 text-ink-faint" aria-hidden />
            </div>
            <p className="font-serif italic font-normal text-3xl tracking-tight text-ink leading-none">
              {stats.validatedPct.toFixed(1)}%
            </p>
            <p className="mt-2 text-[11px] text-ink-faint">workflow capture-first</p>
          </div>

          <div className="rounded-lg border border-rule/40 bg-sage/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                Conflits
              </span>
              <GitMerge className="size-3.5 text-ink-faint" aria-hidden />
            </div>
            <p className="font-serif italic font-normal text-3xl tracking-tight text-ink leading-none">
              {stats.conflictPct.toFixed(1)}%
            </p>
            <p className="mt-2 text-[11px] text-ink-faint">multi-sources divergentes</p>
          </div>
        </div>
      )}
    </Card>
  )
}
