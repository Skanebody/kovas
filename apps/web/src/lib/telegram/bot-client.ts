/**
 * Wrapper Telegram Bot API (HTTPS REST natif — pas de SDK npm).
 *
 * Toutes les fonctions :
 *   - POSTent un JSON sur https://api.telegram.org/bot<TOKEN>/<method>
 *   - throw si la réponse HTTP n'est pas OK ou si `ok: false` dans le body
 *
 * Le token est lu paresseusement (lazy) via process.env.TELEGRAM_BOT_TOKEN —
 * jamais à l'import time pour ne pas casser les builds en preview/CI.
 */

import type {
  InlineKeyboardMarkup,
  SendMessageOpts,
  TelegramApiResponse,
  TelegramMessage,
} from './types'

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot'

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN
  if (!t || t.length === 0) {
    throw new Error('TELEGRAM_BOT_TOKEN required')
  }
  return t
}

function endpoint(method: string): string {
  return `${TELEGRAM_API_BASE}${token()}/${method}`
}

async function call<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(endpoint(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`telegram ${method} HTTP ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as TelegramApiResponse<T>
  if (!json.ok || json.result === undefined) {
    throw new Error(`telegram ${method} failed: ${json.description ?? 'unknown'}`)
  }
  return json.result
}

// ============================================
// sendMessage
// ============================================
export async function sendMessage(
  chatId: number | string,
  text: string,
  opts: SendMessageOpts = {},
): Promise<TelegramMessage> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
  }
  if (opts.parse_mode !== undefined) body.parse_mode = opts.parse_mode
  if (opts.reply_markup !== undefined) body.reply_markup = opts.reply_markup
  if (opts.disable_notification !== undefined) {
    body.disable_notification = opts.disable_notification
  }
  if (opts.reply_to_message_id !== undefined) {
    body.reply_to_message_id = opts.reply_to_message_id
  }
  if (opts.disable_web_page_preview !== undefined) {
    body.disable_web_page_preview = opts.disable_web_page_preview
  }
  return call<TelegramMessage>('sendMessage', body)
}

// ============================================
// editMessageText (édite un message envoyé précédemment — pour confirmations)
// ============================================
export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  opts: SendMessageOpts = {},
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  }
  if (opts.parse_mode !== undefined) body.parse_mode = opts.parse_mode
  if (opts.reply_markup !== undefined) body.reply_markup = opts.reply_markup
  if (opts.disable_web_page_preview !== undefined) {
    body.disable_web_page_preview = opts.disable_web_page_preview
  }
  // L'API peut renvoyer `true` (boolean) ou un TelegramMessage. On ignore le retour.
  await call<TelegramMessage | true>('editMessageText', body)
}

// ============================================
// answerCallbackQuery (toujours appelée pour fermer le spinner Telegram)
// ============================================
export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert = false,
): Promise<void> {
  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  }
  if (text !== undefined) body.text = text
  if (showAlert) body.show_alert = true
  await call<boolean>('answerCallbackQuery', body)
}

// ============================================
// setWebhook (utilisé par scripts/telegram-setup-webhook.mjs)
// ============================================
export async function setWebhook(
  url: string,
  secretToken?: string,
  allowedUpdates: string[] = ['message', 'callback_query'],
): Promise<void> {
  const body: Record<string, unknown> = {
    url,
    allowed_updates: allowedUpdates,
    drop_pending_updates: false,
  }
  if (secretToken !== undefined && secretToken.length > 0) {
    body.secret_token = secretToken
  }
  await call<boolean>('setWebhook', body)
}

// ============================================
// deleteWebhook (debug / rollback)
// ============================================
export async function deleteWebhook(): Promise<void> {
  await call<boolean>('deleteWebhook', { drop_pending_updates: false })
}

// ============================================
// getWebhookInfo (vérification setup)
// ============================================
export interface WebhookInfo {
  url: string
  has_custom_certificate: boolean
  pending_update_count: number
  last_error_date?: number
  last_error_message?: string
  ip_address?: string
}

export async function getWebhookInfo(): Promise<WebhookInfo> {
  return call<WebhookInfo>('getWebhookInfo', {})
}

// ============================================
// Helpers boutons inline (raccourcis ergonomiques)
// ============================================
export function buildInlineKeyboard(
  rows: Array<Array<{ text: string; data?: string; url?: string }>>,
): InlineKeyboardMarkup {
  return {
    inline_keyboard: rows.map((row) =>
      row.map((b) => {
        if (b.url !== undefined) return { text: b.text, url: b.url }
        return { text: b.text, callback_data: b.data ?? '' }
      }),
    ),
  }
}
