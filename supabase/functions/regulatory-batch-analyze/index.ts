/**
 * KOVAS — Edge Function : `regulatory-batch-analyze`.
 *
 * Cron : `0 1 * * *` (01:00 Europe/Paris chaque nuit).
 *
 * Workflow :
 *   1. Auth : Bearer ${INTERNAL_API_SECRET} (cron interne) ou service-role.
 *   2. SELECT regulatory_documents WHERE processed=false AND batch_job_id IS NULL LIMIT 1000.
 *   3. Construit 1 Batch Anthropic (max 100k requests, on cap à 1000).
 *      - Modèle : claude-opus-4-7 (réglementaire = précision critique, cf. CLAUDE.md §8).
 *      - Tool use forcé : submit_regulatory_analysis (schéma identique à regulatory-analyze).
 *   4. POST https://api.anthropic.com/v1/messages/batches → batch_id.
 *   5. UPDATE regulatory_documents SET batch_job_id=batch.id, batch_submitted_at=now()
 *      WHERE id IN (...).
 *   6. Retour : { ok, batch_id, count }.
 *
 * Tarif : 50% du coût standard (Opus 4.7) → ~0,01€/doc analysé vs 0,02€ synchrone.
 *
 * Authority : docs/ai-cost-optimization.md (Levier 2).
 */

// @ts-nocheck — Deno-only Edge Function.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_OPUS_MODEL') ?? 'claude-opus-4-7'
const ANTHROPIC_BATCH_URL = 'https://api.anthropic.com/v1/messages/batches'

const BATCH_MAX_DOCS = Number.parseInt(Deno.env.get('REGULATORY_BATCH_MAX_DOCS') ?? '1000', 10)

// ────────────────────────────────────────────────────────────
// Tool schema identique à regulatory-analyze (source de vérité partagée).
// ────────────────────────────────────────────────────────────

const ANALYSIS_TOOL = {
  name: 'submit_regulatory_analysis',
  description:
    'Submit structured analysis of a French real estate diagnostic regulatory document (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP).',
  input_schema: {
    type: 'object' as const,
    properties: {
      summary: {
        type: 'string',
        description:
          'Résumé exécutif du document en 2-3 phrases (FR), pour un diagnostiqueur immobilier indépendant.',
      },
      impact_analysis: {
        type: 'string',
        description:
          'Analyse impact métier : ce qui change concrètement pour le diagnostiqueur (workflow, calcul, rapport, prix). FR.',
      },
      affected_modules: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['dpe', 'amiante', 'plomb', 'gaz', 'electricite', 'termites', 'carrez', 'erp'],
        },
      },
      affected_diagnostic_types: {
        type: 'array',
        items: { type: 'string' },
      },
      entry_in_force_date: { type: ['string', 'null'] },
      actions_required: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action_type: {
              type: 'string',
              enum: [
                'update_coherence_rule',
                'update_report_template',
                'update_pricing',
                'update_workflow',
                'inform_users',
              ],
            },
            description: { type: 'string' },
            target: { type: 'string' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
          },
          required: ['action_type', 'description', 'urgency'],
        },
      },
      topics: { type: 'array', items: { type: 'string' } },
      is_modification_of: { type: ['string', 'null'] },
    },
    required: ['summary', 'impact_analysis', 'affected_modules', 'actions_required', 'topics'],
  },
}

const SYSTEM_PROMPT = `Tu es un assistant juridique expert en réglementation française du diagnostic immobilier.
KOVAS est un SaaS B2B utilisé par ~13 000 diagnostiqueurs immobiliers indépendants en France.

Mission : analyser un document réglementaire (arrêté, décret, circulaire DHUP, communiqué ADEME, FAQ Cofrac, etc.)
et structurer ton analyse via l'outil submit_regulatory_analysis.

Périmètre KOVAS V1 : 8 diagnostics standards (DPE, amiante, plomb CREP, gaz, électricité, termites, Carrez/Boutin, ERP).
EXCLU : audit énergétique, DTG, marketplace MAR/RGE.

Ton FR sobre, professionnel. JAMAIS de marketing. Cite la référence exacte si possible.
Si le document n'a aucun impact métier KOVAS, renvoie summary="Document hors périmètre KOVAS" et actions_required=[].`

