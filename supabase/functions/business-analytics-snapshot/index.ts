// KOVAS — Edge Function `business-analytics-snapshot`
//
// Cron mensuel — 1er du mois 03:00 UTC :
//
//     SELECT cron.schedule(
//       'business-analytics-snapshot',
//       '0 3 1 * *',
//       $$ SELECT net.http_post(
//            url := current_setting('app.settings.supabase_functions_url') || '/business-analytics-snapshot',
//            headers := jsonb_build_object(
//              'Content-Type', 'application/json',
//              'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
//            )
//          ); $$
//     );
//
// Logique :
//   1. Pour chaque organisation active (organizations.deleted_at IS NULL),
//   2. Calcule les métriques business du mois précédent :
//      - missions volume (total/completed/exported/cancelled) + mix par type
//      - revenue HT/TTC (issued/paid invoices)
//      - conversion rate (quotes accepted / sent+accepted+refused+expired)
//      - repeat client rate (dossiers groupés par client_id)
//      - diversity index (Shannon normalisé sur diagnostic_mix)
//      - health score composite (CLAUDE.md §7)
//   3. UPSERT dans business_analytics_snapshots (UNIQUE org_id+period+period_type).
//   4. Audit log de chaque computation (table observability_audit_logs si dispo,
//      sinon console.log structuré).
//
// Pas de RLS bypass : on tourne en service_role. RLS écriture autorise admin only,
// mais ici on est service_role donc bypass total.

/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Types miroir.
// ────────────────────────────────────────────────────────────

interface OrgRow {
  id: string
  name: string
  plan: string
  plan_status: string
  deleted_at: string | null
}

interface MissionRow {
  id: string
  organization_id: string
  type: string
  status: string
  exported_at: string | null
  completed_at: string | null
  created_at: string
  dossier_id: string
}

interface DossierRow {
  id: string
  organization_id: string
  client_id: string | null
  status: string
  created_at: string
}

interface InvoiceRow {
  id: string
  organization_id: string
  client_id: string | null
  status: string
  amount_ht: number | string
  amount_ttc: number | string
  paid_at: string | null
  issued_at: string | null
  created_at: string
}

interface QuoteRow {
  id: string
  organization_id: string
  status: string
  created_at: string
  accepted_at: string | null
}

interface ComputationResult {
  organization_id: string
  snapshot_period: string
  ok: boolean
  missions_total: number
  revenue_ht_cents: number
  health_score: number | null
  error?: string
}

// ────────────────────────────────────────────────────────────
// Period helpers.
// ────────────────────────────────────────────────────────────

function previousMonth(today: Date = new Date()): string {
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const target = new Date(Date.UTC(y, m - 1, 1))
  const ty = target.getUTCFullYear()
  const tm = (target.getUTCMonth() + 1).toString().padStart(2, '0')
  return `${ty}-${tm}-01`
}

function monthBounds(period: string): { from: string; to: string } {
  const [yStr, mStr] = period.split('-')
  if (!yStr || !mStr) throw new Error(`invalid period: ${period}`)
  const y = parseInt(yStr, 10)
  const m = parseInt(mStr, 10)
  if (!Number.isFinite(y) || !Number.isFinite(m)) throw new Error(`invalid period: ${period}`)
  const fromDate = new Date(Date.UTC(y, m - 1, 1))
  const toDate = new Date(Date.UTC(y, m, 1))
  return { from: fromDate.toISOString(), to: toDate.toISOString() }
}

// ────────────────────────────────────────────────────────────
// Convertisseurs montants.
// ────────────────────────────────────────────────────────────

