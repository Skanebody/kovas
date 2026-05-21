/**
 * KOVAS — Edge Function : `batch-results-poller`.
 *
 * Cron : `0 * * * *` (chaque heure).
 *
 * Workflow :
 *   1. Auth : Bearer ${INTERNAL_API_SECRET} ou service-role.
 *   2. SELECT DISTINCT batch_job_id FROM regulatory_documents
 *        WHERE batch_job_id IS NOT NULL AND batch_completed_at IS NULL.
 *   3. Pour chaque batch_id :
 *        a. GET /v1/messages/batches/:id → check processing_status.
 *        b. Si 'ended' :
 *             - GET /v1/messages/batches/:id/results (NDJSON stream).
 *             - Pour chaque ligne :
 *                 result.type='succeeded'  → parse tool_use submit_regulatory_analysis,
 *                                            UPDATE regulatory_documents
 *                                            (ai_summary, ai_summary_model, topics, processed=true,
 *                                             batch_completed_at, processed_at).
 *                 result.type='errored'    → UPDATE batch_error, batch_completed_at, processed=false.
 *                 result.type='expired/canceled' → UPDATE batch_error, batch_completed_at.
 *             - Log ai_usage_log par doc (operation='regulatory_batch_analyze', batch=true).
 *   4. Retour : { ok, batches_checked, docs_completed, docs_errored }.
 *
 * NB : on n'invoque pas createAutoUpdateIfNeeded / notifyAffectedUsers ici par
 *      simplicité de la V1 batch — délégué à un futur post-process worker (V2).
 *      Pour la V1 : les analyses batch alimentent uniquement ai_summary + topics
 *      (côté RAG). Les notifs/auto-updates restent gérées par regulatory-analyze
 *      en mode synchrone pour les docs urgents.
 *
 * Coût Batch API : 50% du standard sur input + output.
 *
 * Authority : docs/ai-cost-optimization.md (Levier 2).
 */

// @ts-nocheck — Deno-only Edge Function.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_BATCH_URL = 'https://api.anthropic.com/v1/messages/batches'
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_OPUS_MODEL') ?? 'claude-opus-4-7'

// Tarif Opus 4.7 USD/Mtok (snapshot 2026-05) × 0.5 (batch discount).
const OPUS_INPUT_USD_PER_MTOK = 15
const OPUS_OUTPUT_USD_PER_MTOK = 75
const USD_TO_EUR = Number.parseFloat(Deno.env.get('USD_TO_EUR_RATE') ?? '0.92')
const BATCH_DISCOUNT = 0.5

interface BatchSummary {
  id: string
  processing_status: 'in_progress' | 'canceling' | 'ended'
  request_counts?: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
  ended_at: string | null
  results_url: string | null
}

interface BatchResultLine {
  custom_id: string
  result:
    | {
        type: 'succeeded'
        message: {
          content: Array<{ type: string; name?: string; input?: unknown; text?: string }>
          usage: {
            input_tokens: number
            output_tokens: number
            cache_creation_input_tokens?: number
            cache_read_input_tokens?: number
          }
        }
      }
    | { type: 'errored'; error: { type: string; message: string } }
    | { type: 'canceled' }
    | { type: 'expired' }
}

