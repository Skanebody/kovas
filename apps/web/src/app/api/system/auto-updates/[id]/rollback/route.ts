/**
 * POST /api/system/auto-updates/[id]/rollback
 *
 * Annule une auto-update système précédemment appliquée. Utilise `rollback_payload`
 * stocké au moment de l'apply pour restaurer l'état antérieur.
 *
 * Auth : admin (verifyAdminAccess).
 * Idempotence : si status='rolled_back' déjà → 200 no-op.
 *
 * Supporté V1 :
 *   - coherence_rule_modified : restaure `previous_state` (rule_logic, severity, ...)
 *   - coherence_rule_deactivated : remet enabled=true
 *   - coherence_rule_added : DELETE de la ligne créée (best effort si l'ID est dans details)
 *   - report_template_updated : désactive la nouvelle version + remet l'ancienne is_active=true
 *
 * Non rollback-able automatiquement V1 :
 *   - parameter_default_changed (V1 log-only)
 *   - pricing_template_updated (V1 log-only)
 *   - workflow_modified (code-level)
 */

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

interface AutoUpdateRow {
  id: string
  status: string
  applied_at: string | null
  proposed_payload: Record<string, unknown> | null
  rollback_payload: Record<string, unknown> | null
  apply_result: Record<string, unknown> | null
  title: string
}

interface RouteParams {
  params: Promise<{ id: string }>
}

