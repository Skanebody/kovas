/**
 * KOVAS — Edge Function : RAG chatbot réglementaire ("Pose ta question méthodo").
 *
 * Endpoint POST /functions/v1/regulatory-ai-chat
 *
 * Workflow :
 *   1. Auth user (JWT Supabase via Authorization header)
 *   2. INSERT message user dans regulatory_ai_conversations (role='user')
 *   3. RAG :
 *      - Embed query (OpenAI text-embedding-3-small, 1536 dim)
 *      - Top-5 docs réglementaires (pgvector cosine via RPC match_regulatory_documents)
 *      - Top-3 cas communauté (full-text français via RPC match_community_cases)
 *   4. Compose contexte markdown structuré ([D1]...[D5] + [C1]...[C3])
 *   5. Stream Claude Haiku 4.5 en SSE (event: token / event: citation / event: done)
 *   6. INSERT message assistant + cited_documents, cited_community_cases, cited_sources
 *   7. INSERT ai_usage_log (operation='regulatory_chat')
 *
 * Coût :
 *   - Embedding : ~50-200 tokens query → 0,0000001 EUR
 *   - Claude Haiku 4.5 : ~3000 input + 500 output → ~0,0024 USD ≈ 0,0022 EUR
 *   - Total : ~0,002 EUR / message → ~0,02 EUR / conversation 10 messages
 *
 * Sécurité :
 *   - Auth requise (JWT Supabase)
 *   - Filtre processed_at IS NOT NULL + is_superseded=false côté RPC (pas de leak doc non publié)
 *   - cited_documents validés contre l'ensemble retourné par le RAG (pas d'IDs fabriqués)
 *
 * Note : ce fichier tourne sous Deno (Supabase Edge Runtime). Les types Web standard
 * (Response, Request, ReadableStream) sont utilisés directement.
 *
 * Authority : CLAUDE.md §3 + §8 stack IA Anthropic + OpenAI.
 */

// @ts-nocheck — Deno-only Edge Function ; n'est pas compilée par tsc du workspace Node.
// Le typecheck Node ignore ce fichier (cf. exclude tsconfig).

