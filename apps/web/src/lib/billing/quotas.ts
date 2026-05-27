/**
 * KOVAS — Helpers quotas (Edge Function /quota-tracker relay).
 *
 * Côté Node.js (API routes Next.js) :
 *   - `getCurrentMonthQuota(orgId)` : lecture directe via Supabase service role
 *   - `incrementUsage(orgId, column, delta)` : relay vers Edge Function
 *   - `assertQuotaAvailable(orgId, column, delta)` : check avant action critique
 *
 * Cf. migrations 20260526140000_user_usage_quotas (table + RPC).
 *
 * Convention :
 *   - storage : Go (numeric)
 *   - autres : compteurs int
 *   - quota = -1 → illimité (All Inclusive / Cabinet plans)
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js'

export type QuotaColumn =
  | 'missions_used'
  | 'chatbot_messages_used'
  | 'yousign_signatures_used'
  | 'geocoding_requests_used'
  | 'storage_gb_used'

export interface UsageQuotaRow {
  organization_id: string
  period_month: string
  // Missions
  missions_used: number
  missions_quota: number
  missions_overflow_count: number
  missions_overflow_amount_cents: number
  // Chatbot
  chatbot_messages_used: number
  chatbot_messages_quota: number
  chatbot_overflow_count: number
  chatbot_overflow_amount_cents: number
  // Yousign
  yousign_signatures_used: number
  yousign_signatures_quota: number
  yousign_overflow_count: number
  yousign_overflow_amount_cents: number
  // Geocoding
  geocoding_requests_used: number
  geocoding_requests_quota: number
  geocoding_overflow_count: number
  geocoding_overflow_amount_cents: number
  // Storage
  storage_gb_used: number
  storage_gb_quota: number
  storage_overflow_gb: number
  storage_overflow_amount_cents: number
  // Settings
  auto_overflow_enabled: boolean
  alert_80pct_sent_at: string | null
  alert_100pct_sent_at: string | null
  // Billing intent
  stripe_usage_record_id: string | null
  billed_at: string | null
  updated_at: string
}

export interface QuotaStatus {
  used: number
  quota: number
  /** 0..1 ratio. Si quota=-1 → 0. */
  percentage: number
  isOverflowing: boolean
  overflowCount: number
  overflowAmountCents: number
  autoOverflowEnabled: boolean
}

interface AssertQuotaResult {
  allowed: boolean
  overflow: boolean
  reason?: string
  status: QuotaStatus | null
}

/**
 * Mapping colonne usage → colonnes parallèles (quota / overflow_count / overflow_amount).
 * Centralisé ici pour éviter les fautes de frappe.
 */
const COLUMN_MAP: Record<
  QuotaColumn,
  {
    quotaCol: keyof UsageQuotaRow
    overflowCountCol: keyof UsageQuotaRow
    overflowAmountCol: keyof UsageQuotaRow
  }
