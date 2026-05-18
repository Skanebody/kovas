import { ArrowLeft, Mail, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'

export const metadata: Metadata = { title: 'Détail client' }

const TYPE_LABELS: Record<string, string> = {
  particulier: 'Particulier',
  agence: 'Agence',
  notaire: 'Notaire',
  syndic: 'Syndic',
  entreprise: 'Entreprise',
  collectivite: 'Collectivité',
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!client) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/clients">
          <ArrowLeft className="size-4" /> Retour aux clients
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{client.display_name}</h1>
          <Badge variant="muted">{TYPE_LABELS[client.type] ?? client.type}</Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {client.email ? (
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" />
              <a href={`mailto:${client.email}`} className="hover:underline">
                {client.email}
              </a>
            </div>
          ) : null}
          {client.phone ? (
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground" />
              <a href={`tel:${client.phone}`} className="hover:underline">
                {client.phone}
              </a>
            </div>
          ) : null}
          {!client.email && !client.phone && (
            <p className="text-muted-foreground">Aucun contact renseigné</p>
          )}
        </CardContent>
      </Card>

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{client.notes}</CardContent>
        </Card>
      )}
    </div>
  )
}
