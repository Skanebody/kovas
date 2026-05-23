import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import { formatDateShort, formatEur } from './format'
import { DEVIS_STATUS_LABELS, DEVIS_STATUS_VARIANT, type DevisRow } from './types'

interface DevisTableProps {
  rows: readonly DevisRow[]
}

/**
 * Tableau desktop liste de devis — colonnes Numéro mono / Client /
 * Montant TTC / Statut / Date / Actions.
 */
export function DevisTable({ rows }: DevisTableProps) {
  return (
    <AppListTable>
      <AppListTableHead>
        <tr>
          <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Numéro</th>
          <th className="text-left font-medium px-4 py-3">Client</th>
          <th className="text-right font-medium px-4 py-3">Montant TTC</th>
          <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Statut</th>
          <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Émission</th>
          <th className="text-right font-medium px-4 py-3 w-12" aria-label="Actions" />
        </tr>
      </AppListTableHead>
      <tbody>
        {rows.map((d) => (
          <AppListTableRow key={d.id}>
            <AppListTableCell className="hidden sm:table-cell">
              <Link
                href={`/dashboard/devis/${d.id}`}
                className="font-mono text-[11px] font-semibold text-ink hover:underline"
              >
                {d.reference}
              </Link>
            </AppListTableCell>
            <AppListTableCell>
              <Link
                href={`/dashboard/devis/${d.id}`}
                className="text-[13px] text-ink hover:underline"
              >
                {d.clientName}
              </Link>
              {/* En mobile (<sm), afficher la référence sous le nom du client. */}
              <div className="sm:hidden mt-0.5 font-mono text-[10px] text-ink-mute">
                {d.reference}
              </div>
            </AppListTableCell>
            <AppListTableCell className="text-right font-mono tabular-nums">
              {formatEur(d.amountCents)}
            </AppListTableCell>
            <AppListTableCell className="hidden md:table-cell">
              <Badge variant={DEVIS_STATUS_VARIANT[d.status]}>
                {DEVIS_STATUS_LABELS[d.status]}
              </Badge>
            </AppListTableCell>
            <AppListTableCell className="hidden lg:table-cell text-ink-mute text-[12px]">
              {formatDateShort(d.issuedAt)}
            </AppListTableCell>
            <AppListTableCell className="text-right">
              <button
                type="button"
                aria-label={`Actions sur ${d.reference}`}
                className="inline-flex size-8 items-center justify-center rounded-md text-ink-mute hover:bg-ink/5 hover:text-ink transition-colors"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </AppListTableCell>
          </AppListTableRow>
        ))}
      </tbody>
    </AppListTable>
  )
}
