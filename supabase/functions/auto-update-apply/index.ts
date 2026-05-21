/**
 * KOVAS — Edge Function : Application d'une auto-update système approuvée par admin.
 *
 * Endpoint POST /functions/v1/auto-update-apply
 *
 * Body : { autoUpdateId: string }
 *
 * Workflow :
 *   1. Auth admin (JWT Supabase + check is_admin via RPC)
 *   2. Charge system_auto_updates ligne, vérifie status='approved' ET applied_at IS NULL
 *      (idempotent : si déjà 'applied' → 200 ok no-op)
 *   3. Selon change_type :
 *      - 'seed_data' (coherence_rule_added / rule_modified / rule_deactivated)
 *      - 'content_update' (report_template_updated → versionning, jamais delete)
 *      - 'config' (parameter_default_changed / pricing_template_updated)
 *      - 'code_patch' / 'manual_task' : log only (V1 — pas d'exec automatique)
 *   4. Set applied_at + applied_by + apply_result + status='applied'
 *   5. Log audit dans admin_audit_log
 *   6. En cas d'erreur : status='failed' + apply_error renseigné + log audit failure
 *
 * Le sous-type d'opération est encodé dans proposed_payload.operation :
 *   - coherence_rule_added | coherence_rule_modified | coherence_rule_deactivated
 *   - report_template_updated | parameter_default_changed | pricing_template_updated
 *   - workflow_modified (log only V1)
 *
 * Rollback : endpoint séparé `/auto-update-rollback` (à fournir Phase 2) lit
 * rollback_payload pour annuler.
 *
 * Authority : CLAUDE.md §13 + migration 20260525184000_system_auto_updates.
 */

// @ts-nocheck — Deno-only Edge Function ; non compilée par tsc Node.

import { createClient } from 'jsr:@supabase/supabase-js@2'

interface RequestBody {
  autoUpdateId?: string
}

interface AutoUpdateRow {
  id: string
  change_type: 'config' | 'seed_data' | 'code_patch' | 'content_update' | 'manual_task'
  status:
    | 'pending_review'
    | 'approved'
    | 'rejected'
    | 'applied'
    | 'rolled_back'
    | 'failed'
  title: string
  proposed_payload: Record<string, unknown>
  rollback_payload: Record<string, unknown> | null
  applied_at: string | null
  triggered_by_doc_id: string | null
  affected_areas: string[] | null
}

interface ApplyResult {
  operation: string
  affected: number
  notes?: string
  details?: Record<string, unknown>
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function readString(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key]
  return typeof v === 'string' && v.length > 0 ? v : null
}

