'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/current-user'

const CLIENT_TYPES = ['particulier', 'agence', 'notaire', 'syndic', 'entreprise', 'collectivite'] as const

const clientSchema = z.object({
  type: z.enum(CLIENT_TYPES),
  displayName: z.string().min(2).max(120),
  firstName: z.string().max(80).optional().or(z.literal('')),
  lastName: z.string().max(80).optional().or(z.literal('')),
  companyName: z.string().max(120).optional().or(z.literal('')),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().max(30).optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export type ClientFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  ) as Partial<T>
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = clientSchema.safeParse({
    type: formData.get('type'),
    displayName: formData.get('displayName'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    companyName: formData.get('companyName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
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

  const { supabase, orgId, user } = await getCurrentUser()
  const cleaned = clean(parsed.data)
  const { error, data } = await supabase
    .from('clients')
    .insert({
      organization_id: orgId,
      type: parsed.data.type,
      display_name: parsed.data.displayName,
      first_name: cleaned.firstName ?? null,
      last_name: cleaned.lastName ?? null,
      company_name: cleaned.companyName ?? null,
      email: cleaned.email ?? null,
      phone: cleaned.phone ?? null,
      notes: cleaned.notes ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/app/clients')
  redirect(`/app/clients/${data.id}`)
}

export async function updateClientAction(
  clientId: string,
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = clientSchema.safeParse({
    type: formData.get('type'),
    displayName: formData.get('displayName'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    companyName: formData.get('companyName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
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

  const { error } = await supabase
    .from('clients')
    .update({
      type: parsed.data.type,
      display_name: parsed.data.displayName,
      first_name: parsed.data.firstName || null,
      last_name: parsed.data.lastName || null,
      company_name: parsed.data.companyName || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      notes: parsed.data.notes || null,
    })
    .eq('id', clientId)
    .eq('organization_id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/app/clients')
  revalidatePath(`/app/clients/${clientId}`)
  redirect(`/app/clients/${clientId}`)
}

export async function deleteClientAction(clientId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('clients')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', clientId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)
  revalidatePath('/app/clients')
  redirect('/app/clients')
}
