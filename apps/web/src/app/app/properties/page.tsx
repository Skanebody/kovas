import { AppPageHeader } from '@/components/app-page-header'
import { AppListToolbar } from '@/components/app-list-toolbar'
import { parseListSearchParams } from '@/components/app-list-toolbar-utils'
import {
  AppListTable,
  AppListTableCell,
  AppListTableHead,
  AppListTableRow,
} from '@/components/ui/app-list-table'
import { Building2, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Biens' }

const TYPE_LABELS = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  autre: 'Autre',
} as const satisfies Record<string, string>

const PROPERTY_TYPE_FILTER_OPTIONS = Object.entries(TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const PAGE_SIZE = 25

interface PropertiesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PropertiesPage({ searchParams }: PropertiesPageProps) {
  const sp = await searchParams
  const parsed = parseListSearchParams(sp, {
    pageSize: PAGE_SIZE,
    filterKeys: ['property_type'] as const,
  })
  type PropertyType = keyof typeof TYPE_LABELS
  const typeFilterRaw = parsed.filters.property_type
  const typeFilterStr = Array.isArray(typeFilterRaw) ? typeFilterRaw[0] : typeFilterRaw
  const typeFilter: PropertyType | null =
    typeof typeFilterStr === 'string' && typeFilterStr in TYPE_LABELS
      ? (typeFilterStr as PropertyType)
      : null

  const { supabase, orgId } = await getCurrentUser()

  let query = supabase
    .from('properties')
    .select('id, address, city, postal_code, property_type, surface_total, created_at', {
      count: 'exact',
    })
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (parsed.q) {
    const escaped = parsed.q.replace(/[%,]/g, ' ').trim()
    if (escaped.length > 0) {
      const pattern = `%${escaped}%`
      query = query.or(
        `address.ilike.${pattern},city.ilike.${pattern},postal_code.ilike.${pattern}`,
      )
    }
  }

  if (typeFilter) {
    query = query.eq('property_type', typeFilter)
  }

  const { data: properties, count } = await query
    .order('created_at', { ascending: false })
    .range(parsed.offset, parsed.offset + PAGE_SIZE - 1)

  const totalCount = count ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="biens"
        description="Adresses mutualisées entre missions et clients."
      />

      <AppListToolbar
        searchPlaceholder="Rechercher un bien (adresse, ville, code postal)…"
        totalCount={totalCount}
        currentPage={parsed.page}
        pageSize={PAGE_SIZE}
        filters={[
          {
            key: 'property_type',
            label: 'Tous les types',
            options: PROPERTY_TYPE_FILTER_OPTIONS,
          },
        ]}
        primaryAction={
          <Button asChild variant="accent">
            <Link href="/app/properties/new">
              <Plus className="size-4" />
              Nouveau bien
            </Link>
          </Button>
        }
      />

      {properties && properties.length > 0 ? (
        <AppListTable>
          <AppListTableHead>
            <tr>
              <th className="text-left font-medium px-4 py-3">Adresse</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Type</th>
              <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Surface</th>
            </tr>
          </AppListTableHead>
          <tbody>
            {properties.map((p) => (
              <AppListTableRow key={p.id}>
                <AppListTableCell>
                  <Link
                    href={`/app/properties/${p.id}`}
                    className="font-medium text-ink hover:underline text-[14px]"
                  >
                    {p.address}
                  </Link>
                  {(p.postal_code || p.city) && (
                    <div className="text-[11px] text-ink-mute mt-0.5">
                      {[p.postal_code, p.city].filter(Boolean).join(' ')}
                    </div>
                  )}
                </AppListTableCell>
                <AppListTableCell className="hidden sm:table-cell">
                  {p.property_type ? (
                    <Badge variant="muted">
                      {TYPE_LABELS[p.property_type] ?? p.property_type}
                    </Badge>
                  ) : (
                    <span className="text-ink-mute">—</span>
                  )}
                </AppListTableCell>
                <AppListTableCell className="hidden md:table-cell text-ink-mute">
                  {p.surface_total ? `${p.surface_total} m²` : '—'}
                </AppListTableCell>
              </AppListTableRow>
            ))}
          </tbody>
        </AppListTable>
      ) : parsed.q || typeFilter ? (
        <EmptyState
          icon={Building2}
          title="Aucun bien ne correspond à cette recherche."
          description="Affinez les filtres ou videz la recherche pour retrouver vos biens."
        />
      ) : (
        <EmptyState
          icon={Building2}
          title="Aucun bien enregistré."
          description="Ajoutez un bien pour mutualiser son historique de diagnostics entre plusieurs clients ou interventions."
          action={
            <Button asChild variant="accent">
              <Link href="/app/properties/new">
                <Plus className="size-4" />
                Ajouter un bien
              </Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
