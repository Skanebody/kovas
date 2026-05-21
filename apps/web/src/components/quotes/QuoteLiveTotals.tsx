'use client'

/**
 * KOVAS — Sous-composant Totaux pour le wizard (sidebar sticky desktop / bottom mobile).
 * Affiche en temps réel sous-total HT / TVA / Total TTC à partir des lignes.
 */

import { Card } from '@/components/ui/card'
import {
  type QuoteLineItem,
  computeQuoteTotals,
  formatEur,
} from '@/lib/quotes/types'

interface QuoteLiveTotalsProps {
  lines: QuoteLineItem[]
  reference?: string | null
  issuedAt?: string | null
  expiresAt?: string | null
  className?: string
}

export function QuoteLiveTotals({
  lines,
  reference,
  issuedAt,
  expiresAt,
  className,
}: QuoteLiveTotalsProps) {
  const totals = computeQuoteTotals(lines)

  return (
    <Card variant="opaque" padding="default" className={className}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-mute">
            Aperçu
          </p>
          <h3 className="font-serif italic font-normal text-[20px] text-ink leading-tight">
            {reference ?? 'Nouveau devis'}
          </h3>
          {issuedAt ? (
            <p className="text-[12px] text-ink-mute">
              Émis le {issuedAt} · Valable jusqu&apos;au {expiresAt ?? '—'}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5 border-t border-rule/60 pt-4">
          <div className="flex items-center justify-between text-[13px] text-ink-soft">
            <span>Lignes</span>
            <span className="font-mono">{lines.length}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] text-ink-soft">
            <span>Sous-total HT</span>
            <span className="font-mono">{formatEur(totals.subtotalHt)}</span>
          </div>
          <div className="flex items-center justify-between text-[13px] text-ink-soft">
            <span>TVA</span>
            <span className="font-mono">{formatEur(totals.totalTva)}</span>
          </div>
        </div>

        <div className="rounded-lg bg-ink/[0.04] px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wider font-mono text-ink-mute">
            Total TTC
          </span>
          <span className="font-serif italic text-[26px] text-ink leading-none">
            {formatEur(totals.totalTtc)}
          </span>
        </div>
      </div>
    </Card>
  )
}
