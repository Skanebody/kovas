/**
 * KOVAS — Edge Function rebuild-user-patterns.
 *
 * Cron hebdomadaire (suggéré `0 3 * * 0` — dimanche 3h UTC) qui reconstruit
 * le knowledge graph sémantique de chaque diagnostiqueur claimé (lot B59 +
 * B61). Pour chaque diag dont `last_rebuilt_at` est NULL ou < now() - 7j :
 *   1. Lit ses 50 dernières missions complètes (via jointure
 *      missions ↔ diagnosticians via claimed_by_user_id).
 *   2. Mappe en MissionLite[] (shape attendue par buildKnowledgeGraph).
 *   3. Appelle buildKnowledgeGraph() → UserKnowledgeGraph.
 *   4. UPSERT data.user_mission_patterns(diagnostician_id, graph, sample_size,
 *      last_rebuilt_at).
 *
 * Throttling : max 100 diags traités par invocation (cf. pattern
 * ingest-* B29). Au-delà, on s'arrête et on rebuild au prochain cron.
 *
 * Auth : Bearer SUPABASE_SERVICE_ROLE_KEY OU header x-cron-secret = CRON_SECRET.
 *
 * Anti-collision : on saute silencieusement les diagnosticians SANS
 * claimed_by_user_id (fiches non claimées — pas de propriétaire à apprendre).
 *
 * Logique pure-fn dupliquée localement (Deno ne peut pas importer du
 * code Node `apps/web/src/lib/learning/*` directement). À garder
 * **synchronisée** avec apps/web/src/lib/learning/user-knowledge-graph.ts
 * (Lot B59 — section buildKnowledgeGraph uniquement, les 3 autres helpers
 * predictFromGraph / computeDelta / routeAnalysisStrategy ne sont pas
 * nécessaires côté rebuild).
 *
 * Authority : docs/refonte-2026-05/AI_ECONOMICS.md §10 + Lot B61.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.46.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const MAX_DIAGS_PER_RUN = 100
const MAX_MISSIONS_PER_USER = 50
const REBUILD_INTERVAL_DAYS = 7

// ---------------------------------------------------------------------------
// Pure-fn dupliquée — sync avec lib/learning/user-knowledge-graph.ts (B59)
// ---------------------------------------------------------------------------

type PropertyType = 'maison' | 'appartement' | 'autre'
type DpeClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

interface MissionLite {
  id: string
  created_at: string
  postal_code?: string | null
  property_type?: PropertyType | null
  year_built?: number | null
  surface_m2?: number | null
  dpe_class?: DpeClass | null
  equipment_brands?: ReadonlyArray<string> | null
  anomaly_patterns?: ReadonlyArray<string> | null
}

interface EquipmentBrandEntry {
  brand: string
  count: number
  last_seen: string
}
interface PostalCodeEntry {
  postal_code: string
  count: number
}
interface PropertyTypeEntry {
  type: PropertyType
  count: number
}
interface AnomalyPatternEntry {
  pattern: string
  count: number
}

interface UserKnowledgeGraph {
  frequent_equipment_brands: ReadonlyArray<EquipmentBrandEntry>
  frequent_postal_codes: ReadonlyArray<PostalCodeEntry>
  frequent_property_types: ReadonlyArray<PropertyTypeEntry>
  dpe_class_distribution: Record<DpeClass, number>
  avg_year_built: number | null
  avg_surface_m2: number | null
  recurring_anomaly_patterns: ReadonlyArray<AnomalyPatternEntry>
  sample_size: number
  last_updated_at: string
}

const ALL_DPE_CLASSES: ReadonlyArray<DpeClass> = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const ALL_PROPERTY_TYPES: ReadonlyArray<PropertyType> = ['maison', 'appartement', 'autre']
const TOP_EQUIPMENT_BRANDS = 10
const TOP_POSTAL_CODES = 20

function emptyDpeDistribution(): Record<DpeClass, number> {
  const out = {} as Record<DpeClass, number>
  for (const c of ALL_DPE_CLASSES) out[c] = 0
  return out
}

function emptyGraph(now: string): UserKnowledgeGraph {
  return {
    frequent_equipment_brands: [],
    frequent_postal_codes: [],
    frequent_property_types: [],
    dpe_class_distribution: emptyDpeDistribution(),
    avg_year_built: null,
    avg_surface_m2: null,
    recurring_anomaly_patterns: [],
    sample_size: 0,
    last_updated_at: now,
  }
}

function average(values: ReadonlyArray<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return Math.round((sum / nums.length) * 100) / 100
}

function buildKnowledgeGraph(
  missions: ReadonlyArray<MissionLite>,
  now: string = new Date().toISOString(),
): UserKnowledgeGraph {
  if (missions.length === 0) return emptyGraph(now)

  // 1. Marques équipement
  const brandMap = new Map<string, { count: number; last_seen: string }>()
  for (const m of missions) {
    if (!m.equipment_brands) continue
    for (const rawBrand of m.equipment_brands) {
      const brand = rawBrand.trim()
      if (brand.length === 0) continue
      const existing = brandMap.get(brand)
      if (existing) {
        existing.count += 1
        if (m.created_at > existing.last_seen) existing.last_seen = m.created_at
      } else {
        brandMap.set(brand, { count: 1, last_seen: m.created_at })
      }
    }
  }
  const frequent_equipment_brands: EquipmentBrandEntry[] = [...brandMap.entries()]
    .map(([brand, v]) => ({ brand, count: v.count, last_seen: v.last_seen }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
    .slice(0, TOP_EQUIPMENT_BRANDS)

  // 2. Codes postaux
  const postalMap = new Map<string, number>()
  for (const m of missions) {
    if (!m.postal_code) continue
    const pc = m.postal_code.trim()
    if (pc.length === 0) continue
    postalMap.set(pc, (postalMap.get(pc) ?? 0) + 1)
  }
  const frequent_postal_codes: PostalCodeEntry[] = [...postalMap.entries()]
    .map(([postal_code, count]) => ({ postal_code, count }))
    .sort((a, b) => b.count - a.count || a.postal_code.localeCompare(b.postal_code))
    .slice(0, TOP_POSTAL_CODES)

  // 3. Types de bien
  const typeMap = new Map<PropertyType, number>()
  for (const m of missions) {
    if (!m.property_type) continue
    typeMap.set(m.property_type, (typeMap.get(m.property_type) ?? 0) + 1)
  }
  const frequent_property_types: PropertyTypeEntry[] = ALL_PROPERTY_TYPES.filter((t) =>
    typeMap.has(t),
  )
    .map((type) => ({ type, count: typeMap.get(type) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  // 4. DPE distribution
  const dpe_class_distribution = emptyDpeDistribution()
  for (const m of missions) {
    if (!m.dpe_class) continue
    dpe_class_distribution[m.dpe_class] += 1
  }

  // 5. Moyennes
  const avg_year_built = average(missions.map((m) => m.year_built ?? null))
  const avg_surface_m2 = average(missions.map((m) => m.surface_m2 ?? null))

  // 6. Anomalies
  const anomalyMap = new Map<string, number>()
  for (const m of missions) {
    if (!m.anomaly_patterns) continue
    for (const raw of m.anomaly_patterns) {
      const pattern = raw.trim()
      if (pattern.length === 0) continue
      anomalyMap.set(pattern, (anomalyMap.get(pattern) ?? 0) + 1)
    }
  }
  const recurring_anomaly_patterns: AnomalyPatternEntry[] = [...anomalyMap.entries()]
    .filter(([, count]) => count >= 2)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern))
    .slice(0, 20)

  return {
    frequent_equipment_brands,
    frequent_postal_codes,
    frequent_property_types,
    dpe_class_distribution,
    avg_year_built,
    avg_surface_m2,
    recurring_anomaly_patterns,
    sample_size: missions.length,
    last_updated_at: now,
  }
}

// ---------------------------------------------------------------------------
// Edge Function handler
// ---------------------------------------------------------------------------

interface DiagCandidate {
  diagnostician_id: string
  claimed_by_user_id: string
}

interface MissionRow {
  id: string
  created_at: string
  property_id?: string | null
  metadata?: Record<string, unknown> | null
  dpe_letter?: DpeClass | null
}

interface PropertyRow {
  id: string
  postal_code?: string | null
  surface_m2?: number | null
  year_built?: number | null
  property_type?: string | null
}

function getSupabase() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('Supabase credentials missing')
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function checkAuth(req: Request): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const cronSecret = req.headers.get('x-cron-secret') ?? ''
  if (SERVICE_ROLE_KEY && authHeader === `Bearer ${SERVICE_ROLE_KEY}`) return true
  if (CRON_SECRET && cronSecret !== '' && cronSecret === CRON_SECRET) return true
  return false
}

function normalizePropertyType(raw: string | null | undefined): PropertyType | null {
  if (!raw) return null
  const low = raw.toLowerCase().trim()
  if (low === 'maison' || low === 'house') return 'maison'
  if (low === 'appartement' || low === 'apartment' || low === 'appart') return 'appartement'
  return 'autre'
}

async function fetchDiagCandidates(
  supabase: ReturnType<typeof getSupabase>,
): Promise<DiagCandidate[]> {
  // On cible les diagnosticians CLAIMÉS dont le graph n'existe pas OU est
  // périmé (> 7 jours). On laisse Postgres faire le LEFT JOIN + filtre.
  const cutoff = new Date(Date.now() - REBUILD_INTERVAL_DAYS * 24 * 3600 * 1000).toISOString()

  // Pull diagnosticians claimés (claimed_by_user_id NOT NULL)
  const { data: diags, error } = await supabase
    .from('diagnosticians')
    .select('id, claimed_by_user_id')
    .not('claimed_by_user_id', 'is', null)
    .limit(MAX_DIAGS_PER_RUN * 4) // marge car on filtre ensuite par last_rebuilt_at

  if (error) throw new Error(`fetchDiagCandidates failed: ${error.message}`)
  if (!diags || diags.length === 0) return []

  const ids = diags.map((d) => (d as { id: string }).id)

  // Pull les graphs existants pour ces diags
  const { data: existing } = await supabase
    .schema('data' as never)
    .from('user_mission_patterns')
    .select('diagnostician_id, last_rebuilt_at')
    .in('diagnostician_id', ids)

  const lastRebuiltMap = new Map<string, string>()
  for (const row of existing ?? []) {
    const r = row as { diagnostician_id: string; last_rebuilt_at: string }
    lastRebuiltMap.set(r.diagnostician_id, r.last_rebuilt_at)
  }

  // Garde uniquement les diags jamais rebuild ou périmés
  const due: DiagCandidate[] = []
  for (const d of diags) {
    const row = d as { id: string; claimed_by_user_id: string | null }
    if (!row.claimed_by_user_id) continue
    const last = lastRebuiltMap.get(row.id)
    if (!last || last < cutoff) {
      due.push({ diagnostician_id: row.id, claimed_by_user_id: row.claimed_by_user_id })
      if (due.length >= MAX_DIAGS_PER_RUN) break
    }
  }
  return due
}

async function fetchUserMissions(
  supabase: ReturnType<typeof getSupabase>,
  userId: string,
): Promise<MissionLite[]> {
  // missions.assigned_to OU missions.created_by — on prend assigned_to en priorité
  // (vision diagnostiqueur exécutant) avec fallback created_by.
  const { data: missions, error } = await supabase
    .from('missions')
    .select('id, created_at, property_id, metadata, dpe_letter, assigned_to, created_by')
    .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(MAX_MISSIONS_PER_USER)

  if (error) throw new Error(`fetchUserMissions(${userId}) failed: ${error.message}`)
  if (!missions || missions.length === 0) return []

  // Pull les propriétés associées en une seule requête
  const propertyIds = [
    ...new Set(
      missions
        .map((m) => (m as MissionRow).property_id)
        .filter((v): v is string => typeof v === 'string'),
    ),
  ]
  const propertyMap = new Map<string, PropertyRow>()
  if (propertyIds.length > 0) {
    const { data: properties } = await supabase
      .from('properties')
      .select('id, postal_code, surface_m2, year_built, property_type')
      .in('id', propertyIds)
    for (const p of properties ?? []) {
      const pr = p as PropertyRow
      propertyMap.set(pr.id, pr)
    }
  }

  return missions.map((row): MissionLite => {
    const m = row as MissionRow & { assigned_to?: string; created_by?: string }
    const prop = m.property_id ? propertyMap.get(m.property_id) : undefined
    const meta = (m.metadata ?? {}) as {
      equipment_brands?: string[]
      anomaly_patterns?: string[]
    }
    return {
      id: m.id,
      created_at: m.created_at,
      postal_code: prop?.postal_code ?? null,
      property_type: normalizePropertyType(prop?.property_type),
      year_built: prop?.year_built ?? null,
      surface_m2: prop?.surface_m2 ?? null,
      dpe_class: m.dpe_letter ?? null,
      equipment_brands: Array.isArray(meta.equipment_brands) ? meta.equipment_brands : null,
      anomaly_patterns: Array.isArray(meta.anomaly_patterns) ? meta.anomaly_patterns : null,
    }
  })
}

interface RebuildResult {
  diagnostician_id: string
  sample_size: number
  ok: boolean
  error?: string
}

async function rebuildOne(
  supabase: ReturnType<typeof getSupabase>,
  cand: DiagCandidate,
): Promise<RebuildResult> {
  try {
    const missions = await fetchUserMissions(supabase, cand.claimed_by_user_id)
    const now = new Date().toISOString()
    const graph = buildKnowledgeGraph(missions, now)
    const { error } = await supabase
      .schema('data' as never)
      .from('user_mission_patterns')
      .upsert(
        {
          diagnostician_id: cand.diagnostician_id,
          graph,
          sample_size: graph.sample_size,
          last_rebuilt_at: now,
        } as never,
        { onConflict: 'diagnostician_id' },
      )
    if (error) {
      return {
        diagnostician_id: cand.diagnostician_id,
        sample_size: graph.sample_size,
        ok: false,
        error: error.message,
      }
    }
    return { diagnostician_id: cand.diagnostician_id, sample_size: graph.sample_size, ok: true }
  } catch (err) {
    return {
      diagnostician_id: cand.diagnostician_id,
      sample_size: 0,
      ok: false,
      error: err instanceof Error ? err.message : 'unknown',
    }
  }
}

Deno.serve(async (req: Request) => {
  if (!checkAuth(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const startedAt = Date.now()
  const supabase = getSupabase()

  let candidates: DiagCandidate[] = []
  try {
    candidates = await fetchDiagCandidates(supabase)
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'unknown',
        duration_ms: Date.now() - startedAt,
      }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    )
  }

  const results: RebuildResult[] = []
  for (const cand of candidates) {
    // Séquentiel délibérément : Supabase row-level locks + ménager le DB CPU.
    // Si besoin de scale > 100 users/min, paralléliser par batch de 5.
    const r = await rebuildOne(supabase, cand)
    results.push(r)
  }

  const okCount = results.filter((r) => r.ok).length
  const failCount = results.length - okCount
  const avgSample =
    results.length > 0
      ? Math.round((results.reduce((acc, r) => acc + r.sample_size, 0) / results.length) * 100) /
        100
      : 0

  const summary = {
    ok: failCount === 0,
    duration_ms: Date.now() - startedAt,
    candidates_count: candidates.length,
    rebuilt_ok: okCount,
    rebuilt_fail: failCount,
    avg_sample_size: avgSample,
    results,
  }

  console.log('[rebuild-user-patterns]', JSON.stringify(summary))

  return new Response(JSON.stringify(summary), {
    headers: { 'content-type': 'application/json' },
  })
})
