import { FileText, Plus } from 'lucide-react'
import Link from 'next/link'
import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { EmptyTabState } from './empty-tab-state'
import { formatDate, formatEur } from './format-helpers'

type Props = {
  clientId: string
  orgId: string
}

const QUOTE_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  sent: 'Envoyé',
  accepted: 'Accepté',
  refused: 'Refusé',
  expired: 'Expiré',
}

const QUOTE_STATUS_VARIANT: Record<
  string,
  'muted' | 'blue' | 'green' | 'orange' | 'red'
> = {
  draft: 'muted',
  sent: 'blue',
  accepted: 'green',
  refused: 'red',
  expired: 'orange',
}

/**
 * Onglet Devis — liste des devis d'un client (récent → ancien).
 */
export async function ClientDevisTab({ clientId, orgId }: Props) {
  const supabase = await createClient()
  const { data: devis } = await supabase
    .from('quotes')
    .select('id, reference, status, amount_ttc, issued_at, expires_at, created_at')
    .eq('organization_id', orgId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100)

  const items = devis ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-sans text-sm font-semibold uppercase tracking-[0.08em] text-ink-mute">
          Devis
        </h2>
        <Button asChild variant="default" size="sm">
          <Link href={`/dashboard/devis/new?client_id=${clientId}`}>
            <Plus className="size-4" />
            Nouveau devis
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyTabState
          icon={FileText}
          title="Aucun devis pour ce client."
          description="Créez un premier devis pour ce client. Vous pourrez ensuite le convertir en facture en un clic."
          action={
            <Button asChild variant="default" size="sm">
              <Link href={`/dashboard/devis/new?client_id=${clientId}`}>
                <Plus className="size-4" />
                Créer un devis
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
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-right font-medium px-4 py-3">Montant TTC</th>
                  <th className="text-left font-medium px-4 py-3">Statut</th>
                  <th className="px-4 py-3" aria-label="actions" />
                </tr>
              </AppListTableHead>
              <tbody>
                {items.map((q) => (
                  <AppListTableRow key={q.id}>
                    <AppListTableCell>
                      <Link
                        href={`/dashboard/devis/${q.id}`}
                        className="font-mono text-[11px] font-semibold text-ink hover:underline"
                      >
                        {q.reference}
                      </Link>
                    </AppListTableCell>
                    <AppListTableCell className="text-ink-mute text-[12px]">
                      {formatDate(q.issued_at ?? q.created_at)}
                    </AppListTableCell>
                    <AppListTableCell className="text-right font-mono text-[13px] tabular-nums text-ink">
                      {formatEur(q.amount_ttc)}
                    </AppListTableCell>
                    <AppListTableCell>
                      <Badge variant={QUOTE_STATUS_VARIANT[q.status] ?? 'muted'}>
                        {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                      </Badge>
                    </AppListTableCell>
                    <AppListTableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/devis/${q.id}`}>Voir</Link>
                      </Button>
                    </AppListTableCell>
                  </AppListTableRow>
                ))}
              </tbody>
            </AppListTable>
          </div>

          {/* Mobile : cards verticales */}
          <ul className="sm:hidden space-y-2">
            {items.map((q) => (
              <li
                key={q.id}
                className="rounded-xl border border-rule/60 bg-paper/85 p-4 shadow-glass-xs"
              >
                <Link href={`/dashboard/devis/${q.id}`} className="block space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] font-semibold text-ink">
                      {q.reference}
                    </span>
                    <Badge variant={QUOTE_STATUS_VARIANT[q.status] ?? 'muted'}>
                      {QUOTE_STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-ink-mute">
                      {formatDate(q.issued_at ?? q.created_at)}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-ink">
                      {formatEur(q.amount_ttc)}
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