import Anthropic from 'npm:@anthropic-ai/sdk@0.96.0'
import OpenAI from 'npm:openai@4.77.0'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Routing modèle : feature='chatbot_methodo' → Sonnet 4.6 (cf. lib/ai/anthropic-config.ts
// MODEL_FOR_FEATURE). Haiku 4.5 conservé en fallback configurable via env pour A/B.
// TODO : si l'env ANTHROPIC_MODEL_REG_CHAT pointe vers Haiku, vérifier la qualité
// sur 50 questions test avant bascule définitive.
const ANTHROPIC_MODEL = Deno.env.get('ANTHROPIC_MODEL_REG_CHAT') ?? 'claude-sonnet-4-6'
const EMBED_MODEL = 'text-embedding-3-small'
const EMBED_DIMENSIONS = 1536

// Anthropic exige ≥ 1024 tokens pour qu'un bloc soit cacheable. ~4 chars/token FR.
const CACHE_MIN_CHARS = 1024 * 4

const SYSTEM_PROMPT = `Tu es l'assistant méthodologique KOVAS, expert en réglementation française du diagnostic immobilier (DPE, amiante, plomb, gaz, électricité, termites, Carrez/Boutin, ERP).

RÈGLES STRICTES :
1. Réponds UNIQUEMENT en français, ton professionnel et SOBRE (pas de gaming/lifestyle).
2. Cite OBLIGATOIREMENT tes sources avec leur référence [D1] [D2] [C1] etc. dans la réponse.
3. Si la question dépasse la base documentaire ou si tu n'es pas sûr, dis-le explicitement.
4. Ne fais pas d'avis juridique personnel — renvoie à un professionnel si question hors compétence.
5. Format : phrases courtes, listes à puces si plusieurs points, pas de markdown excessif.
6. Inclus les références aux articles de loi / arrêtés cités dans les documents [Dx].
7. Si un cas communauté [Cx] est pertinent, mentionne-le explicitement comme "exemple d'un confrère".

Tu réponds à un diagnostiqueur professionnel en exercice — vocabulaire métier OK, pas besoin de vulgariser.`

interface RequestBody {
  sessionId?: string
  message: string
  missionContext?: {
    dossierId?: string
    currentField?: string
  }
}

interface RegDocHit {
  id: string
  title: string
  ai_summary: string | null
  url: string
  similarity: number
  published_at: string | null
  importance: string
}

interface CommunityHit {
  id: string
  title: string
  question: string
  decision_made: string | null
  justification: string | null
  rank: number
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function sseHeaders(): HeadersInit {
  return {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    'x-accel-buffering': 'no',
    connection: 'keep-alive',
  }
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function composeContext(docs: RegDocHit[], cases: CommunityHit[], maxChars = 6000): string {
  if (docs.length === 0 && cases.length === 0) {
    return 'AUCUN DOCUMENT PERTINENT TROUVÉ DANS LA BASE RÉGLEMENTAIRE.'
  }

  const blocks: string[] = []
  let used = 0
  const push = (b: string): void => {
    if (used + b.length > maxChars) return
    blocks.push(b)
    used += b.length
  }

  if (docs.length > 0) {
    push('## Documents réglementaires pertinents\n')
    docs.forEach((doc, i) => {
      const ref = `[D${i + 1}]`
      push(
        `### ${ref} ${doc.title}\n- URL : ${doc.url}\n- Publié : ${doc.published_at ?? 'n/a'}\n- Importance : ${doc.importance}\n- Résumé : ${doc.ai_summary ?? '(pas de résumé)'}\n\n`,
      )
    })
  }
  if (cases.length > 0) {
    push('## Cas communauté (anonymisés) en lien\n')
    cases.forEach((c, i) => {
      const ref = `[C${i + 1}]`
      push(
        `### ${ref} ${c.title}\n- Question : ${c.question}\n- Décision : ${c.decision_made ?? '(pas de décision)'}\n- Justification : ${c.justification ?? '(pas de justification)'}\n\n`,
      )
    })
  }
  return blocks.join('')
}

// Pricing USD/Mtok (snapshot 2026-05). Cf. apps/web/src/lib/ai/anthropic-config.ts.
const PRICING_USD_PER_MTOK: Record<
  string,
  { input: number; output: number; cached: number; cacheWrite: number }
> = {
  'claude-haiku-4-5': { input: 1, output: 5, cached: 0.1, cacheWrite: 1.25 },
  'claude-sonnet-4-6': { input: 3, output: 15, cached: 0.3, cacheWrite: 3.75 },
  'claude-opus-4-7': { input: 15, output: 75, cached: 1.5, cacheWrite: 18.75 },
}

function computeClaudeCostEur(usage: {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}): number {
  const p = PRICING_USD_PER_MTOK[ANTHROPIC_MODEL] ?? PRICING_USD_PER_MTOK['claude-sonnet-4-6']!
  // SDK Anthropic convention : input_tokens N'INCLUT PAS cache_read ni cache_creation.
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheCreate = usage.cache_creation_input_tokens ?? 0
  const billableInput = usage.input_tokens
  const usd =
    (billableInput / 1_000_000) * p.input +
    (cacheCreate / 1_000_000) * p.cacheWrite +
    (cacheRead / 1_000_000) * p.cached +
    (usage.output_tokens / 1_000_000) * p.output
  return Math.round(usd * 0.92 * 1_000_000) / 1_000_000
}

/**
 * Construit le contenu user avec cache_control ephemeral sur le bloc RAG context.
 *
 * Pourquoi 2 blocs :
 *   - bloc 1 = ragContext (stable sur la durée de la conversation) → cacheable
 *   - bloc 2 = userQuery + dossierLine (variable à chaque message) → non caché
 *
 * Économie attendue : sur une conversation de 10 messages, 9 cache hits sur le RAG
 * context (~5k tokens) → -85% sur ce segment. Sur le system_prompt (~1k tokens), idem.
 *
 * Limite : le cache TTL ephemeral est 5 min. Pour des conversations actives > 5 min,
 * le bloc rag est ré-écrit (cacheCreate counts) puis ré-utilisé. Pour des sessions
 * espacées, on perd le cache → coût standard. KOVAS V1 accepte cette dégradation
 * naturelle (chat synchrone, pas de heartbeat).
 */
function buildUserContent(
  ragContext: string,
  userQuery: string,
  dossierLine: string,
): Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> {
  const ragBlock = `CONTEXTE DOCUMENTAIRE :\n${ragContext}`
  const queryBlock = `${dossierLine}\n\nQUESTION DU DIAGNOSTIQUEUR :\n${userQuery}`
  // On ne cache que si le RAG context est assez large pour respecter le minimum Anthropic.
  if (ragBlock.length >= CACHE_MIN_CHARS) {
    return [
      { type: 'text', text: ragBlock, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: queryBlock },
    ]
  }
  return [{ type: 'text', text: `${ragBlock}${queryBlock}` }]
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!supabaseUrl || !supabaseAnon || !serviceRole || !openaiKey || !anthropicKey) {
    return jsonResponse({ error: 'missing_environment' }, 500)
  }

  // Auth user via Authorization header (JWT Supabase)
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
  const userId = userData.user.id

  // Récupère l'org du user
  const { data: profile } = await supabaseUser
    .from('profiles')
    .select('default_org_id')
    .eq('id', userId)
    .maybeSingle()
  const orgId = (profile as { default_org_id?: string } | null)?.default_org_id ?? null
  if (!orgId) {
    return jsonResponse({ error: 'no_organization' }, 403)
  }

  // Service-role client pour bypass RLS sur inserts (regulatory_ai_conversations).
  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: RequestBody
  try {
    body = (await req.json()) as RequestBody
  } catch {
    return jsonResponse({ error: 'invalid_body' }, 400)
  }

  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return jsonResponse({ error: 'message_required' }, 400)
  }
  if (body.message.length > 4000) {
    return jsonResponse({ error: 'message_too_long' }, 400)
  }

  const sessionId = body.sessionId ?? crypto.randomUUID()
  const userMessage = body.message.trim()

  // 1. INSERT user message
  await supabaseAdmin.from('regulatory_ai_conversations').insert({
    user_id: userId,
    organization_id: orgId,
    session_id: sessionId,
    message_role: 'user',
    message_content: userMessage,
  })

  // 2. RAG : embed query
  const openai = new OpenAI({ apiKey: openaiKey })
  const embedResp = await openai.embeddings.create({
    model: EMBED_MODEL,
    input: userMessage,
    dimensions: EMBED_DIMENSIONS,
    encoding_format: 'float',
  })
  const queryEmbedding = embedResp.data[0]?.embedding
  if (!queryEmbedding) {
    return jsonResponse({ error: 'embedding_failed' }, 500)
  }
  const embeddingTokens = embedResp.usage.total_tokens
  const embeddingCostEur =
    Math.round((embeddingTokens / 1_000_000) * 0.02 * 0.93 * 1_000_000) / 1_000_000

  // 3. Recherche docs + cas en parallèle
  const [docsResp, casesResp] = await Promise.all([
    supabaseAdmin.rpc('match_regulatory_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.65,
      match_count: 5,
    }),
    supabaseAdmin.rpc('match_community_cases', {
      query_text: userMessage,
      match_count: 3,
    }),
  ])

  const docs = ((docsResp.data ?? []) as RegDocHit[]).filter((d) => !!d.id)
  const cases = ((casesResp.data ?? []) as CommunityHit[]).filter((c) => !!c.id)

  // 4. Compose contexte
  const ragContext = composeContext(docs, cases)
  const dossierLine = body.missionContext?.dossierId
    ? `\n\nCONTEXTE MISSION : dossier ${body.missionContext.dossierId}${body.missionContext.currentField ? `, champ courant : ${body.missionContext.currentField}` : ''}.`
    : ''

  // 5. Stream Claude
  const anthropic = new Anthropic({ apiKey: anthropicKey })
  const messageId = crypto.randomUUID()
  let fullText = ''
  let usageRef: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  } | null = null

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      try {
        // Émet d'abord les citations connues (le client peut afficher les sources avant la fin du stream)
        for (let i = 0; i < docs.length; i++) {
          const d = docs[i]
          if (!d) continue
          controller.enqueue(
            encoder.encode(
              sseEvent('citation', {
                ref: `D${i + 1}`,
                document_id: d.id,
                title: d.title,
                url: d.url,
                kind: 'regulatory',
              }),
            ),
          )
        }
        for (let i = 0; i < cases.length; i++) {
          const c = cases[i]
          if (!c) continue
          controller.enqueue(
            encoder.encode(
              sseEvent('citation', {
                ref: `C${i + 1}`,
                case_id: c.id,
                title: c.title,
                kind: 'community',
              }),
            ),
          )
        }

        const claudeStream = await anthropic.messages.stream({
          model: ANTHROPIC_MODEL,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: SYSTEM_PROMPT,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [
            {
              role: 'user',
              // Bloc 1 (RAG context, stable sur la conversation) caché ephemeral 5 min ;
              // bloc 2 (query + dossierLine) variable à chaque message, non caché.
              // Économie : sur 10 messages, ~9 cache hits sur system + RAG (~ -85% input).
              content: buildUserContent(ragContext, userMessage, dossierLine),
            },
          ],
        })

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text
            fullText += text
            controller.enqueue(encoder.encode(sseEvent('token', { text })))
          } else if (event.type === 'message_delta') {
            // usage cumulé à la fin
            if (event.usage) {
              usageRef = {
                input_tokens: (usageRef?.input_tokens ?? 0),
                output_tokens: event.usage.output_tokens ?? 0,
                cache_creation_input_tokens: usageRef?.cache_creation_input_tokens,
                cache_read_input_tokens: usageRef?.cache_read_input_tokens,
              }
            }
          } else if (event.type === 'message_start') {
            const u = event.message.usage
            usageRef = {
              input_tokens: u.input_tokens,
              output_tokens: u.output_tokens ?? 0,
              cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
              cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
            }
          }
        }

        // 6. Persistance post-stream
        const citedDocuments = docs.map((d) => d.id)
        const citedCases = cases.map((c) => c.id)
        const citedSources = [
          ...docs.map((d, i) => ({ ref: `D${i + 1}`, document_id: d.id, title: d.title, url: d.url })),
          ...cases.map((c, i) => ({ ref: `C${i + 1}`, case_id: c.id, title: c.title })),
        ]

        await supabaseAdmin.from('regulatory_ai_conversations').insert({
          id: messageId,
          user_id: userId,
          organization_id: orgId,
          session_id: sessionId,
          message_role: 'assistant',
          message_content: fullText,
          cited_sources: citedSources,
          cited_documents: citedDocuments,
          cited_community_cases: citedCases,
        })

        // 7. AI usage log
        const claudeCostEur = usageRef ? computeClaudeCostEur(usageRef) : 0
        await supabaseAdmin.from('ai_usage_log').insert({
          user_id: userId,
          operation: 'regulatory_chat',
          ai_model: ANTHROPIC_MODEL,
          input_tokens: usageRef?.input_tokens ?? 0,
          output_tokens: usageRef?.output_tokens ?? 0,
          cost_eur: claudeCostEur + embeddingCostEur,
          duration_ms: 0,
          success: true,
        })
        // Cost-tracker centralisé (ai-usage-tracker, vague suivante). Best-effort.
        try {
          await fetch(`${supabaseUrl}/functions/v1/ai-usage-tracker`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${serviceRole}`,
            },
            body: JSON.stringify({
              organizationId: orgId,
              userId,
              feature: 'chatbot_methodo',
              provider: 'anthropic',
              modelUsed: ANTHROPIC_MODEL,
              inputTokens: usageRef?.input_tokens ?? 0,
              outputTokens: usageRef?.output_tokens ?? 0,
              cachedInputTokens: usageRef?.cache_read_input_tokens ?? 0,
              cacheWriteTokens: usageRef?.cache_creation_input_tokens ?? 0,
              estimatedCostEur: claudeCostEur + embeddingCostEur,
              latencyMs: 0,
            }),
          })
        } catch {
          // silent
        }

        controller.enqueue(
          encoder.encode(
            sseEvent('done', {
              messageId,
              sessionId,
              totalDocs: docs.length,
              totalCases: cases.length,
              embeddingTokens,
              claudeUsage: usageRef,
              costEur: claudeCostEur + embeddingCostEur,
            }),
          ),
        )
        controller.close()
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        controller.enqueue(encoder.encode(sseEvent('error', { error: msg })))

        await supabaseAdmin.from('ai_usage_log').insert({
          user_id: userId,
          operation: 'regulatory_chat',
          ai_model: ANTHROPIC_MODEL,
          input_tokens: 0,
          output_tokens: 0,
          cost_eur: embeddingCostEur,
          duration_ms: 0,
          success: false,
          error_message: msg,
        })
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: sseHeaders() })
})
