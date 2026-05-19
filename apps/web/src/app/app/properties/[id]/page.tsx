import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AppPageHeader } from '@/components/app-page-header'
import { DangerZone } from '@/components/danger-zone'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { softDeletePropertyAction } from '../actions'

export const metadata: Metadata = { title: 'Détail bien' }

const TYPE_LABELS: Record<string, string> = {
  maison: 'Maison',
  appartement: 'Appartement',
  immeuble: 'Immeuble',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  autre: 'Autre',
}

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single()

  if (!property) notFound()

  const aptParts: string[] = []
  if (property.building_letter) aptParts.push(`Bât. ${property.building_letter}`)
  if (property.apartment_detail) aptParts.push(property.apartment_detail)
  if (typeof property.floor_number === 'number') {
    aptParts.push(
      property.floor_number === 0
        ? 'RDC'
        : property.floor_number > 0
          ? `${property.floor_number}e étage`
          : `sous-sol ${Math.abs(property.floor_number)}`,
    )
  }
  if (property.lot_number) aptParts.push(`Lot ${property.lot_number}`)

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/properties">
          <ArrowLeft className="size-4" /> Retour aux biens
        </Link>
      </Button>

      <AppPageHeader
        title="Bien"
        accent={property.address}
        eyebrow={[
          [property.postal_code, property.city].filter(Boolean).join(' '),
          property.surface_total ? `${property.surface_total} m²` : null,
          property.year_built ? `${property.year_built}` : null,
        ].filter(Boolean).join(' · ') || undefined}
        action={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="glass" asChild>
              <Link href={`/app/properties/${property.id}/edit`}>
                <Pencil className="size-4" /> Modifier
              </Link>
            </Button>
            <Button variant="accent" asChild>
              <Link href={`/app/dossiers/new?propertyId=${property.id}`}>
                <Plus className="size-4" /> Nouveau dossier
              </Link>
            </Button>
          </div>
        }
      />

      {(aptParts.length > 0 || property.property_type) && (
        <Card variant="opaque" padding="default" className="flex flex-wrap items-center gap-3 text-[13px]">
          {aptParts.length > 0 ? (
            <span className="font-medium text-ink">{aptParts.join(' · ')}</span>
          ) : null}
          {property.property_type ? (
            <Badge variant="muted">
              {TYPE_LABELS[property.property_type] ?? property.property_type}
            </Badge>
          ) : null}
        </Card>
      )}

      <Card variant="opaque" padding="default">
        <CardHeader>
          <CardTitle className="text-base">Caractéristiques</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <Field label="Année" value={property.year_built?.toString()} />
          <Field label="Surface" value={property.surface_total ? `${property.surface_total} m²` : null} />
          <Field label="Carrez" value={property.surface_carrez ? `${property.surface_carrez} m²` : null} />
          <Field label="Boutin" value={property.surface_boutin ? `${property.surface_boutin} m²` : null} />
          <Field label="Pièces" value={property.rooms_count?.toString()} />
          <Field label="Étages" value={property.floors?.toString()} />
        </CardContent>
      </Card>

      {property.notes ? (
        <Card variant="opaque" padding="default">
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{property.notes}</CardContent>
        </Card>
      ) : null}

      <DangerZone
        entityLabel="bien"
        onDelete={softDeletePropertyAction.bind(null, property.id)}
      />
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] text-ink-mute">{label}</div>
      <div className="font-medium text-ink">{value ?? '—'}</div>
    </div>
  )
}
