'use server'

/**
 * Server Actions pour la validation des drafts d'auto-update des guides
 * `/guide/*` (Lot B65).
 *
 * Toutes les actions sont protégées par verifyAdminAccess() (auth + 2FA OK).
 * Lecture/écriture via supabase service_role (createAdminClient).
 *
 * Workflow :
 *   - approveDraft  → INSERT dans internal.guide_versions + queue.status='approved'
 *   - rejectDraft   → queue.status='failed' + log raison
 *   - regenerateDraft → triggers Edge Function `refresh-guides-content`
 *                       avec guide_slug forcé (nouvelle ligne queue)
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

export interface ActionResult {
  readonly ok: boolean
  readonly error?: string
}

export async function approveDraft(draftId: string): Promise<ActionResult> {
  if (!draftId) return { ok: false, error: 'draftId manquant' }
  const { userId } = await requireAdmin()
  const supabase = createAdminClient()

  // 1. Récupère la ligne queue
  // biome-ignore lint/suspicious/noExplicitAny: internal.guide_refresh_queue not in Database.types
  const { data: queueRow, error: fetchErr } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .select('id, guide_slug, status, draft_content, sources_fetched')
    .eq('id', draftId)
    .maybeSingle()

  if (fetchErr || !queueRow) {
    return { ok: false, error: fetchErr?.message ?? 'Draft introuvable' }
  }
  if (queueRow.status !== 'draft_ready') {
    return { ok: false, error: `Statut invalide : ${queueRow.status}` }
  }
  const draft = queueRow.draft_content as {
    title?: string
    content_md?: string
    schema_org_jsonld?: Record<string, unknown>
    word_count?: number
  } | null
  if (!draft?.content_md) {
    return { ok: false, error: 'Draft content vide' }
  }

  // 2. Calcule le prochain version_number
  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { data: latest } = await (supabase as any)
    .schema('internal')
    .from('guide_versions')
    .select('version_number')
    .eq('guide_slug', queueRow.guide_slug)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextVersion = ((latest?.version_number as number | undefined) ?? 0) + 1
  const sourcesCount = Array.isArray(queueRow.sources_fetched) ? queueRow.sources_fetched.length : 0

  // 3. INSERT dans guide_versions (publication)
  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { error: insertErr } = await (supabase as any)
    .schema('internal')
    .from('guide_versions')
    .insert({
      guide_slug: queueRow.guide_slug,
      version_number: nextVersion,
      content_md: draft.content_md,
      schema_org_jsonld: draft.schema_org_jsonld ?? null,
      sources_count: sourcesCount,
      word_count: draft.word_count ?? 0,
      source_draft_id: draftId,
      published_by: userId,
    })

  if (insertErr) {
    return { ok: false, error: `Publication échouée : ${insertErr.message}` }
  }

  // 4. Mark queue row as approved
  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { error: updateErr } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .update({
      status: 'approved',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  if (updateErr) {
    return { ok: false, error: `Queue update failed : ${updateErr.message}` }
  }

  revalidatePath('/admin/guides-refresh')
  revalidatePath(`/guide/${queueRow.guide_slug}`)
  return { ok: true }
}

export async function rejectDraft(draftId: string, reason: string): Promise<ActionResult> {
  if (!draftId || !reason.trim()) {
    return { ok: false, error: 'draftId et reason requis' }
  }
  const { userId } = await requireAdmin()
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { error } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .update({
      status: 'failed',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: reason.trim(),
    })
    .eq('id', draftId)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/guides-refresh')
  return { ok: true }
}

export async function regenerateDraft(draftId: string): Promise<ActionResult> {
  await requireAdmin()
  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  const { data: queueRow, error: fetchErr } = await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .select('id, guide_slug')
    .eq('id', draftId)
    .maybeSingle()

  if (fetchErr || !queueRow) {
    return { ok: false, error: fetchErr?.message ?? 'Draft introuvable' }
  }

  // Mark current as failed (régénération demandée)
  // biome-ignore lint/suspicious/noExplicitAny: internal not in Database.types
  await (supabase as any)
    .schema('internal')
    .from('guide_refresh_queue')
    .update({
      status: 'failed',
      review_notes: 'Régénération demandée par admin',
    })
    .eq('id', draftId)

  // Trigger Edge Function pour le même slug
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  const fnResponse = await fetch(`${supabaseUrl}/functions/v1/refresh-guides-content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ guide_slug: queueRow.guide_slug }),
  })

  if (!fnResponse.ok) {
    const errText = await fnResponse.text()
    return { ok: false, error: `Edge Function échec : ${errText.slice(0, 200)}` }
  }

  revalidatePath('/admin/guides-refresh')
  return { ok: true }
}

export async function triggerManualRefresh(guideSlug: string): Promise<ActionResult> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return { ok: false, error: 'Configuration Edge Function manquante' }
  }

  const fnResponse = await fetch(`${supabaseUrl}/functions/v1/refresh-guides-content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ guide_slug: guideSlug }),
  })

  if (!fnResponse.ok) {
    const errText = await fnResponse.text()
    return { ok: false, error: `Edge Function échec : ${errText.slice(0, 200)}` }
  }

  revalidatePath('/admin/guides-refresh')
  return { ok: true }
}
