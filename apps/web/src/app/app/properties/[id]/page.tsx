import { ArrowLeft, MapPin, Pencil, Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
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

  return (
    <div className="max-w-3xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/properties">
          <ArrowLeft className="size-4" /> Retour aux biens
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">{property.address}</h1>
          {(() => {
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
            return aptParts.length > 0 ? (
              <p className="text-sm font-medium">{aptParts.join(' · ')}</p>
            ) : null
          })()}
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <MapPin className="size-4" />
            {[property.postal_code, property.city].filter(Boolean).join(' ') || 'Localisation non précisée'}
          </p>
          {property.property_type && (
            <Badge variant="muted">{TYPE_LABELS[property.property_type] ?? property.property_type}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" asChild>
            <Link href={`/app/properties/${property.id}/edit`}>
              <Pencil className="size-4" /> Modifier
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/app/dossiers/new?propertyId=${property.id}`}>
              <Plus className="size-4" /> Nouveau dossier
            </Link>
          </Button>
        </div>
      </div>

      <Card>
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

      {property.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{property.notes}</CardContent>
        </Card>
      )}

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
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? '—'}</div>
    </div>
  )
}
