/**
 * KOVAS — Edge Function : backfill embeddings sur regulatory_documents.
 *
 * Worker one-shot / cron quotidien 04:00 UTC.
 *
 * Pour chaque batch :
 *   1. SELECT regulatory_documents WHERE embedding IS NULL AND processed_at IS NOT NULL LIMIT 100
 *   2. Pour chaque doc :
 *      - texte = (ai_summary ?? '') + ' ' + raw_text (cap 8192 tokens ~ 32k chars)
 *   3. Batch OpenAI embeddings (text-embedding-3-small, dim 1536)
 *   4. UPDATE par lot : embedding + embedding_generated_at
 *   5. Log progression
 *
 * Idempotent — relancer ne réembed pas les docs déjà traités (clause WHERE embedding IS NULL).
 *
 * Authority : CLAUDE.md §8 stack IA + module 8 RAG.
 *
 * Note : tourne sous Deno (Supabase Edge Runtime).
 */

// @ts-nocheck — Deno-only Edge Function.

import OpenAI from 'npm:openai@4.77.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_DIMENSIONS = 1536
const BATCH_SIZE = 100
const MAX_CHARS_PER_DOC = 32_000 // ~8192 tokens (FR ~ 4 chars/token)

interface DocRow {
  id: string
  title: string
  ai_summary: string | null
  raw_text: string
}

function truncate(text: string, max = MAX_CHARS_PER_DOC): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n[...tronqué]`
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('method_not_allowed', { status: 405 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!supabaseUrl || !serviceRole || !openaiKey) {
    return new Response(JSON.stringify({ error: 'missing_environment' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  // Auth cron : header partagé pour empêcher déclenchement public arbitraire.
  const cronSecret = Deno.env.get('CRON_SECRET')
  const provided = req.headers.get('x-cron-secret')
  if (cronSecret && provided !== cronSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403,
      headers: { 'content-type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const openai = new OpenAI({ apiKey: openaiKey })

  const startedAt = Date.now()
  let totalProcessed = 0
  let totalTokens = 0
  const errors: { id: string; error: string }[] = []

  // 1. Fetch batch de docs sans embedding
  const { data, error } = await supabase
    .from('regulatory_documents')
    .select('id, title, ai_summary, raw_text')
    .is('embedding', null)
    .not('processed_at', 'is', null)
    .limit(BATCH_SIZE)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const docs = (data ?? []) as DocRow[]
  if (docs.length === 0) {
    return new Response(
      JSON.stringify({
        ok: true,
        processed: 0,
        message: 'no_documents_pending',
        durationMs: Date.now() - startedAt,
      }),
      { headers: { 'content-type': 'application/json' } },
    )
  }

  // 2. Prépare les textes (résumé + raw_text tronqué)
  const inputs = docs.map((d) => {
    const summary = d.ai_summary ? `${d.ai_summary}\n\n` : ''
    return truncate(`${summary}${d.raw_text}`)
  })

  // 3. Batch OpenAI (cap 2048, on est < 100 → 1 seul appel)
  try {
    const resp = await openai.embeddings.create({
      model: EMBED_MODEL,
      input: inputs,
      dimensions: EMBED_DIMENSIONS,
      encoding_format: 'float',
    })
    totalTokens = resp.usage.total_tokens

    // 4. UPDATE doc par doc — Supabase ne supporte pas le batch UPDATE multi-id
    // efficacement sur des vectors ; on parallélise.
    const updates = resp.data.map(async (datum, i) => {
      const doc = docs[i]
      if (!doc) return
      const { error: updErr } = await supabase
        .from('regulatory_documents')
        .update({
          embedding: datum.embedding,
          embedding_generated_at: new Date().toISOString(),
        })
        .eq('id', doc.id)
      if (updErr) {
        errors.push({ id: doc.id, error: updErr.message })
      } else {
        totalProcessed++
      }
    })
    await Promise.all(updates)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return new Response(JSON.stringify({ error: `openai_failed: ${msg}` }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const costEur =
    Math.round((totalTokens / 1_000_000) * 0.02 * 0.93 * 1_000_000) / 1_000_000

  return new Response(
    JSON.stringify({
      ok: true,
      processed: totalProcessed,
      pending: docs.length - totalProcessed,
      errors,
      tokens: totalTokens,
      costEur,
      durationMs: Date.now() - startedAt,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
