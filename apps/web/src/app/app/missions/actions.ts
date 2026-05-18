'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/current-user'

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

const missionSchema = z.object({
  propertyId: z.string().uuid('Bien requis'),
  clientId: z.string().uuid().optional().or(z.literal('')),
  type: z.enum(MISSION_TYPES),
  scheduledAt: z.string().optional().or(z.literal('')),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export type MissionFormState = { error?: string; fieldErrors?: Record<string, string> } | undefined

export async function createMissionAction(
  _prev: MissionFormState,
  formData: FormData,
): Promise<MissionFormState> {
  const parsed = missionSchema.safeParse({
    propertyId: formData.get('propertyId'),
    clientId: formData.get('clientId'),
    type: formData.get('type'),
    scheduledAt: formData.get('scheduledAt'),
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

  // Génère la référence MIS-YYYY-NNNNN via la fonction PG
  const { data: refData, error: refError } = await supabase.rpc('next_reference', {
    p_org: orgId,
    p_kind: 'mission',
  })

  if (refError) return { error: `Référence : ${refError.message}` }

  const { data, error } = await supabase
    .from('missions')
    .insert({
      organization_id: orgId,
      property_id: parsed.data.propertyId,
      client_id: parsed.data.clientId || null,
      type: parsed.data.type,
      status: parsed.data.scheduledAt ? 'scheduled' : 'draft',
      reference: refData as string,
      scheduled_at: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt).toISOString()
        : null,
      notes: parsed.data.notes || null,
      created_by: user.id,
      assigned_to: user.id,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }

  revalidatePath('/app/missions')
  revalidatePath('/app/dashboard')
  redirect(`/app/missions/${data.id}`)
}
