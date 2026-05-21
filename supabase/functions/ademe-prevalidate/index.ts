// KOVAS — Edge Function `ademe-prevalidate`
//
// POST `/ademe-prevalidate`
//
// Pré-validation locale d'un DPE avant publication ADEME : appelle le moteur
// de risk calculator (`apps/web/src/lib/ademe/risk-calculator.ts`), persiste
// le résultat dans `ademe_prevalidations` et retourne le `RiskAssessment`
// complet (verdict + warnings + scores).
//
// Authentication : Bearer JWT user (Supabase Auth). RLS s'applique
// automatiquement via le client supabase initialisé avec le token user.
//
// Pourquoi une Edge Function et pas une API route Next.js ?
//   - Latence faible (lecture règles + dernier snapshot, pas d'IA)
//   - Distribution edge (CDN Supabase, proche du diag)
//   - Réutilisable côté mobile (PWA hors-ligne sync, V1.5)
//
// La logique métier (risk-calculator + rule-evaluator) est dupliquée ici en
// inline (Deno n'a pas accès au monorepo Node). Pattern identique à
// `regulatory-watcher`. La version Node reste la source de vérité — toute
// évolution doit être propagée ici à la main (V2 : packages/ai/ademe-shared
// publié npm + esm.sh).

/// <reference lib="deno.ns" />

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Types — mirror exact `apps/web/src/lib/ademe/risk-calculator.ts`
// ────────────────────────────────────────────────────────────

interface PrevalidationInput {
  type_batiment: 'maison' | 'appartement' | 'immeuble'
  annee_construction: number
  surface_habitable_m2: number
  type_energie_chauffage: string
  type_climatisation: string
  etiquette_dpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  etiquette_ges: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  conso_5_usages_par_m2_ep: number
  latitude?: number
  longitude?: number
}

interface RequestBody {
  mission_id: string
  organization_id: string
  data: PrevalidationInput
  triggered_by?: 'manual' | 'auto_on_save' | 'auto_pre_export' | 'scheduled'
}

type RiskVerdict = 'green' | 'yellow' | 'red'

interface RiskWarning {
  axis: 'volume' | 'distance' | 'coherence' | 'statistical' | 'history'
  severity: 'info' | 'warning' | 'error' | 'blocking'
  code: string
  message: string
  suggested_fix?: string
  context?: Record<string, unknown>
}

interface RuleCondition {
  field: string
  op:
    | 'eq'
    | 'neq'
    | 'ne'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'is_null'
    | 'is_not_null'
    | 'in'
    | 'matches'
    | 'between'
  value?: unknown
}
interface RuleLogic {
  operator: 'AND' | 'OR'
  conditions: RuleCondition[]
}
interface CoherenceRule {
  id: string
  rule_code: string
  title: string
  description: string
  severity: 'info' | 'warning' | 'error' | 'blocking'
  rule_logic: RuleLogic
  suggested_fix: string | null
  diagnostic_types: string[]
  enabled: boolean
}

interface LatestSnapshotRow {
  snapshot_date: string
  metadata: { dpe_count_12m?: number; dpe_count_today?: number; ratio_fg?: number } | null
}

interface LastDpeRow {
  latitude: number | null
  longitude: number | null
}

// ────────────────────────────────────────────────────────────
// Seuils (mirror)
// ────────────────────────────────────────────────────────────

const VOLUME_CRITICAL_YEARLY = 950
const VOLUME_WARNING_YEARLY = 800
const VOLUME_WARNING_DAILY = 6
const DISTANCE_CRITICAL_KM = 40
const DISTANCE_WARNING_KM = 25
const NATIONAL_FG_RATIO = 0.27
const STATISTICAL_TOLERANCE = 0.15
const WEIGHTS = { volume: 0.3, distance: 0.2, coherence: 0.3, statistical: 0.2 }