function readObject(
  payload: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const v = payload[key]
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

// ────────────────────────────────────────────────────────────
// Handlers par opération
// ────────────────────────────────────────────────────────────

async function applyCoherenceRuleAdded(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<ApplyResult> {
  const ruleCode = readString(payload, 'rule_code')
  const title = readString(payload, 'title')
  const description = readString(payload, 'description')
  const ruleLogic = readObject(payload, 'rule_logic')
  if (!ruleCode || !title || !description || !ruleLogic) {
    throw new Error(
      'coherence_rule_added requires rule_code, title, description, rule_logic',
    )
  }

  const insertRow = {
    rule_code: ruleCode,
    title,
    description,
    rule_logic: ruleLogic,
    severity: readString(payload, 'severity') ?? 'warning',
    diagnostic_types: Array.isArray(payload.diagnostic_types)
      ? payload.diagnostic_types
      : ['dpe_vente', 'dpe_location'],
    suggested_fix: readString(payload, 'suggested_fix'),
    source_url: readString(payload, 'source_url'),
    source_reference: readString(payload, 'source_reference'),
    applies_from: readString(payload, 'applies_from'),
    enabled: true,
  }

  const { data, error } = await supabase
    .from('ademe_coherence_rules')
    .insert(insertRow)
    .select('id')
    .single()

  if (error) throw new Error(`insert ademe_coherence_rules failed: ${error.message}`)
  return { operation: 'coherence_rule_added', affected: 1, details: { id: data.id } }
}

async function applyCoherenceRuleModified(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<{ result: ApplyResult; rollback: Record<string, unknown> }> {
  const ruleCode = readString(payload, 'rule_code')
  if (!ruleCode) throw new Error('coherence_rule_modified requires rule_code')

  // Snapshot ancienne version pour rollback
  const { data: previous, error: selErr } = await supabase
    .from('ademe_coherence_rules')
    .select('id, rule_logic, severity, title, description, suggested_fix')
    .eq('rule_code', ruleCode)
    .maybeSingle()
  if (selErr) throw new Error(`select previous rule failed: ${selErr.message}`)
  if (!previous) throw new Error(`rule_code "${ruleCode}" not found`)

  const updates: Record<string, unknown> = {}
  if (readObject(payload, 'rule_logic')) updates.rule_logic = payload.rule_logic
  if (readString(payload, 'severity')) updates.severity = payload.severity
  if (readString(payload, 'title')) updates.title = payload.title
  if (readString(payload, 'description')) updates.description = payload.description
  if (readString(payload, 'suggested_fix')) updates.suggested_fix = payload.suggested_fix
  if (Object.keys(updates).length === 0) {
    throw new Error('coherence_rule_modified requires at least one field to update')
  }

  const { error: updErr } = await supabase
    .from('ademe_coherence_rules')
    .update(updates)
    .eq('rule_code', ruleCode)
  if (updErr) throw new Error(`update ademe_coherence_rules failed: ${updErr.message}`)

  return {
    result: { operation: 'coherence_rule_modified', affected: 1, details: { rule_code: ruleCode } },
    rollback: { rule_code: ruleCode, previous_state: previous },
  }
}

async function applyCoherenceRuleDeactivated(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
): Promise<ApplyResult> {
  const ruleCode = readString(payload, 'rule_code')
  if (!ruleCode) throw new Error('coherence_rule_deactivated requires rule_code')

  const { error } = await supabase
    .from('ademe_coherence_rules')
    .update({ enabled: false })
    .eq('rule_code', ruleCode)
  if (error) throw new Error(`deactivate ademe_coherence_rules failed: ${error.message}`)
  return { operation: 'coherence_rule_deactivated', affected: 1, details: { rule_code: ruleCode } }
}

async function applyReportTemplateUpdated(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>,
  triggeredByDocId: string | null,
): Promise<ApplyResult> {
  const slug = readString(payload, 'slug')
  const diagnosticKind = readString(payload, 'diagnostic_kind')
  const newVersion = readString(payload, 'version')
  const templateBody = readString(payload, 'template_body')
  if (!slug || !diagnosticKind || !newVersion || !templateBody) {
    throw new Error(
      'report_template_updated requires slug, diagnostic_kind, version, template_body',
    )
  }

  // Versionning : on insère une NOUVELLE ligne. L'ancienne reste, on la marque inactive.
  const { error: deactErr } = await supabase
    .from('report_templates')
    .update({ is_active: false })
    .eq('slug', slug)
    .eq('is_active', true)
  if (deactErr) throw new Error(`deactivate previous template failed: ${deactErr.message}`)

  const insertRow = {
    slug,
    diagnostic_kind: diagnosticKind,
    version: newVersion,
    format: readString(payload, 'format') ?? 'pdf',
    template_engine: readString(payload, 'template_engine') ?? 'handlebars',
    template_body: templateBody,
    default_variables: readObject(payload, 'default_variables') ?? {},
    legal_basis: readString(payload, 'legal_basis'),
    effective_from: readString(payload, 'effective_from'),
    is_active: true,
    triggered_by_doc_id: triggeredByDocId,
    description: readString(payload, 'description'),
    changelog: readString(payload, 'changelog'),
  }

  const { data, error } = await supabase
    .from('report_templates')
    .insert(insertRow)
    .select('id, version')
    .single()
  if (error) throw new Error(`insert report_templates failed: ${error.message}`)
  return {
    operation: 'report_template_updated',
    affected: 1,
    details: { id: data.id, version: data.version, slug },
    notes: 'Versionning : ancienne version désactivée (is_active=false) mais conservée.',
  }
}

async function applyParameterDefaultChanged(
  payload: Record<string, unknown>,
): Promise<ApplyResult> {
  // V1 : pas de table système dédiée. On log et on demande une intervention manuelle.
  // Phase 2 : créer table system_parameters + appliquer ici.
  const paramKey = readString(payload, 'parameter_key') ?? 'unknown'
  return {
    operation: 'parameter_default_changed',
    affected: 0,
    notes: `V1 log-only : paramètre "${paramKey}" — application code-level requise (cf. changelog).`,
    details: { parameter_key: paramKey, new_value: payload.new_value },
  }
}

async function applyPricingTemplateUpdated(
  payload: Record<string, unknown>,
): Promise<ApplyResult> {
  // pricing_templates n'existe pas en V1 (cf. migration 20260522140000_pricing.sql).
  // On enregistre l'intention dans le retour pour qu'un admin la traite manuellement.
  return {
    operation: 'pricing_template_updated',
    affected: 0,
    notes:
      'V1 log-only : table pricing_templates non créée (les tarifs sont actuellement en user_pricing_config). Application manuelle requise.',
    details: payload,
  }
}

async function applyWorkflowModified(payload: Record<string, unknown>): Promise<ApplyResult> {
  return {
    operation: 'workflow_modified',
    affected: 0,
    notes: 'V1 log-only : workflows code-level (pas DB). Intervention dev requise.',
    details: payload,
  }
}

// ────────────────────────────────────────────────────────────
// Audit log (service_role)
// ────────────────────────────────────────────────────────────

async function logAudit(
  supabase: ReturnType<typeof createClient>,
  args: {
    adminUserId: string
    actionType: string
    autoUpdateId: string
    title: string
    succeeded: boolean
    errorMessage?: string
    newState?: Record<string, unknown>
  },
): Promise<void> {
  const row = {
    admin_user_id: args.adminUserId,
    action_type: args.actionType,
    action_source: 'system_automated',
    target_type: 'system_auto_update',
    target_id: args.autoUpdateId,
    target_label: args.title.slice(0, 200),
    payload: {},
    new_state: args.newState ?? null,
    succeeded: args.succeeded,
    error_message: args.errorMessage ?? null,
  }
  const { error } = await supabase.from('admin_audit_log').insert(row)
  if (error) {
    console.error('[auto-update-apply] audit log insert failed', error)
  }
}

// ────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseAnon || !serviceRole) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }
  const jwt = authHeader.slice(7)

  const supabaseUser = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: userData, error: userErr } = await supabaseUser.auth.getUser(jwt)
  if (userErr || !userData.user) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }
  const adminUserId = userData.user.id

  // Vérifie is_admin via RPC (la RLS de system_auto_updates l'exige déjà mais on est explicite).
  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: isAdminData, error: isAdminErr } = await supabaseAdmin.rpc('is_admin', {
    p_user_id: adminUserId,
  })
  if (isAdminErr || isAdminData !== true) {
    return jsonResponse({ error: 'forbidden', reason: 'admin_required' }, 403)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }
  const autoUpdateId = body.autoUpdateId
  if (typeof autoUpdateId !== 'string' || autoUpdateId.length === 0) {
    return jsonResponse({ error: 'autoUpdateId_required' }, 400)
  }

  // 1. Charge la ligne
  const { data: row, error: selErr } = await supabaseAdmin
    .from('system_auto_updates')
    .select(
      'id, change_type, status, title, proposed_payload, rollback_payload, applied_at, triggered_by_doc_id, affected_areas',
    )
    .eq('id', autoUpdateId)
    .maybeSingle()
  if (selErr) {
    return jsonResponse({ error: 'db_error', detail: selErr.message }, 500)
  }
  if (!row) {
    return jsonResponse({ error: 'not_found' }, 404)
  }
  const update = row as AutoUpdateRow

  // 2. Idempotence
  if (update.applied_at !== null && update.status === 'applied') {
    return jsonResponse({
      ok: true,
      idempotent: true,
      autoUpdateId,
      status: 'applied',
      appliedAt: update.applied_at,
    })
  }
  if (update.status !== 'approved') {
    return jsonResponse(
      { error: 'invalid_status', detail: `status must be 'approved', got '${update.status}'` },
      409,
    )
  }

  // 3. Routing par operation
  const payload = update.proposed_payload ?? {}
  const operation = readString(payload, 'operation') ?? ''

  try {
    let result: ApplyResult
    let nextRollbackPayload: Record<string, unknown> | null = update.rollback_payload

    switch (operation) {
      case 'coherence_rule_added':
        result = await applyCoherenceRuleAdded(supabaseAdmin, payload)
        break
      case 'coherence_rule_modified': {
        const r = await applyCoherenceRuleModified(supabaseAdmin, payload)
        result = r.result
        nextRollbackPayload = r.rollback
        break
      }
      case 'coherence_rule_deactivated':
        result = await applyCoherenceRuleDeactivated(supabaseAdmin, payload)
        break
      case 'report_template_updated':
        result = await applyReportTemplateUpdated(
          supabaseAdmin,
          payload,
          update.triggered_by_doc_id,
        )
        break
      case 'parameter_default_changed':
        result = await applyParameterDefaultChanged(payload)
        break
      case 'pricing_template_updated':
        result = await applyPricingTemplateUpdated(payload)
        break
      case 'workflow_modified':
        result = await applyWorkflowModified(payload)
        break
      default:
        throw new Error(
          `unknown operation "${operation}" — supported: coherence_rule_{added,modified,deactivated}, report_template_updated, parameter_default_changed, pricing_template_updated, workflow_modified`,
        )
    }

    // 4. Marque comme applied
    const { error: updErr } = await supabaseAdmin
      .from('system_auto_updates')
      .update({
        status: 'applied',
        applied_at: new Date().toISOString(),
        applied_by: adminUserId,
        apply_result: result,
        apply_error: null,
        rollback_payload: nextRollbackPayload ?? update.rollback_payload ?? {},
      })
      .eq('id', autoUpdateId)
    if (updErr) {
      throw new Error(`failed to mark applied: ${updErr.message}`)
    }

    // 5. Audit
    await logAudit(supabaseAdmin, {
      adminUserId,
      actionType: 'system_auto_update_applied',
      autoUpdateId,
      title: update.title,
      succeeded: true,
      newState: { operation, result },
    })

    return jsonResponse({
      ok: true,
      autoUpdateId,
      status: 'applied',
      operation,
      result,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown_error'

    // 6. Mark failed (ne RE-tente PAS automatiquement)
    await supabaseAdmin
      .from('system_auto_updates')
      .update({
        status: 'failed',
        apply_error: msg.slice(0, 1000),
      })
      .eq('id', autoUpdateId)

    await logAudit(supabaseAdmin, {
      adminUserId,
      actionType: 'system_auto_update_failed',
      autoUpdateId,
      title: update.title,
      succeeded: false,
      errorMessage: msg,
    })

    return jsonResponse({ ok: false, error: 'apply_failed', detail: msg }, 500)
  }
})
