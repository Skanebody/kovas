'use server'

/**
 * Server Actions admin /refonte.
 *
 * Actions ponctuelles pour piloter la refonte depuis l'admin :
 *   - backfillLeadScores : applique A1.3.5 à tous les quote_requests
 *     existants sans intent_score (cas typique post-déploiement initial)
 *   - auditSeoPagesBatch : recompute quality_score + needs_refresh
 *     sur seo_page_quality_signals via A1.3.12
 *
 * Toutes les actions exigent l'auth admin + 2FA.
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { scoreLeadIntent } from '@/lib/algos/lead-scoring'
import { scoreSeoQuality } from '@/lib/algos/seo-quality-scorer'
import { revalidatePath } from 'next/cache'

async function requireAdmin(): Promise<void> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret || !access.user) {
    throw new Error('Forbidden — admin access required.')
  }
}

interface QuoteRow {
  id: string
  property_situation: string | null
  property_type: string | null
  property_surface_m2: number | null
  property_postal_code: string | null
  property_year_built: number | null
  diagnostics_requested: string[] | null
  diagnostics_suggested: unknown
  requester_email: string | null
  requester_phone: string | null
  message: string | null
  honeypot_filled: boolean | null
  recaptcha_score: number | null
}

const ALLOWED_SITUATIONS = new Set(['vente', 'location', 'travaux', 'audit'])
const ALLOWED_TYPES = new Set(['maison', 'appartement', 'local_commercial', 'autre'])

export async function backfillLeadScores(options?: {
  /** Limite le batch (sinon traite tous les leads non scorés, jusqu'à 1000 par appel) */
  limit?: number
}): Promise<{
  ok: boolean
  scored?: number
  skipped?: number
  failed?: number
  error?: string
}> {
  await requireAdmin()
  const supabase = createAdminClient()
  const batchLimit = Math.min(Math.max(options?.limit ?? 200, 1), 1000)

  // 1. Charge les quote_requests sans intent_score (jamais scorés)
  // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
  const { data: rowsRaw, error: loadErr } = await (supabase as any)
    .from('quote_requests')
    .select(
      'id, property_situation, property_type, property_surface_m2, property_postal_code, property_year_built, diagnostics_requested, diagnostics_suggested, requester_email, requester_phone, message, honeypot_filled, recaptcha_score',
    )
    .is('intent_score', null)
    .order('created_at', { ascending: false })
    .limit(batchLimit)

  if (loadErr) {
    return { ok: false, error: `load failed: ${loadErr.message}` }
  }

  const rows = (rowsRaw ?? []) as QuoteRow[]
  if (rows.length === 0) {
    return { ok: true, scored: 0, skipped: 0, failed: 0 }
  }

  let scored = 0
  let skipped = 0
  let failed = 0

  for (const row of rows) {
    // Validation minimale — les champs requis doivent être présents
    if (
      !row.property_situation ||
      !ALLOWED_SITUATIONS.has(row.property_situation) ||
      !row.property_type ||
      !ALLOWED_TYPES.has(row.property_type) ||
      !row.requester_email
    ) {
      skipped += 1
      continue
    }

    const diagnosticsSuggestedCount = Array.isArray(row.diagnostics_suggested)
      ? row.diagnostics_suggested.length
      : 0

    try {
      const scoring = scoreLeadIntent({
        property_situation: row.property_situation as 'vente' | 'location' | 'travaux' | 'audit',
        property_type: row.property_type as 'maison' | 'appartement' | 'local_commercial' | 'autre',
        property_surface_m2: row.property_surface_m2,
        property_postal_code: row.property_postal_code,
        property_year_built: row.property_year_built,
        diagnostics_requested: row.diagnostics_requested ?? [],
        diagnostics_suggested_count: diagnosticsSuggestedCount,
        requester_email: row.requester_email,
        has_phone: Boolean(row.requester_phone && row.requester_phone.trim().length > 0),
        has_message: Boolean(row.message && row.message.trim().length > 0),
        honeypot_filled: Boolean(row.honeypot_filled),
        recaptcha_score: row.recaptcha_score,
      })

      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      const { error: updateErr } = await (supabase as any)
        .from('quote_requests')
        .update({
          intent_score: scoring.intent_score,
          intent_bucket: scoring.bucket,
          intent_signals: scoring.signals,
          intent_scored_at: new Date().toISOString(),
        })
        .eq('id', row.id)

      if (updateErr) {
        failed += 1
        console.error(`[backfill] update failed for ${row.id}:`, updateErr.message)
      } else {
        scored += 1
      }
    } catch (err) {
      failed += 1
      console.error(
        `[backfill] scoring failed for ${row.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  revalidatePath('/admin/refonte')
  revalidatePath('/admin/leads/queue')

  return { ok: true, scored, skipped, failed }
}

/* ───────────────────────────────────────────────────────────────────────── */
/* auditSeoPagesBatch — A1.3.12                                              */
/* ───────────────────────────────────────────────────────────────────────── */

interface SeoSignalRow {
  id: string
  page_url: string
  page_type: string | null
  bounce_rate: number | null
  avg_time_on_page_sec: number | null
  pogo_stick_count: number | null
  total_visits: number | null
  has_real_diagnostician: boolean | null
  has_local_data: boolean | null
  has_human_signature: boolean | null
  updated_at: string | null
}

function mapPageType(
  raw: string | null,
): 'city' | 'department' | 'diagnostic_type' | 'guide' | 'other' {
  switch (raw) {
    case 'city':
      return 'city'
    case 'department':
      return 'department'
    case 'diagnostic-type':
    case 'diagnostic_type':
      return 'diagnostic_type'
    case 'guide':
      return 'guide'
    default:
      return 'other'
  }
}

export async function auditSeoPagesBatch(options?: {
  /** Limite la batch (defaut 500, max 2000) */
  limit?: number
}): Promise<{
  ok: boolean
  scored?: number
  thin?: number
  needs_refresh?: number
  unpublish_candidates?: number
  failed?: number
  error?: string
}> {
  await requireAdmin()
  const supabase = createAdminClient()
  const batchLimit = Math.min(Math.max(options?.limit ?? 500, 1), 2000)

  // biome-ignore lint/suspicious/noExplicitAny: table pas dans Database.types
  const { data: rowsRaw, error: loadErr } = await (supabase as any)
    .from('seo_page_quality_signals')
    .select(
      'id, page_url, page_type, bounce_rate, avg_time_on_page_sec, pogo_stick_count, total_visits, has_real_diagnostician, has_local_data, has_human_signature, updated_at',
    )
    .order('last_audited_at', { ascending: true, nullsFirst: true })
    .limit(batchLimit)

  if (loadErr) {
    return { ok: false, error: `load failed: ${loadErr.message}` }
  }

  const rows = (rowsRaw ?? []) as SeoSignalRow[]
  if (rows.length === 0) {
    return { ok: true, scored: 0, thin: 0, needs_refresh: 0, unpublish_candidates: 0, failed: 0 }
  }

  let scored = 0
  let thin = 0
  let needsRefresh = 0
  let unpublishCandidates = 0
  let failed = 0
  const nowIso = new Date().toISOString()

  for (const row of rows) {
    try {
      // pogo_sticking détecté si on a >= 5 pogos sur la pop totale et ratio > 30%
      const totalVisits = row.total_visits ?? 0
      const pogoCount = row.pogo_stick_count ?? 0
      const pogoSticking = pogoCount >= 5 && totalVisits > 0 && pogoCount / totalVisits > 0.3

      const scoring = scoreSeoQuality({
        page_type: mapPageType(row.page_type),
        has_real_diagnostician: Boolean(row.has_real_diagnostician),
        has_local_data: Boolean(row.has_local_data),
        has_human_signature: Boolean(row.has_human_signature),
        bounce_rate: row.bounce_rate,
        avg_time_on_page_sec: row.avg_time_on_page_sec,
        // V1 : word_count + last_content_revision pas joints — défaut neutre
        word_count: null,
        last_content_revision_at: row.updated_at,
        pogo_sticking_detected: pogoSticking,
        is_duplicate_template: false, // V1 : check non implémenté
      })

      const refreshReason =
        scoring.refresh_reasons[0] && scoring.refresh_reasons[0] !== 'none'
          ? scoring.refresh_reasons[0]
          : null

      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      const { error: updateErr } = await (supabase as any)
        .from('seo_page_quality_signals')
        .update({
          quality_score: scoring.quality_score,
          needs_refresh: scoring.needs_refresh,
          refresh_reason: refreshReason,
          last_audited_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', row.id)

      if (updateErr) {
        failed += 1
        console.error(`[audit-seo] update failed for ${row.page_url}:`, updateErr.message)
      } else {
        scored += 1
        if (scoring.bucket === 'thin') thin += 1
        if (scoring.needs_refresh) needsRefresh += 1
        if (scoring.should_unpublish) unpublishCandidates += 1
      }
    } catch (err) {
      failed += 1
      console.error(
        `[audit-seo] scoring failed for ${row.page_url}:`,
        err instanceof Error ? err.message : err,
      )
    }
  }

  revalidatePath('/admin/refonte')
  revalidatePath('/admin/seo/kanban')

  return {
    ok: true,
    scored,
    thin,
    needs_refresh: needsRefresh,
    unpublish_candidates: unpublishCandidates,
    failed,
  }
}
