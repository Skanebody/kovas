import { AppPageHeader } from '@/components/app-page-header'
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

const TYPE_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  agence: 'Agence',
  notaire: 'Notaire',
  syndic: 'Syndic',
  entreprise: 'Entreprise',
  collectivite: 'Collectivité',
}

export default async function ClientsPage() {
  const { supabase, orgId } = await getCurrentUser()

  const { data: clients } = await supabase
    .from('clients')
    .select('id, display_name, type, email, phone, created_at')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const count = clients?.length ?? 0

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Vos"
        accent="clients"
        description={`${count} client${count > 1 ? 's' : ''} · propriétaires, agences, syndics`}
        action={
          <Button asChild variant="accent">
            <Link href="/app/clients/new">
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
                    href={`/app/clients/${c.id}`}
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
      ) : (
        <EmptyState
          icon={Users}
          title="Aucun client encore."
          description="Créez votre premier client (propriétaire, agence ou syndic) pour pouvoir lui lancer des missions."
          action={
            <Button asChild variant="accent">
              <Link href="/app/clients/new">
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
