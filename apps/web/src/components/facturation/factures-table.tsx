import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { StatusPill } from '@/components/ui/status-pill'
import { MoreHorizontal } from 'lucide-react'
import Link from 'next/link'
import {
  daysUntil,
  formatDateShort,
  formatEur,
  paymentDelayLabel,
  paymentDelayVariant,
} from './format'
import { FACTURE_STATUS_LABELS, FACTURE_STATUS_VARIANT, type FactureRow } from './types'

interface FacturesTableProps {
  rows: readonly FactureRow[]
}

/**
 * Tableau desktop liste de factures — colonnes Numéro mono / Client /
 * Montant TTC / Statut paiement / Échéance + délai pastille / Actions.
 *
 * Indicateur visuel délai paiement : vert <15j restants, ambre 15-30j,
 * rouge en retard (cf. `paymentDelayVariant`).
 */
export function FacturesTable({ rows }: FacturesTableProps) {
  return (
    <AppListTable>
      <AppListTableHead>
        <tr>
          <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Numéro</th>
          <th className="text-left font-medium px-4 py-3">Client</th>
          <th className="text-right font-medium px-4 py-3">Montant TTC</th>
          <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Statut</th>
          <th className="text-left font-medium px-4 py-3 hidden lg:table-cell">Échéance</th>
          <th className="text-right font-medium px-4 py-3 w-12" aria-label="Actions" />
        </tr>
      </AppListTableHead>
      <tbody>
        {rows.map((f) => {
          const daysLeft =
            f.status === 'paid' || f.status === 'cancelled' ? null : daysUntil(f.dueAt)
          const delayVariant = paymentDelayVariant(daysLeft)
          return (
            <AppListTableRow key={f.id}>
              <AppListTableCell className="hidden sm:table-cell">
                <Link
                  href={`/dashboard/factures/${f.id}`}
                  className="font-mono text-[11px] font-semibold text-ink hover:underline"
                >
                  {f.reference}
                </Link>
              </AppListTableCell>
              <AppListTableCell>
                <Link
                  href={`/dashboard/factures/${f.id}`}
                  className="text-[13px] text-ink hover:underline"
                >
                  {f.clientName}
                </Link>
                {/* En mobile (<sm), afficher la référence sous le nom du client. */}
                <div className="sm:hidden mt-0.5 font-mono text-[10px] text-ink-mute">
                  {f.reference}
                </div>
              </AppListTableCell>
              <AppListTableCell className="text-right font-mono tabular-nums">
                {formatEur(f.amountCents)}
              </AppListTableCell>
              <AppListTableCell className="hidden md:table-cell">
                <Badge variant={FACTURE_STATUS_VARIANT[f.status]}>
                  {FACTURE_STATUS_LABELS[f.status]}
                </Badge>
              </AppListTableCell>
              <AppListTableCell className="hidden lg:table-cell">
                <div className="flex flex-col gap-1">
                  <span className="text-ink-mute text-[12px]">{formatDateShort(f.dueAt)}</span>
                  {delayVariant !== 'muted' && daysLeft !== null ? (
                    <StatusPill
                      variant={
                        delayVariant === 'green'
                          ? 'green'
                          : delayVariant === 'amber'
                            ? 'amber'
                            : 'coral'
                      }
                      label={paymentDelayLabel(daysLeft)}
                      size="sm"
                    />
                  ) : null}
                </div>
              </AppListTableCell>
              <AppListTableCell className="text-right">
                <button
                  type="button"
                  aria-label={`Actions sur ${f.reference}`}
                  className="inline-flex size-8 items-center justify-center rounded-md text-ink-mute hover:bg-ink/5 hover:text-ink transition-colors"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </AppListTableCell>
            </AppListTableRow>
          )
        })}
      </tbody>
    </AppListTable>
  )
}
