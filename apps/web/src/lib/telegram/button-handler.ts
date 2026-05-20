/**
 * Handler des callback_query (clics sur boutons inline).
 *
 * Format `callback_data` : `<action>:<param1>[:<param2>...]` (max 64 bytes).
 *
 * Actions supportées (V1 partie 1) :
 *   - `confirm:<pending_id>`       — exécute pending_admin_action, audit, edit "✓"
 *   - `cancel:<pending_id>`        — mark cancelled, edit "✕"
 *   - `view_user:<user_id>`        — envoie UserCard
 *   - `resolve_alert:<event_id>`   — marque alerte résolue + audit
 *   - `silence_alert:<rule_id>:<minutes>` — ajoute cooldown supplémentaire (placeholder V1)
 *
 * Toujours appeler `answerCallbackQuery()` à la fin (sinon le spinner Telegram
 * reste actif sur le client mobile).
 */

import { logAdminAction } from '@/lib/admin/audit-log'
import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { answerCallbackQuery, editMessageText, sendMessage } from './bot-client'
import { cancelPendingAction, executePendingAction, getPendingAction } from './confirmation-flow'
import type { TelegramCallbackQuery } from './types'

type AdminSupabase = SupabaseClient<Database>

interface ProfileRow {
  id: string
  email: string
  full_name: string | null
  last_active_at: string | null
}

interface AlertEventResolveBuilder {
  update: (row: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => Promise<{
      error: { message: string } | null
    }>
  }
}

interface AlertRuleUpdateBuilder {
  update: (row: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => Promise<{
      error: { message: string } | null
    }>
  }
}

// ============================================
// Helpers
// ============================================
function parseCallbackData(data: string): { action: string; params: string[] } {
  const parts = data.split(':')
  return { action: parts[0] ?? '', params: parts.slice(1) }
}

// ============================================
// confirm:<pending_id>
// ============================================
async function handleConfirm(
  callback: TelegramCallbackQuery,
  supabase: AdminSupabase,
  userId: string,
  pendingId: string,
): Promise<void> {
  const chatId = callback.message?.chat.id
  const messageId = callback.message?.message_id
  if (!chatId || !messageId) {
    await answerCallbackQuery(callback.id, 'Contexte message manquant')
    return
  }

  const result = await executePendingAction(supabase, pendingId, userId)
  if (!result.ok) {
    await answerCallbackQuery(callback.id, result.error ?? 'Échec')
    await editMessageText(chatId, messageId, `❌ ${result.error ?? 'Échec confirmation'}`, {
      parse_mode: 'Markdown',
    })
    return
  }

  const pending = await getPendingAction(supabase, pendingId)
  const summary = pending?.description ?? 'Action confirmée'

  await logAdminAction({
    adminUserId: userId,
    actionType: 'telegram_confirm_action',
    actionSource: 'telegram_bot_button',
    targetType: 'pending_admin_action',
    targetId: pendingId,
    targetLabel: pending?.description ?? null,
    payload: { tool_uses: result.results },
    succeeded: true,
  })

  await editMessageText(chatId, messageId, `✓ *Effectué* — ${summary}`, {
    parse_mode: 'Markdown',
  })
  await answerCallbackQuery(callback.id, 'Confirmé')
}

// ============================================
// cancel:<pending_id>
// ============================================
async function handleCancel(
  callback: TelegramCallbackQuery,
  supabase: AdminSupabase,
  userId: string,
  pendingId: string,
): Promise<void> {
  const chatId = callback.message?.chat.id
  const messageId = callback.message?.message_id
  if (!chatId || !messageId) {
    await answerCallbackQuery(callback.id, 'Contexte message manquant')
    return
  }

  await cancelPendingAction(supabase, pendingId)
  await logAdminAction({
    adminUserId: userId,
    actionType: 'telegram_cancel_action',
    actionSource: 'telegram_bot_button',
    targetType: 'pending_admin_action',
    targetId: pendingId,
    succeeded: true,
  })

  await editMessageText(chatId, messageId, '✕ *Annulé*', { parse_mode: 'Markdown' })
  await answerCallbackQuery(callback.id, 'Annulé')
}

