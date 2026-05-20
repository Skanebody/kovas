/**
 * KOVAS — Notification sender vers les 4 channels Telegram admin
 * (itération 13/N partie 2).
 *
 * Channels :
 *   - alerts   : alertes business (MRR milestone, signups anomaly, IA cost, ...)
 *   - signups  : nouveaux comptes (event-driven, signal positif)
 *   - revenue  : invoices payées (event-driven)
 *   - errors   : erreurs critiques (API errors, Stripe webhook stale, exceptions)
 *
 * Chaque channel est mappé à une variable d'environnement TELEGRAM_CHAT_ID_*
 * configurée dans Vercel. Si la variable est absente : on log et on skip
 * (pas d'erreur fatale — le bot doit rester fonctionnel sans channel).
 *
 * Convention severity → disable_notification :
 *   - 'info'     → silencieux (disable_notification=true)
 *   - 'warning'  → son normal
 *   - 'critical' → son normal (pas de "high priority" côté Telegram Bot API)
 */

import type {
  AlertEvent as AlertEventBase,
  AlertRule as AlertRuleBase,
} from '@/lib/admin/alert-engine'
import type { Database, Json } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMessage } from './bot-client'
import type { InlineKeyboardButton, InlineKeyboardMarkup } from './types'

type AdminSupabase = SupabaseClient<Database>

// ============================================
// Types
// ============================================

export type NotificationChannel = 'alerts' | 'signups' | 'revenue' | 'errors'
export type NotificationSeverity = 'info' | 'warning' | 'critical'

const CHANNEL_ENV: Record<NotificationChannel, string> = {
  alerts: 'TELEGRAM_CHAT_ID_ALERTS',
  signups: 'TELEGRAM_CHAT_ID_SIGNUPS',
  revenue: 'TELEGRAM_CHAT_ID_REVENUE',
  errors: 'TELEGRAM_CHAT_ID_ERRORS',
}

export interface NotifyChannelOpts {
  buttons?: InlineKeyboardButton[][]
  severity?: NotificationSeverity
  /** Override Markdown parsing (défaut: true). */
  parseMode?: 'Markdown' | 'HTML' | null
}

// ============================================
// Helper : resolve chat_id depuis env
// ============================================

function resolveChatId(channel: NotificationChannel): number | null {
  const envName = CHANNEL_ENV[channel]
  const raw = process.env[envName]
  if (!raw) {
    console.warn(
      `[telegram/notification-sender] ${envName} non configurée — skip channel ${channel}`,
    )
    return null
  }
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id)) {
    console.error(`[telegram/notification-sender] ${envName}="${raw}" invalide (pas un entier)`)
    return null
  }
  return id
}

// ============================================
// Public API : notifyChannel
// ============================================

