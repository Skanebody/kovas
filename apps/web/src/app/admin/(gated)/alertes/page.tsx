/**
 * /admin/alertes — section Alertes (itération 8/N).
 *
 * UI :
 *   - Header eyebrow + h1 serif italic
 *   - 4 metric cards (active critical / active warning / résolues 7j / rules actives)
 *   - ActiveAlertsList (client component avec polling 30s + résolution modale)
 *   - AlertHistoryTable (server-fetched, filtrable)
 *   - AlertConfigForm (server-fetched, lecture seule V1)
 *   - HealthChecksGrid (réutilisé du dashboard, polling 30s)
 *   - PerformanceMetrics (synthèse latence + cache + error rate)
 *
 * Toutes les fetches initiales server-side passent par createAdminClient()
 * derrière la gate /admin/(gated)/layout.tsx → verifyAdminAccess() + 2FA OK.
 */

import type { AlertEventDto } from '@/app/api/admin/alerts/route'
import { ActiveAlertsList } from '@/components/admin/alerts/ActiveAlertsList'
import { AlertConfigForm } from '@/components/admin/alerts/AlertConfigForm'
import { AlertHistoryTable } from '@/components/admin/alerts/AlertHistoryTable'
import { PerformanceMetrics } from '@/components/admin/alerts/PerformanceMetrics'
import { HealthChecksGrid } from '@/components/admin/home/HealthChecksGrid'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { listActiveRules } from '@/lib/admin/alert-engine'
import { getCacheHitRate, getLatencyPercentiles } from '@/lib/admin/ia-analytics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Json } from '@kovas/database/types'
import { AlertOctagon, AlertTriangle, CheckCircle2, Settings } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Alertes',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ============================================
// Types Supabase locaux (alert_events absent du Database type généré)
// ============================================

interface AlertEventJoinRow {
  id: string
  rule_id: string
  target_type: string | null
  target_id: string | null
  target_label: string | null
  actual_value: number | string | null
  threshold_value: number | string | null
  payload: Json
  notified_email: boolean | null
  notified_telegram: boolean | null
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  resolution_note: string | null
  created_at: string
  alert_rules:
    | { name: string; severity: 'info' | 'warning' | 'critical' }
    | { name: string; severity: 'info' | 'warning' | 'critical' }[]
    | null
}

interface ApiEventRow {
  event_type: string
}

interface ActiveEventsBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: boolean,
    ) => Promise<{
      data: AlertEventJoinRow[] | null
      error: { message: string } | null
    }>
  }
}

interface ResolvedEventsBuilder {
  select: (cols: string) => {
    eq: (
      col: string,
      val: boolean,
    ) => {
      gte: (
        col: string,
        val: string,
      ) => {
        order: (
          col: string,
          opts: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{
            data: AlertEventJoinRow[] | null
            error: { message: string } | null
          }>
        }
      }
    }
  }
}

function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

function rowToEvent(row: AlertEventJoinRow): AlertEventDto {
  const joined = Array.isArray(row.alert_rules) ? row.alert_rules[0] : row.alert_rules
  return {
    id: row.id,
    rule_id: row.rule_id,
    rule_name: joined?.name ?? '(règle supprimée)',
    rule_severity: joined?.severity ?? 'warning',
    target_type: row.target_type,
    target_id: row.target_id,
    target_label: row.target_label,
    actual_value: toNum(row.actual_value),
    threshold_value: toNum(row.threshold_value),
    payload: (row.payload ?? {}) as Record<string, unknown>,
    notified_email: row.notified_email ?? false,
    notified_telegram: row.notified_telegram ?? false,
    resolved: row.resolved,
    resolved_at: row.resolved_at,
    resolved_by: row.resolved_by,
    resolution_note: row.resolution_note,
    created_at: row.created_at,
  }
}

