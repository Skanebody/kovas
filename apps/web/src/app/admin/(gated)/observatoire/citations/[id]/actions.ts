'use server'

/**
 * Server Actions admin pour la modération des citations presse de l'Observatoire.
 *
 * Workflow : pending_review → verified / rejected.
 * Toutes les mutations vérifient `verifyAdminAccess()` côté serveur, et
 * estampillent `verified_by` + `verified_at` à chaque changement de statut.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'

interface ActionResult {
  ok: boolean
  error?: string
}

async function requireAdmin(): Promise<{ userId: string }> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
  return { userId: access.user.id }
}

interface UpdateCitationInput {
  id: string
  status: 'verified' | 'rejected' | 'pending_review'
  rejectionReason?: string | null
  // Champs éditables côté admin (validation/correction)
  articleTitle?: string
  articleUrl?: string
  quoteExcerpt?: string
  author?: string | null
  publishedAt?: string
  displayOrder?: number
}

/**
 * Met à jour une citation : statut, champs éditoriaux, raison du rejet, etc.
 * Estampille verified_by/at quand on passe à verified ou rejected.
 */
export async function updatePressCitation(input: UpdateCitationInput): Promise<ActionResult> {
  const { userId } = await requireAdmin()
  const supabase = createAdminClient()

  const patch: Record<string, unknown> = {}
  if (input.articleTitle !== undefined) patch.article_title = input.articleTitle
  if (input.articleUrl !== undefined) patch.article_url = input.articleUrl
  if (input.quoteExcerpt !== undefined) patch.quote_excerpt = input.quoteExcerpt
  if (input.author !== undefined) patch.author = input.author
  if (input.publishedAt !== undefined) patch.published_at = input.publishedAt
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder

  patch.status = input.status
  if (input.status === 'verified') {
    patch.verified_by = userId
    patch.verified_at = new Date().toISOString()
    patch.rejection_reason = null
  } else if (input.status === 'rejected') {
    patch.verified_by = userId
    patch.verified_at = new Date().toISOString()
    patch.rejection_reason = input.rejectionReason ?? 'Non vérifié'
  } else {
    // retour en pending_review
    patch.verified_by = null
    patch.verified_at = null
    patch.rejection_reason = null
  }

  // biome-ignore lint/suspicious/noExplicitAny: table pas encore dans Database.types
  const { error } = await (supabase as any)
    .from('observatoire_press_citations')
    .update(patch)
    .eq('id', input.id)

  if (error) {
    console.error('updatePressCitation error:', error.message)
    return { ok: false, error: error.message }
  }

  revalidatePath('/observatoire')
  revalidatePath(`/observatoire/citation/${input.id}`)
  revalidatePath(`/admin/observatoire/citations/${input.id}`)
  return { ok: true }
}

/**
 * Marque une citation comme vérifiée (raccourci au cas où aucune édition).
 */
export async function verifyPressCitation(id: string): Promise<ActionResult> {
  return updatePressCitation({ id, status: 'verified' })
}

/**
 * Rejette une citation avec une raison (optionnelle mais recommandée).
 */
export async function rejectPressCitation(id: string, reason: string): Promise<ActionResult> {
  return updatePressCitation({ id, status: 'rejected', rejectionReason: reason })
}
