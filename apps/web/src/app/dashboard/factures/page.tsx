import { AppPageHeader } from '@/components/app-page-header'
import { AppListToolbar } from '@/components/app-list-toolbar'
import { parseListSearchParams } from '@/components/app-list-toolbar-utils'
import {
  AppListTable,
  AppListTableHead,
} from '@/components/ui/app-list-table'
import { Plus, Receipt } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import { InvoiceListRow } from '@/components/invoices/InvoiceListRow'
import { InvoiceKpiBar } from '@/components/invoices/InvoiceKpiBar'
import {
  INVOICE_STATUS_LABEL,
  type InvoiceStatus,
} from '@/lib/invoices/types'

export const metadata: Metadata = { title: 'Factures' }
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 25

const STATUS_FILTER_OPTIONS = (
  ['draft', 'issued', 'partial', 'paid', 'overdue', 'cancelled'] as InvoiceStatus[]
).map((value) => ({ value, label: INVOICE_STATUS_LABEL[value] }))

interface FacturesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function FacturesPage({ searchParams }: FacturesPageProps) {
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

  // ──────────────────────────────────────────────────────────
  // KPI bar (always full month, ignore filters)
  // ──────────────────────────────────────────────────────────
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const in7daysIso = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const [monthIssuedQ, monthPaidQ, overdueQ, upcomingQ] = await Promise.all([
    supabase
      .from('invoices')
      .select('amount_ht')
      .eq('organization_id', orgId)
      .gte('issued_at', monthStart)
      .neq('status', 'draft'),
    supabase
      .from('invoices')
      .select('paid_amount')
      .eq('organization_id', orgId)
      .gte('paid_at', `${monthStart}T00:00:00Z`)
      .in('status', ['paid', 'partial']),
    supabase
      .from('invoices')
      .select('amount_ttc, paid_amount', { count: 'exact' })
      .eq('organization_id', orgId)
      .in('status', ['issued', 'partial', 'overdue'])
      .lt('due_date', today),
    supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .in('status', ['issued', 'partial'])
      .gte('due_date', today)
      .lte('due_date', in7daysIso),
  ])

  const monthHt = (monthIssuedQ.data ?? []).reduce(
    (acc, row) => acc + Number((row as { amount_ht: number }).amount_ht ?? 0),
    0,
  )
  const monthCollected = (monthPaidQ.data ?? []).reduce(
    (acc, row) => acc + Number((row as { paid_amount: number | null }).paid_amount ?? 0),
    0,
  )
  const overdueRows = overdueQ.data ?? []
  const overdueAmount = overdueRows.reduce(
    (acc, row) =>
      acc +
      (Number((row as { amount_ttc: number }).amount_ttc ?? 0) -
        Number((row as { paid_amount: number | null }).paid_amount ?? 0)),
    0,
  )

  // ──────────────────────────────────────────────────────────
  // List query (status filter + search on reference)
  // ──────────────────────────────────────────────────────────
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

  // Joindre nom client : on prend snapshot si présent, sinon on charge clients
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
      (inv.client_id ? clientNames.get(inv.client_id) ?? 'Client supprimé' : '—')
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

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="factures"
        description="Émettez, suivez et relancez vos factures clients — Factur-X prêt PPF."
      />

      <InvoiceKpiBar
        monthHtEur={monthHt}
        monthCollectedEur={monthCollected}
        overdueCount={overdueRows.length}
        overdueAmountEur={overdueAmount}
        upcomingCount={upcomingQ.count ?? 0}
      />

      <AppListToolbar
        searchPlaceholder="Rechercher une facture (référence FAC-…)…"
        totalCount={totalCount}
        currentPage={parsed.page}
        pageSize={PAGE_SIZE}
        filters={[
          {
            key: 'status',
            label: 'Tous les statuts',
            options: STATUS_FILTER_OPTIONS,
          },
        ]}
        primaryAction={
          <Button asChild variant="accent">
            <Link href="/dashboard/factures/nouveau">
              <Plus className="size-4" />
              Nouvelle facture
            </Link>
          </Button>
        }
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
      ) : parsed.q || statusFilter ? (
        <EmptyState
          icon={Receipt}
          title="Aucune facture ne correspond à cette recherche."
          description="Affinez les filtres ou videz la recherche pour retrouver vos factures."
        />
      ) : (
        <EmptyState
          icon={Receipt}
          title="Aucune facture encore."
          description="Émettez votre première facture en quelques clics — Factur-X généré automatiquement."
          action={
            <Button asChild variant="accent">
              <Link href="/dashboard/factures/nouveau">
                <Plus className="size-4" />
                Créer une facture
              </Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
