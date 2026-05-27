// KOVAS — Edge Function `benchmark-compute`
//
// Cron mensuel — 1er du mois 04:00 UTC (1h après business-analytics-snapshot) :
//
//     SELECT cron.schedule(
//       'benchmark-compute',
//       '0 4 1 * *',
//       $$ SELECT net.http_post(
//            url := current_setting('app.settings.supabase_functions_url') || '/benchmark-compute',
//            headers := jsonb_build_object(
//              'Content-Type', 'application/json',
//              'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
//            )
//          ); $$
//     );
//
// Logique :
//   1. Charge `business_analytics_snapshots` pour le mois précédent.
//   2. Pour chaque org, dérive (region_code, cabinet_size) :
//      - region_code via postal_code organisation → table FR DEPT_TO_REGION
//      - cabinet_size via memberships.count active per org
//   3. Pour chaque combinaison (scope, scope_code, cabinet_segment) :
//      - cabinets_count ≥ 5 (k-anonymity)
//      - anti-déduction : skip si top_client_share_pct moyen > 80% (un prescripteur
//        majoritaire pourrait dé-anonymiser le cabinet)
//      - calcule P25/P50/P75 sur metrics (missions, revenue, avg_value, conversion,
//        repeat_client, health_score)
//   4. UPSERT dans anonymous_benchmarks (UNIQUE
//      snapshot_period+period_type+scope+scope_code+cabinet_segment+diagnostic_kind).

/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Constantes / régions.
// ────────────────────────────────────────────────────────────

const DEPT_TO_REGION: Record<string, string> = {
  '01': '84',
  '03': '84',
  '07': '84',
  '15': '84',
  '26': '84',
  '38': '84',
  '42': '84',
  '43': '84',
  '63': '84',
  '69': '84',
  '73': '84',
  '74': '84',
  '21': '27',
  '25': '27',
  '39': '27',
  '58': '27',
  '70': '27',
  '71': '27',
  '89': '27',
  '90': '27',
  '22': '53',
  '29': '53',
  '35': '53',
  '56': '53',
  '18': '24',
  '28': '24',
  '36': '24',
  '37': '24',
  '41': '24',
  '45': '24',
  '2A': '94',
  '2B': '94',
  '08': '44',
  '10': '44',
  '51': '44',
  '52': '44',
  '54': '44',
  '55': '44',
  '57': '44',
  '67': '44',
  '68': '44',
  '88': '44',
  '02': '32',
  '59': '32',
  '60': '32',
  '62': '32',
  '80': '32',
  '75': '11',
  '77': '11',
  '78': '11',
  '91': '11',
  '92': '11',
  '93': '11',
  '94': '11',
  '95': '11',
  '14': '28',
  '27': '28',
  '50': '28',
  '61': '28',
  '76': '28',
  '16': '75',
  '17': '75',
  '19': '75',
  '23': '75',
  '24': '75',
  '33': '75',
  '40': '75',
  '47': '75',
  '64': '75',
  '79': '75',
  '86': '75',
  '87': '75',
  '09': '76',
  '11': '76',
  '12': '76',
  '30': '76',
  '31': '76',
  '32': '76',
  '34': '76',
  '46': '76',
  '48': '76',
  '65': '76',
  '66': '76',
  '81': '76',
  '82': '76',
  '44': '52',
  '49': '52',
  '53': '52',
  '72': '52',
  '85': '52',
  '04': '93',
  '05': '93',
  '06': '93',
  '13': '93',
  '83': '93',
  '84': '93',
}

const MIN_CABINETS = 5
const ANTI_DEDUCTION_THRESHOLD = 0.8

type CabinetSize = 'solo' | 'small' | 'medium' | 'large'

function cabinetSizeFromUserCount(count: number): CabinetSize {
  if (count <= 1) return 'solo'
  if (count <= 3) return 'small'
  if (count <= 10) return 'medium'
  return 'large'
}

function postalCodeToRegion(postalCode: string | null): string | null {
  if (!postalCode || postalCode.length < 2) return null
  let dept: string
  if (postalCode.startsWith('20')) {
    const n = parseInt(postalCode.slice(2, 5), 10)
    dept = n < 200 ? '2A' : '2B'
  } else {
    dept = postalCode.slice(0, 2)
  }
  return DEPT_TO_REGION[dept] ?? null
}

