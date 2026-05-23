/**
 * KOVAS — Route API POST /api/coach/stream (streaming SSE).
 *
 * Endpoint Coach IA conversationnel personnel.
 * Modèle par défaut : claude-haiku-4-5 (chat rapide + bon marché).
 *
 * Body :
 *   {
 *     conversationId: string | null,   // null = nouvelle conversation
 *     message: string                  // message utilisateur
 *   }
 *
 * Comportement :
 *  1. Authentifie l'utilisateur via getCurrentUser
 *  2. Crée la conversation si conversationId est null
 *  3. INSERT le message utilisateur
 *  4. Fetch contexte (last 10 missions, profile, last 30j invoices)
 *  5. Stream la réponse Claude (SSE delta) à la connexion
 *  6. À la fin, INSERT le message assistant
 *  7. Détecte les lignes "[RECOMMENDATION: title // summary // action_url]"
 *     et INSERT dans coach_recommendations
 *
 * Format SSE :
 *   data: { type: 'delta', text: string }
 *   data: { type: 'done', conversationId, usage }
 *   data: { type: 'error', error: string }
 *
 * Auth : getCurrentUser (redirect /login si non connecté).
 * Ton : SOBRE PROFESSIONNEL, vouvoiement, pas d'emoji.
 */

import Anthropic from '@anthropic-ai/sdk'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const maxDuration = 60

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL_CHAT ?? 'claude-haiku-4-5'
const MAX_HISTORY_MESSAGES = 12
const MAX_MESSAGE_LEN = 4000

interface ChatRequestBody {
  conversationId?: unknown
  message?: unknown
}

interface UserContext {
  full_name: string | null
  recent_missions: Array<{ type: string; status: string; completed_at: string | null }>
  invoice_count_30d: number
  invoice_total_ht_30d: number
}

interface MissionRow {
  type: string | null
  status: string | null
  completed_at: string | null
}

interface InvoiceRow {
  amount_ht: number | string | null
  status: string | null
}

interface PersistedMessage {
  role: 'user' | 'assistant'
  content: string
}

