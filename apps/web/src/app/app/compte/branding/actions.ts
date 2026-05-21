'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  BRANDING_ALLOWED_MIME_TYPES,
  BRANDING_BUCKET,
  BRANDING_MAX_BYTES,
  brandingMimeToExt,
  type BrandingMime,
} from '@/lib/branding/get-organization-branding'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type FormState = { error?: string; success?: boolean } | undefined

// ============================================
// Upload logo cabinet
// ============================================

/**
 * Upload un nouveau logo cabinet. Validations :
 *   - taille ≤ 2 Mo
 *   - mime ∈ {image/png, image/svg+xml, image/jpeg}
 *   - 1 seul logo par org (upsert : overwrite si déjà présent)
 *
 * Path Storage : `<orgId>/logo.<ext>` (cf. migration 20260527100000).
 * Met à jour `organizations.logo_url + logo_mime + brand_updated_at`.
 */
export async function uploadLogoAction(formData: FormData): Promise<FormState> {
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return { error: 'Fichier manquant' }
  }

  if (file.size === 0) {
    return { error: 'Fichier vide' }
  }

  if (file.size > BRANDING_MAX_BYTES) {
    return { error: 'Fichier trop volumineux (2 Mo maximum)' }
  }

  if (!BRANDING_ALLOWED_MIME_TYPES.includes(file.type as BrandingMime)) {
    return {
      error: 'Format non supporté. Utilisez PNG, JPEG ou SVG.',
    }
  }

  const { supabase, orgId } = await getCurrentUser()

  const ext = brandingMimeToExt(file.type)
  const newPath = `${orgId}/logo.${ext}`

  // Nettoyage best-effort des anciens logos d'extension différente
  // (un seul logo par org — évite le résidu si l'utilisateur change png→svg).
  const { data: existing } = await supabase.storage
    .from(BRANDING_BUCKET)
    .list(orgId, { limit: 10 })

  const staleObjects = (existing ?? [])
    .map((obj) => `${orgId}/${obj.name}`)
    .filter((path) => path !== newPath)

  if (staleObjects.length > 0) {
    await supabase.storage.from(BRANDING_BUCKET).remove(staleObjects)
  }

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(newPath, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    return { error: `Upload échoué : ${uploadError.message}` }
  }

  // Cast minimal : colonnes branding pas encore dans Database types regénérés
  const client = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  }

  const { error: updateError } = await client
    .from('organizations')
    .update({
      logo_url: newPath,
      logo_mime: file.type,
      brand_updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (updateError) {
    // Best-effort rollback : on essaie de retirer le fichier qu'on vient
    // d'uploader pour ne pas laisser de résidu orphelin.
    await supabase.storage.from(BRANDING_BUCKET).remove([newPath])
    return { error: `Enregistrement échoué : ${updateError.message}` }
  }

  revalidatePath('/app/compte/branding')
  return { success: true }
}

// ============================================
// Suppression logo
// ============================================

export async function deleteLogoAction(): Promise<FormState> {
  const { supabase, orgId } = await getCurrentUser()

  // Liste les fichiers de l'org dans le bucket et les supprime tous
  // (un seul logo, mais on couvre les éventuels résidus d'anciennes extensions).
  const { data: existing } = await supabase.storage
    .from(BRANDING_BUCKET)
    .list(orgId, { limit: 10 })

  const paths = (existing ?? []).map((obj) => `${orgId}/${obj.name}`)

  if (paths.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(BRANDING_BUCKET)
      .remove(paths)
    if (removeError) {
      return { error: `Suppression Storage échouée : ${removeError.message}` }
    }
  }

  const client = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  }

  const { error: updateError } = await client
    .from('organizations')
    .update({
      logo_url: null,
      logo_mime: null,
      brand_updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (updateError) {
    return { error: `Enregistrement échoué : ${updateError.message}` }
  }

  revalidatePath('/app/compte/branding')
  return { success: true }
}

// ============================================
// Couleur principale
// ============================================

const colorSchema = z.object({
  hex: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Code couleur invalide (format attendu : #RRGGBB)')
    .transform((v) => v.toUpperCase()),
})

export async function updateBrandColorAction(hex: string): Promise<FormState> {
  const parsed = colorSchema.safeParse({ hex })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Code couleur invalide' }
  }

  const { supabase, orgId } = await getCurrentUser()

  const client = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  }

  const { error } = await client
    .from('organizations')
    .update({
      brand_color_hex: parsed.data.hex,
      brand_updated_at: new Date().toISOString(),
    })
    .eq('id', orgId)

  if (error) {
    return { error: `Enregistrement échoué : ${error.message}` }
  }

  revalidatePath('/app/compte/branding')
  return { success: true }
}
