import { ArrowLeft, Building2, Mail, MapPin, Pencil, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DangerZone } from '@/components/danger-zone'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { formatFullAddress } from '@/lib/format-address'
import { isBusinessClientType } from '@/lib/validation/client'
import { deleteClientAction } from '../actions'

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

  const addressLines = formatFullAddress(client)
  const personName = [client.first_name, client.last_name].filter(Boolean).join(' ')
  const business = isBusinessClientType(client.type)

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
        <Button variant="outline" asChild>
          <Link href={`/app/clients/${client.id}/edit`}>
            <Pencil className="size-4" /> Modifier
          </Link>
        </Button>
      </div>

      {(personName || client.company_name) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {personName ? (
              <p>
                <span className="text-muted-foreground">Contact : </span>
                {personName}
              </p>
            ) : null}
            {client.company_name ? (
              <p className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                {client.company_name}
              </p>
            ) : null}
            {business && client.siret ? (
              <p>
                <span className="text-muted-foreground">SIRET : </span>
                {client.siret}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {client.email ? (
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${client.email}`} className="hover:underline">
                {client.email}
              </a>
            </div>
          ) : null}
          {client.phone ? (
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-muted-foreground shrink-0" />
              <a href={`tel:${client.phone}`} className="hover:underline">
                {client.phone}
              </a>
            </div>
          ) : null}
          {!client.email && !client.phone && (
            <p className="text-muted-foreground">Aucun email ni téléphone renseigné</p>
          )}
        </CardContent>
      </Card>

      {addressLines.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Adresse cabinet (facturation)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {addressLines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {client.notes ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{client.notes}</CardContent>
        </Card>
      ) : null}

      <DangerZone
        entityLabel="client"
        onDelete={deleteClientAction.bind(null, client.id)}
      />
    </div>
  )
}
