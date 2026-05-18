'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/current-user'

const PROPERTY_TYPES = ['maison', 'appartement', 'immeuble', 'local_commercial', 'bureau', 'autre'] as const

const propertySchema = z.object({
  address: z.string().min(3, 'Adresse requise').max(255),
  postalCode: z.string().max(10).optional().or(z.literal('')),
  city: z.string().max(120).optional().or(z.literal('')),
  insee: z.string().max(10).optional().or(z.literal('')),
  lng: z.coerce.number().optional(),
  lat: z.coerce.number().optional(),
  propertyType: z.enum(PROPERTY_TYPES).optional(),
  yearBuilt: z.coerce.number().int().min(1000).max(2100).optional(),
  surfaceTotal: z.coerce.number().min(0).max(100000).optional(),
  // Détails appartement/immeuble (visibles conditionnellement selon propertyType)
  apartmentDetail: z.string().max(120).optional().or(z.literal('')),
  buildingLetter: z.string().max(10).optional().or(z.literal('')),
  floorNumber: z.coerce.number().int().min(-5).max(60).optional(),
  lotNumber: z.string().max(20).optional().or(z.literal('')),
  clientId: z.string().uuid().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export type PropertyFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined

export async function createPropertyAction(
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const parsed = propertySchema.safeParse({
    address: formData.get('address'),
    postalCode: formData.get('address_postcode'),
    city: formData.get('address_city'),
    insee: formData.get('address_insee'),
    lng: formData.get('address_lng') || undefined,
    lat: formData.get('address_lat') || undefined,
    propertyType: formData.get('propertyType') || undefined,
    yearBuilt: formData.get('yearBuilt') || undefined,
    surfaceTotal: formData.get('surfaceTotal') || undefined,
    apartmentDetail: formData.get('apartmentDetail'),
    buildingLetter: formData.get('buildingLetter'),
    floorNumber: formData.get('floorNumber') || undefined,
    lotNumber: formData.get('lotNumber'),
    clientId: formData.get('clientId'),
    notes: formData.get('notes'),
  })

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), i.message]),
      ),
    }
  }

  const { supabase, orgId } = await getCurrentUser()

  // location: PostGIS POINT(lng lat) — null si pas de coords
  const location =
    parsed.data.lng && parsed.data.lat
      ? `SRID=4326;POINT(${parsed.data.lng} ${parsed.data.lat})`
      : null

  const { error, data } = await supabase
    .from('properties')
    .insert({
      organization_id: orgId,
      client_id: parsed.data.clientId || null,
      address: parsed.data.address,
      city: parsed.data.city || null,
      postal_code: parsed.data.postalCode || null,
      insee_code: parsed.data.insee || null,
      location,
      property_type: parsed.data.propertyType ?? null,
      year_built: parsed.data.yearBuilt ?? null,
      surface_total: parsed.data.surfaceTotal ?? null,
      apartment_detail: parsed.data.apartmentDetail || null,
      building_letter: parsed.data.buildingLetter || null,
      floor_number: parsed.data.floorNumber ?? null,
      lot_number: parsed.data.lotNumber || null,
      notes: parsed.data.notes || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/app/properties')
  redirect(`/app/properties/${data.id}`)
}
