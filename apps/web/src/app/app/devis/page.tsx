import { AppListToolbar } from '@/components/app-list-toolbar'
import { parseListSearchParams } from '@/components/app-list-toolbar-utils'
import { AppPageHeader } from '@/components/app-page-header'
import { QuoteListRow, type QuoteRow } from '@/components/quotes/QuoteListRow'
import {
  AppListTable,
  AppListTableHead,
} from '@/components/ui/app-list-table'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import { FileText, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Devis' }

const STATUS_FILTER_OPTIONS = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'sent', label: 'Envoyé' },
  { value: 'accepted', label: 'Accepté' },
  { value: 'refused', label: 'Refusé' },
  { value: 'expired', label: 'Expiré' },
]

const PAGE_SIZE = 25

interface QuotesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

interface QuoteDbRow {
  id: string
  reference: string
  status: string
  amount_ttc: number
  issued_at: string | null
  expires_at: string | null
  client_id: string
  client_snapshot: { displayName?: string } | null
  clients: { display_name: string | null } | null
}

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const sp = await searchParams
  const parsed = parseListSearchParams(sp, {
    pageSize: PAGE_SIZE,
    filterKeys: ['status'] as const,
  })
  const statusFilterRaw = parsed.filters.status
  const statusFilter = Array.isArray(statusFilterRaw) ? statusFilterRaw[0] : statusFilterRaw

  const { supabase, orgId } = await getCurrentUser()

  let query = supabase
    .from('quotes')
    .select(
      'id, reference, status, amount_ttc, issued_at, expires_at, client_id, client_snapshot, clients(display_name)',
      { count: 'exact' },
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (statusFilter && STATUS_FILTER_OPTIONS.some((o) => o.value === statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  if (parsed.q) {
    const escaped = parsed.q.replace(/[%,]/g, ' ').trim()
    if (escaped.length > 0) {
      const pattern = `%${escaped}%`
      query = query.ilike('reference', pattern)
    }
  }

  const { data, count } = await query
    .order('created_at', { ascending: false })
    .range(parsed.offset, parsed.offset + PAGE_SIZE - 1)

  const quotes = ((data ?? []) as unknown as QuoteDbRow[]).map<QuoteRow>((q) => ({
    id: q.id,
    reference: q.reference,
    status: q.status,
    amount_ttc: Number(q.amount_ttc),
    issued_at: q.issued_at,
    expires_at: q.expires_at,
    client_display_name:
      q.clients?.display_name ?? q.client_snapshot?.displayName ?? 'Client retiré',
  }))

  const totalCount = count ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="devis"
        description="Brouillons, envoyés, acceptés — toute la facturation amont au même endroit."
      />

      <AppListToolbar
        searchPlaceholder="Rechercher une référence (DEV-2026-…)…"
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
            <Link href="/app/devis/nouveau">
              <Plus className="size-4" />
              Nouveau devis
            </Link>
          </Button>
        }
      />

      {quotes.length > 0 ? (
        <AppListTable>
          <AppListTableHead>
            <tr>
              <th className="text-left font-medium px-4 py-3">Référence</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Statut</th>
              <th className="text-left font-medium px-4 py-3">Client</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">
                Date d&apos;émission
              </th>
              <th className="text-right font-medium px-4 py-3">Montant TTC</th>
            </tr>
          </AppListTableHead>
          <tbody>
            {quotes.map((q) => (
              <QuoteListRow key={q.id} row={q} />
            ))}
          </tbody>
        </AppListTable>
      ) : parsed.q || statusFilter ? (
        <EmptyState
          icon={FileText}
          title="Aucun devis ne correspond à cette recherche."
          description="Affinez les filtres ou videz la recherche pour retrouver vos devis."
        />
      ) : (
        <EmptyState
          icon={FileText}
          title="Aucun devis encore."
          description="Créez votre premier devis pour démarrer la mission avec un cadre tarifaire clair pour le client."
          action={
            <Button asChild variant="accent">
              <Link href="/app/devis/nouveau">
                <Plus className="size-4" />
                Créer un devis
              </Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