> = {
  missions_used: {
    quotaCol: 'missions_quota',
    overflowCountCol: 'missions_overflow_count',
    overflowAmountCol: 'missions_overflow_amount_cents',
  },
  chatbot_messages_used: {
    quotaCol: 'chatbot_messages_quota',
    overflowCountCol: 'chatbot_overflow_count',
    overflowAmountCol: 'chatbot_overflow_amount_cents',
  },
  yousign_signatures_used: {
    quotaCol: 'yousign_signatures_quota',
    overflowCountCol: 'yousign_overflow_count',
    overflowAmountCol: 'yousign_overflow_amount_cents',
  },
  geocoding_requests_used: {
    quotaCol: 'geocoding_requests_quota',
    overflowCountCol: 'geocoding_overflow_count',
    overflowAmountCol: 'geocoding_overflow_amount_cents',
  },
  storage_gb_used: {
    quotaCol: 'storage_gb_quota',
    overflowCountCol: 'storage_overflow_gb',
    overflowAmountCol: 'storage_overflow_amount_cents',
  },
}

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRole) {
    throw new Error('quotas.ts: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function computeCurrentPeriodMonth(): string {
  // 1er du mois Europe/Paris (suffisant : un décalage d'1h max sur le passage UTC).
  const now = new Date()
  const parisFormatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = parisFormatter.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value ?? `${now.getUTCFullYear()}`
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  return `${year}-${month}-01`
}

function ratio(used: number, quota: number): number {
  if (quota === -1) return 0
  if (quota <= 0) return used > 0 ? 1 : 0
  return Math.min(used / quota, 999) // pas de cap à 1 pour exposer dépassements
}

/**
 * Lecture du compteur du mois courant. Si la ligne n'existe pas encore,
 * appelle `ensure_current_month_quota_row` (RPC) pour la provisionner.
 */
export async function getCurrentMonthQuota(orgId: string): Promise<UsageQuotaRow> {
  const supabase = getServiceClient()
  const period = computeCurrentPeriodMonth()

  let { data } = await supabase
    .from('user_usage_quotas')
    .select('*')
    .eq('organization_id', orgId)
    .eq('period_month', period)
    .maybeSingle()

  if (!data) {
    const { error: rpcError } = await supabase.rpc('ensure_current_month_quota_row', {
      p_organization_id: orgId,
    })
    if (rpcError) {
      throw new Error(`ensure_current_month_quota_row: ${rpcError.message}`)
    }
    const reread = await supabase
      .from('user_usage_quotas')
      .select('*')
      .eq('organization_id', orgId)
      .eq('period_month', period)
      .maybeSingle()
    if (reread.error || !reread.data) {
      throw new Error(`getCurrentMonthQuota: failed to read row after provisioning`)
    }
    data = reread.data
  }

  return data as UsageQuotaRow
}

/**
 * Incrémente un compteur via Edge Function quota-tracker (centralise la logique
 * 80% alerts + overflow billing + retours typés).
 */
export async function incrementUsage(
  orgId: string,
  column: QuotaColumn,
  delta: number,
): Promise<QuotaStatus> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  const cronSecret = process.env.CRON_SECRET
  if (!supabaseUrl || !serviceRole || !cronSecret) {
    throw new Error('incrementUsage: missing env (SUPABASE_URL / SERVICE_ROLE / CRON_SECRET)')
  }

  const fnUrl = `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/quota-tracker`
  const resp = await fetch(fnUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cronSecret}`,
    },
    body: JSON.stringify({ organizationId: orgId, column, delta }),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`quota-tracker HTTP ${resp.status}: ${text.slice(0, 200)}`)
  }
  const payload = (await resp.json()) as {
    used: number
    quota: number
    percentage: number
    isOverflowing: boolean
    overflowCount: number
    overflowAmountCents: number
    autoOverflowEnabled: boolean
  }
  return payload
}

/**
 * Check avant action critique (création mission, envoi signature, etc.).
 *
 * Comportement :
 *   - Si used + delta <= quota : allowed=true, overflow=false
 *   - Sinon, si auto_overflow_enabled=true : allowed=true, overflow=true
 *   - Sinon : allowed=false, reason='quota_exceeded'
 *
 * NB : ne modifie pas le compteur. À appeler AVANT l'action, puis
 *      `incrementUsage` après succès.
 */
export async function assertQuotaAvailable(
  orgId: string,
  column: QuotaColumn,
  delta: number,
): Promise<AssertQuotaResult> {
  const row = await getCurrentMonthQuota(orgId)
  const map = COLUMN_MAP[column]
  const used = Number(row[column])
  const quota = Number(row[map.quotaCol])
  const overflowCount = Number(row[map.overflowCountCol])
  const overflowAmount = Number(row[map.overflowAmountCol])
  const status: QuotaStatus = {
    used,
    quota,
    percentage: ratio(used + delta, quota),
    isOverflowing: quota !== -1 && used + delta > quota,
    overflowCount,
    overflowAmountCents: overflowAmount,
    autoOverflowEnabled: row.auto_overflow_enabled,
  }

  if (quota === -1) {
    return { allowed: true, overflow: false, status }
  }
  if (used + delta <= quota) {
    return { allowed: true, overflow: false, status }
  }
  if (row.auto_overflow_enabled) {
    return { allowed: true, overflow: true, status }
  }
  return {
    allowed: false,
    overflow: false,
    reason: 'quota_exceeded',
    status,
  }
}
