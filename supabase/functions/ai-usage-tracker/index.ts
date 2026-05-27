/**
 * KOVAS — Edge Function : AI usage tracker (centralise tracking IA Claude/Whisper/etc.).
 *
 * Endpoint POST /functions/v1/ai-usage-tracker
 *
 * Pas de cron : appelé synchronement depuis chaque Edge Function IA après un
 * appel Claude/Whisper/Deepgram/Embeddings réussi.
 *
 * Auth : `Authorization: Bearer <CRON_SECRET>`.
 *
 * Body :
 *   {
 *     organizationId: uuid,
 *     userId: uuid,
 *     feature: string,                  // ex 'chatbot_methodo' | 'voice_transcribe' | 'vision_photo_classify'
 *     provider: 'anthropic'|'openai'|'deepgram',
 *     modelUsed: string,
 *     inputTokens?: number,
 *     outputTokens?: number,
 *     cachedInputTokens?: number,
 *     cacheWriteTokens?: number,
 *     audioMinutes?: number,
 *     latencyMs?: number,
 *     relatedTable?: string,
 *     relatedId?: string,
 *     metadata?: Record<string, unknown>
 *   }
 *
 * Workflow :
 *   1. Calcule estimated_cost_eur_cents via grille tarifaire (env-overridable)
 *   2. INSERT dans ai_usage_logs
 *   3. Side effect : si feature='chatbot_methodo' → relay vers quota-tracker
 *      pour incrémenter chatbot_messages_used (+1).
 */

// @ts-nocheck — Deno-only Edge Function

import { createClient } from 'jsr:@supabase/supabase-js@2'

type Provider = 'anthropic' | 'openai' | 'deepgram'

