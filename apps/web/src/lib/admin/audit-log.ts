/**
 * Helper pour INSERT dans admin_audit_log.
 *
 * Le trigger SQL audit_log_immutable() bloque tout UPDATE/DELETE — cette
 * fonction sert UNIQUEMENT à logger, jamais à modifier rétroactivement.
 *
 * Utilise le client service_role (RLS n'autorise pas l'INSERT côté client).
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Json } from '@kovas/database/types'

export type AuditActionSource =
  | 'dashboard_web'
  | 'telegram_bot_command'
  | 'telegram_bot_button'
  | 'telegram_bot_nlp'
  | 'system_automated'
  | 'cli'

export interface AuditLogEntry {
  adminUserId: string
  actionType: string
  actionSource: AuditActionSource
  targetType?: string | null
  targetId?: string | null
  targetLabel?: string | null
  payload?: Record<string, unknown>
  previousState?: Record<string, unknown> | null
  newState?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  succeeded: boolean
  errorMessage?: string | null
}

interface AuditLogInsertRow {
  admin_user_id: string
  action_type: string
  action_source: AuditActionSource
  target_type: string | null
  target_id: string | null
  target_label: string | null
  payload: Json
  previous_state: Json | null
  new_state: Json | null
  ip_address: string | null
  user_agent: string | null
  succeeded: boolean
  error_message: string | null
}

export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  const supabase = createAdminClient()
  const row: AuditLogInsertRow = {
    admin_user_id: entry.adminUserId,
    action_type: entry.actionType,
    action_source: entry.actionSource,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    target_label: entry.targetLabel ?? null,
    payload: (entry.payload ?? {}) as Json,
    previous_state: (entry.previousState ?? null) as Json | null,
    new_state: (entry.newState ?? null) as Json | null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
    succeeded: entry.succeeded,
    error_message: entry.errorMessage ?? null,
  }

  // admin_audit_log absent du Database type généré (migration 2026-05-21,
  // types à régénérer via `pnpm db:gen-types`). On utilise le builder generic
  // de supabase-js en passant par un cast typé (pas any).
  const { error } = await (
    supabase.from('admin_audit_log') as unknown as {
      insert: (rows: AuditLogInsertRow) => Promise<{ error: { message: string } | null }>
    }
  ).insert(row)

  if (error) {
    // L'audit log doit toujours réussir — log côté serveur si échec.
    console.error('[admin/audit-log] insert failed', error)
  }
}
