/**
 * Types partagés pour la page /admin/audit (filtres + table + détail).
 *
 * admin_audit_log absent du Database type — types locaux jusqu'à `pnpm db:gen-types`.
 */

import type { AuditActionSource } from '@/lib/admin/audit-log'

export interface AuditLogRow {
  id: string
  admin_user_id: string
  admin_email: string | null
  action_type: string
  action_source: AuditActionSource
  target_type: string | null
  target_id: string | null
  target_label: string | null
  payload: Record<string, unknown>
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  succeeded: boolean
  error_message: string | null
  created_at: string
}

export interface AuditFilters {
  adminUserId: string
  actionTypes: string[]
  actionSources: AuditActionSource[]
  succeeded: 'all' | 'true' | 'false'
  targetType: string
  q: string
  dateFrom: string
  dateTo: string
}

export interface AuditStats {
  total: number
  failedTotal: number
  criticalActionsTotal: number
  last24h: number
}

export const AUDIT_PAGE_SIZE = 50
export const AUDIT_EXPORT_MAX = 10_000

/**
 * Action types considérées "critiques" pour le compteur du panneau stats.
 * Liste extensible — basée sur les wrappers d'audit déjà branchés.
 */
export const CRITICAL_ACTION_TYPES = new Set<string>([
  'user_suspended',
  'user_unsuspended',
  'user_credit_granted',
  'user_caps_updated',
  'user_plan_changed',
  'user_custom_email_sent',
  'broadcast_sent',
  'broadcast_test_sent',
  'email_template_deleted',
  'cache_purged',
  'cron_triggered',
])

export const ACTION_SOURCE_OPTIONS: Array<{ value: AuditActionSource; label: string }> = [
  { value: 'dashboard_web', label: 'Dashboard web' },
  { value: 'telegram_bot_command', label: 'Telegram · commande' },
  { value: 'telegram_bot_button', label: 'Telegram · bouton' },
  { value: 'telegram_bot_nlp', label: 'Telegram · NLP' },
  { value: 'system_automated', label: 'Système (cron)' },
  { value: 'cli', label: 'CLI' },
]