async function computeErrorRate60min(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<number> {
  const sinceIso = new Date(Date.now() - 60 * 60_000).toISOString()
  const { data, error } = await supabase
    .from('events')
    .select('event_type')
    .gte('created_at', sinceIso)
    .like('event_type', 'api.%')
  if (error || !data) return 0
  const rows = data as ApiEventRow[]
  if (rows.length === 0) return 0
  const errors = rows.filter((r) => r.event_type === 'api.error').length
  return errors / rows.length
}

export default async function AdminAlertsPage() {
  const supabase = createAdminClient()
  const sevenDaysAgoIso = new Date(Date.now() - 7 * 86_400_000).toISOString()

  // 1. Rules
  const rulesPromise = listActiveRules(supabase)

  // 2. Active events (server-side initial render — le client component
  //    re-fetch toutes les 30s)
  const activeBuilder = supabase.from('alert_events') as unknown as ActiveEventsBuilder
  const activePromise = activeBuilder
    .select('*, alert_rules:rule_id (name, severity)')
    .eq('resolved', false)

  // 3. Resolved 7d (pour history table + counter)
  const resolvedBuilder = supabase.from('alert_events') as unknown as ResolvedEventsBuilder
  const resolvedPromise = resolvedBuilder
    .select('*, alert_rules:rule_id (name, severity)')
    .eq('resolved', true)
    .gte('created_at', sevenDaysAgoIso)
    .order('resolved_at', { ascending: false })
    .limit(30)

  // 4. Performance
  const latencyPromise = getLatencyPercentiles(supabase)
  const cachePromise = getCacheHitRate(supabase)
  const errorRatePromise = computeErrorRate60min(supabase)

  const [rules, activeRes, resolvedRes, latency, cacheHit, errorRate] = await Promise.all([
    rulesPromise,
    activePromise,
    resolvedPromise,
    latencyPromise,
    cachePromise,
    errorRatePromise,
  ])

  const activeEvents = (activeRes.data ?? []).map(rowToEvent)
  const resolvedEvents = (resolvedRes.data ?? []).map(rowToEvent)

  let active_critical = 0
  let active_warning = 0
  for (const ev of activeEvents) {
    if (ev.rule_severity === 'critical') active_critical += 1
    else if (ev.rule_severity === 'warning') active_warning += 1
  }
  const rules_active = rules.filter((r) => r.active).length

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          ⚠️ Alertes · Monitoring
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Veille en continu.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Détection automatique des anomalies coûts IA, pics signups, webhooks Stripe et taux
          d'erreur API · résolution + historique.
        </p>
      </div>

      {/* 4 metric cards */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Métriques alertes"
      >
        <AdminMetricCard
          eyebrow="Actives critical"
          value={String(active_critical)}
          hint={active_critical === 0 ? 'Aucune alerte critique' : 'Action immédiate requise'}
          icon={AlertOctagon}
        />
        <AdminMetricCard
          eyebrow="Actives warning"
          value={String(active_warning)}
          hint={active_warning === 0 ? 'Tout est sous seuil' : 'À traiter dans la journée'}
          icon={AlertTriangle}
        />
        <AdminMetricCard
          eyebrow="Résolues 7j"
          value={String(resolvedEvents.length)}
          hint="Historique 7 derniers jours"
          icon={CheckCircle2}
        />
        <AdminMetricCard
          eyebrow="Rules actives"
          value={String(rules_active)}
          hint={`${rules.length} règles configurées au total`}
          icon={Settings}
        />
      </section>

      {/* Health + Performance */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Health & performance">
        <HealthChecksGrid />
        <PerformanceMetrics
          latencyP50ms={latency.p50ms}
          latencyP95ms={latency.p95ms}
          cacheHit30d={cacheHit.rate30d}
          errorRate60min={errorRate}
        />
      </section>

      {/* Active alerts list */}
      <section aria-label="Alertes actives">
        <ActiveAlertsList />
      </section>

      {/* Config rules + History */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Règles & historique">
        <AlertConfigForm rules={rules} />
        <AlertHistoryTable events={resolvedEvents} />
      </section>
    </div>
  )
}