export async function notifyChannel(
  channel: NotificationChannel,
  text: string,
  opts: NotifyChannelOpts = {},
): Promise<void> {
  const chatId = resolveChatId(channel)
  if (chatId === null) return

  const severity = opts.severity ?? 'warning'
  const replyMarkup: InlineKeyboardMarkup | undefined =
    opts.buttons && opts.buttons.length > 0 ? { inline_keyboard: opts.buttons } : undefined

  try {
    await sendMessage(chatId, text, {
      parse_mode: opts.parseMode === null ? undefined : (opts.parseMode ?? 'Markdown'),
      disable_notification: severity === 'info',
      reply_markup: replyMarkup,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    console.error(
      `[telegram/notification-sender] sendMessage failed (channel=${channel}, severity=${severity})`,
      msg,
    )
  }
}

// ============================================
// Templating message_template
// ============================================

/**
 * Remplace `{key}` ou `{nested.key}` dans le template avec les valeurs payload.
 * Sécurise : valeur non trouvée → garde le placeholder pour debug.
 */
function renderTemplate(template: string, payload: Record<string, unknown>): string {
  return template.replace(/\{([a-zA-Z0-9_.]+)\}/g, (_, path: string) => {
    const keys = path.split('.')
    let cur: unknown = payload
    for (const k of keys) {
      if (cur === null || cur === undefined) return `{${path}}`
      if (typeof cur === 'object' && !Array.isArray(cur) && k in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[k]
      } else {
        return `{${path}}`
      }
    }
    if (cur === null || cur === undefined) return `{${path}}`
    if (typeof cur === 'number') return cur.toLocaleString('fr-FR')
    return String(cur)
  })
}

function parseButtonsConfig(raw: Json | null): InlineKeyboardButton[][] | undefined {
  if (!raw || !Array.isArray(raw)) return undefined
  const rows: InlineKeyboardButton[][] = []
  for (const row of raw) {
    if (!Array.isArray(row)) continue
    const btns: InlineKeyboardButton[] = []
    for (const b of row) {
      if (b === null || typeof b !== 'object') continue
      const obj = b as Record<string, unknown>
      const text = typeof obj.text === 'string' ? obj.text : null
      if (!text) continue
      const cb = typeof obj.callback_data === 'string' ? obj.callback_data : undefined
      const url = typeof obj.url === 'string' ? obj.url : undefined
      if (url) btns.push({ text, url })
      else btns.push({ text, callback_data: cb ?? '' })
    }
    if (btns.length > 0) rows.push(btns)
  }
  return rows.length > 0 ? rows : undefined
}

// ============================================
// Public API : sendAlertEventNotification (utilisé par alert-engine)
// ============================================

/**
 * Envoie une notification Telegram pour un alert_event :
 *   - Choisit le channel via rule.notify_telegram_channel (défaut 'alerts').
 *   - Render rule.notify_message_template avec event.payload.
 *   - Render rule.notify_buttons (inline_keyboard config jsonb).
 *   - disable_notification: rule.severity === 'info'.
 *   - Update alert_events.notified_telegram = true.
 *
 * Retourne true si envoi réussi (et UPDATE OK).
 */
export async function sendAlertEventNotification(
  supabase: AdminSupabase,
  rule: AlertRuleBase,
  event: AlertEventBase,
): Promise<boolean> {
  // Le channel par défaut est 'alerts' si non spécifié.
  const channelName = (rule.notify_telegram_channel ?? 'alerts').toLowerCase()
  if (!isValidChannel(channelName)) {
    console.warn(
      `[telegram/notification-sender] channel inconnu "${channelName}" — fallback alerts`,
    )
  }
  const channel: NotificationChannel = isValidChannel(channelName) ? channelName : 'alerts'

  // Render le template (fallback : utilise rule.name + actual_value)
  const payload = { ...event.payload, rule_name: rule.name } as Record<string, unknown>
  if (event.actual_value !== null) payload.actual_value = event.actual_value
  if (event.threshold_value !== null) payload.threshold_value = event.threshold_value
  if (event.target_label !== null) payload.target_label = event.target_label

  const severityEmoji =
    rule.severity === 'critical' ? '🚨' : rule.severity === 'warning' ? '⚠️' : '📊'
  const defaultTemplate = `${severityEmoji} *${rule.name}*\n${
    event.target_label ? `Cible : ${event.target_label}\n` : ''
  }${event.actual_value !== null ? `Valeur : ${event.actual_value}` : ''}${
    event.threshold_value !== null ? ` (seuil ${event.threshold_value})` : ''
  }`

  const text = rule.notify_message_template
    ? renderTemplate(rule.notify_message_template, payload)
    : defaultTemplate

  const buttons = parseButtonsConfig(rule.notify_buttons)

  await notifyChannel(channel, text, {
    severity: rule.severity,
    buttons,
  })

  // UPDATE alert_events.notified_telegram = true
  try {
    const updater = supabase.from('alert_events') as unknown as {
      update: (v: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
      }
    }
    const { error } = await updater.update({ notified_telegram: true }).eq('id', event.id)
    if (error) {
      console.error('[telegram/notification-sender] UPDATE alert_events failed', error)
      return false
    }
  } catch (err) {
    console.error('[telegram/notification-sender] UPDATE alert_events threw', err)
    return false
  }
  return true
}

function isValidChannel(name: string): name is NotificationChannel {
  return name === 'alerts' || name === 'signups' || name === 'revenue' || name === 'errors'
}

// ============================================
// Public API : sendSignupNotification
// ============================================

export interface SignupNotificationInput {
  user_id: string
  email: string | null
  full_name: string | null
  created_at: string
  organization_name?: string | null
}

export async function sendSignupNotification(profile: SignupNotificationInput): Promise<void> {
  const name = profile.full_name ?? profile.email ?? '(sans nom)'
  const text = `👤 *Nouveau signup*\n\n*${name}*\n${profile.email ?? ''}${
    profile.organization_name ? `\nOrg : ${profile.organization_name}` : ''
  }\n\`${profile.user_id}\``
  await notifyChannel('signups', text, { severity: 'info' })
}

// ============================================
// Public API : sendRevenueNotification
// ============================================

export interface RevenueNotificationInput {
  amount_eur: number
  source: string
  org_label?: string | null
}

export async function sendRevenueNotification(input: RevenueNotificationInput): Promise<void> {
  const amount = input.amount_eur.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const text = `💰 *Encaissement* — *${amount} €*\nSource : ${input.source}${
    input.org_label ? `\n${input.org_label}` : ''
  }`
  await notifyChannel('revenue', text, { severity: 'info' })
}

// ============================================
// Public API : sendErrorNotification
// ============================================

export interface ErrorNotificationInput {
  message: string
  stack?: string | null
  context?: Record<string, unknown> | null
}

export async function sendErrorNotification(input: ErrorNotificationInput): Promise<void> {
  const stackSnippet = input.stack ? `\n\`\`\`\n${input.stack.slice(0, 800)}\n\`\`\`` : ''
  const ctx = input.context ? `\n\`${JSON.stringify(input.context).slice(0, 400)}\`` : ''
  const text = `🚨 *Erreur critique*\n${input.message.slice(0, 600)}${ctx}${stackSnippet}`
  await notifyChannel('errors', text, { severity: 'critical' })
}