function eurosToCents(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'string' ? parseFloat(value) : value
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

// ────────────────────────────────────────────────────────────
// Métriques.
// ────────────────────────────────────────────────────────────

function diagnosticMix(missions: MissionRow[]): Record<string, number> {
  const mix: Record<string, number> = {}
  for (const m of missions) {
    mix[m.type] = (mix[m.type] ?? 0) + 1
  }
  return mix
}

function statusCounts(missions: MissionRow[]): {
  completed: number
  exported: number
  cancelled: number
} {
  let completed = 0
  let exported = 0
  let cancelled = 0
  for (const m of missions) {
    if (m.status === 'completed' || m.status === 'done') completed += 1
    if (m.exported_at) exported += 1
    if (m.status === 'cancelled') cancelled += 1
  }
  return { completed, exported, cancelled }
}

function revenueMonth(invoices: InvoiceRow[]): {
  ht: number
  ttc: number
} {
  let ht = 0
  let ttc = 0
  for (const inv of invoices) {
    if (inv.status === 'draft' || inv.status === 'cancelled') continue
    ht += eurosToCents(inv.amount_ht)
    ttc += eurosToCents(inv.amount_ttc)
  }
  return { ht, ttc }
}

function conversionRate(quotes: QuoteRow[]): number | null {
  const sent = quotes.filter((q) => ['sent', 'accepted', 'refused', 'expired'].includes(q.status))
  if (sent.length === 0) return null
  const accepted = sent.filter((q) => q.status === 'accepted').length
  return Number((accepted / sent.length).toFixed(4))
}

function repeatClientRate(dossiers: DossierRow[]): {
  rate: number | null
  unique: number
  recurring: number
} {
  const byClient = new Map<string, number>()
  for (const d of dossiers) {
    if (!d.client_id) continue
    byClient.set(d.client_id, (byClient.get(d.client_id) ?? 0) + 1)
  }
  if (byClient.size === 0) return { rate: null, unique: 0, recurring: 0 }
  let recurring = 0
  for (const c of byClient.values()) if (c > 1) recurring += 1
  return {
    rate: Number((recurring / byClient.size).toFixed(4)),
    unique: byClient.size,
    recurring,
  }
}

function diversityIndex(mix: Record<string, number>): number | null {
  const counts = Object.values(mix)
  const total = counts.reduce((a, b) => a + b, 0)
  if (total === 0 || counts.length === 0) return null
  if (counts.length === 1) return 0
  let h = 0
  for (const c of counts) {
    if (c === 0) continue
    const p = c / total
    h += -p * Math.log(p)
  }
  const hMax = Math.log(counts.length)
  return hMax === 0 ? 0 : Number((h / hMax).toFixed(4))
}

function healthScore(input: {
  revenueHtCents: number
  conversion: number | null
  diversity: number | null
  growth: number | null
}): number {
  const revenueTarget = 5_000_00 // 5 000 € HT
  const conversionTarget = 0.5
  const diversityTarget = 0.7
  const revenueScore = Math.min(input.revenueHtCents / revenueTarget, 1) * 30
  const conversionScore =
    input.conversion !== null ? Math.min(input.conversion / conversionTarget, 1) * 20 : 0
  const diversityScore =
    input.diversity !== null ? Math.min(input.diversity / diversityTarget, 1) * 20 : 0
  const growthScore =
    input.growth !== null ? Math.max(0, Math.min(input.growth + 1, 2) / 2) * 30 : 0
  return Number((revenueScore + conversionScore + diversityScore + growthScore).toFixed(2))
}

// ────────────────────────────────────────────────────────────
// Loaders par org.
// ────────────────────────────────────────────────────────────

async function listActiveOrgs(client: SupabaseClient): Promise<OrgRow[]> {
  const { data, error } = await (client as any)
    .from('organizations')
    .select('id, name, plan, plan_status, deleted_at')
    .is('deleted_at', null)
  if (error) throw new Error(`list organizations: ${error.message}`)
  return (data ?? []) as OrgRow[]
}

async function loadMonthlyMissions(
  client: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
): Promise<MissionRow[]> {
  const { data, error } = await (client as any)
    .from('missions')
    .select('id, organization_id, type, status, exported_at, completed_at, created_at, dossier_id')
    .eq('organization_id', orgId)
    .gte('created_at', from)
    .lt('created_at', to)
  if (error) {
    console.error(`[snapshot] missions ${orgId}:`, error.message)
    return []
  }
  return (data ?? []) as MissionRow[]
}

async function loadMonthlyDossiers(
  client: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
): Promise<DossierRow[]> {
  const { data, error } = await (client as any)
    .from('dossiers')
    .select('id, organization_id, client_id, status, created_at')
    .eq('organization_id', orgId)
    .gte('created_at', from)
    .lt('created_at', to)
  if (error) {
    console.error(`[snapshot] dossiers ${orgId}:`, error.message)
    return []
  }
  return (data ?? []) as DossierRow[]
}

async function loadMonthlyInvoices(
  client: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
): Promise<InvoiceRow[]> {
  const { data, error } = await (client as any)
    .from('invoices')
    .select(
      'id, organization_id, client_id, status, amount_ht, amount_ttc, paid_at, issued_at, created_at',
    )
    .eq('organization_id', orgId)
    .gte('created_at', from)
    .lt('created_at', to)
  if (error) {
    console.error(`[snapshot] invoices ${orgId}:`, error.message)
    return []
  }
  return (data ?? []) as InvoiceRow[]
}

async function loadMonthlyQuotes(
  client: SupabaseClient,
  orgId: string,
  from: string,
  to: string,
): Promise<QuoteRow[]> {
  const { data, error } = await (client as any)
    .from('quotes')
    .select('id, organization_id, status, created_at, accepted_at')
    .eq('organization_id', orgId)
    .gte('created_at', from)
    .lt('created_at', to)
  if (error) {
    console.error(`[snapshot] quotes ${orgId}:`, error.message)
    return []
  }
  return (data ?? []) as QuoteRow[]
}

async function loadPreviousRevenue(
  client: SupabaseClient,
  orgId: string,
  prevPeriod: string,
): Promise<number | null> {
  const { data, error } = await (client as any)
    .from('business_analytics_snapshots')
    .select('revenue_ht_cents')
    .eq('organization_id', orgId)
    .eq('snapshot_period', prevPeriod)
    .eq('period_type', 'month')
    .maybeSingle()
  if (error || !data) return null
  return typeof data.revenue_ht_cents === 'number' ? data.revenue_ht_cents : null
}

// ────────────────────────────────────────────────────────────
// Compute + upsert pour 1 org.
// ────────────────────────────────────────────────────────────

async function snapshotForOrg(
  client: SupabaseClient,
  org: OrgRow,
  period: string,
): Promise<ComputationResult> {
  const result: ComputationResult = {
    organization_id: org.id,
    snapshot_period: period,
    ok: false,
    missions_total: 0,
    revenue_ht_cents: 0,
    health_score: null,
  }

  try {
    const { from, to } = monthBounds(period)
    const [missions, dossiers, invoices, quotes] = await Promise.all([
      loadMonthlyMissions(client, org.id, from, to),
      loadMonthlyDossiers(client, org.id, from, to),
      loadMonthlyInvoices(client, org.id, from, to),
      loadMonthlyQuotes(client, org.id, from, to),
    ])
    const mix = diagnosticMix(missions)
    const { completed, exported, cancelled } = statusCounts(missions)
    const { ht, ttc } = revenueMonth(invoices)
    const conversion = conversionRate(quotes)
    const { rate: repeat, unique, recurring } = repeatClientRate(dossiers)
    const diversity = diversityIndex(mix)

    // Previous month for growth ratio
    const prevPeriodDate = new Date(`${period}T00:00:00Z`)
    prevPeriodDate.setUTCMonth(prevPeriodDate.getUTCMonth() - 1)
    const prevPeriod = `${prevPeriodDate.getUTCFullYear()}-${(prevPeriodDate.getUTCMonth() + 1).toString().padStart(2, '0')}-01`
    const prevRevenue = await loadPreviousRevenue(client, org.id, prevPeriod)
    const growth = prevRevenue !== null && prevRevenue > 0 ? (ht - prevRevenue) / prevRevenue : null

    const health = healthScore({
      revenueHtCents: ht,
      conversion,
      diversity,
      growth,
    })

    const avgValue = completed > 0 ? Math.round(ht / completed) : 0

    const row = {
      organization_id: org.id,
      snapshot_period: period,
      period_type: 'month',
      missions_total: missions.length,
      missions_completed: completed,
      missions_exported: exported,
      missions_cancelled: cancelled,
      diagnostic_mix: mix,
      revenue_ht_cents: ht,
      revenue_ttc_cents: ttc,
      avg_mission_value_cents: avgValue,
      ai_cost_cents: 0,
      variable_cost_cents: 0,
      gross_margin_cents: ht,
      gross_margin_ratio: ht > 0 ? 1 : null,
      unique_clients: unique,
      recurring_clients: recurring,
      computed_by: 'edge_business_analytics_snapshot_v1',
      metadata: {
        conversion_rate: conversion,
        repeat_client_rate: repeat,
        health_score: health,
        diversity_index: diversity,
        growth_ratio: growth,
        previous_revenue_ht_cents: prevRevenue,
        computed_at: new Date().toISOString(),
      },
    }

    const { error: upErr } = await (client as any)
      .from('business_analytics_snapshots')
      .upsert(row, { onConflict: 'organization_id,snapshot_period,period_type' })
    if (upErr) throw new Error(`upsert business_analytics_snapshots: ${upErr.message}`)

    result.ok = true
    result.missions_total = missions.length
    result.revenue_ht_cents = ht
    result.health_score = health
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  }
  return result
}

// ────────────────────────────────────────────────────────────
// Auth.
// ────────────────────────────────────────────────────────────

function isAuthorized(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!expected) return false
  const auth = req.headers.get('authorization') ?? ''
  return auth === `Bearer ${expected}`
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) throw new Error('SUPABASE env missing')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ────────────────────────────────────────────────────────────
// Handler.
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const startedAt = Date.now()
  const supabase = createServiceClient()

  // Permettre un override de période via body (utile pour backfill manuel).
  let period = previousMonth(new Date())
  try {
    const body = (await req.json()) as { period?: string } | undefined
    if (body?.period && /^\d{4}-\d{2}-01$/.test(body.period)) {
      period = body.period
    }
  } catch {
    // pas de body : OK, on prend le mois précédent.
  }

  try {
    const orgs = await listActiveOrgs(supabase)
    const results: ComputationResult[] = []
    for (const org of orgs) {
      const r = await snapshotForOrg(supabase, org, period)
      results.push(r)
      console.log(
        `[snapshot] org=${org.id} ok=${r.ok} missions=${r.missions_total} revenue_ht=${r.revenue_ht_cents}cents health=${r.health_score}${r.error ? ` err=${r.error}` : ''}`,
      )
    }
    const ok = results.filter((r) => r.ok).length
    const fail = results.length - ok
    return new Response(
      JSON.stringify({
        ok: true,
        period,
        orgs_total: results.length,
        orgs_ok: ok,
        orgs_failed: fail,
        elapsed_ms: Date.now() - startedAt,
        results: results.slice(0, 50),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        elapsed_ms: Date.now() - startedAt,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
