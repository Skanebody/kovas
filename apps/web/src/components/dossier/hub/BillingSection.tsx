import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Euro, FileText, Plus } from 'lucide-react'
import Link from 'next/link'

export interface BillingItem {
  id: string
  kind: 'quote' | 'invoice' | 'payment'
  reference: string
  amountCents: number
  status:
    | 'draft'
    | 'sent'
    | 'accepted'
    | 'refused'
    | 'expired'
    | 'paid'
    | 'overdue'
    | 'partial'
    | 'issued'
    | 'cancelled'
  date: string
}

interface BillingSectionProps {
  items: ReadonlyArray<BillingItem>
  dossierId: string
  clientId: string | null
  propertyId: string | null
}

const STATUS_VARIANT: Record<
  BillingItem['status'],
  'muted' | 'blue' | 'green' | 'red' | 'yellow' | 'orange'
> = {
  draft: 'muted',
  sent: 'blue',
  accepted: 'green',
  refused: 'red',
  expired: 'muted',
  paid: 'green',
  overdue: 'red',
  partial: 'yellow',
  issued: 'blue',
  cancelled: 'muted',
}

const STATUS_LABEL: Record<BillingItem['status'], string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
  paid: 'Payée',
  overdue: 'En retard',
  partial: 'Partielle',
  issued: 'Émise',
  cancelled: 'Annulée',
}

function eur(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

/**
 * Section 7 — Documents commerciaux (devis, factures) rattachés au dossier.
 *
 * Chantier A (FIX-KK §A) : permet d'afficher les devis/factures liés via
 * `quotes.dossier_id` / `invoices.dossier_id` + boutons de création pré-remplie.
 */
export function BillingSection({ items, dossierId, clientId, propertyId }: BillingSectionProps) {
  const quotes = items.filter((i) => i.kind === 'quote')
  const invoices = items.filter((i) => i.kind === 'invoice')

  const totalInvoicedCents = invoices.reduce(
    (acc, i) => (i.status !== 'cancelled' ? acc + i.amountCents : acc),
    0,
  )
  const totalPaidCents = invoices.reduce(
    (acc, i) => (i.status === 'paid' ? acc + i.amountCents : acc),
    0,
  )
  const outstanding = totalInvoicedCents - totalPaidCents

  // Query string pour pré-remplir les wizards
  const qs = new URLSearchParams()
  qs.set('dossierId', dossierId)
  if (clientId) qs.set('clientId', clientId)
  if (propertyId) qs.set('propertyId', propertyId)
  const newQuoteHref = `/dashboard/devis/nouveau?${qs.toString()}`
  const newInvoiceHref = `/dashboard/factures/nouveau?${qs.toString()}`

  return (
    <Card variant="flat" padding="default" id="billing" className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[#0F1419]">Documents commerciaux</h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/55">
          Section 07
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Facturé" value={eur(totalInvoicedCents)} />
        <Stat label="Encaissé" value={eur(totalPaidCents)} />
        <Stat label="Solde" value={eur(outstanding)} highlight={outstanding > 0} />
      </div>

      {/* Devis */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
            Devis · {quotes.length}
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link href={newQuoteHref}>
              <Plus className="size-3.5" />
              Nouveau devis
            </Link>
          </Button>
        </div>
        {quotes.length > 0 ? (
          <ul className="divide-y divide-[#0F1419]/[0.08] rounded-md border border-[#0F1419]/[0.08]">
            {quotes.map((q) => (
              <BillingRow key={q.id} item={q} detailHref={`/dashboard/devis/${q.id}`} />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-[#0F1419]/[0.08] bg-cream-deep/30 px-3 py-3 text-[12px] text-[#0F1419]/72">
            Aucun devis pour ce dossier.
          </p>
        )}
      </div>

      {/* Factures */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">
            Factures · {invoices.length}
          </p>
          <Button variant="ghost" size="sm" asChild>
            <Link href={newInvoiceHref}>
              <Plus className="size-3.5" />
              Nouvelle facture
            </Link>
          </Button>
        </div>
        {invoices.length > 0 ? (
          <ul className="divide-y divide-[#0F1419]/[0.08] rounded-md border border-[#0F1419]/[0.08]">
            {invoices.map((inv) => (
              <BillingRow key={inv.id} item={inv} detailHref={`/dashboard/factures/${inv.id}`} />
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-[#0F1419]/[0.08] bg-cream-deep/30 px-3 py-3 text-[12px] text-[#0F1419]/72">
            Aucune facture pour ce dossier.
          </p>
        )}
      </div>
    </Card>
  )
}

function BillingRow({ item, detailHref }: { item: BillingItem; detailHref: string }) {
  return (
    <li>
      <Link
        href={detailHref}
        className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-foreground/[0.03]"
      >
        <div className="flex items-center gap-3 min-w-0">
          {item.kind === 'payment' ? (
            <Euro className="size-4 text-[#0F1419]/72 shrink-0" />
          ) : (
            <FileText className="size-4 text-[#0F1419]/72 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#0F1419] truncate">{item.reference}</p>
            <p className="text-[11px] text-[#0F1419]/55">
              {new Date(item.date).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_LABEL[item.status]}</Badge>
          <p className="font-mono text-[13px] text-[#0F1419]">{eur(item.amountCents)}</p>
        </div>
      </Link>
    </li>
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
    <div className="rounded-md border border-[#0F1419]/[0.08] bg-cream-deep/30 p-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-[#0F1419]/72">{label}</p>
      <p
        className={`mt-1 font-serif italic text-[24px] leading-none ${highlight ? 'text-warning' : 'text-[#0F1419]'}`}
      >
        {value}
      </p>
    </div>
  )
}
