'use client'

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { toast } from '@/components/ui/toaster'
import { formatEur } from './format'
import { TARIF_CATEGORY_LABELS, type TarifRow } from './types'

interface TarifsMobileCardProps {
  row: TarifRow
}

export function TarifsMobileCard({ row }: TarifsMobileCardProps) {
  return (
    <button
      type="button"
      onClick={() =>
        toast.info('Édition produit', {
          description: `Modal d'édition pour "${row.name}" — disponible avec la V1.5.`,
        })
      }
      className="block w-full text-left"
    >
      <Card variant="opaque" padding="sm" className="hover:shadow-glass transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[14px] text-ink truncate">{row.name}</p>
            {row.description ? (
              <p className="text-[12px] text-ink-mute mt-0.5 line-clamp-2">{row.description}</p>
            ) : null}
            <div className="mt-2">
              <Badge variant="muted">{TARIF_CATEGORY_LABELS[row.category]}</Badge>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono tabular-nums text-[14px] font-semibold text-ink">
              {formatEur(row.priceCents)}
            </p>
            <p className="text-[11px] text-ink-faint mt-1">{row.usageCount} util.</p>
          </div>
        </div>
      </Card>
    </button>
  )
}
