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
type MissionType = (typeof MISSION_TYPES)[number]

const dossierSchema = z.object({
  propertyId: z.string().uuid('Bien requis'),
  clientId: z.string().uuid().optional().or(z.literal('')),
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