// ────────────────────────────────────────────────────────────
// Types miroir.
// ────────────────────────────────────────────────────────────

interface SnapshotRow {
  organization_id: string
  snapshot_period: string
  period_type: string
  missions_total: number
  missions_completed: number
  revenue_ht_cents: number
  revenue_ttc_cents: number
  avg_mission_value_cents: number
  diagnostic_mix: Record<string, number>
  top_client_share_pct: number | null
  metadata: Record<string, unknown>
}

interface OrgInfoRow {
  id: string
  postal_code: string | null
  member_count: number
}

interface SnapshotForBench {
  organization_id: string
  region_code: string | null
  cabinet_size: CabinetSize
  revenue_ht_cents: number
  missions_completed: number
  avg_mission_value_cents: number
  conversion_rate: number | null
  repeat_client_rate: number | null
  health_score: number | null
  diagnostic_mix: Record<string, number>
  top_client_share_pct: number | null
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

// ────────────────────────────────────────────────────────────
// Stats — P25/P50/P75.
// ────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return sorted[0] ?? null
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo] ?? null
  const w = idx - lo
  const v1 = sorted[lo]
  const v2 = sorted[hi]
  if (v1 === undefined || v2 === undefined) return null
  return v1 * (1 - w) + v2 * w
}

interface PercentileTriple {
  p25: number
  p50: number
  p75: number
}

function percentileTriple(values: number[]): PercentileTriple | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const p25 = percentile(sorted, 0.25)
  const p50 = percentile(sorted, 0.5)
  const p75 = percentile(sorted, 0.75)
  if (p25 === null || p50 === null || p75 === null) return null
  return { p25, p50, p75 }
}

function passesAntiDeduction(snaps: SnapshotForBench[]): boolean {
  const ratios = snaps.map((s) => s.top_client_share_pct).filter((v): v is number => v !== null)
  if (ratios.length === 0) return true
  const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length
  return avg / 100 <= ANTI_DEDUCTION_THRESHOLD
}

// ────────────────────────────────────────────────────────────
// Loaders.
// ────────────────────────────────────────────────────────────

async function loadSnapshots(client: SupabaseClient, period: string): Promise<SnapshotRow[]> {
  const { data, error } = await (client as any)
    .from('business_analytics_snapshots')
    .select(
      'organization_id, snapshot_period, period_type, missions_total, missions_completed, revenue_ht_cents, revenue_ttc_cents, avg_mission_value_cents, diagnostic_mix, top_client_share_pct, metadata',
    )
    .eq('snapshot_period', period)
    .eq('period_type', 'month')
  if (error) throw new Error(`snapshots load: ${error.message}`)
  return (data ?? []) as SnapshotRow[]
}

async function loadOrgsInfo(
  client: SupabaseClient,
  orgIds: string[],
): Promise<Map<string, OrgInfoRow>> {
  if (orgIds.length === 0) return new Map()
  const { data: orgs, error: orgsErr } = await (client as any)
    .from('organizations')
    .select('id, postal_code')
    .in('id', orgIds)
  if (orgsErr) throw new Error(`orgs load: ${orgsErr.message}`)
  const { data: members, error: memErr } = await (client as any)
    .from('memberships')
    .select('organization_id, status')
    .in('organization_id', orgIds)
    .eq('status', 'active')
  if (memErr) throw new Error(`memberships load: ${memErr.message}`)

  const memberCount = new Map<string, number>()
  for (const m of (members ?? []) as Array<{ organization_id: string; status: string }>) {
    memberCount.set(m.organization_id, (memberCount.get(m.organization_id) ?? 0) + 1)
  }

  const map = new Map<string, OrgInfoRow>()
  for (const o of (orgs ?? []) as Array<{ id: string; postal_code: string | null }>) {
    map.set(o.id, {
      id: o.id,
      postal_code: o.postal_code,
      member_count: memberCount.get(o.id) ?? 0,
    })
  }
  return map
}

// ────────────────────────────────────────────────────────────
// Build snapshot-for-bench rows.
// ────────────────────────────────────────────────────────────

