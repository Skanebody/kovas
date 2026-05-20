/**
 * Routeur central du webhook Telegram.
 *
 * Reçoit un `TelegramUpdate` (POST /api/telegram/webhook) et dispatch :
 *   1. Vérifie chat_id ∈ admin_users (sinon silence radio — pas d'écho)
 *   2. Rate limit (30 req / 60s par chat_id)
 *   3. Route :
 *      - callback_query     → button-handler
 *      - message texte `/…` → command-handler
 *      - message texte libre → fallback "/help" (NLP arrive dans une autre iter)
 *
 * Toutes les interactions sont auditées dans telegram_bot_interactions
 * (succès ou erreur), sans interrompre le flux en cas d'échec d'insert.
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import { sendMessage } from './bot-client'
import { handleCallbackQuery } from './button-handler'
import { getAdminUserFromChatId } from './chat-id-validator'
import { handleCommand } from './command-handler'
import { logTelegramInteraction } from './interactions-log'
import { isRateLimited } from './rate-limiter'
import type { TelegramUpdate } from './types'

export async function handleTelegramWebhook(update: TelegramUpdate): Promise<void> {
  // Extraction chat_id (présent soit dans message, soit dans callback_query)
  const chatId = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id ?? null
  if (chatId === null) {
    // Update inutile (channel post, etc.) — silence radio
    return
  }

  const supabase = createAdminClient()

  // 1. Validation chat_id
  const admin = await getAdminUserFromChatId(chatId, supabase)
  if (!admin) {
    // Pas un admin → silence radio (on ne révèle pas l'existence du bot)
    console.warn('[telegram/webhook] unauthorized chat_id', chatId)
    return
  }

  // 2. Rate limit
  if (isRateLimited(chatId)) {
    try {
      await sendMessage(chatId, '⏳ Trop de commandes, ralentis un peu (30 req / minute).')
    } catch (e) {
      console.error('[telegram/webhook] rate-limit notice failed', e)
    }
    await logTelegramInteraction({
      chatId,
      userId: admin.user_id,
      messageId: update.message?.message_id ?? null,
      type: 'command',
      botResponse: 'rate_limited',
      succeeded: false,
      errorMessage: 'rate_limited',
    })
    return
  }

  // 3. Dispatch callback_query
  if (update.callback_query) {
    const cb = update.callback_query
    const result = await handleCallbackQuery(cb, supabase, admin.user_id)
    await logTelegramInteraction({
      chatId,
      userId: admin.user_id,
      messageId: cb.message?.message_id ?? null,
      type: 'callback_query',
      callbackData: cb.data ?? null,
      succeeded: result.succeeded,
    })
    return
  }

  // 4. Dispatch message texte
  const message = update.message
  if (!message || !message.text) {
    return
  }
  const text = message.text.trim()

  if (text.startsWith('/')) {
    const result = await handleCommand(message, supabase, admin.user_id)
    await logTelegramInteraction({
      chatId,
      userId: admin.user_id,
      messageId: message.message_id,
      type: 'command',
      userMessage: text,
      botResponse: result.response,
      commandName: result.commandName,
      succeeded: result.succeeded,
      errorMessage: result.error ?? null,
    })
    return
  }

  // 5. Message libre — fallback V1 partie 1 (NLP en cours d'implémentation
  // par l'autre agent : itération 12 partie 2).
  try {
    await sendMessage(
      chatId,
      '💡 Tape /help pour voir les commandes disponibles. (Le mode IA conversationnel arrive bientôt.)',
      { parse_mode: 'Markdown' },
    )
  } catch (e) {
    console.error('[telegram/webhook] fallback sendMessage failed', e)
  }
  await logTelegramInteraction({
    chatId,
    userId: admin.user_id,
    messageId: message.message_id,
    type: 'nlp_message',
    userMessage: text,
    botResponse: 'fallback_no_nlp_v1',
    succeeded: true,
  })
}
