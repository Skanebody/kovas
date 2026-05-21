import { AppPageHeader } from '@/components/app-page-header'
import { AppListToolbar } from '@/components/app-list-toolbar'
import { parseListSearchParams } from '@/components/app-list-toolbar-utils'
import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Plus, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Clients' }

const TYPE_LABELS = {
  particulier: 'Particulier',
  agence: 'Agence',
  notaire: 'Notaire',
  syndic: 'Syndic',
  entreprise: 'Entreprise',
  collectivite: 'Collectivité',
} as const satisfies Record<string, string>

const CLIENT_TYPE_FILTER_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const PAGE_SIZE = 25

interface ClientsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const sp = await searchParams
  const parsed = parseListSearchParams(sp, {
    pageSize: PAGE_SIZE,
    filterKeys: ['type'] as const,
  })
  type ClientType = keyof typeof TYPE_LABELS
  const typeFilterRaw = parsed.filters.type
  const typeFilterStr = Array.isArray(typeFilterRaw) ? typeFilterRaw[0] : typeFilterRaw
  const typeFilter: ClientType | null =
    typeof typeFilterStr === 'string' && typeFilterStr in TYPE_LABELS
      ? (typeFilterStr as ClientType)
      : null

  const { supabase, orgId } = await getCurrentUser()

  let query = supabase
    .from('clients')
    .select('id, display_name, type, email, phone, created_at', { count: 'exact' })
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (parsed.q) {
    // Escape `%` et `,` pour `.or()` Supabase (limitation PostgREST).
    const escaped = parsed.q.replace(/[%,]/g, ' ').trim()
    if (escaped.length > 0) {
      const pattern = `%${escaped}%`
      query = query.or(
        `display_name.ilike.${pattern},email.ilike.${pattern},phone.ilike.${pattern}`,
      )
    }
  }

  if (typeFilter) {
    query = query.eq('type', typeFilter)
  }

  const { data: clients, count } = await query
    .order('created_at', { ascending: false })
    .range(parsed.offset, parsed.offset + PAGE_SIZE - 1)

  const totalCount = count ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="clients"
        description="Propriétaires, agences, syndics — toute la base contacts."
      />

      <AppListToolbar
        searchPlaceholder="Rechercher un client (nom, email, téléphone)…"
        totalCount={totalCount}
        currentPage={parsed.page}
        pageSize={PAGE_SIZE}
        filters={[
          {
            key: 'type',
            label: 'Tous les types',
            options: CLIENT_TYPE_FILTER_OPTIONS,
          },
        ]}
        primaryAction={
          <Button asChild variant="accent">
            <Link href="/dashboard/clients/new">
              <Plus className="size-4" />
              Nouveau client
            </Link>
          </Button>
        }
      />

      {clients && clients.length > 0 ? (
        <AppListTable>
          <AppListTableHead>
            <tr>
              <th className="text-left font-medium px-4 py-3">Nom</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Type</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Contact</th>
            </tr>
          </AppListTableHead>
          <tbody>
            {clients.map((c) => (
              <AppListTableRow key={c.id}>
                <AppListTableCell>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    {c.display_name}
                  </Link>
                </AppListTableCell>
                <AppListTableCell className="hidden sm:table-cell">
                  <Badge variant="muted">{TYPE_LABELS[c.type] ?? c.type}</Badge>
                </AppListTableCell>
                <AppListTableCell className="hidden md:table-cell text-ink-mute">
                  {c.email ?? c.phone ?? '—'}
                </AppListTableCell>
              </AppListTableRow>
            ))}
          </tbody>
        </AppListTable>
      ) : parsed.q || typeFilter ? (
        <EmptyState
          icon={Users}
          title="Aucun client ne correspond à cette recherche."
          description="Affinez les filtres ou videz la recherche pour retrouver vos clients."
        />
      ) : (
        <EmptyState
          icon={Users}
          title="Aucun client encore."
          description="Créez votre premier client (propriétaire, agence ou syndic) pour pouvoir lui lancer des missions."
          action={
            <Button asChild variant="accent">
              <Link href="/dashboard/clients/new">
                <Plus className="size-4" />
                Créer un client
              </Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
