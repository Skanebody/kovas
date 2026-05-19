import { AppPageHeader } from '@/components/app-page-header'
import { DangerZone } from '@/components/danger-zone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { formatFullAddress } from '@/lib/format-address'
import { isBusinessClientType } from '@/lib/validation/client'
import { ArrowLeft, Building2, Home, Mail, MapPin, Pencil, Phone, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
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

  // Count dossiers historiques pour badge "Fidèle" (wireframe v4 §6.1)
  // Mission n'a pas de client_id direct — relation via dossier
  const [{ count: dossiersCount }, { data: ownedProperties }] = await Promise.all([
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('client_id', id),
    // Logements actuellement détenus par ce client (propriétaire)
    // CLAUDE.md §3 — un propriétaire peut avoir plusieurs logements
    supabase
      .from('properties')
      .select('id, address, postal_code, city, year_built, surface_total, property_type')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
  ])

  const missionsCount = dossiersCount ?? 0
  const fidele = missionsCount >= 5

  const addressLines = formatFullAddress(client)
  const personName = [client.first_name, client.last_name].filter(Boolean).join(' ')
  const business = isBusinessClientType(client.type)
  const typeLabel = TYPE_LABELS[client.type] ?? client.type

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/clients">
          <ArrowLeft className="size-4" /> Retour aux clients
        </Link>
      </Button>

      <AppPageHeader
        title="Client"
        accent={client.display_name}
        eyebrow={`${typeLabel}${missionsCount ? ` · ${missionsCount} dossier${missionsCount > 1 ? 's' : ''}` : ''}`}
        action={
          <div className="flex items-center gap-2">
            {fidele && (
              <span className="inline-flex items-center gap-1 rounded-pill bg-accent-warm-soft text-accent-warm px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                Fidèle
              </span>
            )}
            <Button variant="glass" asChild>
              <Link href={`/app/clients/${client.id}/edit`}>
                <Pencil className="size-4" /> Modifier
              </Link>
            </Button>
          </div>
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

      {/* LOGEMENTS DU PROPRIÉTAIRE — un propriétaire peut avoir plusieurs biens.
          Le client_id sur properties.client_id reflète le propriétaire actuel ;
          un transfert (changement de propriétaire) se fait depuis la fiche bien. */}
      <Card variant="opaque" padding="default">
        <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Home className="size-4 text-ink-mute" /> Logements détenus
            <span className="text-xs font-normal text-ink-mute">
              ({ownedProperties?.length ?? 0})
            </span>
          </CardTitle>
          <Button variant="glass" size="sm" asChild>
            <Link href={`/app/properties/new?clientId=${id}`}>
              <Plus className="size-4" /> Ajouter un logement
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {!ownedProperties || ownedProperties.length === 0 ? (
            <p className="text-sm text-ink-mute italic">
              Aucun logement rattaché. Cliquez « Ajouter un logement » pour en créer un — ou
              transférez un bien existant depuis la fiche du logement.
            </p>
          ) : (
            <ul className="divide-y divide-rule/60">
              {ownedProperties.map((p) => {
                const address = [p.address, p.postal_code, p.city].filter(Boolean).join(', ')
                return (
                  <li key={p.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link href={`/app/properties/${p.id}`} className="flex items-start gap-3 group">
                      <MapPin className="size-4 mt-0.5 text-ink-mute shrink-0" />
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-ink group-hover:underline truncate">
                          {address || 'Adresse non renseignée'}
                        </p>
                        <p className="text-[11px] text-ink-mute">
                          {[
                            p.property_type,
                            p.year_built ? `${p.year_built}` : null,
                            p.surface_total ? `${p.surface_total} m²` : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {client.notes ? (
        <Card variant="opaque" padding="default">
          <CardHeader>
            <CardTitle className="text-base">Notes internes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{client.notes}</CardContent>
        </Card>
      ) : null}

      <DangerZone entityLabel="client" onDelete={deleteClientAction.bind(null, client.id)} />
    </div>
  )
}