function sse(payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`)
}

function buildSystemPrompt(ctx: UserContext): string {
  const missionsLine =
    ctx.recent_missions.length > 0
      ? ctx.recent_missions
          .slice(0, 10)
          .map((m) => `${m.type} (${m.status})`)
          .join(', ')
      : 'aucune mission récente'

  const ca30j = ctx.invoice_total_ht_30d.toFixed(2)

  return [
    'Vous êtes le Coach IA KOVAS — un conseiller business personnel pour diagnostiqueur immobilier indépendant.',
    '',
    'Profil utilisateur :',
    `- Nom : ${ctx.full_name ?? 'non renseigné'}`,
    `- Missions récentes : ${missionsLine}`,
    `- Factures 30j : ${ctx.invoice_count_30d} (CA HT ${ca30j} €)`,
    '',
    'Spécialisation :',
    '- Diagnostic immobilier français (DPE, amiante, plomb CREP, gaz, électricité, termites, Carrez/Boutin, ERP).',
    '- Productivité terrain, optimisation business, réglementation FR, pricing KOVAS.',
    '',
    'Règles strictes :',
    '- Ton SOBRE PROFESSIONNEL. Vouvoiement obligatoire.',
    "- PAS d'emoji, JAMAIS.",
    '- Réponses concises (5-8 phrases max sauf si on vous demande explicitement un développement).',
    '- Quand vous identifiez une action concrète actionable, écrivez-la sur sa propre ligne au format exact :',
    '  [RECOMMENDATION: titre court // résumé une phrase // /dashboard/...]',
    "- Le chemin d'action peut être omis (laissez vide) si non applicable.",
    '- Vous pouvez émettre 0, 1 ou 2 recommandations par réponse (jamais 3+).',
    '- Ne pas inventer de chiffres absents du contexte. Si une donnée manque, dites-le.',
    '- Pour la réglementation, citez les articles pertinents (CCH, RT2012, RE2020, arrêtés DPE 3CL-2021).',
  ].join('\n')
}

async function loadUserContext(): Promise<UserContext> {
  const { supabase, orgId, profile } = await getCurrentUser()

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [missionsRes, invoicesRes] = await Promise.all([
    supabase
      .from('missions')
      .select('type, status, completed_at')
      .eq('organization_id', orgId)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from('invoices')
      .select('amount_ht, status')
      .eq('organization_id', orgId)
      .gte('issued_at', since30d),
  ])

  const missions: MissionRow[] = Array.isArray(missionsRes.data)
    ? (missionsRes.data as MissionRow[])
    : []
  const invoices: InvoiceRow[] = Array.isArray(invoicesRes.data)
    ? (invoicesRes.data as InvoiceRow[])
    : []

  const invoiceTotal = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + (Number.parseFloat(String(i.amount_ht ?? '0')) || 0), 0)

  return {
    full_name: profile?.full_name ?? null,
    recent_missions: missions.map((m) => ({
      type: m.type ?? 'INCONNU',
      status: m.status ?? 'unknown',
      completed_at: m.completed_at,
    })),
    invoice_count_30d: invoices.length,
    invoice_total_ht_30d: invoiceTotal,
  }
}

async function loadConversationHistory(
  conversationId: string,
  userId: string,
): Promise<PersistedMessage[]> {
  const { supabase } = await getCurrentUser()

  type ConvRow = { id: string; user_id: string }
  type MsgRow = { role: string; content: string }

  // biome-ignore lint/suspicious/noExplicitAny: coach_* tables not yet in generated types
  const convRes = await (supabase as any)
    .from('coach_conversations')
    .select('id, user_id')
    .eq('id', conversationId)
    .maybeSingle()

  const conv = (convRes.data as ConvRow | null) ?? null
  if (!conv || conv.user_id !== userId) return []

  // biome-ignore lint/suspicious/noExplicitAny: coach_* tables not yet in generated types
  const msgsRes = await (supabase as any)
    .from('coach_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(MAX_HISTORY_MESSAGES)

  const rows = (msgsRes.data as MsgRow[] | null) ?? []
  return rows
    .filter(
      (r): r is { role: 'user' | 'assistant'; content: string } =>
        (r.role === 'user' || r.role === 'assistant') && typeof r.content === 'string',
    )
    .map((r) => ({ role: r.role, content: r.content }))
}

function normalizeMessage(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw.trim().slice(0, MAX_MESSAGE_LEN)
}

interface ExtractedRecommendation {
  title: string
  summary: string | null
  action_url: string | null
}

function extractRecommendations(text: string): ExtractedRecommendation[] {
  const matches: ExtractedRecommendation[] = []
  // [RECOMMENDATION: titre // résumé // /dashboard/xxx]
  const re = /\[RECOMMENDATION:\s*([^\]]+)\]/gi
  let m: RegExpExecArray | null
  // biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex loop
  while ((m = re.exec(text)) !== null) {
    const parts = m[1].split('//').map((s) => s.trim())
    const title = parts[0] ?? ''
    const summary = parts[1] ?? null
    const actionUrl = parts[2] && parts[2].length > 0 ? parts[2] : null
    if (title.length > 0 && title.length <= 200) {
      matches.push({
        title,
        summary: summary && summary.length <= 500 ? summary : null,
        action_url: actionUrl?.startsWith('/dashboard/') ? actionUrl : null,
      })
    }
  }
  return matches
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth
  const { user } = await getCurrentUser()

  // 2. Parse body
  let payload: ChatRequestBody
  try {
    payload = (await request.json()) as ChatRequestBody
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'invalid_json' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const userMessage = normalizeMessage(payload.message)
  if (userMessage.length === 0) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_message' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  }

  const conversationIdIn =
    typeof payload.conversationId === 'string' ? payload.conversationId : null

  // 3. Clé Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'anthropic_not_configured' }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    })
  }

  // 4. Charger contexte + historique
  const ctx = await loadUserContext()

  let conversationId = conversationIdIn
  const history: PersistedMessage[] =
    conversationId !== null ? await loadConversationHistory(conversationId, user.id) : []

  // 5. Créer la conversation si nouvelle
  const { supabase } = await getCurrentUser()
  if (conversationId === null) {
    // biome-ignore lint/suspicious/noExplicitAny: coach_* tables not yet in generated types
    const insertRes = await (supabase as any)
      .from('coach_conversations')
      .insert({
        user_id: user.id,
        title: userMessage.slice(0, 80),
      })
      .select('id')
      .single()

    const newId = (insertRes.data as { id?: string } | null)?.id ?? null
    if (!newId) {
      return new Response(JSON.stringify({ ok: false, error: 'cannot_create_conversation' }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
      })
    }
    conversationId = newId
  }

  // 6. INSERT message utilisateur
  // biome-ignore lint/suspicious/noExplicitAny: coach_* tables not yet in generated types
  await (supabase as any).from('coach_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
  })

  const systemPrompt = buildSystemPrompt(ctx)
  const anthropic = new Anthropic({ apiKey })

  const messagesForApi = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: userMessage },
  ]

  // 7. Streaming SSE
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = ''
      let inputTokens = 0
      let outputTokens = 0
      try {
        const anthropicStream = anthropic.messages.stream({
          model: DEFAULT_MODEL,
          max_tokens: 1024,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: messagesForApi,
        })

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const delta = event.delta.text
            assistantText += delta
            controller.enqueue(sse({ type: 'delta', text: delta }))
          }
        }

        const finalMessage = await anthropicStream.finalMessage()
        inputTokens = finalMessage.usage.input_tokens
        outputTokens = finalMessage.usage.output_tokens

        // INSERT message assistant + recos avant 'done'
        try {
          // biome-ignore lint/suspicious/noExplicitAny: coach_* tables not yet in generated types
          await (supabase as any).from('coach_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: assistantText,
            tokens_in: inputTokens,
            tokens_out: outputTokens,
            model: DEFAULT_MODEL,
          })

          const recos = extractRecommendations(assistantText)
          if (recos.length > 0) {
            // biome-ignore lint/suspicious/noExplicitAny: coach_* tables not yet in generated types
            await (supabase as any).from('coach_recommendations').insert(
              recos.map((r) => ({
                user_id: user.id,
                source_conversation_id: conversationId,
                title: r.title,
                summary: r.summary,
                action_url: r.action_url,
              })),
            )
          }
        } catch {
          // persistence failure : log only, ne casse pas le stream
        }

        controller.enqueue(
          sse({
            type: 'done',
            conversationId,
            usage: { input_tokens: inputTokens, output_tokens: outputTokens },
          }),
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'streaming_error'
        controller.enqueue(sse({ type: 'error', error: message }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
