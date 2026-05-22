import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Euro, FileText } from 'lucide-react'

export interface BillingItem {
  id: string
  kind: 'quote' | 'invoice' | 'payment'
  reference: string
  amountCents: number
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'
  date: string
}

interface BillingSectionProps {
  items: ReadonlyArray<BillingItem>
}

const STATUS_VARIANT: Record<BillingItem['status'], 'muted' | 'blue' | 'green' | 'red' | 'yellow'> = {
  draft: 'muted',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  cancelled: 'muted',
}

const STATUS_LABEL: Record<BillingItem['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  paid: 'Payé',
  overdue: 'En retard',
  cancelled: 'Annulé',
}

function eur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

/**
 * Section 7 — Facturation + paiement.
 * Devis, factures, paiements rattachés au dossier.
 */
export function BillingSection({ items }: BillingSectionProps) {
  const quotes = items.filter((i) => i.kind === 'quote')
  const invoices = items.filter((i) => i.kind === 'invoice')
  const payments = items.filter((i) => i.kind === 'payment')

  const totalInvoiced = invoices.reduce(
    (acc, i) => (i.status !== 'cancelled' ? acc + i.amountCents : acc),
    0,
  )
  const totalPaid = payments.reduce((acc, i) => acc + i.amountCents, 0)
  const outstanding = totalInvoiced - totalPaid

  return (
    <Card variant="flat" padding="default" id="billing" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink">Facturation & paiement</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-faint">Section 07</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Facturé" value={eur(totalInvoiced)} />
        <Stat label="Payé" value={eur(totalPaid)} />
        <Stat label="Solde" value={eur(outstanding)} highlight={outstanding > 0} />
      </div>

      {items.length > 0 ? (
        <ul className="divide-y divide-rule/60 rounded-md border border-rule/60">
          {[...quotes, ...invoices, ...payments].map((it) => (
            <li key={it.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="flex items-center gap-3 min-w-0">
                {it.kind === 'payment' ? (
                  <Euro className="size-4 text-ink-mute shrink-0" />
                ) : (
                  <FileText className="size-4 text-ink-mute shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">{it.reference}</p>
                  <p className="text-[11px] text-ink-faint">
                    {new Date(it.date).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Badge variant={STATUS_VARIANT[it.status]}>{STATUS_LABEL[it.status]}</Badge>
                <p className="font-mono text-[13px] text-ink">{eur(it.amountCents)}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-md border border-dashed border-rule/60 bg-cream-deep/30 p-4 text-center text-[13px] text-ink-mute">
          Aucun devis ou facture pour ce dossier. Le devis peut être généré une fois la mission planifiée.
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" disabled>
          Générer un devis
        </Button>
        <Button variant="outline" size="sm" disabled>
          Émettre la facture
        </Button>
      </div>
    </Card>
  )
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="rounded-md border border-rule/60 bg-cream-deep/30 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-ink-mute">{label}</p>
      <p
        className={`mt-1 font-serif italic text-[24px] leading-none ${highlight ? 'text-warning' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  )
}
