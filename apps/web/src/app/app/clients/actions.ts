'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  clientFormSchema,
  clientFormValuesToRow,
  parseClientFormData,
} from '@/lib/validation/client'

export type ClientFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined

function zodFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  return Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]))
}

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = clientFormSchema.safeParse(parseClientFormData(formData))

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: zodFieldErrors(parsed.error.issues),
    }
  }

  const { supabase, orgId, user } = await getCurrentUser()
  const row = clientFormValuesToRow(parsed.data)

  const { error, data } = await supabase
    .from('clients')
    .insert({
      organization_id: orgId,
      ...row,
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
  const parsed = clientFormSchema.safeParse(parseClientFormData(formData))

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: zodFieldErrors(parsed.error.issues),
    }
  }

  const { supabase, orgId } = await getCurrentUser()
  const row = clientFormValuesToRow(parsed.data)

  const { error } = await supabase
    .from('clients')
    .update(row)
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
