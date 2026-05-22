import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { formatDateShort, formatEur } from './format'
import { DEVIS_STATUS_LABELS, DEVIS_STATUS_VARIANT, type DevisRow } from './types'

interface DevisMobileCardProps {
  row: DevisRow
}

/**
 * Card mobile devis — cliquable, full-width, statut + montant alignés.
 */
export function DevisMobileCard({ row }: DevisMobileCardProps) {
  return (
    <Link href={`/dashboard/devis/${row.id}`} className="block">
      <Card variant="opaque" padding="sm" className="hover:shadow-glass transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] text-ink-mute uppercase tracking-wide">
              {row.reference}
            </p>
            <p className="font-semibold text-[14px] text-ink mt-1 truncate">{row.clientName}</p>
            <p className="text-[12px] text-ink-mute mt-0.5">
              Émis le {formatDateShort(row.issuedAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono tabular-nums text-[14px] font-semibold text-ink">
              {formatEur(row.amountCents)}
            </p>
            <div className="mt-1.5">
              <Badge variant={DEVIS_STATUS_VARIANT[row.status]}>
                {DEVIS_STATUS_LABELS[row.status]}
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
