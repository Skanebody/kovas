'use client'

/**
 * KOVAS — Ligne d'édition d'une prestation dans le wizard devis.
 *
 * Grid responsive :
 *   - 1 col : designation (flex 1)
 *   - 1 col : qté (80px)
 *   - 1 col : PU HT (120px, format texte décimal FR)
 *   - 1 col : TVA % (80px)
 *   - 1 col : actions (suppression)
 *
 * Sur mobile (< sm) on stacke en 2 lignes.
 */

import { Input } from '@/components/ui/input'
import { type QuoteLineItem, formatEur, round2 } from '@/lib/quotes/types'
import { cn } from '@/lib/utils'
import { Trash2 } from 'lucide-react'

interface QuoteLineItemRowProps {
  line: QuoteLineItem
  onChange: (patch: Partial<QuoteLineItem>) => void
  onRemove: () => void
  disabled?: boolean
}

export function QuoteLineItemRow({
  line,
  onChange,
  onRemove,
  disabled = false,
}: QuoteLineItemRowProps) {
  const lineHt = round2(line.quantity * line.unitPriceHt)

  return (
    <li
      className={cn(
        'rounded-lg border border-rule/60 bg-paper p-3',
        'grid grid-cols-1 sm:grid-cols-[1fr_70px_110px_70px_auto] gap-2 items-center',
      )}
    >
      <Input
        aria-label="Désignation"
        value={line.designation}
        onChange={(e) => onChange({ designation: e.target.value })}
        disabled={disabled}
      />
      <Input
        aria-label="Quantité"
        type="number"
        min={1}
        value={line.quantity}
        onChange={(e) =>
          onChange({ quantity: Math.max(1, Number.parseFloat(e.target.value) || 1) })
        }
        disabled={disabled}
      />
      <Input
        aria-label="Prix unitaire HT"
        type="text"
        inputMode="decimal"
        value={line.unitPriceHt}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value.replace(',', '.'))
          onChange({ unitPriceHt: Number.isFinite(v) ? v : 0 })
        }}
        disabled={disabled}
      />
      <Input
        aria-label="TVA %"
        type="text"
        inputMode="decimal"
        value={line.tvaRate}
        onChange={(e) => {
          const v = Number.parseFloat(e.target.value.replace(',', '.'))
          onChange({ tvaRate: Number.isFinite(v) ? v : 0 })
        }}
        disabled={disabled}
      />
      <div className="flex items-center gap-2 sm:gap-3 justify-between sm:justify-end">
        <span className="font-mono text-[12px] text-ink-soft whitespace-nowrap">
          {formatEur(lineHt)}
        </span>
        <button
          type="button"
          aria-label="Supprimer la prestation"
          onClick={onRemove}
          disabled={disabled}
          className="flex size-8 items-center justify-center rounded-full text-ink-mute hover:text-accent-red hover:bg-ink/5 disabled:opacity-40"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  )
}
