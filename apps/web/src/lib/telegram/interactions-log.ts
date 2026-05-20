/**
 * Helper INSERT dans telegram_bot_interactions.
 *
 * Toutes les interactions (commande, callback, NLP, notification) y atterrissent
 * pour audit + debug. Le service_role bypasse RLS. Les erreurs d'insert sont
 * loggées mais n'interrompent jamais le flux (best-effort).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Json } from '@kovas/database/types'
import type { ToolUseCall } from './types'

export type TelegramInteractionType =
  | 'command'
  | 'callback_query'
  | 'nlp_message'
  | 'notification_sent'
  | 'confirmation_request'
  | 'confirmation_response'

export interface TelegramInteractionEntry {
  chatId: number
  userId: string | null
  messageId: number | null
  type: TelegramInteractionType
  userMessage?: string | null
  botResponse?: string | null
  commandName?: string | null
  callbackData?: string | null
  toolUses?: ToolUseCall[] | null
  aiCostEur?: number | null
  succeeded: boolean
  errorMessage?: string | null
}

interface InteractionInsertRow {
  chat_id: number
  user_id: string | null
  message_id: number | null
  type: TelegramInteractionType
  user_message: string | null
  bot_response: string | null
  command_name: string | null
  callback_data: string | null
  tool_uses: Json | null
  ai_cost_eur: number | null
  succeeded: boolean | null
  error_message: string | null
}

interface InteractionsInsertBuilder {
  insert: (row: InteractionInsertRow) => Promise<{ error: { message: string } | null }>
}

export async function logTelegramInteraction(entry: TelegramInteractionEntry): Promise<void> {
  const supabase = createAdminClient()
  const row: InteractionInsertRow = {
    chat_id: entry.chatId,
    user_id: entry.userId,
    message_id: entry.messageId,
    type: entry.type,
    user_message: entry.userMessage ?? null,
    bot_response: entry.botResponse ?? null,
    command_name: entry.commandName ?? null,
    callback_data: entry.callbackData ?? null,
    tool_uses: (entry.toolUses ?? null) as unknown as Json | null,
    ai_cost_eur: entry.aiCostEur ?? null,
    succeeded: entry.succeeded,
    error_message: entry.errorMessage ?? null,
  }
  const builder = supabase.from('telegram_bot_interactions') as unknown as InteractionsInsertBuilder
  const { error } = await builder.insert(row)
  if (error) {
    console.error('[telegram/interactions-log] insert failed', error)
  }
}
