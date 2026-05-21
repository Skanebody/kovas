// KOVAS — Edge Function `regulatory-analyze`
//
// Déclenchée par `regulatory-watcher` après détection d'un document nouveau/modifié.
// POST { documentId: string } → 200 { ok, analysis }
//
// 1. Charge le document `regulatory_documents.id = documentId`.
// 2. Appelle Claude Sonnet 4.6 via *tool use* (JSON forcé par schéma).
//    → `claude-sonnet-4-6` (cher mais analyse réglementaire = précision critique,
//       JAMAIS opus — coût/mission ~0,02€).
//    TODO Cost Optimization 2026-05 — Pour les docs NON urgents (importance ≠
//    'critical'), basculer vers `regulatory-batch-analyze` (Batch API 50% off,
//    cron nocturne 01:00). Conserver cette fonction pour les docs critical/high
//    déclenchés manuellement par admin où le délai 1-24h du batch est inacceptable.
// 3. Génère 2 embeddings OpenAI text-embedding-3-small (1536d) sur le full_text + le résumé.
// 4. UPDATE regulatory_documents (analysis JSON, embeddings, processed=true).
// 5. Si action requise `update_coherence_rule` ou `update_report_template` :
//    INSERT INTO system_auto_updates avec approved_by_admin=false (humain valide).
// 6. notifyAffectedUsers(documentId, analysis) :
//    INSERT regulatory_notifications par user dont l'org a une mission ≤90j sur
//    un diagnostic_type concerné par `affected_modules`.
//
// Log coût via `ai_usage_log` (operation='regulatory_analyze').
// NB : le system_prompt est déjà caché en ephemeral (cf. callClaude) → -90%
// sur le system prompt si plusieurs docs analysés dans la fenêtre 5 min.

/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Constantes & types
// ────────────────────────────────────────────────────────────

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings'
const OPENAI_EMBED_MODEL = 'text-embedding-3-small'

// Coûts unitaires Anthropic Sonnet 4.6 (USD/Mtok, snapshot 2026-05).
// Cf. https://www.anthropic.com/pricing → conversion EUR via ratio 0.92.
const ANTHROPIC_INPUT_USD_PER_MTOK = 3
const ANTHROPIC_OUTPUT_USD_PER_MTOK = 15
const USD_TO_EUR = 0.92
const OPENAI_EMBED_USD_PER_MTOK = 0.02

interface RegulatoryDocument {
  id: string
  source_id: string
  document_type: string
  reference: string | null
  title: string | null
  publication_date: string | null
  full_text: string | null
  full_text_url: string | null
  full_text_hash: string | null
  diagnostic_types: string[] | null
  topics: string[] | null
}

type ActionType =
  | 'update_coherence_rule'
  | 'update_report_template'
  | 'update_pricing'
  | 'update_workflow'
  | 'inform_users'

type Urgency = 'low' | 'medium' | 'high' | 'critical'
type AffectedModule =
  | 'dpe'
  | 'amiante'
  | 'plomb'
  | 'gaz'
  | 'electricite'
  | 'termites'
  | 'carrez'
  | 'erp'

interface RegulatoryAction {
  action_type: ActionType
  description: string
  target?: string
  urgency: Urgency
}

interface RegulatoryAnalysis {
  summary: string
  impact_analysis: string
  affected_modules: AffectedModule[]
  affected_diagnostic_types?: string[]
  entry_in_force_date?: string | null
  actions_required: RegulatoryAction[]
  topics: string[]
  is_modification_of?: string | null
}

// ────────────────────────────────────────────────────────────
// Claude tool schema (force JSON valide via tool use, JAMAIS de free-form parsing)
// ────────────────────────────────────────────────────────────

const ANALYSIS_TOOL = {
  name: 'submit_regulatory_analysis',
  description:
    'Submit structured analysis of a French real estate diagnostic regulatory document (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP).',
  input_schema: {
    type: 'object',
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
        description: 'Modules KOVAS concernés (parmi les 8 diagnostics standards).',
      },
      affected_diagnostic_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'Types de diagnostics concernés (synonymes/codes admin).',
      },
      entry_in_force_date: {
        type: ['string', 'null'],
        description: 'Date d\'entrée en vigueur (YYYY-MM-DD) si précisée, sinon null.',
      },
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
            urgency: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical'],
            },
          },
          required: ['action_type', 'description', 'urgency'],
        },
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description: 'Mots-clés / sujets : utilisés pour le RAG (5-10 topics max).',
      },
      is_modification_of: {
        type: ['string', 'null'],
        description: 'Référence/UUID d\'un document antérieur modifié, ou null.',
      },
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
Si le document n'a aucun impact métier KOVAS (ex : info financière hors-sujet), renvoie summary="Document hors périmètre KOVAS" et actions_required=[].`

