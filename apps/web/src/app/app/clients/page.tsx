import { Plus, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {clients?.length ?? 0} client{(clients?.length ?? 0) > 1 ? 's' : ''}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/clients/new">
            <Plus className="size-4" />
            Nouveau client
          </Link>
        </Button>
      </div>

      {clients && clients.length > 0 ? (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-4 py-3">Nom</th>
                <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Type</th>
                <th className="text-left font-medium px-4 py-3 hidden md:table-cell">Contact</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/app/clients/${c.id}`} className="font-medium hover:underline">
                      {c.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="muted">{TYPE_LABELS[c.type] ?? c.type}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {c.email ?? c.phone ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 pb-8 text-center space-y-4">
            <Users className="size-10 mx-auto text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="font-semibold">Aucun client pour le moment</h2>
              <p className="text-sm text-muted-foreground">
                Créez votre premier client pour pouvoir lancer une mission.
              </p>
            </div>
            <Button asChild>
              <Link href="/app/clients/new">
                <Plus className="size-4" />
                Créer un client
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
