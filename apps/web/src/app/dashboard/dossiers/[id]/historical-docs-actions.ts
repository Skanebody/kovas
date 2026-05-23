'use server'

import { randomUUID } from 'node:crypto'
import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const HISTORICAL_DOC_CATEGORIES = [
  'previous_dpe',
  'previous_amiante',
  'plans',
  'energy_bills',
  'notary_acts',
  'historical_photos',
  'other',
] as const

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
])

const uploadSchema = z.object({
  dossierId: z.string().uuid(),
  category: z.enum(HISTORICAL_DOC_CATEGORIES),
  notes: z.string().max(2000).optional().or(z.literal('')),
})

export type HistoricalDocUploadState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | { success: true; documentId: string }
  | undefined

/**
 * Upload d'un document historique sur un dossier.
 *
 * Path bucket : `<organization_id>/<dossier_id>/<uuid>.<ext>`
 * (la RLS Storage filtre par organization_id en première position).
 */
export async function uploadHistoricalDocumentAction(
  _prev: HistoricalDocUploadState,
  formData: FormData,
): Promise<HistoricalDocUploadState> {
  const parsed = uploadSchema.safeParse({
    dossierId: formData.get('dossierId'),
    category: formData.get('category'),
    notes: formData.get('notes') ?? '',
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const err of parsed.error.errors) {
      const key = err.path[0] as string | undefined
      if (key) fieldErrors[key] = err.message
    }
    return { error: 'Champs invalides', fieldErrors }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Fichier requis' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: 'Fichier trop volumineux (50 Mo max)' }
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { error: 'Type de fichier non supporté (PDF, JPG, PNG, WebP, HEIC)' }
  }

  const { supabase, orgId, user } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore regénérés post-migration FIX-KK.
  const sb = supabase as any

  // Vérifier que le dossier appartient à l'organisation
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id')
    .eq('id', parsed.data.dossierId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()
  if (dossierErr) return { error: dossierErr.message }
  if (!dossier) return { error: 'Dossier introuvable' }

  // Détermine l'extension à partir du nom de fichier original
  const lastDot = file.name.lastIndexOf('.')
  const ext = lastDot > 0 ? file.name.slice(lastDot + 1).toLowerCase() : 'bin'
  const docId = randomUUID()
  const storagePath = `${orgId}/${parsed.data.dossierId}/${docId}.${ext}`

  // Upload vers bucket
  const buffer = await file.arrayBuffer()
  const { error: uploadErr } = await supabase.storage
    .from('dossier-documents')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })
  if (uploadErr) return { error: `Upload échoué : ${uploadErr.message}` }

  // Insert metadata row
  const willTriggerAi =
    parsed.data.category === 'previous_dpe' || parsed.data.category === 'previous_amiante'

  const { data: row, error: insertErr } = await sb
    .from('dossier_historical_documents')
    .insert({
      dossier_id: parsed.data.dossierId,
      organization_id: orgId,
      category: parsed.data.category,
      storage_path: storagePath,
      original_filename: file.name,
      file_size_bytes: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
      notes: parsed.data.notes ? String(parsed.data.notes) : null,
      ai_extraction_status: willTriggerAi ? 'pending' : 'skipped',
    })
    .select('id')
    .single()

  if (insertErr) {
    // Rollback : supprimer le fichier uploadé
    await supabase.storage.from('dossier-documents').remove([storagePath])
    return { error: insertErr.message }
  }

  // V1 : l'extraction IA Vision sera déclenchée par un cron / job worker
  // séparé (voir packages/ai/dpe-vision-extract.ts à venir). On laisse
  // simplement le statut 'pending' pour signaler qu'il y a une extraction
  // à faire.

  revalidatePath(`/dashboard/dossiers/${parsed.data.dossierId}`)
  return { success: true, documentId: row.id }
}

export async function deleteHistoricalDocumentAction(
  documentId: string,
): Promise<{ error?: string } | undefined> {
  const { supabase, orgId } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore regénérés post-migration FIX-KK.
  const sb = supabase as any

  // Charge la ligne pour récupérer le storage_path et le dossier_id
  const { data: doc, error: fetchErr } = await sb
    .from('dossier_historical_documents')
    .select('id, storage_path, dossier_id, organization_id')
    .eq('id', documentId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!doc) return { error: 'Document introuvable' }

  // Supprime le fichier du bucket
  await supabase.storage.from('dossier-documents').remove([doc.storage_path])

  // Supprime la ligne (CASCADE depuis dossier_id pas nécessaire ici)
  const { error: deleteErr } = await sb
    .from('dossier_historical_documents')
    .delete()
    .eq('id', documentId)
    .eq('organization_id', orgId)

  if (deleteErr) return { error: deleteErr.message }

  revalidatePath(`/dashboard/dossiers/${doc.dossier_id}`)
  return undefined
}