// ────────────────────────────────────────────────────────────
// Haversine
// ────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}
function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRadians(bLat - aLat)
  const dLon = toRadians(bLng - aLng)
  const lat1 = toRadians(aLat)
  const lat2 = toRadians(bLat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

// ────────────────────────────────────────────────────────────
// Rule evaluator (mirror minimal)
// ────────────────────────────────────────────────────────────

function evaluateRule(logic: RuleLogic, data: Record<string, unknown>): boolean {
  if (!logic || !Array.isArray(logic.conditions) || logic.conditions.length === 0) return false
  const op = logic.operator === 'OR' ? 'OR' : 'AND'
  const fn = (c: RuleCondition) => evalCondition(c, data)
  return op === 'AND' ? logic.conditions.every(fn) : logic.conditions.some(fn)
}

function evalCondition(c: RuleCondition, data: Record<string, unknown>): boolean {
  const v = getField(data, c.field)
  switch (c.op) {
    case 'is_null':
      return v === null || v === undefined || v === ''
    case 'is_not_null':
      return v !== null && v !== undefined && v !== ''
    case 'eq':
      return softEq(v, c.value)
    case 'neq':
    case 'ne':
      return !softEq(v, c.value)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const a = toNum(v)
      const b = toNum(c.value)
      if (a === null || b === null) return false
      if (c.op === 'gt') return a > b
      if (c.op === 'gte') return a >= b
      if (c.op === 'lt') return a < b
      return a <= b
    }
    case 'in':
      if (!Array.isArray(c.value)) return false
      return c.value.some((x) => softEq(v, x))
    case 'matches': {
      if (typeof c.value !== 'string' || typeof v !== 'string') return false
      try {
        return new RegExp(c.value, 'i').test(v)
      } catch {
        return false
      }
    }
    case 'between': {
      if (!Array.isArray(c.value) || c.value.length !== 2) return false
      const n = toNum(v)
      const lo = toNum(c.value[0])
      const hi = toNum(c.value[1])
      if (n === null || lo === null || hi === null) return false
      return n >= lo && n <= hi
    }
    default:
      return false
  }
}

function getField(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = data
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
    const rec = cur as Record<string, unknown>
    if (p in rec) {
      cur = rec[p]
      continue
    }
    const lower = p.toLowerCase()
    let found = false
    for (const k of Object.keys(rec)) {
      if (k.toLowerCase() === lower) {
        cur = rec[k]
        found = true
        break
      }
    }
    if (!found) return undefined
  }
  return cur
}

function softEq(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || a === undefined || b === null || b === undefined) return false
  if (typeof a === 'number' && typeof b === 'string') return String(a) === b
  if (typeof a === 'string' && typeof b === 'number') return a === String(b)
  if (typeof a === 'string' && typeof b === 'string') {
    return a.trim().toLowerCase() === b.trim().toLowerCase()
  }
  return false
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

// ────────────────────────────────────────────────────────────
// Risk computation (orchestrateur inline)
// ────────────────────────────────────────────────────────────

interface RiskAssessment {
  verdict: RiskVerdict
  global_score: number
  axis_scores: {
    volume: number
    distance: number
    coherence: number
    statistical: number
  }
  warnings: RiskWarning[]
  computed_at: string
}

