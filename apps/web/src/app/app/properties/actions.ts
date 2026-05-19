'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const PROPERTY_TYPES = [
  'maison',
  'appartement',
  'immeuble',
  'local_commercial',
  'bureau',
  'autre',
] as const

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

export async function updatePropertyAction(
  propertyId: string,
  _prev: PropertyFormState,
  formData: FormData,
): Promise<PropertyFormState> {
  const parsed = propertySchema.safeParse({
    address: formData.get('address'),
    postalCode: (formData.get('address_postcode') || formData.get('postalCode')) ?? '',
    city: (formData.get('address_city') || formData.get('city')) ?? '',
    insee: formData.get('address_insee') ?? '',
    lng: formData.get('address_lng') || undefined,
    lat: formData.get('address_lat') || undefined,
    propertyType: formData.get('propertyType') || undefined,
    yearBuilt: formData.get('yearBuilt') || undefined,
    surfaceTotal: formData.get('surfaceTotal') || undefined,
    apartmentDetail: formData.get('apartmentDetail') ?? '',
    buildingLetter: formData.get('buildingLetter') ?? '',
    floorNumber: formData.get('floorNumber') || undefined,
    lotNumber: formData.get('lotNumber') ?? '',
    clientId: formData.get('clientId') ?? '',
    notes: formData.get('notes') ?? '',
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

  const location =
    parsed.data.lng && parsed.data.lat
      ? `SRID=4326;POINT(${parsed.data.lng} ${parsed.data.lat})`
      : undefined

  const updates: Record<string, unknown> = {
    address: parsed.data.address,
    city: parsed.data.city || null,
    postal_code: parsed.data.postalCode || null,
    property_type: parsed.data.propertyType ?? null,
    year_built: parsed.data.yearBuilt ?? null,
    surface_total: parsed.data.surfaceTotal ?? null,
    apartment_detail: parsed.data.apartmentDetail || null,
    building_letter: parsed.data.buildingLetter || null,
    floor_number: parsed.data.floorNumber ?? null,
    lot_number: parsed.data.lotNumber || null,
    client_id: parsed.data.clientId || null,
    notes: parsed.data.notes || null,
  }
  if (parsed.data.insee) updates.insee_code = parsed.data.insee
  if (location !== undefined) updates.location = location

  const { error } = await supabase
    .from('properties')
    .update(updates as never)
    .eq('id', propertyId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/app/properties')
  revalidatePath(`/app/properties/${propertyId}`)
  redirect(`/app/properties/${propertyId}`)
}

/**
 * Transfère un bien à un autre propriétaire (ou le dissocie si newClientId
 * est null/vide).
 *
 * Sémantique : `properties.client_id` représente le propriétaire ACTUEL.
 * Pour l'historique d'audit (qui a possédé ce bien à quelle période),
 * voir V1.5 — table `property_transfers` ou colonne `metadata.transfers[]`.
 */
export async function transferPropertyOwnerAction(
  propertyId: string,
  newClientId: string | null,
): Promise<{ error?: string } | undefined> {
  const { supabase, orgId } = await getCurrentUser()

  // Si newClientId fourni, vérifier qu'il appartient à la même organisation
  if (newClientId) {
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id')
      .eq('id', newClientId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .maybeSingle()
    if (clientErr) return { error: clientErr.message }
    if (!client) return { error: 'Client introuvable.' }
  }

  const { error } = await supabase
    .from('properties')
    .update({ client_id: newClientId || null })
    .eq('id', propertyId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  revalidatePath(`/app/properties/${propertyId}`)
  revalidatePath('/app/properties')
  revalidatePath('/app/clients')
  if (newClientId) revalidatePath(`/app/clients/${newClientId}`)
  return undefined
}

export async function softDeletePropertyAction(propertyId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('properties')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', propertyId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath('/app/properties')
  redirect('/app/properties')
}