function buildBenchRows(
  snapshots: SnapshotRow[],
  orgInfo: Map<string, OrgInfoRow>,
): SnapshotForBench[] {
  const out: SnapshotForBench[] = []
  for (const s of snapshots) {
    const info = orgInfo.get(s.organization_id)
    if (!info) continue
    const region = postalCodeToRegion(info.postal_code)
    const size = cabinetSizeFromUserCount(info.member_count)
    const meta = s.metadata ?? {}
    out.push({
      organization_id: s.organization_id,
      region_code: region,
      cabinet_size: size,
      revenue_ht_cents: s.revenue_ht_cents,
      missions_completed: s.missions_completed,
      avg_mission_value_cents: s.avg_mission_value_cents,
      conversion_rate:
        typeof meta['conversion_rate'] === 'number' ? (meta['conversion_rate'] as number) : null,
      repeat_client_rate:
        typeof meta['repeat_client_rate'] === 'number'
          ? (meta['repeat_client_rate'] as number)
          : null,
      health_score:
        typeof meta['health_score'] === 'number' ? (meta['health_score'] as number) : null,
      diagnostic_mix: s.diagnostic_mix ?? {},
      top_client_share_pct: s.top_client_share_pct,
    })
  }
  return out
}

// ────────────────────────────────────────────────────────────
// Compute benchmarks (groupes + percentiles + k-anon + anti-déduction).
// ────────────────────────────────────────────────────────────

interface BenchmarkRow {
  snapshot_period: string
  period_type: 'month'
  scope: 'national' | 'region'
  scope_code: string | null
  cabinet_segment: CabinetSize | 'all'
  diagnostic_kind: string | null
  cabinets_count: number
  missions_count: number
  median_missions_per_cabinet: number
  p25_missions_per_cabinet: number
  p75_missions_per_cabinet: number
  median_mission_value_cents: number
  p25_mission_value_cents: number
  p75_mission_value_cents: number
  diagnostic_mix_pct: Record<string, number>
  k_anonymity_threshold: number
  computed_by: string
  metadata: Record<string, unknown>
}

function pushGroup(
  groups: Map<string, SnapshotForBench[]>,
  key: string,
  s: SnapshotForBench,
): void {
  const existing = groups.get(key)
  if (existing) existing.push(s)
  else groups.set(key, [s])
}

