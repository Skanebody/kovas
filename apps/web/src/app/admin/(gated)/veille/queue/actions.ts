'use server'

/**
 * Server Actions pour la queue de validation des articles de veille SEO
 * (méthode Amandine Bart).
 *
 * Toutes les actions sont protégées par verifyAdminAccess() (auth + 2FA OK).
 * Lecture/écriture via supabase service_role (createAdminClient).
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<{ userId: string }> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
  return { userId: access.user.id }
}

export interface ApproveResult {
  readonly ok: boolean
  readonly error?: string
}

export async function approveArticle(
  articleId: string,
  options?: {
    eeatExperience?: number
    eeatExpertise?: number
    eeatAuthoritativeness?: number
    eeatTrustworthiness?: number
    reviewNotes?: string
  },
): Promise<ApproveResult> {
  if (!articleId) return { ok: false, error: 'articleId manquant' }

  const { userId } = await requireAdmin()
  const supabase = createAdminClient()

  const patch: Record<string, unknown> = {
    status: 'published',
    reviewed_by: userId,
    reviewed_at: new Date().toISOString(),
    published_at: new Date().toISOString(),
  }

  if (options?.eeatExperience !== undefined) patch.eeat_experience = options.eeatExperience
  if (options?.eeatExpertise !== undefined) patch.eeat_expertise = options.eeatExpertise
  if (options?.eeatAuthoritativeness !== undefined)
    patch.eeat_authoritativeness = options.eeatAuthoritativeness
  if (options?.eeatTrustworthiness !== undefined)
    patch.eeat_trustworthiness = options.eeatTrustworthiness
  if (options?.reviewNotes) patch.review_notes = options.reviewNotes

  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  const { error } = await (supabase as any)
    .from('veille_articles_draft')
    .update(patch)
    .eq('id', articleId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/veille/queue')
  revalidatePath('/dashboard/veille/articles')
  return { ok: true }
}

export async function rejectArticle(articleId: string, reason: string): Promise<ApproveResult> {
  if (!articleId || !reason.trim()) {
    return { ok: false, error: 'articleId et reason requis' }
  }

  const { userId } = await requireAdmin()
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  const { error } = await (supabase as any)
    .from('veille_articles_draft')
    .update({
      status: 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      rejected_reason: reason.trim(),
    })
    .eq('id', articleId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/veille/queue')
  return { ok: true }
}

export async function regenerateArticle(articleId: string): Promise<ApproveResult> {
  await requireAdmin()
  const supabase = createAdminClient()

  // Récupère le keyword associé
  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  const { data: article, error: fetchErr } = await (supabase as any)
    .from('veille_articles_draft')
    .select('target_keyword')
    .eq('id', articleId)
    .maybeSingle()

  if (fetchErr || !article) {
    return { ok: false, error: fetchErr?.message ?? 'Article introuvable' }
  }

  // biome-ignore lint/suspicious/noExplicitAny: veille_keywords_priority pas encore typée
  const { data: kw, error: kwErr } = await (supabase as any)
    .from('veille_keywords_priority')
    .select('id')
    .eq('keyword', article.target_keyword)
    .maybeSingle()

  if (kwErr || !kw) {
    return { ok: false, error: 'Keyword associé introuvable' }
  }

  // Marquer l'article comme rejected
  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  await (supabase as any)
    .from('veille_articles_draft')
    .update({
      status: 'rejected',
      rejected_reason: 'Régénération demandée par admin',
    })
    .eq('id', articleId)

  // Invoquer Edge Function pour régénérer
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  const fnResponse = await fetch(`${supabaseUrl}/functions/v1/generate-veille-article`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ keyword_id: kw.id }),
  })

  if (!fnResponse.ok) {
    const errText = await fnResponse.text()
    return { ok: false, error: `Edge Function échec : ${errText.slice(0, 200)}` }
  }

  revalidatePath('/admin/veille/queue')
  return { ok: true }
}

export async function updateArticleContent(
  articleId: string,
  patches: {
    contentMarkdown?: string
    title?: string
    metaTitle?: string
    metaDescription?: string
  },
): Promise<ApproveResult> {
  await requireAdmin()
  const supabase = createAdminClient()

  const patch: Record<string, unknown> = {}
  if (patches.contentMarkdown !== undefined) patch.content_markdown = patches.contentMarkdown
  if (patches.title !== undefined) patch.title = patches.title
  if (patches.metaTitle !== undefined) patch.meta_title = patches.metaTitle
  if (patches.metaDescription !== undefined) patch.meta_description = patches.metaDescription

  if (Object.keys(patch).length === 0) {
    return { ok: false, error: 'Aucune modification' }
  }

  // biome-ignore lint/suspicious/noExplicitAny: veille_articles_draft pas encore typée
  const { error } = await (supabase as any)
    .from('veille_articles_draft')
    .update(patch)
    .eq('id', articleId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/veille/queue')
  return { ok: true }
}

export async function triggerBatchGeneration(
  limit = 2,
): Promise<{ ok: boolean; generated?: number; error?: string }> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-veille-article`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ limit }),
  })

  if (!response.ok) {
    const errText = await response.text()
    return { ok: false, error: `Edge Function échec : ${errText.slice(0, 200)}` }
  }

  const json = (await response.json()) as { generated?: number }
  revalidatePath('/admin/veille/queue')
  return { ok: true, generated: json.generated ?? 0 }
}