async function computeRisk(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null,
  data: PrevalidationInput,
): Promise<{ assessment: RiskAssessment; rulesChecked: number }> {
  const [snapRes, lastDpeRes, rulesRes] = await Promise.all([
    supabase
      .from('ademe_kpi_snapshots')
      .select('snapshot_date, metadata')
      .eq('organization_id', orgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ademe_dpe_cache')
      .select('latitude, longitude')
      .eq('organization_id', orgId)
      .order('date_etablissement', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('ademe_coherence_rules')
      .select('id, rule_code, title, description, severity, rule_logic, suggested_fix, diagnostic_types, enabled')
      .eq('enabled', true),
  ])

  const snapshot = snapRes.data as LatestSnapshotRow | null
  const lastDpe = lastDpeRes.data as LastDpeRow | null
  const rules = (rulesRes.data ?? []) as CoherenceRule[]

  const warnings: RiskWarning[] = []
  let volumeScore = 0
  let distanceScore = 0
  let coherenceScore = 0
  let statisticalScore = 0

  // Volume
  const count12m = snapshot?.metadata?.dpe_count_12m ?? 0
  const countToday = snapshot?.metadata?.dpe_count_today ?? 0
  if (count12m >= VOLUME_CRITICAL_YEARLY) {
    volumeScore = 100
    warnings.push({
      axis: 'volume',
      severity: 'error',
      code: 'VOLUME_YEARLY_CRITICAL',
      message: `${count12m} DPE publiés sur 12 mois — seuil critique ${VOLUME_CRITICAL_YEARLY} atteint.`,
      context: { count_12m: count12m },
    })
  } else if (count12m >= VOLUME_WARNING_YEARLY) {
    volumeScore = 60
    warnings.push({
      axis: 'volume',
      severity: 'warning',
      code: 'VOLUME_YEARLY_WARNING',
      message: `${count12m} DPE sur 12 mois — surveillance recommandée.`,
      context: { count_12m: count12m },
    })
  }
  if (countToday >= VOLUME_WARNING_DAILY) {
    volumeScore = Math.max(volumeScore, 50)
    warnings.push({
      axis: 'volume',
      severity: 'warning',
      code: 'VOLUME_DAILY_WARNING',
      message: `${countToday} DPE déjà publiés aujourd'hui.`,
      context: { count_today: countToday },
    })
  }

  // Distance
  if (
    lastDpe &&
    typeof lastDpe.latitude === 'number' &&
    typeof lastDpe.longitude === 'number' &&
    typeof data.latitude === 'number' &&
    typeof data.longitude === 'number'
  ) {
    const km = haversineKm(data.latitude, data.longitude, lastDpe.latitude, lastDpe.longitude)
    if (km > DISTANCE_CRITICAL_KM) {
      distanceScore = 100
      warnings.push({
        axis: 'distance',
        severity: 'error',
        code: 'DISTANCE_CRITICAL',
        message: `${km.toFixed(1)} km depuis le dernier DPE — anormal (seuil ${DISTANCE_CRITICAL_KM} km).`,
        context: { km },
      })
    } else if (km > DISTANCE_WARNING_KM) {
      distanceScore = 50
      warnings.push({
        axis: 'distance',
        severity: 'warning',
        code: 'DISTANCE_WARNING',
        message: `${km.toFixed(1)} km depuis le dernier DPE.`,
        context: { km },
      })
    }
  }

  // Cohérence
  let rulesViolatedErrors = 0
  let rulesViolatedWarn = 0
  for (const rule of rules) {
    const violated = evaluateRule(rule.rule_logic, data as unknown as Record<string, unknown>)
    if (!violated) continue
    warnings.push({
      axis: 'coherence',
      severity: rule.severity,
      code: rule.rule_code,
      message: rule.description,
      ...(rule.suggested_fix !== null ? { suggested_fix: rule.suggested_fix } : {}),
      context: { rule_id: rule.id, title: rule.title },
    })
    if (rule.severity === 'error' || rule.severity === 'blocking') rulesViolatedErrors += 1
    else if (rule.severity === 'warning') rulesViolatedWarn += 1
  }
  coherenceScore = Math.min(100, rulesViolatedErrors * 60 + rulesViolatedWarn * 20)

  // Statistique
  const isOld = data.annee_construction < 1975
  const isExcellent = data.etiquette_dpe === 'A' || data.etiquette_dpe === 'B'
  if (isOld && isExcellent) {
    statisticalScore = Math.max(statisticalScore, 35)
    warnings.push({
      axis: 'statistical',
      severity: 'warning',
      code: 'STAT_OLD_BUILDING_EXCELLENT_LABEL',
      message: `Étiquette ${data.etiquette_dpe} sur bâtiment ${data.annee_construction} — statistiquement rare.`,
      context: { annee: data.annee_construction, etiquette: data.etiquette_dpe },
    })
  }
  const orgRatioFg = snapshot?.metadata?.ratio_fg
  if (typeof orgRatioFg === 'number') {
    const delta = NATIONAL_FG_RATIO - orgRatioFg
    if (delta > STATISTICAL_TOLERANCE) {
      statisticalScore = Math.max(statisticalScore, 60)
      warnings.push({
        axis: 'statistical',
        severity: 'warning',
        code: 'STAT_FG_UNDERREPRESENTED',
        message: `Ratio F/G cabinet ${(orgRatioFg * 100).toFixed(1)}% vs ${(NATIONAL_FG_RATIO * 100).toFixed(1)}% national.`,
        context: { org_ratio: orgRatioFg, delta },
      })
    }
  }
  if (data.etiquette_dpe === 'E' && data.conso_5_usages_par_m2_ep > 320) {
    statisticalScore = Math.max(statisticalScore, 20)
    warnings.push({
      axis: 'statistical',
      severity: 'info',
      code: 'STAT_FRONTIER_DE',
      message: `Consommation ${data.conso_5_usages_par_m2_ep} kWh/m²/an proche frontière E/F.`,
    })
  }

  const globalScore = Math.round(
    volumeScore * WEIGHTS.volume +
      distanceScore * WEIGHTS.distance +
      coherenceScore * WEIGHTS.coherence +
      statisticalScore * WEIGHTS.statistical,
  )
  const verdict: RiskVerdict = globalScore >= 70 ? 'red' : globalScore >= 40 ? 'yellow' : 'green'

  // Référence userId pour audit (pas utilisé dans le score mais documenté).
  void userId

  return {
    assessment: {
      verdict,
      global_score: globalScore,
      axis_scores: {
        volume: volumeScore,
        distance: distanceScore,
        coherence: coherenceScore,
        statistical: statisticalScore,
      },
      warnings,
      computed_at: new Date().toISOString(),
    },
    rulesChecked: rules.length,
  }
}

// ────────────────────────────────────────────────────────────
// Persistence
// ────────────────────────────────────────────────────────────

async function persistPrevalidation(
  supabase: SupabaseClient,
  body: RequestBody,
  userId: string | null,
  assessment: RiskAssessment,
  rulesChecked: number,
): Promise<{ id: string }> {
  const rulesPassed = rulesChecked - assessment.warnings.filter((w) => w.axis === 'coherence').length
  const rulesFailed = assessment.warnings.filter(
    (w) => w.axis === 'coherence' && (w.severity === 'error' || w.severity === 'blocking'),
  ).length
  const rulesWarning = assessment.warnings.filter(
    (w) => w.axis === 'coherence' && w.severity === 'warning',
  ).length

  const status =
    assessment.verdict === 'red'
      ? 'failed'
      : assessment.verdict === 'yellow'
      ? 'warning'
      : 'passed'

  const row = {
    organization_id: body.organization_id,
    mission_id: body.mission_id,
    user_id: userId,
    status,
    triggered_by: body.triggered_by ?? 'manual',
    total_rules_checked: rulesChecked,
    rules_passed: Math.max(0, rulesPassed),
    rules_failed: rulesFailed,
    rules_warning: rulesWarning,
    quality_score: Number(((100 - assessment.global_score) / 100).toFixed(3)),
    findings: assessment.warnings,
    snapshot_payload: body.data as unknown as Record<string, unknown>,
    completed_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('ademe_prevalidations')
    .insert(row)
    .select('id')
    .single()
  if (error) throw new Error(`insert ademe_prevalidations: ${error.message}`)
  return { id: (data as { id: string }).id }
}

// ────────────────────────────────────────────────────────────
// Validation input
// ────────────────────────────────────────────────────────────

function validateBody(raw: unknown): RequestBody | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'body_invalid' }
  const r = raw as Record<string, unknown>
  if (typeof r.mission_id !== 'string') return { error: 'mission_id_required' }
  if (typeof r.organization_id !== 'string') return { error: 'organization_id_required' }
  if (!r.data || typeof r.data !== 'object') return { error: 'data_required' }
  const d = r.data as Record<string, unknown>
  const types = ['maison', 'appartement', 'immeuble']
  const labels = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  if (typeof d.type_batiment !== 'string' || !types.includes(d.type_batiment)) {
    return { error: 'type_batiment_invalid' }
  }
  if (typeof d.annee_construction !== 'number') return { error: 'annee_construction_invalid' }
  if (typeof d.surface_habitable_m2 !== 'number') return { error: 'surface_habitable_m2_invalid' }
  if (typeof d.type_energie_chauffage !== 'string') return { error: 'type_energie_chauffage_invalid' }
  if (typeof d.type_climatisation !== 'string') return { error: 'type_climatisation_invalid' }
  if (typeof d.etiquette_dpe !== 'string' || !labels.includes(d.etiquette_dpe)) {
    return { error: 'etiquette_dpe_invalid' }
  }
  if (typeof d.etiquette_ges !== 'string' || !labels.includes(d.etiquette_ges)) {
    return { error: 'etiquette_ges_invalid' }
  }
  if (typeof d.conso_5_usages_par_m2_ep !== 'number') {
    return { error: 'conso_5_usages_par_m2_ep_invalid' }
  }
  const triggers = ['manual', 'auto_on_save', 'auto_pre_export', 'scheduled']
  const triggered = typeof r.triggered_by === 'string' && triggers.includes(r.triggered_by)
    ? (r.triggered_by as RequestBody['triggered_by'])
    : 'manual'

  return {
    mission_id: r.mission_id,
    organization_id: r.organization_id,
    data: d as unknown as PrevalidationInput,
    triggered_by: triggered,
  }
}

// ────────────────────────────────────────────────────────────
// Handler
// ────────────────────────────────────────────────────────────

function createUserClient(req: Request): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !anon) return null
  const auth = req.headers.get('Authorization') ?? ''
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createUserClient(req)
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Auth check
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const validated = validateBody(raw)
  if ('error' in validated) {
    return new Response(JSON.stringify(validated), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { assessment, rulesChecked } = await computeRisk(
      supabase,
      validated.organization_id,
      userData.user.id,
      validated.data,
    )
    const persisted = await persistPrevalidation(
      supabase,
      validated,
      userData.user.id,
      assessment,
      rulesChecked,
    )
    return new Response(
      JSON.stringify({ ok: true, prevalidation_id: persisted.id, assessment }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})
