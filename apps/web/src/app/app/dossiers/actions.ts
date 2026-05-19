'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const MISSION_TYPES = [
  'dpe_vente',
  'dpe_location',
  'copropriete',
  'amiante_vente',
  'amiante_avant_travaux',
  'plomb_crep',
  'gaz',
  'electricite',
  'termites',
  'carrez_boutin',
  'erp',
] as const
type MissionType = (typeof MISSION_TYPES)[number]

const dossierSchema = z.object({
  propertyId: z.string().uuid('Bien requis'),
  clientId: z.string().uuid().optional().or(z.literal('')),
  types: z.array(z.enum(MISSION_TYPES)).min(1, 'Sélectionnez au moins un diagnostic'),
  scheduledAt: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

// Quick RDV — autorise propertyId UUID OU adresse BAN inline + client inline
const quickDossierSchema = z.object({
  // Bien : soit propertyId existant, soit adresse BAN
  propertyId: z.string().uuid().optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  addressPostcode: z.string().max(10).optional().or(z.literal('')),
  addressCity: z.string().max(120).optional().or(z.literal('')),
  addressInsee: z.string().max(10).optional().or(z.literal('')),
  addressLng: z.coerce.number().optional(),
  addressLat: z.coerce.number().optional(),
  yearBuilt: z.coerce.number().int().min(1000).max(2100).optional(),
  // Client : soit clientId existant, soit nom/tel/email inline (tous optionnels)
  clientId: z.string().uuid().optional().or(z.literal('')),
  clientName: z.string().max(120).optional().or(z.literal('')),
  clientPhone: z.string().max(30).optional().or(z.literal('')),
  clientEmail: z.string().max(120).optional().or(z.literal('')),
  // Diagnostics + RDV
  types: z.array(z.enum(MISSION_TYPES)).min(1, 'Sélectionnez au moins un diagnostic'),
  scheduledAt: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export type DossierFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined

export async function createDossierAction(
  _prev: DossierFormState,
  formData: FormData,
): Promise<DossierFormState> {
  const types = formData.getAll('types').filter((v): v is string => typeof v === 'string')

  const parsed = dossierSchema.safeParse({
    propertyId: formData.get('propertyId'),
    clientId: formData.get('clientId'),
    types,
    scheduledAt: formData.get('scheduledAt'),
    notes: formData.get('notes'),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), i.message]),
      ),
    }
  }

  const { supabase, orgId, user } = await getCurrentUser()

  // 1. Référence DOS du dossier
  const { data: dossierRef, error: dossierRefErr } = await supabase.rpc('next_reference', {
    p_org: orgId,
    p_kind: 'dossier',
  })
  if (dossierRefErr) return { error: `Référence dossier : ${dossierRefErr.message}` }

  // 2. Insert dossier
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .insert({
      organization_id: orgId,
      property_id: parsed.data.propertyId,
      client_id: parsed.data.clientId || null,
      reference: dossierRef as string,
      scheduled_at: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt).toISOString()
        : null,
      status: parsed.data.scheduledAt ? 'scheduled' : 'draft',
      notes: parsed.data.notes || null,
      created_by: user.id,
      assigned_to: user.id,
    })
    .select('id')
    .single()

  if (dossierErr || !dossier) {
    return { error: `Création dossier : ${dossierErr?.message ?? 'unknown'}` }
  }

  // 3. Crée 1 mission par type sélectionné (chacune avec sa propre référence MIS)
  type MissionStatus =
    | 'draft'
    | 'scheduled'
    | 'in_progress'
    | 'to_review'
    | 'done'
    | 'exported'
    | 'archived'
    | 'cancelled'
  const missionRows: Array<{
    organization_id: string
    dossier_id: string
    reference: string
    type: MissionType
    status: MissionStatus
    created_by: string
    assigned_to: string
  }> = []
  for (const type of parsed.data.types) {
    const { data: missionRef, error: missionRefErr } = await supabase.rpc('next_reference', {
      p_org: orgId,
      p_kind: 'mission',
    })
    if (missionRefErr) {
      await supabase.from('dossiers').delete().eq('id', dossier.id)
      return { error: `Référence mission ${type} : ${missionRefErr.message}` }
    }
    missionRows.push({
      organization_id: orgId,
      dossier_id: dossier.id,
      reference: missionRef as string,
      type,
      status: (parsed.data.scheduledAt ? 'scheduled' : 'draft') as MissionStatus,
      created_by: user.id,
      assigned_to: user.id,
    })
  }

  const { error: missionsErr } = await supabase.from('missions').insert(missionRows)
  if (missionsErr) {
    await supabase.from('dossiers').delete().eq('id', dossier.id)
    return { error: `Création missions : ${missionsErr.message}` }
  }

  revalidatePath('/app/dossiers')
  revalidatePath('/app/dashboard')
  redirect(`/app/dossiers/${dossier.id}`)
}

