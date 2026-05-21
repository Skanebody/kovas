import { Badge } from '@/components/ui/badge'
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from '@/lib/invoices/types'

/**
 * Pillule statut facture — mapping DS v5 :
 *   draft     → muted
 *   issued    → blue
 *   partial   → amber
 *   paid      → green (chartreuse côté affirmé)
 *   overdue   → red
 *   cancelled → muted (avec strikethrough texte)
 *
 * Note : le statut 'paid' utilise volontairement la variante `green` (lime-mist
 * existante) plutôt que chartreuse pour conserver la sobriété sur les listes —
 * la chartreuse est réservée aux CTA / KPIs hero (DS v5 strict).
 */

type StatusVariant = 'muted' | 'blue' | 'amber' | 'green' | 'red'

const STATUS_VARIANT: Record<InvoiceStatus, StatusVariant> = {
  draft: 'muted',
  issued: 'blue',
  partial: 'amber',
  paid: 'green',
  overdue: 'red',
  cancelled: 'muted',
}

export interface InvoiceStatusPillProps {
  status: InvoiceStatus
  className?: string
}

export function InvoiceStatusPill({ status, className }: InvoiceStatusPillProps) {
  const variant = STATUS_VARIANT[status]
  const label = INVOICE_STATUS_LABEL[status]
  // Pour cancelled : on garde la variante muted mais on ajoute une nuance
  // visuelle (strikethrough) pour signifier "annulé".
  if (status === 'cancelled') {
    return (
      <Badge variant="red" className={className}>
        <span className="line-through opacity-80">Annulée</span>
      </Badge>
    )
  }
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  )
}
