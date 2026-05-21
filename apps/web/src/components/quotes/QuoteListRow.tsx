/**
 * KOVAS — Ligne de tableau pour la page liste des devis.
 *
 * Rendu en cell d'un AppListTable (tr direct, pas de Card).
 */

import { AppListTableCell, AppListTableRow } from '@/components/ui/app-list-table'
import { formatDateLong, formatEur } from '@/lib/quotes/types'
import Link from 'next/link'
import { QuoteStatusPill } from './QuoteStatusPill'

export interface QuoteRow {
  id: string
  reference: string
  status: string
  amount_ttc: number
  issued_at: string | null
  expires_at: string | null
  client_display_name: string
}

interface QuoteListRowProps {
  row: QuoteRow
}

export function QuoteListRow({ row }: QuoteListRowProps) {
  return (
    <AppListTableRow>
      <AppListTableCell>
        <Link
          href={`/dashboard/devis/${row.id}`}
          className="font-mono text-[12px] font-semibold text-ink hover:underline"
        >
          {row.reference}
        </Link>
      </AppListTableCell>
      <AppListTableCell className="hidden sm:table-cell">
        <QuoteStatusPill status={row.status} />
      </AppListTableCell>
      <AppListTableCell className="text-ink truncate max-w-[220px]">
        {row.client_display_name}
      </AppListTableCell>
      <AppListTableCell className="hidden md:table-cell text-ink-mute text-[12px]">
        {formatDateLong(row.issued_at)}
      </AppListTableCell>
      <AppListTableCell className="text-right font-mono whitespace-nowrap">
        {formatEur(row.amount_ttc)}
      </AppListTableCell>
    </AppListTableRow>
  )
}
