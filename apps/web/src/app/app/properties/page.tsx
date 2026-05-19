import { AppPageHeader } from '@/components/app-page-header'
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

const TYPE_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  autre: 'Autre',
}

export default async function PropertiesPage() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: properties } = await supabase
    .from('properties')
    .select('id, address, city, postal_code, property_type, surface_total, created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const count = properties?.length ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Biens"
        description={`${count} bien${count > 1 ? 's' : ''}`}
        action={
          <Button asChild variant="warm">
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
      ) : (
        <EmptyState
          icon={Building2}
          title="Aucun bien enregistré."
          description="Ajoutez un bien pour mutualiser son historique de diagnostics entre plusieurs clients ou interventions."
          action={
            <Button asChild variant="warm">
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