// ────────────────────────────────────────────────────────────
// Types DB.
// ────────────────────────────────────────────────────────────

interface RegulatoryDocumentForBatch {
  id: string
  doc_type: string
  title: string | null
  url: string | null
  published_at: string | null
  raw_text: string | null
}

interface BatchRequestPayload {
  custom_id: string
  params: {
    model: string
    max_tokens: number
    system: Array<{ type: 'text'; text: string }>
    tools: typeof ANALYSIS_TOOL[]
    tool_choice: { type: 'tool'; name: string }
    messages: Array<{ role: 'user'; content: string }>
  }
}

function buildRequest(doc: RegulatoryDocumentForBatch): BatchRequestPayload {
  const userContent = `Document à analyser :

Titre : ${doc.title ?? '(sans titre)'}
Type : ${doc.doc_type}
Date publication : ${doc.published_at ?? '(inconnue)'}
URL : ${doc.url ?? '(aucune)'}

--- Contenu ---
${(doc.raw_text ?? '').slice(0, 60_000)}
--- Fin ---

Analyse le document et appelle obligatoirement l'outil submit_regulatory_analysis.`

  return {
    custom_id: doc.id,
    params: {
      model: ANTHROPIC_MODEL,
      max_tokens: 2048,
      system: [{ type: 'text', text: SYSTEM_PROMPT }],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: 'tool', name: 'submit_regulatory_analysis' },
      messages: [{ role: 'user', content: userContent }],
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
  }

  const supaUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  const internalSecret = Deno.env.get('INTERNAL_API_SECRET')
  if (!supaUrl || !serviceKey || !anthropicKey || !internalSecret) {
    return jsonResponse({ ok: false, error: 'missing_environment' }, 500)
  }

  // Auth : Bearer service role OU internal secret (cron interne).
  const authHeader = req.headers.get('Authorization') ?? ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (bearer !== internalSecret && bearer !== serviceKey) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401)
  }

  const client = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const startedAt = Date.now()

  // 1. Récupère les docs en attente d'analyse.
  const { data: pendingData, error: pendingErr } = await client
    .from('regulatory_documents')
    .select('id, doc_type, title, url, published_at, raw_text')
    .eq('processed', false)
    .is('batch_job_id', null)
    .order('created_at', { ascending: true })
    .limit(BATCH_MAX_DOCS)

  if (pendingErr) {
    return jsonResponse({ ok: false, error: `select_pending_failed: ${pendingErr.message}` }, 500)
  }

  const pending = (pendingData ?? []) as RegulatoryDocumentForBatch[]
  if (pending.length === 0) {
    return jsonResponse({
      ok: true,
      message: 'no_pending_documents',
      count: 0,
      duration_ms: Date.now() - startedAt,
    })
  }

  // 2. Construit le batch.
  const requests = pending.map(buildRequest)

  // 3. Soumission Anthropic Batch API.
  const submittedAt = new Date().toISOString()
  let batchId: string
  try {
    const res = await fetch(ANTHROPIC_BATCH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'message-batches-2024-09-24',
      },
      body: JSON.stringify({ requests }),
    })
    if (!res.ok) {
      const errText = await res.text()
      return jsonResponse(
        { ok: false, error: `anthropic_batch_${res.status}`, details: errText.slice(0, 500) },
        500,
      )
    }
    const json = (await res.json()) as { id: string; processing_status: string }
    batchId = json.id
  } catch (err) {
    return jsonResponse(
      { ok: false, error: 'anthropic_fetch_failed', details: err instanceof Error ? err.message : 'unknown' },
      500,
    )
  }

  // 4. Marque les docs comme batched.
  const docIds = pending.map((d) => d.id)
  const { error: updErr } = await client
    .from('regulatory_documents')
    .update({ batch_job_id: batchId, batch_submitted_at: submittedAt })
    .in('id', docIds)

  if (updErr) {
    console.error('[regulatory-batch-analyze] update batch_job_id failed:', updErr.message)
    // On ne re-throw pas : le batch est lancé chez Anthropic, on log seulement.
  }

  return jsonResponse({
    ok: true,
    batch_id: batchId,
    count: pending.length,
    submitted_at: submittedAt,
    duration_ms: Date.now() - startedAt,
  })
})