// ────────────────────────────────────────────────────────────
// Anthropic call (tool use, retry exponentiel)
// ────────────────────────────────────────────────────────────

async function callClaude(doc: RegulatoryDocument): Promise<{
  analysis: RegulatoryAnalysis
  inputTokens: number
  outputTokens: number
  latencyMs: number
}> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing')

  const userContent = `Document à analyser :

Titre : ${doc.title ?? '(sans titre)'}
Référence : ${doc.reference ?? '(sans référence)'}
Type : ${doc.document_type}
Date publication : ${doc.publication_date ?? '(inconnue)'}
URL : ${doc.full_text_url ?? '(aucune)'}

--- Contenu ---
${(doc.full_text ?? '').slice(0, 60_000)}
--- Fin ---

Analyse le document et appelle obligatoirement l'outil submit_regulatory_analysis.`

  const body = {
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    system: [
      // Prompt cache 1h sur le system prompt (stable entre docs).
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    ],
    tools: [ANALYSIS_TOOL],
    tool_choice: { type: 'tool', name: 'submit_regulatory_analysis' },
    messages: [{ role: 'user', content: userContent }],
  }

  const started = Date.now()
  // Retry exponentiel sur 429/500/502/503/504
  let attempt = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      const json = (await res.json()) as {
        content: Array<{ type: string; name?: string; input?: unknown }>
        usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number }
      }
      const toolUse = json.content.find(
        (c) => c.type === 'tool_use' && c.name === 'submit_regulatory_analysis',
      )
      if (!toolUse?.input) {
        throw new Error('Claude did not call submit_regulatory_analysis tool')
      }
      return {
        analysis: toolUse.input as RegulatoryAnalysis,
        inputTokens: json.usage.input_tokens,
        outputTokens: json.usage.output_tokens,
        latencyMs: Date.now() - started,
      }
    }

    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < 3) {
      const backoffMs = 2 ** attempt * 1000 + Math.floor(Math.random() * 500)
      console.warn(
        `[regulatory-analyze] Anthropic ${res.status}, retry in ${backoffMs}ms (attempt ${attempt + 1}/3)`,
      )
      await new Promise((r) => setTimeout(r, backoffMs))
      attempt++
      continue
    }

    const errText = await res.text()
    throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 500)}`)
  }
}

// ────────────────────────────────────────────────────────────
// OpenAI embeddings
// ────────────────────────────────────────────────────────────

async function generateEmbedding(text: string): Promise<{ vector: number[]; tokens: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) throw new Error('OPENAI_API_KEY missing')

  const res = await fetch(OPENAI_EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_EMBED_MODEL,
      // Truncation côté serveur : OpenAI accepte jusqu'à 8192 tokens, on cape à ~25k chars (~6k tokens).
      input: text.slice(0, 25_000),
    }),
  })
  if (!res.ok) {
    throw new Error(`OpenAI embeddings HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    data: Array<{ embedding: number[] }>
    usage: { total_tokens: number }
  }
  const first = json.data[0]
  if (!first) throw new Error('OpenAI embeddings: empty data')
  return { vector: first.embedding, tokens: json.usage.total_tokens }
}

// ────────────────────────────────────────────────────────────
// Notifications utilisateurs concernés (heuristique : missions récentes ≤90j)
// ────────────────────────────────────────────────────────────

const MODULE_TO_MISSION_TYPES: Record<AffectedModule, string[]> = {
  dpe: ['dpe', 'dpe_vente', 'dpe_location'],
  amiante: ['amiante', 'amiante_avant_travaux', 'amiante_avant_demolition'],
  plomb: ['plomb', 'crep'],
  gaz: ['gaz', 'etat_gaz'],
  electricite: ['electricite', 'etat_electricite'],
  termites: ['termites', 'etat_parasitaire'],
  carrez: ['carrez', 'boutin', 'loi_carrez', 'loi_boutin'],
  erp: ['erp', 'etat_risques_pollutions'],
}