function computeBenchmarks(period: string, snaps: SnapshotForBench[]): BenchmarkRow[] {
  const groups = new Map<string, SnapshotForBench[]>()
  for (const s of snaps) {
    if (s.region_code) {
      pushGroup(groups, `region|${s.region_code}|${s.cabinet_size}`, s)
      pushGroup(groups, `region|${s.region_code}|all`, s)
    }
    pushGroup(groups, `national|all|${s.cabinet_size}`, s)
    pushGroup(groups, `national|all|all`, s)
  }

  const rows: BenchmarkRow[] = []
  for (const [key, group] of groups) {
    if (group.length < MIN_CABINETS) continue
    if (!passesAntiDeduction(group)) continue
    const parts = key.split('|')
    const scope = parts[0] === 'region' ? 'region' : 'national'
    const scopeCode = parts[1] === 'all' ? null : (parts[1] ?? null)
    const segmentRaw = parts[2] ?? 'all'
    const segment = segmentRaw === 'all' ? 'all' : (segmentRaw as CabinetSize)

    const missionsArr = group.map((s) => s.missions_completed)
    const revenueArr = group.map((s) => s.revenue_ht_cents)
    const valueArr = group.map((s) => s.avg_mission_value_cents)
    const conversionArr = group.map((s) => s.conversion_rate).filter((v): v is number => v !== null)
    const repeatArr = group.map((s) => s.repeat_client_rate).filter((v): v is number => v !== null)
    const healthArr = group.map((s) => s.health_score).filter((v): v is number => v !== null)

    const missionsTriple = percentileTriple(missionsArr)
    const valueTriple = percentileTriple(valueArr)
    if (!missionsTriple || !valueTriple) continue

    // Diagnostic mix pct global (somme normalisée).
    const mixCounts: Record<string, number> = {}
    let mixTotal = 0
    for (const s of group) {
      for (const [k, v] of Object.entries(s.diagnostic_mix)) {
        mixCounts[k] = (mixCounts[k] ?? 0) + v
        mixTotal += v
      }
    }
    const mixPct: Record<string, number> = {}
    if (mixTotal > 0) {
      for (const [k, v] of Object.entries(mixCounts)) {
        mixPct[k] = Number(((v / mixTotal) * 100).toFixed(2))
      }
    }

    const conversionMedian =
      conversionArr.length > 0
        ? percentile(
            [...conversionArr].sort((a, b) => a - b),
            0.5,
          )
        : null
    const repeatMedian =
      repeatArr.length > 0
        ? percentile(
            [...repeatArr].sort((a, b) => a - b),
            0.5,
          )
        : null
    const healthMedian =
      healthArr.length > 0
        ? percentile(
            [...healthArr].sort((a, b) => a - b),
            0.5,
          )
        : null
    const revenueMedian =
      percentile(
        [...revenueArr].sort((a, b) => a - b),
        0.5,
      ) ?? 0

    rows.push({
      snapshot_period: period,
      period_type: 'month',
      scope,
      scope_code: scopeCode,
      cabinet_segment: segment,
      diagnostic_kind: null,
      cabinets_count: group.length,
      missions_count: group.reduce((acc, s) => acc + s.missions_completed, 0),
      median_missions_per_cabinet: Number(missionsTriple.p50.toFixed(2)),
      p25_missions_per_cabinet: Number(missionsTriple.p25.toFixed(2)),
      p75_missions_per_cabinet: Number(missionsTriple.p75.toFixed(2)),
      median_mission_value_cents: Math.round(valueTriple.p50),
      p25_mission_value_cents: Math.round(valueTriple.p25),
      p75_mission_value_cents: Math.round(valueTriple.p75),
      diagnostic_mix_pct: mixPct,
      k_anonymity_threshold: MIN_CABINETS,
      computed_by: 'edge_benchmark_compute_v1',
      metadata: {
        median_revenue_monthly_cents: Math.round(revenueMedian),
        median_conversion_rate:
          conversionMedian !== null ? Number(conversionMedian.toFixed(4)) : null,
        median_repeat_client_rate: repeatMedian !== null ? Number(repeatMedian.toFixed(4)) : null,
        median_health_score: healthMedian !== null ? Number(healthMedian.toFixed(2)) : null,
        anti_deduction_pass: true,
        computed_at: new Date().toISOString(),
      },
    })
  }
  return rows
}

// ────────────────────────────────────────────────────────────
// Upsert.
// ────────────────────────────────────────────────────────────

async function upsertBenchmarks(client: SupabaseClient, rows: BenchmarkRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const CHUNK = 200
  let total = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const { error } = await (client as any).from('anonymous_benchmarks').upsert(slice, {
      onConflict: 'snapshot_period,period_type,scope,scope_code,cabinet_segment,diagnostic_kind',
    })
    if (error) throw new Error(`upsert anonymous_benchmarks: ${error.message}`)
    total += slice.length
  }
  return total
}

// ────────────────────────────────────────────────────────────
// Auth + handler.
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

Deno.serve(async (req: Request) => {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const startedAt = Date.now()
  const supabase = createServiceClient()

  let period = previousMonth(new Date())
  try {
    const body = (await req.json()) as { period?: string } | undefined
    if (body?.period && /^\d{4}-\d{2}-01$/.test(body.period)) {
      period = body.period
    }
  } catch {
    // pas de body : OK.
  }

  try {
    const snapshots = await loadSnapshots(supabase, period)
    if (snapshots.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          period,
          message: 'no snapshots to aggregate',
          elapsed_ms: Date.now() - startedAt,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const orgIds = snapshots.map((s) => s.organization_id)
    const orgInfo = await loadOrgsInfo(supabase, orgIds)
    const benchInputs = buildBenchRows(snapshots, orgInfo)
    const rows = computeBenchmarks(period, benchInputs)
    const upserted = await upsertBenchmarks(supabase, rows)
    return new Response(
      JSON.stringify({
        ok: true,
        period,
        snapshots_loaded: snapshots.length,
        benchmark_rows_computed: rows.length,
        benchmark_rows_upserted: upserted,
        groups_skipped_low_k:
          snapshots.length > 0 && rows.length === 0
            ? 'all groups under k-anonymity threshold'
            : null,
        elapsed_ms: Date.now() - startedAt,
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
