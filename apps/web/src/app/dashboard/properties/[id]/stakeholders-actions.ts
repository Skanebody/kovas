'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const RELATIONSHIP_ROLES = [
  'owner',
  'co_owner',
  'tenant',
  'seller',
  'buyer',
  'property_manager',
  'syndic',
  'notary',
  'agency',
] as const

export type PropertyRelationshipRole = (typeof RELATIONSHIP_ROLES)[number]

export const PROPERTY_ROLE_LABEL: Record<PropertyRelationshipRole, string> = {
  owner: 'Propriétaire',
  co_owner: 'Co-propriétaire (indivision)',
  tenant: 'Locataire',
  seller: 'Vendeur',
  buyer: 'Acheteur',
  property_manager: 'Gestionnaire',
  syndic: 'Syndic',
  notary: 'Notaire',
  agency: 'Agence',
}

const addSchema = z.object({
  propertyId: z.string().uuid(),
  clientId: z.string().uuid(),
  role: z.enum(RELATIONSHIP_ROLES),
  ownershipShare: z.coerce.number().min(0.01).max(100).optional(),
  startedAt: z.string().optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
})

export type AddStakeholderState = { error?: string; success?: boolean } | undefined

/**
 * Chantier C (FIX-KK §C) — Ajoute un nouveau lien client ↔ bien.
 * Active (is_current=true), date début = today si non précisée.
 */
export async function addPropertyStakeholderAction(
  _prev: AddStakeholderState,
  formData: FormData,
): Promise<AddStakeholderState> {
  const parsed = addSchema.safeParse({
    propertyId: formData.get('propertyId'),
    clientId: formData.get('clientId'),
    role: formData.get('role'),
    ownershipShare: formData.get('ownershipShare') || undefined,
    startedAt: formData.get('startedAt') || undefined,
    notes: formData.get('notes') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Champs invalides' }
  }

  const { supabase, orgId } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB post-migration FIX-KK.
  const sb = supabase as any

  // Vérifier que property + client appartiennent à l'organisation
  const [{ data: prop }, { data: client }] = await Promise.all([
    supabase
      .from('properties')
      .select('id')
      .eq('id', parsed.data.propertyId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('clients')
      .select('id')
      .eq('id', parsed.data.clientId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  if (!prop) return { error: 'Bien introuvable' }
  if (!client) return { error: 'Client introuvable' }

  const { error } = await sb.from('property_client_relationships').insert({
    property_id: parsed.data.propertyId,
    client_id: parsed.data.clientId,
    organization_id: orgId,
    role: parsed.data.role,
    is_current: true,
    started_at: parsed.data.startedAt ?? new Date().toISOString().slice(0, 10),
    ownership_share: parsed.data.ownershipShare ?? null,
    notes: parsed.data.notes ? String(parsed.data.notes) : null,
  })

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/properties/${parsed.data.propertyId}`)
  return { success: true }
}

/**
 * Chantier C (FIX-KK §C) — Marque une relation comme historique
 * (ex : ancien propriétaire après revente, ancien locataire après bail).
 */
export async function endPropertyStakeholderAction(
  relationshipId: string,
  endedAt: string,
): Promise<{ error?: string } | undefined> {
  const { supabase, orgId } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB post-migration FIX-KK.
  const sb = supabase as any

  const { data: row, error: fetchErr } = await sb
    .from('property_client_relationships')
    .select('id, property_id')
    .eq('id', relationshipId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!row) return { error: 'Relation introuvable' }

  const { error } = await sb
    .from('property_client_relationships')
    .update({ is_current: false, ended_at: endedAt })
    .eq('id', relationshipId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/properties/${row.property_id}`)
  return undefined
}

const reventeSchema = z.object({
  propertyId: z.string().uuid(),
  newOwnerClientId: z.string().uuid(),
  transactionDate: z.string().min(10),
  transactionAmount: z.coerce.number().min(0).optional(),
  notes: z.string().max(1000).optional().or(z.literal('')),
})

export type DeclareReventeState = { error?: string; success?: boolean } | undefined

/**
 * Chantier D (FIX-KK §D) — Déclare une revente du bien.
 *
 * Effets :
 *  1. Toutes les relations is_current=true avec role='owner' deviennent
 *     historiques (is_current=false, ended_at = transaction_date).
 *  2. Une nouvelle relation owner is_current=true est créée pour le
 *     nouveau propriétaire avec started_at = transaction_date.
 *  3. Une ligne d'audit property_ownership_history est insérée.
 *  4. properties.client_id (legacy) est mis à jour vers le nouveau owner.
 */
export async function declareReventeAction(
  _prev: DeclareReventeState,
  formData: FormData,
): Promise<DeclareReventeState> {
  const parsed = reventeSchema.safeParse({
    propertyId: formData.get('propertyId'),
    newOwnerClientId: formData.get('newOwnerClientId'),
    transactionDate: formData.get('transactionDate'),
    transactionAmount: formData.get('transactionAmount') || undefined,
    notes: formData.get('notes') ?? '',
  })
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Champs invalides' }
  }

  const { supabase, orgId, user } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB post-migration FIX-KK.
  const sb = supabase as any

  // Vérifier que property + nouveau client appartiennent à l'org
  const [{ data: prop }, { data: newOwner }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, client_id')
      .eq('id', parsed.data.propertyId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('clients')
      .select('id, display_name')
      .eq('id', parsed.data.newOwnerClientId)
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .maybeSingle(),
  ])
  if (!prop) return { error: 'Bien introuvable' }
  if (!newOwner) return { error: 'Nouveau propriétaire introuvable' }

  const previousOwnerClientId: string | null = (prop as { client_id: string | null }).client_id

  // 1. Marquer toutes les relations owner actuelles comme historiques
  const { error: endErr } = await sb
    .from('property_client_relationships')
    .update({ is_current: false, ended_at: parsed.data.transactionDate })
    .eq('property_id', parsed.data.propertyId)
    .eq('organization_id', orgId)
    .eq('role', 'owner')
    .eq('is_current', true)
  if (endErr) return { error: endErr.message }

  // 2. Insérer la nouvelle relation owner
  const { error: insertErr } = await sb.from('property_client_relationships').insert({
    property_id: parsed.data.propertyId,
    client_id: parsed.data.newOwnerClientId,
    organization_id: orgId,
    role: 'owner',
    is_current: true,
    started_at: parsed.data.transactionDate,
    notes: parsed.data.notes ? String(parsed.data.notes) : null,
  })
  if (insertErr) return { error: insertErr.message }

  // 3. Ligne d'audit
  const { error: histErr } = await sb.from('property_ownership_history').insert({
    property_id: parsed.data.propertyId,
    organization_id: orgId,
    previous_owner_client_id: previousOwnerClientId,
    new_owner_client_id: parsed.data.newOwnerClientId,
    transaction_date: parsed.data.transactionDate,
    transaction_amount_eur: parsed.data.transactionAmount ?? null,
    notes: parsed.data.notes ? String(parsed.data.notes) : null,
    recorded_by: user.id,
  })
  if (histErr) return { error: histErr.message }

  // 4. Sync legacy properties.client_id
  await supabase
    .from('properties')
    .update({ client_id: parsed.data.newOwnerClientId })
    .eq('id', parsed.data.propertyId)
    .eq('organization_id', orgId)

  revalidatePath(`/dashboard/properties/${parsed.data.propertyId}`)
  revalidatePath('/dashboard/properties')
  return { success: true }
}
