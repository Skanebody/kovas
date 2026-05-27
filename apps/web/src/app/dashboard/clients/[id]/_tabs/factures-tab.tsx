import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { Plus, Receipt } from 'lucide-react'
import Link from 'next/link'
import { EmptyTabState } from './empty-tab-state'
import { formatDate, formatEur } from './format-helpers'

type Props = {
  clientId: string
  orgId: string
}

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  partial: 'Partielle',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
}

const INVOICE_STATUS_VARIANT: Record<string, 'muted' | 'blue' | 'green' | 'orange' | 'red'> = {
  draft: 'muted',
  issued: 'blue',
  partial: 'orange',
  paid: 'green',
  overdue: 'red',
  cancelled: 'muted',
}

/**
 * Onglet Factures — liste des factures d'un client + statut paiement.
 */
export async function ClientFacturesTab({ clientId, orgId }: Props) {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select(
      'id, reference, status, amount_ttc, paid_amount, issued_at, due_date, paid_at, created_at',
    )
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100)

  const items = invoices ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink-mute">
          Factures
        </h2>
        <Button asChild variant="accent" size="sm">
          <Link href={`/dashboard/factures/new?client_id=${clientId}`}>
            <Plus className="size-4" />
            Nouvelle facture
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyTabState
          icon={Receipt}
          title="Aucune facture pour ce client."
          description="Émettez une facture (depuis un devis accepté ou directement). Factur-X et suivi de paiement inclus."
          action={
            <Button asChild variant="accent" size="sm">
              <Link href={`/dashboard/factures/new?client_id=${clientId}`}>
                <Plus className="size-4" />
                Créer une facture
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop : table */}
          <div className="hidden sm:block">
            <AppListTable>
              <AppListTableHead>
                <tr>
                  <th className="text-left font-medium px-4 py-3">Référence</th>
                  <th className="text-left font-medium px-4 py-3">Émise le</th>
                  <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Échéance</th>
                  <th className="text-right font-medium px-4 py-3">Montant TTC</th>
                  <th className="text-left font-medium px-4 py-3">Statut</th>
                  <th className="px-4 py-3" aria-label="actions" />
                </tr>
              </AppListTableHead>
              <tbody>
                {items.map((f) => (
                  <AppListTableRow key={f.id}>
                    <AppListTableCell>
                      <Link
                        href={`/dashboard/factures/${f.id}`}
                        className="font-mono text-[11px] font-semibold text-ink hover:underline"
                      >
                        {f.reference}
                      </Link>
                    </AppListTableCell>
                    <AppListTableCell className="text-ink-mute text-[12px]">
                      {formatDate(f.issued_at ?? f.created_at)}
                    </AppListTableCell>
                    <AppListTableCell className="hidden md:table-cell text-ink-mute text-[12px]">
                      {formatDate(f.due_date)}
                    </AppListTableCell>
                    <AppListTableCell className="text-right font-mono text-[13px] tabular-nums text-ink">
                      {formatEur(f.amount_ttc)}
                    </AppListTableCell>
                    <AppListTableCell>
                      <Badge variant={INVOICE_STATUS_VARIANT[f.status] ?? 'muted'}>
                        {INVOICE_STATUS_LABELS[f.status] ?? f.status}
                      </Badge>
                    </AppListTableCell>
                    <AppListTableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/factures/${f.id}`}>Voir</Link>
                      </Button>
                    </AppListTableCell>
                  </AppListTableRow>
                ))}
              </tbody>
            </AppListTable>
          </div>

          {/* Mobile : cards verticales */}
          <ul className="sm:hidden space-y-2">
            {items.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-rule/60 bg-paper/85 p-4 shadow-glass-xs"
              >
                <Link href={`/dashboard/factures/${f.id}`} className="block space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-semibold text-ink">
                      {f.reference}
                    </span>
                    <Badge variant={INVOICE_STATUS_VARIANT[f.status] ?? 'muted'}>
                      {INVOICE_STATUS_LABELS[f.status] ?? f.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-mute">{formatDate(f.issued_at ?? f.created_at)}</span>
                    <span className="font-mono tabular-nums font-semibold text-ink">
                      {formatEur(f.amount_ttc)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