function readString(payload: Record<string, unknown> | null, key: string): string | null {
  if (!payload) return null
  const v = payload[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

function readObject(
  payload: Record<string, unknown> | null,
  key: string,
): Record<string, unknown> | null {
  if (!payload) return null
  const v = payload[key]
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

interface SupabaseUpdateBuilder<TRow> {
  update: (patch: Partial<TRow>) => {
    eq: (col: string, val: string | boolean) => Promise<{ error: { message: string } | null }>
  }
  delete: () => {
    eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
  }
  insert: (row: TRow) => Promise<{ error: { message: string } | null }>
}

interface CoherenceRuleRow {
  rule_code: string
  rule_logic?: Record<string, unknown>
  severity?: string
  title?: string
  description?: string
  suggested_fix?: string | null
  enabled?: boolean
}

interface ReportTemplateRow {
  id?: string
  slug?: string
  version?: string
  is_active?: boolean
}

export async function POST(_req: Request, ctx: RouteParams): Promise<Response> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (access.needs2FA) {
    return NextResponse.json({ error: '2fa_required' }, { status: 403 })
  }

  const { id } = await ctx.params
  if (!id) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: row, error: selErr } = await supabase
    .from('system_auto_updates')
    .select('id, status, applied_at, proposed_payload, rollback_payload, apply_result, title')
    .eq('id', id)
    .maybeSingle()
  if (selErr) {
    return NextResponse.json({ error: 'db_error', detail: selErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const update = row as AutoUpdateRow

  if (update.status === 'rolled_back') {
    return NextResponse.json({ ok: true, idempotent: true, status: 'rolled_back' })
  }
  if (update.status !== 'applied') {
    return NextResponse.json(
      { error: 'invalid_status', detail: `status must be 'applied', got '${update.status}'` },
      { status: 409 },
    )
  }

  const operation = readString(update.proposed_payload, 'operation') ?? ''
  const adminUserId = access.user.id

  try {
    if (operation === 'coherence_rule_modified') {
      const previous = readObject(update.rollback_payload, 'previous_state')
      const ruleCode = readString(update.rollback_payload, 'rule_code')
      if (!previous || !ruleCode) {
        throw new Error(
          'coherence_rule_modified rollback requires rollback_payload.previous_state + rule_code',
        )
      }
      const builder = supabase.from(
        'ademe_coherence_rules',
      ) as unknown as SupabaseUpdateBuilder<CoherenceRuleRow>
      const { error } = await builder
        .update({
          rule_logic: (previous as { rule_logic?: Record<string, unknown> }).rule_logic,
          severity: (previous as { severity?: string }).severity,
          title: (previous as { title?: string }).title,
          description: (previous as { description?: string }).description,
          suggested_fix: (previous as { suggested_fix?: string | null }).suggested_fix ?? null,
        })
        .eq('rule_code', ruleCode)
      if (error) throw new Error(`restore rule failed: ${error.message}`)
    } else if (operation === 'coherence_rule_deactivated') {
      const ruleCode = readString(update.proposed_payload, 'rule_code')
      if (!ruleCode) throw new Error('rollback requires rule_code')
      const builder = supabase.from(
        'ademe_coherence_rules',
      ) as unknown as SupabaseUpdateBuilder<CoherenceRuleRow>
      const { error } = await builder.update({ enabled: true }).eq('rule_code', ruleCode)
      if (error) throw new Error(`reactivate rule failed: ${error.message}`)
    } else if (operation === 'coherence_rule_added') {
      const details = readObject(update.apply_result, 'details')
      const newId = readString(details, 'id')
      if (!newId) throw new Error('rollback requires apply_result.details.id')
      const builder = supabase.from(
        'ademe_coherence_rules',
      ) as unknown as SupabaseUpdateBuilder<CoherenceRuleRow>
      const { error } = await builder.delete().eq('id', newId)
      if (error) throw new Error(`delete rule failed: ${error.message}`)
    } else if (operation === 'report_template_updated') {
      const details = readObject(update.apply_result, 'details')
      const newId = readString(details, 'id')
      const slug = readString(details, 'slug')
      if (!newId || !slug) throw new Error('rollback requires apply_result.details.id + slug')
      const builder = supabase.from(
        'report_templates',
      ) as unknown as SupabaseUpdateBuilder<ReportTemplateRow>
      // 1. Désactive la nouvelle version
      const r1 = await builder.update({ is_active: false }).eq('id', newId)
      if (r1.error) throw new Error(`deactivate new template failed: ${r1.error.message}`)
      // 2. Tente de réactiver une version antérieure (la plus récente)
      const { data: prev } = await supabase
        .from('report_templates')
        .select('id, version')
        .eq('slug', slug)
        .neq('id', newId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (prev) {
        const prevRow = prev as { id: string }
        const r2 = await builder.update({ is_active: true }).eq('id', prevRow.id)
        if (r2.error) throw new Error(`reactivate previous template failed: ${r2.error.message}`)
      }
    } else {
      return NextResponse.json(
        {
          error: 'rollback_not_supported',
          detail: `operation "${operation}" cannot be rolled back automatically — manual revert required`,
        },
        { status: 422 },
      )
    }

    // Mark as rolled_back (table absente du Database type généré — cast typé)
    const autoUpdatesBuilder = supabase.from(
      'system_auto_updates',
    ) as unknown as SupabaseUpdateBuilder<{ status: string }>
    const { error: updErr } = await autoUpdatesBuilder
      .update({ status: 'rolled_back' })
      .eq('id', id)
    if (updErr) {
      throw new Error(`failed to mark rolled_back: ${updErr.message}`)
    }

    await logAdminAction({
      adminUserId,
      actionType: 'system_auto_update_rolled_back',
      actionSource: 'dashboard_web',
      targetType: 'system_auto_update',
      targetId: id,
      targetLabel: update.title.slice(0, 200),
      succeeded: true,
    })

    return NextResponse.json({ ok: true, status: 'rolled_back', operation })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'
    await logAdminAction({
      adminUserId,
      actionType: 'system_auto_update_rollback_failed',
      actionSource: 'dashboard_web',
      targetType: 'system_auto_update',
      targetId: id,
      targetLabel: update.title.slice(0, 200),
      succeeded: false,
      errorMessage: msg,
    })
    return NextResponse.json({ ok: false, error: 'rollback_failed', detail: msg }, { status: 500 })
  }
}
