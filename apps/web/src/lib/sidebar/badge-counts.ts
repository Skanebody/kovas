/**
 * KOVAS — Compteurs de badges pour la sidebar.
 *
 * Chargé côté server au render du layout. Reste léger : 4 requêtes count(*)
 * en parallèle, max ~100ms total sur Supabase Paris.
 *
 * Si un compteur n'est pas disponible (table absente, erreur) on retourne 0,
 * jamais d'exception (la sidebar ne doit jamais casser le layout).
 */

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SidebarBadgeCounts {
  active_dossiers: number
  overdue_invoices: number
  unread_messages: number
  unread_notifications: number
}

export const EMPTY_BADGE_COUNTS: SidebarBadgeCounts = {
  active_dossiers: 0,
  overdue_invoices: 0,
  unread_messages: 0,
  unread_notifications: 0,
}

async function safeCount(
  promise: PromiseLike<{ count: number | null; error: unknown }>,
): Promise<number> {
  try {
    const { count, error } = await promise
    if (error || typeof count !== 'number') return 0
    return count
  } catch {
    return 0
  }
}

/**
 * Charge les 4 compteurs en parallèle pour un orgId donné.
 *
 * - active_dossiers : dossiers en cours (status != 'completed', not deleted)
 * - overdue_invoices : factures impayées dont la date d'échéance est passée
 * - unread_messages : messages non lus (table 'messages' filtré read_at IS NULL)
 * - unread_notifications : notifications non lues
 */
export async function loadSidebarBadgeCounts(
  supabase: SupabaseClient,
  orgId: string,
): Promise<SidebarBadgeCounts> {
  const today = new Date().toISOString().slice(0, 10)
  const [active_dossiers, overdue_invoices, unread_messages, unread_notifications] =
    await Promise.all([
      safeCount(
        supabase
          .from('dossiers')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .not('status', 'in', '("completed","cancelled","archived")'),
      ),
      safeCount(
        supabase
          .from('invoices')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('deleted_at', null)
          .eq('status', 'sent')
          .lt('due_date', today),
      ),
      safeCount(
        supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .is('read_at', null),
      ),
      safeCount(
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', orgId) // best-effort, fallback 0
          .is('read_at', null),
      ),
    ])
  return { active_dossiers, overdue_invoices, unread_messages, unread_notifications }
}