interface RequestBody {
  organizationId: string
  userId: string
  feature: string
  provider: Provider
  modelUsed: string
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  cacheWriteTokens?: number
  audioMinutes?: number
  latencyMs?: number
  relatedTable?: string
  relatedId?: string
  metadata?: Record<string, unknown>
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

interface PricingEntry {
  inputUsdPerMTok?: number
  outputUsdPerMTok?: number
  cachedInputUsdPerMTok?: number
  cacheWriteUsdPerMTok?: number
  audioUsdPerMinute?: number
}

function readPricing(): Record<string, PricingEntry> {
  // Sources : env vars (overridable sans redéploiement) avec fallback grille canonique.
  function num(name: string, fallback: number): number {
    const v = Deno.env.get(name)
    if (!v) return fallback
    const n = Number(v)
    return Number.isNaN(n) ? fallback : n
  }
  return {
    'claude-haiku-4-5': {
      inputUsdPerMTok: num('ANTHROPIC_PRICING_HAIKU_INPUT_USD_PER_MTOK', 1),
      outputUsdPerMTok: num('ANTHROPIC_PRICING_HAIKU_OUTPUT_USD_PER_MTOK', 5),
      cachedInputUsdPerMTok: num('ANTHROPIC_PRICING_HAIKU_CACHED_USD_PER_MTOK', 0.1),
      cacheWriteUsdPerMTok: num('ANTHROPIC_PRICING_HAIKU_CACHE_WRITE_USD_PER_MTOK', 1.25),
    },
    'claude-sonnet-4-6': {
      inputUsdPerMTok: num('ANTHROPIC_PRICING_SONNET_INPUT_USD_PER_MTOK', 3),
      outputUsdPerMTok: num('ANTHROPIC_PRICING_SONNET_OUTPUT_USD_PER_MTOK', 15),
      cachedInputUsdPerMTok: num('ANTHROPIC_PRICING_SONNET_CACHED_USD_PER_MTOK', 0.3),
      cacheWriteUsdPerMTok: num('ANTHROPIC_PRICING_SONNET_CACHE_WRITE_USD_PER_MTOK', 3.75),
    },
    'claude-opus-4-7': {
      inputUsdPerMTok: num('ANTHROPIC_PRICING_OPUS_INPUT_USD_PER_MTOK', 15),
      outputUsdPerMTok: num('ANTHROPIC_PRICING_OPUS_OUTPUT_USD_PER_MTOK', 75),
      cachedInputUsdPerMTok: num('ANTHROPIC_PRICING_OPUS_CACHED_USD_PER_MTOK', 1.5),
      cacheWriteUsdPerMTok: num('ANTHROPIC_PRICING_OPUS_CACHE_WRITE_USD_PER_MTOK', 18.75),
    },
    'gpt-4o-mini-transcribe': {
      audioUsdPerMinute: num('OPENAI_PRICING_WHISPER_USD_PER_MIN', 0.006),
    },
    'text-embedding-3-small': {
      inputUsdPerMTok: num('OPENAI_PRICING_EMBED_SMALL_USD_PER_MTOK', 0.02),
    },
    'nova-3': {
      audioUsdPerMinute: num('DEEPGRAM_PRICING_NOVA3_USD_PER_MIN', 0.0043),
    },
  }
}

function computeCostEurCents(input: {
  pricing: Record<string, PricingEntry>
  modelUsed: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  audioMinutes: number
  usdToEur: number
}): { eurCents: number; usd: number; source: 'default' | 'unknown' } {
  const p = input.pricing[input.modelUsed]
  if (!p) return { eurCents: 0, usd: 0, source: 'unknown' }
  let usd = 0
  if (p.inputUsdPerMTok) usd += (input.inputTokens * p.inputUsdPerMTok) / 1_000_000
  if (p.outputUsdPerMTok) usd += (input.outputTokens * p.outputUsdPerMTok) / 1_000_000
  if (p.cachedInputUsdPerMTok)
    usd += (input.cachedInputTokens * p.cachedInputUsdPerMTok) / 1_000_000
  if (p.cacheWriteUsdPerMTok) usd += (input.cacheWriteTokens * p.cacheWriteUsdPerMTok) / 1_000_000
  if (p.audioUsdPerMinute) usd += input.audioMinutes * p.audioUsdPerMinute
  return { eurCents: Math.round(usd * input.usdToEur * 100), usd, source: 'default' }
}

async function relayQuotaTracker(args: {
  supabaseUrl: string
  cronSecret: string
  organizationId: string
  column: string
  delta: number
}): Promise<{ ok: boolean }> {
  try {
    const fnUrl = `${args.supabaseUrl.replace(/\/+$/, '')}/functions/v1/quota-tracker`
    const resp = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${args.cronSecret}`,
      },
      body: JSON.stringify({
        organizationId: args.organizationId,
        column: args.column,
        delta: args.delta,
      }),
    })
    return { ok: resp.ok }
  } catch {
    return { ok: false }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (!supabaseUrl || !serviceRole || !cronSecret) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }
  if (req.headers.get('Authorization') !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400)
  }
  if (!body.organizationId || !body.feature || !body.provider || !body.modelUsed) {
    return jsonResponse({ error: 'missing_fields' }, 400)
  }
  if (!['anthropic', 'openai', 'deepgram'].includes(body.provider)) {
    return jsonResponse({ error: 'invalid_provider' }, 400)
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const usdToEurRaw = Number(Deno.env.get('USD_TO_EUR_RATE') ?? '0.92')
  const usdToEur = Number.isNaN(usdToEurRaw) || usdToEurRaw <= 0 ? 0.92 : usdToEurRaw

  const pricing = readPricing()
  const cost = computeCostEurCents({
    pricing,
    modelUsed: body.modelUsed,
    inputTokens: body.inputTokens ?? 0,
    outputTokens: body.outputTokens ?? 0,
    cachedInputTokens: body.cachedInputTokens ?? 0,
    cacheWriteTokens: body.cacheWriteTokens ?? 0,
    audioMinutes: body.audioMinutes ?? 0,
    usdToEur,
  })

  const insertObj: Record<string, unknown> = {
    organization_id: body.organizationId,
    user_id: body.userId ?? null,
    feature: body.feature,
    provider: body.provider,
    model_used: body.modelUsed,
    input_tokens: body.inputTokens ?? 0,
    output_tokens: body.outputTokens ?? 0,
    cached_input_tokens: body.cachedInputTokens ?? 0,
    cache_write_tokens: body.cacheWriteTokens ?? 0,
    audio_minutes: body.audioMinutes ?? null,
    estimated_cost_eur_cents: cost.eurCents,
    latency_ms: body.latencyMs ?? null,
    related_table: body.relatedTable ?? null,
    related_id: body.relatedId ?? null,
    metadata: {
      ...(body.metadata ?? {}),
      _cost_usd: cost.usd,
      _pricing_source: cost.source,
    },
  }

  const { error } = await supabase.from('ai_usage_logs').insert(insertObj)
  if (error) {
    console.error('[ai-usage-tracker] insert failed', error)
    return jsonResponse({ error: 'insert_failed', detail: error.message }, 500)
  }

  // Side effect : feature='chatbot_methodo' → +1 chatbot_messages_used
  let quotaRelay: { ok: boolean } | null = null
  if (body.feature === 'chatbot_methodo') {
    quotaRelay = await relayQuotaTracker({
      supabaseUrl,
      cronSecret,
      organizationId: body.organizationId,
      column: 'chatbot_messages_used',
      delta: 1,
    })
  }

  return jsonResponse({
    ok: true,
    costEurCents: cost.eurCents,
    pricingSource: cost.source,
    quotaRelayed: quotaRelay?.ok ?? null,
  })
})
