/**
 * POST /api/telegram/send  (interne)
 *
 * Endpoint privé pour envoyer un message bot Telegram depuis du code serveur
 * (cron notifications, alert engine, status broadcast, etc.).
 *
 * Sécurité :
 *   - Header `x-internal-secret` doit matcher INTERNAL_API_SECRET (env)
 *   - JAMAIS exposé publiquement (pas de bouton frontend)
 *
 * Body JSON :
 *   {
 *     "chat_id": number | string,           // requis
 *     "text": string,                       // requis (max 4096 chars Telegram)
 *     "parse_mode"?: "Markdown" | "HTML" | "MarkdownV2",
 *     "reply_markup"?: InlineKeyboardMarkup,
 *     "disable_notification"?: boolean,
 *     "disable_web_page_preview"?: boolean
 *   }
 *
 * Réponse : { ok: true, message_id: number } ou { ok: false, error: string }.
 *
 * Logge dans telegram_bot_interactions (type='notification_sent').
 */

import { sendMessage } from '@/lib/telegram/bot-client'
import { logTelegramInteraction } from '@/lib/telegram/interactions-log'
import type { InlineKeyboardMarkup, SendMessageOpts } from '@/lib/telegram/types'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface SendRequestBody {
  chat_id: number | string
  text: string
  parse_mode?: 'Markdown' | 'HTML' | 'MarkdownV2'
  reply_markup?: InlineKeyboardMarkup
  disable_notification?: boolean
  disable_web_page_preview?: boolean
}

function isInlineKeyboardMarkup(v: unknown): v is InlineKeyboardMarkup {
  if (!v || typeof v !== 'object') return false
  const obj = v as { inline_keyboard?: unknown }
  return Array.isArray(obj.inline_keyboard)
}

function parseBody(raw: unknown): SendRequestBody | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const chatId = obj.chat_id
  const text = obj.text
  if (chatId === undefined || chatId === null) return null
  if (typeof chatId !== 'number' && typeof chatId !== 'string') return null
  if (typeof text !== 'string' || text.length === 0 || text.length > 4096) return null

  const result: SendRequestBody = { chat_id: chatId, text }
  if (
    obj.parse_mode === 'Markdown' ||
    obj.parse_mode === 'HTML' ||
    obj.parse_mode === 'MarkdownV2'
  ) {
    result.parse_mode = obj.parse_mode
  }
  if (isInlineKeyboardMarkup(obj.reply_markup)) {
    result.reply_markup = obj.reply_markup
  }
  if (typeof obj.disable_notification === 'boolean') {
    result.disable_notification = obj.disable_notification
  }
  if (typeof obj.disable_web_page_preview === 'boolean') {
    result.disable_web_page_preview = obj.disable_web_page_preview
  }
  return result
}

export async function POST(req: Request): Promise<NextResponse> {
  // 1. Auth internal secret
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected || expected.length === 0) {
    return NextResponse.json({ error: 'Internal secret not configured' }, { status: 500 })
  }
  const provided = req.headers.get('x-internal-secret')
  if (provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse body
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 })
  }
  const body = parseBody(raw)
  if (!body) {
    return NextResponse.json({ ok: false, error: 'Invalid body' }, { status: 400 })
  }

  const opts: SendMessageOpts = {}
  if (body.parse_mode !== undefined) opts.parse_mode = body.parse_mode
  if (body.reply_markup !== undefined) opts.reply_markup = body.reply_markup
  if (body.disable_notification !== undefined) opts.disable_notification = body.disable_notification
  if (body.disable_web_page_preview !== undefined) {
    opts.disable_web_page_preview = body.disable_web_page_preview
  }

  // 3. Send + log
  try {
    const sent = await sendMessage(body.chat_id, body.text, opts)
    const chatIdNum =
      typeof body.chat_id === 'number' ? body.chat_id : Number.parseInt(String(body.chat_id), 10)
    await logTelegramInteraction({
      chatId: Number.isFinite(chatIdNum) ? chatIdNum : 0,
      userId: null,
      messageId: sent.message_id,
      type: 'notification_sent',
      botResponse: body.text.slice(0, 1000),
      succeeded: true,
    })
    return NextResponse.json({ ok: true, message_id: sent.message_id })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    console.error('[api/telegram/send] sendMessage failed', e)
    const chatIdNum =
      typeof body.chat_id === 'number' ? body.chat_id : Number.parseInt(String(body.chat_id), 10)
    await logTelegramInteraction({
      chatId: Number.isFinite(chatIdNum) ? chatIdNum : 0,
      userId: null,
      messageId: null,
      type: 'notification_sent',
      botResponse: body.text.slice(0, 1000),
      succeeded: false,
      errorMessage: msg,
    })
    return NextResponse.json({ ok: false, error: msg }, { status: 502 })
  }
}
