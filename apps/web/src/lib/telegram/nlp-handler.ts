/**
 * KOVAS — NLP handler bot Telegram (itération 13/N partie 2).
 *
 * Pipeline :
 *   1. Charge l'historique conversation (5 derniers échanges du chat).
 *   2. Appelle Claude Haiku 4.5 avec system prompt (caché) + tools registry.
 *   3. Si stop_reason='tool_use' :
 *      a) Sépare les tool_use destructifs des read-only.
 *      b) Destructifs → crée pending_admin_actions + envoie boutons inline
 *         (PAS d'exécution réelle ici).
 *      c) Read-only → exécute via tool-executor, renvoie les tool_results à
 *         Claude pour formuler la réponse finale.
 *   4. Sinon → envoie le texte directement.
 *   5. Track le coût IA dans ai_usage + log dans telegram_bot_interactions.
 *
 * Prompt caching : system block avec `cache_control: ephemeral` (1h TTL).
 * Les schémas de tools + le prompt admin pèsent ~3-5k tokens, le cache réduit
 * le coût des appels suivants de 90% sur la fenêtre cache.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Database, Json } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ADMIN_BOT_SYSTEM_PROMPT } from './admin-bot-system-prompt'
import { sendMessage } from './bot-client'
import { createPendingAction } from './confirmation-flow'
import { DESTRUCTIVE_TOOL_NAMES } from './destructive-tools'
import { ADMIN_BOT_TOOLS } from './tool-definitions'
import { executeToolCalls } from './tool-executor'
import type { TelegramMessage, ToolUseCall } from './types'

type AdminSupabase = SupabaseClient<Database>

const MODEL = process.env.ANTHROPIC_BOT_MODEL ?? 'claude-haiku-4-5'
const MAX_TOKENS = 1500
const HISTORY_DEPTH = 5

// Pricing Claude Haiku 4.5 (USD / 1M tokens) — aligné vision-analyzer.ts
const PRICE_INPUT_PER_M_USD = 1.0
const PRICE_OUTPUT_PER_M_USD = 5.0
const PRICE_CACHE_WRITE_PER_M_USD = 1.25
const PRICE_CACHE_READ_PER_M_USD = 0.1
const USD_TO_EUR_RATE = 0.93

// ============================================
// Historique conversation
// ============================================

interface TgInteractionHistoryRow {
  type: string
  user_message: string | null
  bot_response: string | null
  created_at: string
}

interface TgInteractionsHistoryBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: number,
    ) => {
      in: (
        col: string,
        vals: string[],
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: TgInteractionHistoryRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

async function getConversationHistory(
  supabase: AdminSupabase,
  chatId: number,
  depth: number,
): Promise<Anthropic.MessageParam[]> {
  const builder = supabase.from(
    'telegram_bot_interactions',
  ) as unknown as TgInteractionsHistoryBuilder
  const { data, error } = await builder
    .select('type, user_message, bot_response, created_at')
    .eq('chat_id', chatId)
    .in('type', ['nlp_message'])
    .order('created_at', { ascending: false })
    .limit(depth)

  if (error || !data) return []

  // On a les N derniers DESC → on inverse pour ordre chronologique.
  const ordered = data.slice().reverse()
  const messages: Anthropic.MessageParam[] = []
  for (const row of ordered) {
    if (row.user_message) {
      messages.push({ role: 'user', content: row.user_message })
    }
    if (row.bot_response) {
      messages.push({ role: 'assistant', content: row.bot_response })
    }
  }
  return messages
}

// ============================================
// Log telegram_bot_interactions
// ============================================

interface TgInteractionInsertRow {
  chat_id: number
  user_id: string | null
  message_id: number | null
  type: 'nlp_message' | 'confirmation_request'
  user_message: string | null
  bot_response: string | null
  tool_uses: Json | null
  ai_cost_eur: number | null
  succeeded: boolean
  error_message: string | null
}

interface TgInteractionsInserter {
  insert: (row: TgInteractionInsertRow) => Promise<{ error: { message: string } | null }>
}

async function logInteraction(
  supabase: AdminSupabase,
  entry: TgInteractionInsertRow,
): Promise<void> {
  const inserter = supabase.from('telegram_bot_interactions') as unknown as TgInteractionsInserter
  const { error } = await inserter.insert(entry)
  if (error) {
    console.error('[telegram/nlp-handler] log interaction failed', error)
  }
}

// ============================================
// Tracking coût IA dans ai_usage
// ============================================

interface AiUsageInsertRow {
  organization_id: string | null
  user_id: string
  provider: string
  model: string
  operation: string
  input_tokens: number
  output_tokens: number
  cached_tokens: number
  cost_eur: number
  latency_ms: number | null
}

async function trackAiCost(
  supabase: AdminSupabase,
  userId: string,
  usage: Anthropic.Usage,
  latencyMs: number,
): Promise<number> {
  const inputTokens = usage.input_tokens
  const outputTokens = usage.output_tokens
  const cacheCreation = usage.cache_creation_input_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0

  const billableInput = Math.max(0, inputTokens - cacheCreation - cacheRead)
  const costUsd =
    (billableInput / 1_000_000) * PRICE_INPUT_PER_M_USD +
    (cacheCreation / 1_000_000) * PRICE_CACHE_WRITE_PER_M_USD +
    (cacheRead / 1_000_000) * PRICE_CACHE_READ_PER_M_USD +
    (outputTokens / 1_000_000) * PRICE_OUTPUT_PER_M_USD
  const costEur = Math.round(costUsd * USD_TO_EUR_RATE * 1_000_000) / 1_000_000

  const row: AiUsageInsertRow = {
    organization_id: null,
    user_id: userId,
    provider: 'anthropic',
    model: MODEL,
    operation: 'telegram_bot_nlp',
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cached_tokens: cacheRead,
    cost_eur: costEur,
    latency_ms: latencyMs,
  }
  const { error } = await supabase.from('ai_usage').insert(row)
  if (error) {
    console.error('[telegram/nlp-handler] ai_usage insert failed', error)
  }
  return costEur
}

// ============================================
// Helpers descriptifs (actions destructives)
// ============================================

function describeAction(toolUse: Anthropic.ToolUseBlock): string {
  const input = (toolUse.input ?? {}) as Record<string, unknown>
  const userId = typeof input.user_id === 'string' ? input.user_id : 'inconnu'
  const reason = typeof input.reason === 'string' ? input.reason : null

  switch (toolUse.name) {
    case 'request_user_suspension':
      return `*Suspendre l'utilisateur* \`${userId}\`${reason ? `\nRaison : ${reason}` : ''}`
    case 'request_credit_grant': {
      const amount = typeof input.amount_eur === 'number' ? input.amount_eur : 0
      return `*Octroyer un crédit* de *${amount.toFixed(2)} €* à \`${userId}\`${
        reason ? `\nRaison : ${reason}` : ''
      }`
    }
    case 'request_cap_modification': {
      const cap = typeof input.new_cap_eur === 'number' ? input.new_cap_eur : 0
      return `*Modifier le cap IA mensuel* de \`${userId}\` à *${cap.toFixed(2)} €*${
        reason ? `\nRaison : ${reason}` : ''
      }`
    }
    case 'request_plan_upgrade': {
      const plan = typeof input.new_plan === 'string' ? input.new_plan : '?'
      return `*Changer le plan* de \`${userId}\` vers *${plan}*${
        reason ? `\nRaison : ${reason}` : ''
      }`
    }
    case 'request_send_email': {
      const subject = typeof input.subject === 'string' ? input.subject : '(sans sujet)'
      return `*Envoyer un email* à \`${userId}\`\nSujet : "${subject}"`
    }
    default:
      return `*Action* \`${toolUse.name}\` sur \`${userId}\``
  }
}

function describeActions(toolUses: Anthropic.ToolUseBlock[]): string {
  if (toolUses.length === 1) {
    const first = toolUses[0]
    return first ? describeAction(first) : ''
  }
  return toolUses.map((t, i) => `${i + 1}. ${describeAction(t)}`).join('\n\n')
}

function toolUseToCall(tu: Anthropic.ToolUseBlock): ToolUseCall {
  const input = isRecord(tu.input) ? (tu.input as Record<string, unknown>) : {}
  return { tool: tu.name, input }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// ============================================
// Pipeline principal
// ============================================

export interface HandleNlpInput {
  message: TelegramMessage
  supabase: AdminSupabase
  userId: string
}

export async function handleNaturalLanguage(params: HandleNlpInput): Promise<void> {
  const { message, supabase, userId } = params
  const userText = message.text ?? ''
  const chatId = message.chat.id

  if (!userText.trim()) return

  if (!process.env.ANTHROPIC_API_KEY) {
    await sendMessage(chatId, 'Erreur : ANTHROPIC_API_KEY non configurée.', {
      parse_mode: 'Markdown',
    })
    return
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const history = await getConversationHistory(supabase, chatId, HISTORY_DEPTH)

  // 1er appel Claude
  const t0 = Date.now()
  let firstResponse: Anthropic.Message
  try {
    firstResponse = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: ADMIN_BOT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [...history, { role: 'user', content: userText }],
      tools: ADMIN_BOT_TOOLS,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error('[telegram/nlp-handler] Claude call failed', msg)
    await sendMessage(chatId, `Erreur appel IA : ${msg.slice(0, 200)}`, { parse_mode: 'Markdown' })
    await logInteraction(supabase, {
      chat_id: chatId,
      user_id: userId,
      message_id: message.message_id,
      type: 'nlp_message',
      user_message: userText,
      bot_response: null,
      tool_uses: null,
      ai_cost_eur: null,
      succeeded: false,
      error_message: msg,
    })
    return
  }
  const firstLatencyMs = Date.now() - t0
  const costFirst = await trackAiCost(supabase, userId, firstResponse.usage, firstLatencyMs)

  // Branche A : tool_use présent
  if (firstResponse.stop_reason === 'tool_use') {
    const toolUses = firstResponse.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    )
    const destructive = toolUses.filter((tu) => DESTRUCTIVE_TOOL_NAMES.has(tu.name))
    const readOnly = toolUses.filter((tu) => !DESTRUCTIVE_TOOL_NAMES.has(tu.name))

    // A1 : destructifs → confirmation requise (le user doit confirmer via bouton)
    if (destructive.length > 0) {
      const description = describeActions(destructive)
      const calls: ToolUseCall[] = destructive.map(toolUseToCall)
      let pendingId: string
      try {
        pendingId = await createPendingAction(
          supabase,
          chatId,
          userId,
          description,
          calls,
          userText,
        )
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'unknown'
        await sendMessage(chatId, `Erreur préparation confirmation : ${msg}`, {
          parse_mode: 'Markdown',
        })
        return
      }

      const confirmText = `⚠️ *Confirmation requise*\n\n${description}\n\n_Action irréversible — confirme pour exécuter._`
      await sendMessage(chatId, confirmText, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✓ Confirmer', callback_data: `confirm:${pendingId}` },
              { text: '✕ Annuler', callback_data: `cancel:${pendingId}` },
            ],
          ],
        },
      })

      await logInteraction(supabase, {
        chat_id: chatId,
        user_id: userId,
        message_id: message.message_id,
        type: 'confirmation_request',
        user_message: userText,
        bot_response: confirmText,
        tool_uses: calls as unknown as Json,
        ai_cost_eur: costFirst,
        succeeded: true,
        error_message: null,
      })
      return
    }

    // A2 : read-only → exécute + renvoi à Claude pour formuler la réponse
    const toolResults = await executeToolCalls(readOnly, supabase, userId)

    const finalT0 = Date.now()
    let finalResponse: Anthropic.Message
    try {
      finalResponse = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: 'text',
            text: ADMIN_BOT_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          ...history,
          { role: 'user', content: userText },
          { role: 'assistant', content: firstResponse.content },
          {
            role: 'user',
            content: toolResults.map((r) => ({
              type: 'tool_result' as const,
              tool_use_id: r.toolUseId,
              content: JSON.stringify(r.error ? { error: r.error } : r.result),
              is_error: r.error !== undefined,
            })),
          },
        ],
        tools: ADMIN_BOT_TOOLS,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'
      console.error('[telegram/nlp-handler] final Claude call failed', msg)
      await sendMessage(chatId, `Erreur appel IA (suite) : ${msg.slice(0, 200)}`, {
        parse_mode: 'Markdown',
      })
      return
    }
    const finalLatencyMs = Date.now() - finalT0
    const costFinal = await trackAiCost(supabase, userId, finalResponse.usage, finalLatencyMs)

    const finalText = finalResponse.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
    const textOut = finalText?.text.trim() ?? '(pas de réponse)'
    await sendMessage(chatId, textOut, { parse_mode: 'Markdown' })

    await logInteraction(supabase, {
      chat_id: chatId,
      user_id: userId,
      message_id: message.message_id,
      type: 'nlp_message',
      user_message: userText,
      bot_response: textOut,
      tool_uses: readOnly.map(toolUseToCall) as unknown as Json,
      ai_cost_eur: costFirst + costFinal,
      succeeded: true,
      error_message: null,
    })
    return
  }

  // Branche B : pas de tool_use, réponse directe
  const textBlock = firstResponse.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  const textOut = textBlock?.text.trim() ?? '(pas de réponse)'
  await sendMessage(chatId, textOut, { parse_mode: 'Markdown' })

  await logInteraction(supabase, {
    chat_id: chatId,
    user_id: userId,
    message_id: message.message_id,
    type: 'nlp_message',
    user_message: userText,
    bot_response: textOut,
    tool_uses: null,
    ai_cost_eur: costFirst,
    succeeded: true,
    error_message: null,
  })
}
