import { AppListToolbar } from '@/components/app-list-toolbar'
import { parseListSearchParams } from '@/components/app-list-toolbar-utils'
import { AppPageHeader } from '@/components/app-page-header'
import { InvoiceListRow } from '@/components/invoices/InvoiceListRow'
import { AppListTable, AppListTableHead } from '@/components/ui/app-list-table'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import { INVOICE_STATUS_LABEL, type InvoiceStatus } from '@/lib/invoices/types'
import { ArrowLeft, Receipt } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Historique factures' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

interface FacturesHistoryPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Historique des factures (toutes, plus large que `page.tsx` qui se focalise
 * sur l'urgence). Accessible via le lien « Voir l'historique » de la section
 * Payées. V1 : tableau standard avec filtres statut et recherche par
 * référence.
 */
export default async function FacturesHistoryPage({ searchParams }: FacturesHistoryPageProps) {
  const sp = await searchParams
  const parsed = parseListSearchParams(sp, {
    pageSize: PAGE_SIZE,
    filterKeys: ['status'] as const,
  })
  const statusFilterRaw = parsed.filters.status
  const statusFilterStr = Array.isArray(statusFilterRaw) ? statusFilterRaw[0] : statusFilterRaw
  const statusFilter: InvoiceStatus | null =
    typeof statusFilterStr === 'string' && statusFilterStr in INVOICE_STATUS_LABEL
      ? (statusFilterStr as InvoiceStatus)
      : null

  const { supabase, orgId } = await getCurrentUser()

  let query = supabase
    .from('invoices')
    .select(
      'id, reference, status, amount_ttc, paid_amount, due_date, issued_at, credit_note_for_invoice_id, client_snapshot, client_id',
      { count: 'exact' },
    )
    .eq('organization_id', orgId)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }
  if (parsed.q) {
    const escaped = parsed.q.replace(/[%,]/g, ' ').trim()
    if (escaped.length > 0) {
      query = query.ilike('reference', `%${escaped}%`)
    }
  }

  const { data: invoices, count } = await query
    .order('created_at', { ascending: false })
    .range(parsed.offset, parsed.offset + PAGE_SIZE - 1)

  const clientIds = Array.from(
    new Set(
      (invoices ?? [])
        .filter((i) => !(i as { client_snapshot?: unknown }).client_snapshot && i.client_id)
        .map((i) => i.client_id as string),
    ),
  )
  const clientNames = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, display_name')
      .in('id', clientIds)
    for (const c of clients ?? []) {
      clientNames.set(c.id, c.display_name)
    }
  }

  const rows = (invoices ?? []).map((inv) => {
    const snapshot = inv.client_snapshot as { display_name?: string } | null
    const clientName =
      snapshot?.display_name ??
      (inv.client_id ? (clientNames.get(inv.client_id) ?? 'Client supprimé') : '—')
    return {
      id: inv.id,
      reference: inv.reference,
      status: inv.status as InvoiceStatus,
      amount_ttc: Number(inv.amount_ttc),
      paid_amount: inv.paid_amount === null ? null : Number(inv.paid_amount),
      due_date: inv.due_date,
      issued_at: inv.issued_at,
      client_display_name: clientName,
      is_credit_note: Boolean(inv.credit_note_for_invoice_id),
    }
  })

  const totalCount = count ?? 0
  const statusOptions = (
    ['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]
  ).map((value) => ({ value, label: INVOICE_STATUS_LABEL[value] }))

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-3">
        <Link
          href="/dashboard/factures"
          className="inline-flex items-center gap-2 text-[12px] text-ink-mute hover:text-ink transition-colors"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Retour aux urgences
        </Link>
        <AppPageHeader
          title="Historique"
          accent="factures"
          description="Toutes les factures émises — filtres et recherche disponibles."
        />
      </div>

      <AppListToolbar
        searchPlaceholder="Rechercher une facture (référence FAC-…)…"
        totalCount={totalCount}
        currentPage={parsed.page}
        pageSize={PAGE_SIZE}
        filters={[
          {
            key: 'status',
            label: 'Tous les statuts',
            options: statusOptions,
          },
        ]}
      />

      {rows.length > 0 ? (
        <AppListTable>
          <AppListTableHead>
            <tr>
              <th className="text-left font-medium px-4 py-3">Référence</th>
              <th className="text-left font-medium px-4 py-3">Client</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Émise le</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Échéance</th>
              <th className="text-right font-medium px-4 py-3">TTC</th>
              <th className="text-left font-medium px-4 py-3">Statut</th>
            </tr>
          </AppListTableHead>
          <tbody>
            {rows.map((row) => (
              <InvoiceListRow key={row.id} invoice={row} />
            ))}
          </tbody>
        </AppListTable>
      ) : (
        <EmptyState
          icon={Receipt}
          title="Aucune facture ne correspond à cette recherche."
          description="Affine les filtres ou vide la recherche pour retrouver tes factures."
          action={
            <Button asChild variant="outline">
              <Link href="/dashboard/factures">Retour aux urgences</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
