import { AppListTableCell, AppListTableRow } from '@/components/ui/app-list-table'
import type { InvoiceStatus } from '@/lib/invoices/types'
import Link from 'next/link'
import { InvoiceStatusPill } from './InvoiceStatusPill'

export interface InvoiceListRowData {
  id: string
  reference: string
  status: InvoiceStatus
  amount_ttc: number
  paid_amount: number | null
  due_date: string | null
  issued_at: string | null
  client_display_name: string
  is_credit_note: boolean
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
  }).format(d)
}

export interface InvoiceListRowProps {
  invoice: InvoiceListRowData
}

/**
 * Ligne du tableau facture (`AppListTable` parent).
 * Tap target plein : la première cellule (référence) est un Link cliquable.
 */
export function InvoiceListRow({ invoice }: InvoiceListRowProps) {
  return (
    <AppListTableRow key={invoice.id}>
      <AppListTableCell>
        <Link
          href={`/dashboard/factures/${invoice.id}`}
          className="font-mono text-[12px] text-ink hover:underline font-semibold"
        >
          {invoice.reference}
        </Link>
        {invoice.is_credit_note ? (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-ink-mute font-mono">
            Avoir
          </span>
        ) : null}
      </AppListTableCell>
      <AppListTableCell className="text-ink">{invoice.client_display_name}</AppListTableCell>
      <AppListTableCell className="hidden md:table-cell text-ink-mute whitespace-nowrap">
        {formatDateShort(invoice.issued_at)}
      </AppListTableCell>
      <AppListTableCell className="hidden md:table-cell text-ink-mute whitespace-nowrap">
        {formatDateShort(invoice.due_date)}
      </AppListTableCell>
      <AppListTableCell className="text-right tabular-nums font-medium text-ink whitespace-nowrap">
        {formatEur(invoice.amount_ttc)}
      </AppListTableCell>
      <AppListTableCell>
        <InvoiceStatusPill status={invoice.status} />
      </AppListTableCell>
    </AppListTableRow>
  )
}
