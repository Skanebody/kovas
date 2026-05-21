'use server'

/**
 * Server Actions du pipeline SEO admin (Mission D4).
 *
 * Toutes les actions sont protégées par verifyAdminAccess() (auth + 2FA OK).
 * Lecture/écriture via supabase service_role (createAdminClient).
 *
 * Tables visées (créées par mission D1 en parallèle, pas encore dans Database.types) :
 *   - seo_drafts
 *   - seo_draft_versions
 *   - seo_publications
 *
 * En raison de l'absence de types générés, on caste `supabase as unknown as ...`
 * pour conserver TypeScript strict côté caller tout en autorisant les opérations
 * sur ces tables.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'

export type SeoDraftStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'published'
  | 'archived'
  | 'rejected'

const VALID_STATUSES: readonly SeoDraftStatus[] = [
  'draft',
  'review',
  'approved',
  'published',
  'archived',
  'rejected',
]

export interface EeatValidations {
  hasAnecdote: boolean
  hasFigures: boolean
  hasExpertQuote: boolean
  hasPhoto: boolean
}

interface SeoDraftMinimalRow {
  id: string
  title: string
  slug: string | null
  status: SeoDraftStatus
  content_markdown: string | null
  revision_count: number | null
}

interface SeoDraftVersionRow {
  draft_id: string
  version_number: number
  content_markdown: string
  edit_summary: string | null
  edited_by: string | null
}

interface SeoPublicationRow {
  draft_id: string
  published_url: string
  seo_title: string
  seo_description: string
  schema_org_json: Record<string, unknown> | null
}

// ============================================
// Auth guard
// ============================================

async function requireAdmin(): Promise<{ userId: string }> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
  return { userId: access.user.id }
}

// ============================================
// EEAT scoring (côté Server Action, recalcule à chaque save)
// ============================================

export function computeEeatValidations(markdown: string): EeatValidations {
  const text = markdown.toLowerCase()

  const anecdoteRegex =
    /(j'ai|j'etais|j'étais|lors d'une intervention|recemment|récemment|sur le terrain)/i
  let hasAnecdote = false
  const match = anecdoteRegex.exec(text)
  if (match && typeof match.index === 'number') {
    const idx = match.index
    const windowStart = Math.max(0, idx - 100)
    const windowEnd = Math.min(text.length, idx + 200)
    const windowText = text.slice(windowStart, windowEnd)
    const wordCount = windowText.split(/\s+/).filter(Boolean).length
    hasAnecdote = wordCount >= 50
  }

  const figureRegex = /\d+(?:[\s,]\d+)*\s*(%|€|m²|m2|ans?|mois|kg|kwh|kWh)/gi
  const figures = markdown.match(figureRegex) ?? []
  const hasFigures = figures.length >= 3

  const quoteRegex1 =
    /[«"][^»"]{20,300}[»"]\s*[—\-–]\s*[A-ZÀ-Ý][a-zà-ÿ-]+\s+[A-ZÀ-Ý][a-zà-ÿ-]+/
  const quoteRegex2 =
    /selon\s+[A-ZÀ-Ý][a-zà-ÿ-]+\s+[A-ZÀ-Ý][a-zà-ÿ-]+\s*,\s*[a-zà-ÿ]/i
  const hasExpertQuote = quoteRegex1.test(markdown) || quoteRegex2.test(markdown)

  const hasPhoto = /!\[[^\]]*\]\([^)]+\)/.test(markdown)

  return { hasAnecdote, hasFigures, hasExpertQuote, hasPhoto }
}

export function computeEeatScore(v: EeatValidations): number {
  let s = 0
  if (v.hasAnecdote) s += 3
  if (v.hasFigures) s += 3
  if (v.hasExpertQuote) s += 2
  if (v.hasPhoto) s += 2
  return s
}

// ============================================
// generateSeoDrafts — invoque l'Edge Function `seo-generate-draft`
// ============================================

interface GenerateDraftsResponse {
  ok: boolean
  drafts: Array<{
    keyword: string
    title: string
    eeat_score: number
    status: 'draft' | 'failed'
    error?: string
  }>
  totalCost: number
  durationMs: number
  error?: string
}

export async function generateSeoDrafts(top = 5): Promise<GenerateDraftsResponse> {
  await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    return {
      ok: false,
      drafts: [],
      totalCost: 0,
      durationMs: 0,
      error: 'Supabase env missing (URL / service_role).',
    }
  }

  const url = `${supabaseUrl.replace(/\/$/, '')}/functions/v1/seo-generate-draft`
  const safeTop = Math.min(20, Math.max(1, Math.floor(top)))

  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ top: safeTop }),
      cache: 'no-store',
    })

    const payload = (await resp.json()) as GenerateDraftsResponse

    if (!resp.ok) {
      return {
        ok: false,
        drafts: [],
        totalCost: 0,
        durationMs: 0,
        error: payload?.error ?? `Edge Function HTTP ${resp.status}`,
      }
    }

    revalidatePath('/admin/seo/kanban')
    return payload
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, drafts: [], totalCost: 0, durationMs: 0, error: msg }
  }
}

// ============================================
// updateDraftStatus
// ============================================

export async function updateDraftStatus(
  draftId: string,
  newStatus: SeoDraftStatus,
): Promise<void> {
  await requireAdmin()

  if (!VALID_STATUSES.includes(newStatus)) {
    throw new Error(`Statut invalide : ${newStatus}`)
  }

  const supabase = createAdminClient()
  const { error } = await (
    supabase as unknown as {
      from: (table: string) => {
        update: (
          values: Record<string, unknown>,
        ) => {
          eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>
        }
      }
    }
  )
    .from('seo_drafts')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', draftId)

  if (error) {
    throw new Error(`updateDraftStatus failed: ${error.message}`)
  }

  revalidatePath('/admin/seo/kanban')
  revalidatePath(`/admin/seo/drafts/${draftId}`)
}

// ============================================
// saveDraft — incrémente version + recalcule eeat_score
// ============================================

export async function saveDraft(
  draftId: string,
  contentMarkdown: string,
  editSummary?: string,
): Promise<{ version: number; eeatScore: number }> {
  const { userId } = await requireAdmin()
  const supabase = createAdminClient()

  // 1. Lis l'état actuel du draft (revision_count + status)
  const { data: existing, error: readErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data: SeoDraftMinimalRow | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  )
    .from('seo_drafts')
    .select('id, title, slug, status, content_markdown, revision_count')
    .eq('id', draftId)
    .maybeSingle()

  if (readErr || !existing) {
    throw new Error(`saveDraft : draft introuvable (${readErr?.message ?? 'not found'})`)
  }

  // 2. Recompute EEAT
  const validations = computeEeatValidations(contentMarkdown)
  const score = computeEeatScore(validations)
  const nextVersion = (existing.revision_count ?? 0) + 1

  // 3. UPDATE seo_drafts
  const { error: updErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        update: (
          values: Record<string, unknown>,
        ) => {
          eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>
        }
      }
    }
  )
    .from('seo_drafts')
    .update({
      content_markdown: contentMarkdown,
      eeat_score: score,
      eeat_validations: validations,
      revision_count: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draftId)

  if (updErr) {
    throw new Error(`saveDraft update failed: ${updErr.message}`)
  }

  // 4. INSERT version snapshot
  const versionRow: SeoDraftVersionRow = {
    draft_id: draftId,
    version_number: nextVersion,
    content_markdown: contentMarkdown,
    edit_summary: editSummary ?? null,
    edited_by: userId,
  }
  const { error: vErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        insert: (row: SeoDraftVersionRow) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .from('seo_draft_versions')
    .insert(versionRow)

  if (vErr) {
    // Non-bloquant : on log mais on ne fait pas échouer la save principale.
    console.warn(`saveDraft version snapshot failed: ${vErr.message}`)
  }

  revalidatePath('/admin/seo/kanban')
  revalidatePath(`/admin/seo/drafts/${draftId}`)

  return { version: nextVersion, eeatScore: score }
}

// ============================================
// publishDraft — transition approved → published + INSERT seo_publications
// ============================================

export async function publishDraft(draftId: string): Promise<{ publishedUrl: string }> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { data: existing, error: readErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{
              data:
                | (SeoDraftMinimalRow & {
                    meta_description: string | null
                    target_url: string | null
                  })
                | null
              error: { message: string } | null
            }>
          }
        }
      }
    }
  )
    .from('seo_drafts')
    .select(
      'id, title, slug, status, content_markdown, revision_count, meta_description, target_url',
    )
    .eq('id', draftId)
    .maybeSingle()

  if (readErr || !existing) {
    throw new Error(`publishDraft : draft introuvable (${readErr?.message ?? 'not found'})`)
  }

  const slug = existing.slug ?? draftId
  const publishedUrl = existing.target_url ?? `https://kovas.fr/blog/${slug}`
  const publishedAt = new Date().toISOString()

  // UPDATE seo_drafts → published
  const { error: updErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        update: (
          values: Record<string, unknown>,
        ) => {
          eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>
        }
      }
    }
  )
    .from('seo_drafts')
    .update({
      status: 'published',
      published_url: publishedUrl,
      published_at: publishedAt,
      updated_at: publishedAt,
    })
    .eq('id', draftId)

  if (updErr) {
    throw new Error(`publishDraft update failed: ${updErr.message}`)
  }

  // INSERT seo_publications
  const pubRow: SeoPublicationRow = {
    draft_id: draftId,
    published_url: publishedUrl,
    seo_title: existing.title,
    seo_description: existing.meta_description ?? existing.title.slice(0, 155),
    schema_org_json: null,
  }
  const { error: pubErr } = await (
    supabase as unknown as {
      from: (table: string) => {
        insert: (row: SeoPublicationRow) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .from('seo_publications')
    .insert(pubRow)

  if (pubErr) {
    console.warn(`publishDraft : seo_publications insert failed: ${pubErr.message}`)
  }

  revalidatePath('/admin/seo/kanban')
  revalidatePath(`/admin/seo/drafts/${draftId}`)

  return { publishedUrl }
}

// ============================================
// assignDraft
// ============================================

export async function assignDraft(draftId: string, userId: string | null): Promise<void> {
  await requireAdmin()
  const supabase = createAdminClient()

  const { error } = await (
    supabase as unknown as {
      from: (table: string) => {
        update: (
          values: Record<string, unknown>,
        ) => {
          eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>
        }
      }
    }
  )
    .from('seo_drafts')
    .update({ assigned_to: userId, updated_at: new Date().toISOString() })
    .eq('id', draftId)

  if (error) {
    throw new Error(`assignDraft failed: ${error.message}`)
  }

  revalidatePath('/admin/seo/kanban')
  revalidatePath(`/admin/seo/drafts/${draftId}`)
}
