/**
 * Validation chat_id Telegram → admin_users.
 *
 * Le bot Telegram ne répond QU'aux chat_id présents dans admin_users avec
 * is_active=true. Toute autre conversation est ignorée silencieusement
 * (pas d'écho — on ne révèle pas l'existence du bot à un inconnu).
 *
 * Comparaison côté DB sur la colonne `telegram_chat_id` (text). Le webhook
 * envoie un bigint → on convertit en string pour la requête.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type AdminSupabase = SupabaseClient<Database>

interface AdminUserRow {
  user_id: string
  role: 'super_admin' | 'admin' | 'support'
  is_active: boolean
}

interface AdminUsersBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      eq: (
        col: string,
        val: boolean,
      ) => {
        maybeSingle: () => Promise<{
          data: AdminUserRow | null
          error: { message: string } | null
        }>
      }
    }
  }
}

export async function validateChatId(chatId: number, supabase: AdminSupabase): Promise<boolean> {
  const admin = await getAdminUserFromChatId(chatId, supabase)
  return admin !== null
}

export async function getAdminUserFromChatId(
  chatId: number,
  supabase: AdminSupabase,
): Promise<{ user_id: string; role: 'super_admin' | 'admin' | 'support' } | null> {
  const builder = supabase.from('admin_users') as unknown as AdminUsersBuilder
  const { data, error } = await builder
    .select('user_id, role, is_active')
    .eq('telegram_chat_id', chatId.toString())
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('[telegram/chat-id-validator] query failed', error)
    return null
  }
  if (!data) return null
  return { user_id: data.user_id, role: data.role }
}