async function notifyAffectedUsers(
  client: SupabaseClient,
  documentId: string,
  analysis: RegulatoryAnalysis,
  documentTitle: string,
): Promise<number> {
  const affectedMissionTypes = Array.from(
    new Set(analysis.affected_modules.flatMap((m) => MODULE_TO_MISSION_TYPES[m] ?? [])),
  )
  if (affectedMissionTypes.length === 0) return 0

  const since90d = new Date(Date.now() - 90 * 86_400_000).toISOString()

  // Récupère les (user_id, organization_id) distincts ayant une mission récente
  // sur un des types concernés.
  const { data: missionsData, error: missionsErr } = await (client as any)
    .from('missions')
    .select('created_by, organization_id, mission_type')
    .in('mission_type', affectedMissionTypes)
    .gte('created_at', since90d)

  if (missionsErr) {
    console.error('[regulatory-analyze] missions query error:', missionsErr.message)
    return 0
  }
  const missions = (missionsData as
    | Array<{
        created_by: string | null
        organization_id: string | null
        mission_type: string | null
      }>
    | null) ?? []
  const pairs = new Map<string, { user_id: string; organization_id: string | null }>()
  for (const m of missions) {
    if (!m.created_by) continue
    const key = `${m.created_by}|${m.organization_id ?? ''}`
    if (!pairs.has(key)) {
      pairs.set(key, { user_id: m.created_by, organization_id: m.organization_id })
    }
  }
  if (pairs.size === 0) return 0

  // Priorité : critical/high → 'high', sinon 'medium'.
  const maxUrgency = analysis.actions_required.reduce<Urgency>((acc, a) => {
    const rank: Record<Urgency, number> = { low: 0, medium: 1, high: 2, critical: 3 }
    return rank[a.urgency] > rank[acc] ? a.urgency : acc
  }, 'low')
  const priority: 'low' | 'medium' | 'high' =
    maxUrgency === 'critical' || maxUrgency === 'high' ? 'high' : 'medium'

  const rows = Array.from(pairs.values()).map((p) => ({
    user_id: p.user_id,
    organization_id: p.organization_id,
    document_id: documentId,
    notification_type: 'regulatory_change',
    priority,
    title: `Évolution réglementaire : ${documentTitle.slice(0, 120)}`,
    body: analysis.summary,
    call_to_action: 'Consulter les changements',
  }))

  const { error: insertErr } = await (client as any)
    .from('regulatory_notifications')
    .insert(rows)
  if (insertErr) {
    console.error('[regulatory-analyze] notifications insert error:', insertErr.message)
    return 0
  }
  return rows.length
}

// ────────────────────────────────────────────────────────────
// Auto-update système (approbation humaine obligatoire)
// ────────────────────────────────────────────────────────────

async function createAutoUpdateIfNeeded(
  client: SupabaseClient,
  documentId: string,
  analysis: RegulatoryAnalysis,
): Promise<number> {
  const sensitiveActions = analysis.actions_required.filter(
    (a) => a.action_type === 'update_coherence_rule' || a.action_type === 'update_report_template',
  )
  if (sensitiveActions.length === 0) return 0

  const rows = sensitiveActions.map((a) => ({
    triggered_by_document_id: documentId,
    update_type: a.action_type,
    target_table: a.action_type === 'update_coherence_rule' ? 'coherence_rules' : 'report_templates',
    target_id: a.target ?? null,
    changes_applied: { description: a.description, urgency: a.urgency } as Record<string, unknown>,
    rollback_data: null,
    approved_by_admin: false,
  }))

  const { error } = await (client as any).from('system_auto_updates').insert(rows)
  if (error) {
    console.error('[regulatory-analyze] system_auto_updates insert error:', error.message)
    return 0
  }
  return rows.length
}

// ────────────────────────────────────────────────────────────
// Coût tracking
// ────────────────────────────────────────────────────────────

function computeCostEur(
  inputTokens: number,
  outputTokens: number,
  embedTokens: number,
): number {
  const claudeUsd =
    (inputTokens / 1_000_000) * ANTHROPIC_INPUT_USD_PER_MTOK +
    (outputTokens / 1_000_000) * ANTHROPIC_OUTPUT_USD_PER_MTOK
  const openaiUsd = (embedTokens / 1_000_000) * OPENAI_EMBED_USD_PER_MTOK
  return (claudeUsd + openaiUsd) * USD_TO_EUR
}

