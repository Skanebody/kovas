import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { EditPropertyForm } from './edit-form'

export const metadata: Metadata = { title: 'Modifier le bien' }

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const [{ data: property }, { data: clients }] = await Promise.all([
    supabase
      .from('properties')
      .select(
        'id, address, postal_code, city, insee_code, property_type, year_built, surface_total, apartment_detail, building_letter, floor_number, lot_number, client_id, notes',
      )
      .eq('id', id)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('display_name'),
  ])

  if (!property) notFound()

  return (
    <div className="max-w-2xl space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/app/properties/${id}`}>
          <ArrowLeft className="size-4" /> Retour au bien
        </Link>
      </Button>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Modifier le bien</h1>
        <p className="text-sm text-muted-foreground">
          {property.address}
          {property.city ? `, ${property.city}` : ''}
        </p>
      </div>

      <EditPropertyForm property={property} clients={clients ?? []} />
    </div>
  )
}