interface RegulatoryAnalysisInput {
  summary?: string
  impact_analysis?: string
  affected_modules?: string[]
  affected_diagnostic_types?: string[]
  entry_in_force_date?: string | null
  actions_required?: Array<{
    action_type: string
    description: string
    target?: string
    urgency: string
  }>
  topics?: string[]
  is_modification_of?: string | null
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function computeBatchCostEur(inputTokens: number, outputTokens: number): number {
  const usd =
    (inputTokens / 1_000_000) * OPUS_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * OPUS_OUTPUT_USD_PER_MTOK
  return Math.round(usd * BATCH_DISCOUNT * USD_TO_EUR * 1_000_000) / 1_000_000
}

async function retrieveBatch(apiKey: string, batchId: string): Promise<BatchSummary> {
  const res = await fetch(`${ANTHROPIC_BATCH_URL}/${batchId}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'message-batches-2024-09-24',
    },
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`retrieveBatch HTTP ${res.status}: ${errText.slice(0, 300)}`)
  }
  return (await res.json()) as BatchSummary
}

async function* iterateResults(
  apiKey: string,
  batchId: string,
): AsyncGenerator<BatchResultLine, void, unknown> {
  const res = await fetch(`${ANTHROPIC_BATCH_URL}/${batchId}/results`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'message-batches-2024-09-24',
    },
  })
  if (!res.ok || !res.body) {
    throw new Error(`iterateResults HTTP ${res.status}`)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const t = line.trim()
      if (!t) continue
      try {
        yield JSON.parse(t) as BatchResultLine
      } catch (err) {
        console.warn('[batch-results-poller] bad NDJSON line:', err)
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer.trim()) as BatchResultLine
    } catch {
      // ignore
    }
  }
}

async function processResultLine(
  client: ReturnType<typeof createClient>,
  systemUserId: string | null,
  line: BatchResultLine,
): Promise<{ status: 'ok' | 'error'; tokensIn: number; tokensOut: number }> {
  const documentId = line.custom_id
  const completedAt = new Date().toISOString()

  if (line.result.type === 'succeeded') {
    const message = line.result.message
    const usage = message.usage
    const toolUse = message.content.find(
      (b) => b.type === 'tool_use' && b.name === 'submit_regulatory_analysis',
    )
    if (!toolUse?.input) {
      await client
        .from('regulatory_documents')
        .update({
          batch_completed_at: completedAt,
          batch_error: 'no_tool_use_in_response',
          processed: false,
        })
        .eq('id', documentId)
      return { status: 'error', tokensIn: usage.input_tokens, tokensOut: usage.output_tokens }
    }
    const analysis = toolUse.input as RegulatoryAnalysisInput
    const costEur = computeBatchCostEur(usage.input_tokens, usage.output_tokens)

    const patch: Record<string, unknown> = {
      ai_summary: analysis.summary ?? null,
      ai_summary_model: ANTHROPIC_MODEL,
      ai_summary_cost_eur: costEur,
      topics: analysis.topics ?? [],
      batch_completed_at: completedAt,
      processed: true,
      processed_at: completedAt,
      batch_error: null,
    }
    if (analysis.affected_diagnostic_types) {
      patch['diagnostic_kinds'] = analysis.affected_diagnostic_types
    }

    const { error } = await client
      .from('regulatory_documents')
      .update(patch)
      .eq('id', documentId)
    if (error) {
      console.error('[batch-results-poller] update doc failed:', documentId, error.message)
    }

    // ai_usage_log : best effort.
    if (systemUserId) {
      await client.from('ai_usage_log').insert({
        user_id: systemUserId,
        operation: 'regulatory_batch_analyze',
        ai_model: ANTHROPIC_MODEL,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        cost_eur: costEur,
        duration_ms: 0,
        success: true,
      })
    }
    return { status: 'ok', tokensIn: usage.input_tokens, tokensOut: usage.output_tokens }
  }

  // Non-success : on stocke l'erreur.
  const errMsg =
    line.result.type === 'errored'
      ? `${line.result.error.type}: ${line.result.error.message}`
      : line.result.type
  await client
    .from('regulatory_documents')
    .update({
      batch_completed_at: completedAt,
      batch_error: errMsg.slice(0, 500),
      processed: false,
    })
    .eq('id', documentId)
  return { status: 'error', tokensIn: 0, tokensOut: 0 }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  const supaUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const internalSecret = Deno.env.get('INTERNAL_API_SECRET')
  const systemUserId = Deno.env.get('KOVAS_SYSTEM_USER_ID') ?? null
  if (!supaUrl || !serviceKey || !anthropicKey || !internalSecret) {
    return jsonResponse({ ok: false, error: 'missing_environment' }, 500)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (bearer !== internalSecret && bearer !== serviceKey) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  }

  const client = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const startedAt = Date.now()

  // 1. Liste les batch_id distincts encore en cours.
  const { data: pendingDocs, error: pendingErr } = await client
    .from('regulatory_documents')
    .select('batch_job_id')
    .not('batch_job_id', 'is', null)
    .is('batch_completed_at', null)

  if (pendingErr) {
    return jsonResponse({ ok: false, error: `select_pending: ${pendingErr.message}` }, 500)
  }

  const batchIds = Array.from(
    new Set(
      (pendingDocs ?? [])
        .map((r) => (r as { batch_job_id?: string }).batch_job_id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  )

  if (batchIds.length === 0) {
    return jsonResponse({
      ok: true,
      message: 'no_pending_batches',
      batches_checked: 0,
      duration_ms: Date.now() - startedAt,
    })
  }

  let docsCompleted = 0
  let docsErrored = 0
  let totalTokensIn = 0
  let totalTokensOut = 0
  const batchStatuses: Array<{ id: string; status: string }> = []

  for (const batchId of batchIds) {
    try {
      const summary = await retrieveBatch(anthropicKey, batchId)
      batchStatuses.push({ id: batchId, status: summary.processing_status })

      if (summary.processing_status !== 'ended') {
        // Encore en cours : on revient au prochain tick.
        continue
      }

      for await (const line of iterateResults(anthropicKey, batchId)) {
        const r = await processResultLine(client, systemUserId, line)
        if (r.status === 'ok') docsCompleted++
        else docsErrored++
        totalTokensIn += r.tokensIn
        totalTokensOut += r.tokensOut
      }
    } catch (err) {
      console.error(
        '[batch-results-poller] batch error:',
        batchId,
        err instanceof Error ? err.message : 'unknown',
      )
      batchStatuses.push({
        id: batchId,
        status: `error: ${err instanceof Error ? err.message.slice(0, 100) : 'unknown'}`,
      })
    }
  }

  return jsonResponse({
    ok: true,
    batches_checked: batchIds.length,
    batch_statuses: batchStatuses,
    docs_completed: docsCompleted,
    docs_errored: docsErrored,
    total_tokens_in: totalTokensIn,
    total_tokens_out: totalTokensOut,
    duration_ms: Date.now() - startedAt,
  })
})