async function logAiUsage(
  client: SupabaseClient,
  params: {
    documentId: string
    inputTokens: number
    outputTokens: number
    embedTokens: number
    durationMs: number
    success: boolean
    errorMessage?: string
  },
): Promise<void> {
  const costEur = computeCostEur(params.inputTokens, params.outputTokens, params.embedTokens)
  // ai_usage_log : table existante (cf. migration 20260523140000_documents.sql)
  // user_id NOT NULL → on stocke un user technique "system" si absent (cf. seed/.env).
  const systemUserId = Deno.env.get('KOVAS_SYSTEM_USER_ID') ?? null
  if (!systemUserId) {
    console.warn('[regulatory-analyze] KOVAS_SYSTEM_USER_ID missing — skipping ai_usage_log')
    return
  }
  const { error } = await (client as any).from('ai_usage_log').insert({
    user_id: systemUserId,
    document_id: null, // ai_usage_log.document_id pointe documents.id (pas regulatory_documents)
    operation: 'regulatory_analyze',
    ai_model: ANTHROPIC_MODEL,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    cost_eur: costEur,
    duration_ms: params.durationMs,
    success: params.success,
    error_message: params.errorMessage ?? null,
  })
  if (error) {
    console.error('[regulatory-analyze] ai_usage_log insert error:', error.message)
  }
  // Cost-tracker centralisé (ai-usage-tracker Edge Function — créée vague suivante).
  // Best-effort, ne bloque pas l'analyse réglementaire si indisponible.
  const supaUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (supaUrl && serviceKey) {
    try {
      await fetch(`${supaUrl}/functions/v1/ai-usage-tracker`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          userId: systemUserId,
          feature: 'regulatory_analysis',
          provider: 'anthropic',
          modelUsed: ANTHROPIC_MODEL,
          inputTokens: params.inputTokens,
          outputTokens: params.outputTokens,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          estimatedCostEur: costEur,
          latencyMs: params.durationMs,
        }),
      })
    } catch {
      // silent
    }
  }
}

// ────────────────────────────────────────────────────────────
// Handler principal
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const startedAt = Date.now()
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'POST only' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supaUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supaUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: 'missing supabase env' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const client = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: { documentId?: string }
  try {
    body = (await req.json()) as { documentId?: string }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const documentId = body.documentId
  if (!documentId) {
    return new Response(JSON.stringify({ ok: false, error: 'documentId required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // 1. Charge le document
  const { data: docData, error: docErr } = await (client as any)
    .from('regulatory_documents')
    .select(
      'id, source_id, document_type, reference, title, publication_date, full_text, full_text_url, full_text_hash, diagnostic_types, topics',
    )
    .eq('id', documentId)
    .single()
  if (docErr || !docData) {
    return new Response(
      JSON.stringify({ ok: false, error: docErr?.message ?? 'document not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    )
  }
  const doc = docData as RegulatoryDocument

  // Marque processing_status = 'processing'
  await (client as any)
    .from('regulatory_documents')
    .update({ processing_status: 'processing' })
    .eq('id', documentId)

  try {
    // 2. Analyse Claude
    const claudeResult = await callClaude(doc)
    const analysis = claudeResult.analysis

    // 3. Embeddings (full_text + summary)
    const embedFullText = doc.full_text
      ? await generateEmbedding(doc.full_text)
      : { vector: [] as number[], tokens: 0 }
    const embedSummary = await generateEmbedding(analysis.summary)
    const totalEmbedTokens = embedFullText.tokens + embedSummary.tokens

    // 4. UPDATE document
    const updatePatch: Record<string, unknown> = {
      ai_summary: analysis.summary,
      ai_impact_analysis: analysis.impact_analysis,
      ai_affected_modules: analysis.affected_modules,
      ai_actions_required: analysis.actions_required,
      topics: analysis.topics,
      diagnostic_types: analysis.affected_diagnostic_types ?? doc.diagnostic_types,
      entry_in_force_date: analysis.entry_in_force_date ?? null,
      ai_summary_embedding: embedSummary.vector,
      processed: true,
      processing_status: 'completed',
      processed_at: new Date().toISOString(),
    }
    if (embedFullText.vector.length > 0) {
      updatePatch['embedding'] = embedFullText.vector
    }

    const { error: updErr } = await (client as any)
      .from('regulatory_documents')
      .update(updatePatch)
      .eq('id', documentId)
    if (updErr) throw new Error(`document update failed: ${updErr.message}`)

    // 5. Auto-updates système (sensibles → approbation humaine)
    const autoUpdates = await createAutoUpdateIfNeeded(client, documentId, analysis)

    // 6. Notifications utilisateurs concernés
    const notified = await notifyAffectedUsers(
      client,
      documentId,
      analysis,
      doc.title ?? '(document sans titre)',
    )

    const durationMs = Date.now() - startedAt
    await logAiUsage(client, {
      documentId,
      inputTokens: claudeResult.inputTokens,
      outputTokens: claudeResult.outputTokens,
      embedTokens: totalEmbedTokens,
      durationMs,
      success: true,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        documentId,
        duration_ms: durationMs,
        analysis,
        auto_updates_created: autoUpdates,
        users_notified: notified,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const errMsg = (err as Error).message ?? String(err)
    console.error('[regulatory-analyze] error:', errMsg)
    await (client as any)
      .from('regulatory_documents')
      .update({
        processing_status: 'failed',
        processing_error: errMsg.slice(0, 1000),
      })
      .eq('id', documentId)

    await logAiUsage(client, {
      documentId,
      inputTokens: 0,
      outputTokens: 0,
      embedTokens: 0,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: errMsg,
    })

    return new Response(JSON.stringify({ ok: false, error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
