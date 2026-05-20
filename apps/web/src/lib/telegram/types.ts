/**
 * Types Telegram Bot API (sous-ensemble utilisé par KOVAS).
 *
 * Source : https://core.telegram.org/bots/api (révision avril 2024).
 * On ne modélise QUE les champs accédés par le bot. Tout le reste reste opaque.
 */

export interface TelegramUser {
  id: number
  is_bot: boolean
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramChat {
  id: number
  type: 'private' | 'group' | 'supergroup' | 'channel'
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

export interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  reply_to_message?: TelegramMessage
}

export interface TelegramCallbackQuery {
  id: string
  from: TelegramUser
  message?: TelegramMessage
  chat_instance: string
  data?: string
}

export interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

// Inline keyboards
export interface InlineKeyboardButton {
  text: string
  callback_data?: string
  url?: string
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][]
}

// Options sendMessage
export interface SendMessageOpts {
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2'
  reply_markup?: InlineKeyboardMarkup
  disable_notification?: boolean
  reply_to_message_id?: number
  disable_web_page_preview?: boolean
}

// Réponse générique
export interface TelegramApiResponse<T> {
  ok: boolean
  result?: T
  description?: string
  error_code?: number
}

// ToolUse descriptor (pour pending_admin_actions.tool_uses jsonb)
// L'exécuteur (button-handler) lit ces descripteurs sérialisés et appelle
// les fonctions correspondantes côté serveur. Le NLP agent (autre itération)
// produit ces descripteurs depuis le message utilisateur.
export interface ToolUseCall {
  tool: string
  input: Record<string, unknown>
}
