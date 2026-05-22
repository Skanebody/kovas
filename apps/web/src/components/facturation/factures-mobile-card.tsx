import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status-pill'
import Link from 'next/link'
import {
  daysUntil,
  formatDateShort,
  formatEur,
  paymentDelayLabel,
  paymentDelayVariant,
} from './format'
import { FACTURE_STATUS_LABELS, FACTURE_STATUS_VARIANT, type FactureRow } from './types'

interface FacturesMobileCardProps {
  row: FactureRow
}

export function FacturesMobileCard({ row }: FacturesMobileCardProps) {
  const daysLeft = row.status === 'paid' || row.status === 'cancelled' ? null : daysUntil(row.dueAt)
  const delayVariant = paymentDelayVariant(daysLeft)

  return (
    <Link href={`/dashboard/factures/${row.id}`} className="block">
      <Card variant="opaque" padding="sm" className="hover:shadow-glass transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] text-ink-mute uppercase tracking-wide">
              {row.reference}
            </p>
            <p className="font-semibold text-[14px] text-ink mt-1 truncate">{row.clientName}</p>
            <p className="text-[12px] text-ink-mute mt-0.5">
              Échéance {formatDateShort(row.dueAt)}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-mono tabular-nums text-[14px] font-semibold text-ink">
              {formatEur(row.amountCents)}
            </p>
            <div className="mt-1.5">
              <Badge variant={FACTURE_STATUS_VARIANT[row.status]}>
                {FACTURE_STATUS_LABELS[row.status]}
              </Badge>
            </div>
          </div>
        </div>
        {delayVariant !== 'muted' && daysLeft !== null ? (
          <div className="mt-3">
            <StatusPill
              variant={
                delayVariant === 'green' ? 'green' : delayVariant === 'amber' ? 'amber' : 'coral'
              }
              label={paymentDelayLabel(daysLeft)}
              size="sm"
            />
          </div>
        ) : null}
      </Card>
    </Link>
  )
}