/**
 * createQuickDossierAction — prise de RDV téléphone optimisée.
 *
 * Crée en cascade (transactionnel logique, rollback sur échec) :
 *  - property minimale si pas de propertyId (adresse BAN obligatoire dans ce cas)
 *  - client minimal si pas de clientId ET au moins un champ client inline rempli
 *  - dossier
 *  - 1 mission par type sélectionné
 *
 * Pensé pour un diagnostiqueur en ligne avec un prospect : 90 secondes chrono.
 */
export async function createQuickDossierAction(
  _prev: DossierFormState,
  formData: FormData,
): Promise<DossierFormState> {
  const types = formData.getAll('types').filter((v): v is string => typeof v === 'string')

  const parsed = quickDossierSchema.safeParse({
    propertyId: formData.get('propertyId'),
    address: formData.get('address'),
    addressPostcode: formData.get('address_postcode'),
    addressCity: formData.get('address_city'),
    addressInsee: formData.get('address_insee'),
    addressLng: formData.get('address_lng') || undefined,
    addressLat: formData.get('address_lat') || undefined,
    yearBuilt: formData.get('yearBuilt') || undefined,
    clientId: formData.get('clientId'),
    clientName: formData.get('clientName'),
    clientPhone: formData.get('clientPhone'),
    clientEmail: formData.get('clientEmail'),
    types,
    scheduledAt: formData.get('scheduledAt'),
    notes: formData.get('notes'),
  })

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path.join('.'), i.message]),
      ),
    }
  }

  const data = parsed.data
  if (!data.propertyId && !data.address) {
    return {
      error: 'Adresse requise (ou sélectionnez un bien existant).',
      fieldErrors: { address: 'Adresse requise' },
    }
  }

  const { supabase, orgId, user } = await getCurrentUser()

  let propertyId = data.propertyId || ''
  let createdPropertyId: string | null = null
  let clientId = data.clientId || ''
  let createdClientId: string | null = null

  // 1. Créer property si nécessaire
  if (!propertyId && data.address) {
    const location =
      data.addressLng && data.addressLat
        ? `SRID=4326;POINT(${data.addressLng} ${data.addressLat})`
        : null

    const { data: propRow, error: propErr } = await supabase
      .from('properties')
      .insert({
        organization_id: orgId,
        address: data.address,
        postal_code: data.addressPostcode || null,
        city: data.addressCity || null,
        insee_code: data.addressInsee || null,
        location,
        year_built: data.yearBuilt ?? null,
      })
      .select('id')
      .single()

    if (propErr || !propRow) {
      return { error: `Création bien : ${propErr?.message ?? 'unknown'}` }
    }
    propertyId = propRow.id
    createdPropertyId = propRow.id
  }

  // 2. Créer client si nécessaire (au moins un champ inline rempli)
  const hasClientInline =
    !clientId && (data.clientName?.trim() || data.clientPhone?.trim() || data.clientEmail?.trim())

  if (hasClientInline) {
    const displayName = (data.clientName || data.clientPhone || data.clientEmail || 'Client').trim()
    const { data: cliRow, error: cliErr } = await supabase
      .from('clients')
      .insert({
        organization_id: orgId,
        type: 'particulier',
        display_name: displayName,
        phone: data.clientPhone || null,
        email: data.clientEmail || null,
      })
      .select('id')
      .single()

    if (cliErr || !cliRow) {
      if (createdPropertyId) {
        await supabase.from('properties').delete().eq('id', createdPropertyId)
      }
      return { error: `Création client : ${cliErr?.message ?? 'unknown'}` }
    }
    clientId = cliRow.id
    createdClientId = cliRow.id
  }

  // 3. Référence DOS
  const { data: dossierRef, error: dossierRefErr } = await supabase.rpc('next_reference', {
    p_org: orgId,
    p_kind: 'dossier',
  })
  if (dossierRefErr) {
    if (createdClientId) await supabase.from('clients').delete().eq('id', createdClientId)
    if (createdPropertyId) await supabase.from('properties').delete().eq('id', createdPropertyId)
    return { error: `Référence dossier : ${dossierRefErr.message}` }
  }

  // 4. Dossier
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .insert({
      organization_id: orgId,
      property_id: propertyId,
      client_id: clientId || null,
      reference: dossierRef as string,
      scheduled_at: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null,
      status: data.scheduledAt ? 'scheduled' : 'draft',
      notes: data.notes || null,
      created_by: user.id,
      assigned_to: user.id,
    })
    .select('id')
    .single()

  if (dossierErr || !dossier) {
    if (createdClientId) await supabase.from('clients').delete().eq('id', createdClientId)
    if (createdPropertyId) await supabase.from('properties').delete().eq('id', createdPropertyId)
    return { error: `Création dossier : ${dossierErr?.message ?? 'unknown'}` }
  }

  // 5. Missions
  type MissionStatus =
    | 'draft'
    | 'scheduled'
    | 'in_progress'
    | 'to_review'
    | 'done'
    | 'exported'
    | 'archived'
    | 'cancelled'
  const missionRows: Array<{
    organization_id: string
    dossier_id: string
    reference: string
    type: MissionType
    status: MissionStatus
    created_by: string
    assigned_to: string
  }> = []
  for (const type of data.types) {
    const { data: missionRef, error: missionRefErr } = await supabase.rpc('next_reference', {
      p_org: orgId,
      p_kind: 'mission',
    })
    if (missionRefErr) {
      await supabase.from('dossiers').delete().eq('id', dossier.id)
      if (createdClientId) await supabase.from('clients').delete().eq('id', createdClientId)
      if (createdPropertyId) await supabase.from('properties').delete().eq('id', createdPropertyId)
      return { error: `Référence mission ${type} : ${missionRefErr.message}` }
    }
    missionRows.push({
      organization_id: orgId,
      dossier_id: dossier.id,
      reference: missionRef as string,
      type,
      status: (data.scheduledAt ? 'scheduled' : 'draft') as MissionStatus,
      created_by: user.id,
      assigned_to: user.id,
    })
  }

  const { error: missionsErr } = await supabase.from('missions').insert(missionRows)
  if (missionsErr) {
    await supabase.from('dossiers').delete().eq('id', dossier.id)
    if (createdClientId) await supabase.from('clients').delete().eq('id', createdClientId)
    if (createdPropertyId) await supabase.from('properties').delete().eq('id', createdPropertyId)
    return { error: `Création missions : ${missionsErr.message}` }
  }

  revalidatePath('/app/dossiers')
  revalidatePath('/app/dashboard')
  revalidatePath('/app/properties')
  revalidatePath('/app/clients')
  redirect(`/app/dossiers/${dossier.id}`)
}

export async function softDeleteDossierAction(dossierId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('dossiers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', dossierId)
    .eq('organization_id', orgId)
  if (error) throw new Error(error.message)
  revalidatePath('/app/dossiers')
  redirect('/app/dossiers')
}
