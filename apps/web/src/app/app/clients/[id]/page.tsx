import { ArrowLeft, Building2, Mail, MapPin, Pencil, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppPageHeader } from '@/components/app-page-header'
import { DangerZone } from '@/components/danger-zone'
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
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/clients">
          <ArrowLeft className="size-4" /> Retour aux clients
        </Link>
      </Button>

      <AppPageHeader
        title={client.display_name}
        description={TYPE_LABELS[client.type] ?? client.type}
        action={
          <Button variant="glass" asChild>
            <Link href={`/app/clients/${client.id}/edit`}>
              <Pencil className="size-4" /> Modifier
            </Link>
          </Button>
        }
      />

      {(personName || client.company_name) && (
        <Card variant="opaque" padding="default">
          <CardHeader>
            <CardTitle className="text-base">Identité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {personName ? (
              <p>
                <span className="text-ink-mute">Contact : </span>
                {personName}
              </p>
            ) : null}
            {client.company_name ? (
              <p className="flex items-center gap-2">
                <Building2 className="size-4 text-ink-mute shrink-0" />
                {client.company_name}
              </p>
            ) : null}
            {business && client.siret ? (
              <p>
                <span className="text-ink-mute">SIRET : </span>
                {client.siret}
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Coordonnées</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {client.email ? (
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-ink-mute shrink-0" />
              <a href={`mailto:${client.email}`} className="hover:underline">
                {client.email}
              </a>
            </div>
          ) : null}
          {client.phone ? (
            <div className="flex items-center gap-2">
              <Phone className="size-4 text-ink-mute shrink-0" />
              <a href={`tel:${client.phone}`} className="hover:underline">
                {client.phone}
              </a>
            </div>
          ) : null}
          {!client.email && !client.phone && (
            <p className="text-ink-mute">Aucun email ni téléphone renseigné</p>
          )}
        </CardContent>
      </Card>

      {addressLines.length > 0 ? (
        <Card variant="opaque" padding="default">
          <CardHeader>
            <CardTitle className="text-base">Adresse cabinet (facturation)</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="size-4 text-ink-mute shrink-0 mt-0.5" />
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
        <Card variant="opaque" padding="default">
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