// ============================================
// view_user:<user_id>
// ============================================
async function handleViewUser(
  callback: TelegramCallbackQuery,
  supabase: AdminSupabase,
  userId: string,
  targetUserId: string,
): Promise<void> {
  const chatId = callback.message?.chat.id
  if (!chatId) {
    await answerCallbackQuery(callback.id, 'Contexte chat manquant')
    return
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, last_active_at')
    .eq('id', targetUserId)
    .maybeSingle<ProfileRow>()

  if (error || !data) {
    await sendMessage(chatId, `❌ Utilisateur \`${targetUserId.slice(0, 8)}\` introuvable`, {
      parse_mode: 'Markdown',
    })
    await answerCallbackQuery(callback.id, 'Introuvable')
    return
  }

  const lines = [
    `👤 *${data.full_name ?? data.email}*`,
    `📧 \`${data.email}\``,
    `🕐 Dernière activité : ${data.last_active_at ?? 'jamais'}`,
  ]
  await sendMessage(chatId, lines.join('\n'), { parse_mode: 'Markdown' })

  await logAdminAction({
    adminUserId: userId,
    actionType: 'telegram_view_user',
    actionSource: 'telegram_bot_button',
    targetType: 'user',
    targetId: targetUserId,
    targetLabel: data.email,
    succeeded: true,
  })

  await answerCallbackQuery(callback.id)
}

// ============================================
// resolve_alert:<event_id>
// ============================================
async function handleResolveAlert(
  callback: TelegramCallbackQuery,
  supabase: AdminSupabase,
  userId: string,
  eventId: string,
): Promise<void> {
  const chatId = callback.message?.chat.id
  const messageId = callback.message?.message_id
  if (!chatId) {
    await answerCallbackQuery(callback.id, 'Contexte chat manquant')
    return
  }

  const builder = supabase.from('alert_events') as unknown as AlertEventResolveBuilder
  const { error } = await builder
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
      resolution_note: 'Résolu via bot Telegram',
    })
    .eq('id', eventId)

  if (error) {
    await answerCallbackQuery(callback.id, 'Échec résolution')
    await sendMessage(chatId, `❌ Échec résolution alerte : ${error.message}`, {
      parse_mode: 'Markdown',
    })
    return
  }

  await logAdminAction({
    adminUserId: userId,
    actionType: 'alert_resolved',
    actionSource: 'telegram_bot_button',
    targetType: 'alert_event',
    targetId: eventId,
    succeeded: true,
  })

  if (messageId) {
    await editMessageText(chatId, messageId, '✓ *Alerte résolue*', { parse_mode: 'Markdown' })
  } else {
    await sendMessage(chatId, '✓ Alerte résolue', { parse_mode: 'Markdown' })
  }
  await answerCallbackQuery(callback.id, 'Résolue')
}

// ============================================
// silence_alert:<rule_id>:<minutes>
// ============================================
async function handleSilenceAlert(
  callback: TelegramCallbackQuery,
  supabase: AdminSupabase,
  userId: string,
  ruleId: string,
  minutesStr: string,
): Promise<void> {
  const chatId = callback.message?.chat.id
  if (!chatId) {
    await answerCallbackQuery(callback.id, 'Contexte chat manquant')
    return
  }

  const minutes = Math.max(1, Math.min(10080, Number.parseInt(minutesStr, 10) || 60))

  // V1 : on augmente le cooldown_minutes de la rule. Comme alert_engine se base
  // sur (last_event.created_at + cooldown_minutes), bumper le cooldown silence
  // la rule pour la durée souhaitée.
  const builder = supabase.from('alert_rules') as unknown as AlertRuleUpdateBuilder
  const { error } = await builder
    .update({ cooldown_minutes: minutes, updated_at: new Date().toISOString() })
    .eq('id', ruleId)

  if (error) {
    await answerCallbackQuery(callback.id, 'Échec silence')
    await sendMessage(chatId, `❌ Échec silence rule : ${error.message}`, {
      parse_mode: 'Markdown',
    })
    return
  }

  await logAdminAction({
    adminUserId: userId,
    actionType: 'alert_silenced',
    actionSource: 'telegram_bot_button',
    targetType: 'alert_rule',
    targetId: ruleId,
    payload: { cooldown_minutes: minutes },
    succeeded: true,
  })

  await sendMessage(chatId, `🔕 Rule silenciée pour *${minutes} min*`, { parse_mode: 'Markdown' })
  await answerCallbackQuery(callback.id, `Silencié ${minutes} min`)
}

// ============================================
// Dispatcher principal
// ============================================
export async function handleCallbackQuery(
  callback: TelegramCallbackQuery,
  supabase: AdminSupabase,
  userId: string,
): Promise<{ action: string; succeeded: boolean }> {
  const data = callback.data ?? ''
  const { action, params } = parseCallbackData(data)

  try {
    switch (action) {
      case 'confirm': {
        const id = params[0]
        if (!id) throw new Error('confirm: missing pending_id')
        await handleConfirm(callback, supabase, userId, id)
        return { action, succeeded: true }
      }
      case 'cancel': {
        const id = params[0]
        if (!id) throw new Error('cancel: missing pending_id')
        await handleCancel(callback, supabase, userId, id)
        return { action, succeeded: true }
      }
      case 'view_user': {
        const id = params[0]
        if (!id) throw new Error('view_user: missing user_id')
        await handleViewUser(callback, supabase, userId, id)
        return { action, succeeded: true }
      }
      case 'resolve_alert': {
        const id = params[0]
        if (!id) throw new Error('resolve_alert: missing event_id')
        await handleResolveAlert(callback, supabase, userId, id)
        return { action, succeeded: true }
      }
      case 'silence_alert': {
        const ruleId = params[0]
        const minutes = params[1] ?? '60'
        if (!ruleId) throw new Error('silence_alert: missing rule_id')
        await handleSilenceAlert(callback, supabase, userId, ruleId, minutes)
        return { action, succeeded: true }
      }
      default: {
        await answerCallbackQuery(callback.id, `Action inconnue : ${action}`, true)
        return { action: action || '(empty)', succeeded: false }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    console.error('[telegram/button-handler] crashed', e)
    await answerCallbackQuery(callback.id, `Erreur : ${msg.slice(0, 180)}`, true)
    return { action, succeeded: false }
  }
}
