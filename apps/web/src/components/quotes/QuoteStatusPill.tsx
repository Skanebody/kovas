import { Badge } from '@/components/ui/badge'
import type { QuoteStatus } from '@/lib/quotes/types'

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
}

const STATUS_VARIANT: Record<QuoteStatus, 'muted' | 'blue' | 'green' | 'red' | 'amber'> = {
  draft: 'muted',
  sent: 'blue',
  accepted: 'green',
  refused: 'red',
  expired: 'amber',
}

interface QuoteStatusPillProps {
  status: string
}

/**
 * Badge couleur cohérent pour un statut de devis.
 * Tolérant : statut inconnu → variant muted + label brut.
 */
export function QuoteStatusPill({ status }: QuoteStatusPillProps) {
  const s = status as QuoteStatus
  const label = STATUS_LABEL[s] ?? status
  const variant = STATUS_VARIANT[s] ?? 'muted'
  return <Badge variant={variant}>{label}</Badge>
}
