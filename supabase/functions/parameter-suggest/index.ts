// KOVAS — Edge Function `parameter-suggest`
//
// POST /parameter-suggest
//   body : {
//     parameterName: ParameterName,
//     context: SuggestionContext,
//     missionId?: string
//   }
//
//   → 200 { ok: true, suggestion: SuggestionOutput }
//
// Logique V1 (cf. CLAUDE.md §7bis) :
//   1. Auth user via Bearer JWT (RLS-protected) + résolution organization_id
//      via le helper `is_member_of` côté DB.
//   2. Statistiques ADEME : on requête `ademe_dpe_cache` avec filtres de
//      similarité (year ± 5, surface ± 20%, type identique, code postal
//      proche). Si > 50 cas → modale = suggestion.
//   3. Sinon fallback `static-rules.ts` (heuristiques par décennie).
//   4. Insert dans `parameter_suggestions` (audit + dataset entraînement).
//
// Cache LRU 1h sur signature contexte (mémoire process Edge runtime).
//
// NB Cost Optimization 2026-05 — Cette fonction N'APPELLE PAS Anthropic en V1
// (statistiques ADEME + heuristiques statiques). Aucun cost-tracker requis.
// Mapping logique futur : MODEL_FOR_FEATURE.parameter_suggestion = 'haiku'
// (Haiku 4.5) si on bascule vers un appel IA pour les cas low-confidence
// (Phase 2). Cf. apps/web/src/lib/ai/anthropic-config.ts.

/// <reference lib="deno.ns" />
// deno-lint-ignore-file no-explicit-any

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

// ────────────────────────────────────────────────────────────
// Types miroir (copie minimaliste des helpers Node — Edge n'a pas
// d'accès direct à apps/web/src/lib/parameters/. Source de vérité
// reste apps/web/src/lib/parameters/*.ts).
// ────────────────────────────────────────────────────────────

type ParameterName =
  | 'type_ventilation'
  | 'type_chauffage'
  | 'type_ecs'
  | 'type_isolation_murs'
  | 'type_isolation_toiture'
  | 'type_menuiseries'
  | 'type_climatisation'

interface SuggestionContext {
  yearBuilt?: number
  surface?: number
  inseeCode?: string
  postalCode?: string
  buildingType?: string
  etiquetteDpe?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  floors?: number
  [k: string]: string | number | boolean | null | undefined
}

interface SuggestionAlternative {
  value: string
  probability: number
  count: number
}

interface ReglementaryReference {
  label: string
  url: string
  publishedAt?: string
}

interface SuggestionOutput {
  parameterName: ParameterName
  suggestedValue: string
  confidenceScore: number
  alternatives: SuggestionAlternative[]
  justification: string
  reglementaryReferences: ReglementaryReference[]
  similarCasesCount: number
  source: 'ademe_statistics' | 'static_rule' | 'no_data'
  cacheKey: string
  computedAt: string
}

const ADEME_FIELD_BY_PARAMETER: Record<ParameterName, string | null> = {
  type_ventilation: 'type_ventilation',
  type_chauffage: 'type_chauffage',
  type_ecs: 'type_ecs',
  type_climatisation: 'type_climatisation',
  type_isolation_murs: null,
  type_isolation_toiture: null,
  type_menuiseries: null,
}

const MIN_SAMPLES = 50

// ────────────────────────────────────────────────────────────
// Cache LRU 1h.
// ────────────────────────────────────────────────────────────

interface CacheEntry {
  value: SuggestionOutput
  expiresAt: number
}
const LRU_MAX = 500
const LRU_TTL_MS = 60 * 60 * 1000
const cache = new Map<string, CacheEntry>()

function makeCacheKey(name: ParameterName, ctx: SuggestionContext): string {
  const yearBucket =
    typeof ctx.yearBuilt === 'number' ? Math.floor(ctx.yearBuilt / 5) * 5 : 'na'
  const surfaceBucket =
    typeof ctx.surface === 'number' ? Math.floor(ctx.surface / 20) * 20 : 'na'
  const region = ctx.inseeCode ?? ctx.postalCode ?? 'na'
  const bType = ctx.buildingType ?? 'na'
  return `${name}|${yearBucket}|${surfaceBucket}|${region}|${bType}`
}

function getCached(key: string): SuggestionOutput | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  cache.delete(key)
  cache.set(key, entry)
  return entry.value
}

function setCached(key: string, value: SuggestionOutput): void {
  if (cache.size >= LRU_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { value, expiresAt: Date.now() + LRU_TTL_MS })
}

// ────────────────────────────────────────────────────────────
// Normalisation.
// ────────────────────────────────────────────────────────────

function normalizeValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[éèê]/g, 'e')
    .replace(/[àâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
}

// ────────────────────────────────────────────────────────────
// Requête statistique ADEME.
// ────────────────────────────────────────────────────────────

async function fetchSimilarValues(
  client: SupabaseClient,
  organizationId: string,
  ademeField: string,
  ctx: SuggestionContext,
): Promise<Array<string | null>> {
  let query: any = (client as any)
    .from('ademe_dpe_cache')
    .select(`${ademeField}`, { count: 'exact', head: false })
    .eq('organization_id', organizationId)
    .limit(2000)

  if (typeof ctx.yearBuilt === 'number') {
    query = query
      .gte('annee_construction', ctx.yearBuilt - 5)
      .lte('annee_construction', ctx.yearBuilt + 5)
  }
  if (typeof ctx.surface === 'number') {
    query = query
      .gte('surface_habitable_m2', Math.floor(ctx.surface * 0.8))
      .lte('surface_habitable_m2', Math.ceil(ctx.surface * 1.2))
  }
  if (ctx.buildingType) {
    query = query.eq('type_batiment', ctx.buildingType)
  }
  if (ctx.inseeCode) {
    query = query.eq('insee_code', ctx.inseeCode)
  } else if (ctx.postalCode) {
    query = query.eq('postal_code', ctx.postalCode)
  }

  const { data, error } = await query
  if (error) {
    console.error('[parameter-suggest] fetchSimilarValues error:', error.message)
    return []
  }
  return (data ?? []).map((row: Record<string, unknown>) => {
    const v = row[ademeField]
    return typeof v === 'string' ? v : null
  })
}

async function suggestFromStats(
  client: SupabaseClient,
  organizationId: string,
  parameterName: ParameterName,
  ctx: SuggestionContext,
  cacheKey: string,
): Promise<SuggestionOutput | null> {
  const ademeField = ADEME_FIELD_BY_PARAMETER[parameterName]
  if (!ademeField) return null

  const raw = await fetchSimilarValues(client, organizationId, ademeField, ctx)
  const counts = new Map<string, number>()
  let total = 0
  for (const v of raw) {
    if (!v) continue
    const n = normalizeValue(v)
    counts.set(n, (counts.get(n) ?? 0) + 1)
    total += 1
  }
  if (total < MIN_SAMPLES) return null

  let bestValue: string | null = null
  let bestCount = 0
  for (const [value, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      bestValue = value
    }
  }
  if (!bestValue) return null
  const probability = bestCount / total

  const alternatives: SuggestionAlternative[] = [...counts.entries()]
    .filter(([v]) => v !== bestValue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([value, count]) => ({
      value,
      count,
      probability: count / total,
    }))

  return {
    parameterName,
    suggestedValue: bestValue,
    confidenceScore: Number(probability.toFixed(3)),
    alternatives,
    justification: `Modale sur ${total} DPE ADEME similaires (année ± 5, surface ± 20%, type identique). Valeur dominante : ${bestValue} (${(probability * 100).toFixed(1)}%).`,
    reglementaryReferences: [
      {
        label: 'ADEME — Open data DPE V2 logements existants',
        url: 'https://data.ademe.fr/datasets/dpe-v2-logements-existants',
      },
    ],
    similarCasesCount: total,
    source: 'ademe_statistics',
    cacheKey,
    computedAt: new Date().toISOString(),
  }
}

// ────────────────────────────────────────────────────────────
// Règles statiques (mirror static-rules.ts — KISS).
// On garde l'algo "première règle qui match" et on documente les
// URLs Légifrance / Cerema / ADEME sans citer de texte.
// ────────────────────────────────────────────────────────────

const REF_ARRETE_VENTILATION_1982: ReglementaryReference = {
  label: 'Arrêté du 24 mars 1982 — Aération des logements',
  url: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000310578',
  publishedAt: '1982-03-24',
}
const REF_CEREMA_VENTILATION: ReglementaryReference = {
  label: 'Cerema — NF DTU 68.3 / Installations de ventilation mécanique',
  url: 'https://www.cerema.fr/fr/actualites/nf-dtu-68-3-installations-ventilation-mecanique',
}
const REF_ARRETE_3CL_2021: ReglementaryReference = {
  label: 'Arrêté du 31 mars 2021 — Méthode 3CL-DPE 2021',
  url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000043296140',
  publishedAt: '2021-03-31',
}
const REF_CEREMA_PERFORMANCE: ReglementaryReference = {
  label: 'Cerema — Performance des bâtiments existants',
  url: 'https://www.cerema.fr/fr/centre-ressources/boutique/performance-batiments-existants',
}
const REF_ADEME_BILAN_DPE: ReglementaryReference = {
  label: 'ADEME — Bilan annuel DPE',
  url: 'https://librairie.ademe.fr/urbanisme-et-batiment/',
}

interface StaticRule {
  match: (ctx: SuggestionContext) => boolean
  value: string
  confidence: number
  justification: string
  references: ReglementaryReference[]
}

const RULES_VENTILATION: StaticRule[] = [
  {
    match: (c) => typeof c.yearBuilt === 'number' && c.yearBuilt < 1969,
    value: 'naturelle',
    confidence: 0.65,
    justification: 'Logement antérieur à 1969 : ventilation naturelle (pas d\'obligation VMC avant 1982).',
    references: [REF_CEREMA_VENTILATION, REF_ARRETE_VENTILATION_1982],
  },
  {
    match: (c) =>
      typeof c.yearBuilt === 'number' && c.yearBuilt >= 1969 && c.yearBuilt < 1982,
    value: 'vmc_simple_flux',
    confidence: 0.55,
    justification: 'Logement 1969-1982 : transition vers VMC. VMC SF probable.',
    references: [REF_ARRETE_VENTILATION_1982, REF_CEREMA_VENTILATION],
  },
  {
    match: (c) =>
      typeof c.yearBuilt === 'number' && c.yearBuilt >= 1982 && c.yearBuilt < 2000,
    value: 'vmc_simple_flux',
    confidence: 0.75,
    justification: 'Logement 1982-2000 : arrêté 1982 → VMC SF standard.',
    references: [REF_ARRETE_VENTILATION_1982, REF_CEREMA_VENTILATION],
  },
  {
    match: (c) =>
      typeof c.yearBuilt === 'number' && c.yearBuilt >= 2000 && c.yearBuilt < 2012,
    value: 'vmc_hygro_a',
    confidence: 0.6,
    justification: 'Logement 2000-2012 : VMC hygro A fréquente en neuf.',
    references: [REF_CEREMA_VENTILATION, REF_CEREMA_PERFORMANCE],
  },
  {
    match: (c) => typeof c.yearBuilt === 'number' && c.yearBuilt >= 2012,
    value: 'vmc_hygro_b',
    confidence: 0.7,
    justification: 'Post-RT 2012 : VMC hygro B ou double-flux dominantes.',
    references: [REF_ARRETE_3CL_2021, REF_CEREMA_VENTILATION],
  },
]

const RULES_CHAUFFAGE: StaticRule[] = [
  {
    match: (c) =>
      typeof c.yearBuilt === 'number' && c.yearBuilt < 1980 && c.buildingType === 'maison',
    value: 'fioul',
    confidence: 0.4,
    justification: 'Maison avant 1980 : fioul ou gaz historiquement majoritaires.',
    references: [REF_ADEME_BILAN_DPE, REF_CEREMA_PERFORMANCE],
  },
  {
    match: (c) =>
      typeof c.yearBuilt === 'number' &&
      c.yearBuilt >= 1980 &&
      c.yearBuilt < 2005 &&
      c.buildingType === 'maison',
    value: 'gaz',
    confidence: 0.5,
    justification: 'Maison 1980-2005 : chaudière gaz majoritaire en zone raccordée.',
    references: [REF_ADEME_BILAN_DPE],
  },
  {
    match: (c) => typeof c.yearBuilt === 'number' && c.yearBuilt >= 2012,
    value: 'pac',
    confidence: 0.55,
    justification: 'Post-RT 2012 : PAC air-eau / air-air en très forte progression.',
    references: [REF_ARRETE_3CL_2021, REF_ADEME_BILAN_DPE],
  },
]

const RULES_ECS: StaticRule[] = [
  {
    match: (c) => typeof c.yearBuilt === 'number' && c.yearBuilt >= 2012,
    value: 'thermodynamique',
    confidence: 0.5,
    justification: 'Post-RT 2012 : chauffe-eau thermodynamique ou solaire dominants.',
    references: [REF_ARRETE_3CL_2021, REF_ADEME_BILAN_DPE],
  },
  {
    match: (c) =>
      typeof c.yearBuilt === 'number' && c.yearBuilt >= 1990 && c.yearBuilt < 2012,
    value: 'electrique',
    confidence: 0.6,
    justification: 'Logement 1990-2012 : chauffe-eau électrique standard.',
    references: [REF_ADEME_BILAN_DPE],
  },
]

const RULES_BY_PARAMETER: Partial<Record<ParameterName, StaticRule[]>> = {
  type_ventilation: RULES_VENTILATION,
  type_chauffage: RULES_CHAUFFAGE,
  type_ecs: RULES_ECS,
}

function suggestFromStaticRules(
  parameterName: ParameterName,
  ctx: SuggestionContext,
  cacheKey: string,
): SuggestionOutput | null {
  const rules = RULES_BY_PARAMETER[parameterName]
  if (!rules) return null
  const matched = rules.find((r) => r.match(ctx))
  if (!matched) return null
  return {
    parameterName,
    suggestedValue: matched.value,
    confidenceScore: matched.confidence,
    alternatives: [],
    justification: matched.justification,
    reglementaryReferences: matched.references,
    similarCasesCount: 0,
    source: 'static_rule',
    cacheKey,
    computedAt: new Date().toISOString(),
  }
}

// ────────────────────────────────────────────────────────────
// Auth user + organization resolution.
// ────────────────────────────────────────────────────────────

async function resolveUserOrg(
  authClient: SupabaseClient,
): Promise<{ userId: string; organizationId: string } | null> {
  const { data: userData, error: userErr } = await authClient.auth.getUser()
  if (userErr || !userData?.user) return null
  const userId = userData.user.id
  // On lit le default_org du profile.
  const { data: profile, error: profErr } = await (authClient as any)
    .from('profiles')
    .select('default_org_id')
    .eq('id', userId)
    .single()
  if (profErr || !profile?.default_org_id) return null
  return { userId, organizationId: profile.default_org_id as string }
}

// ────────────────────────────────────────────────────────────
// Audit INSERT parameter_suggestions.
// ────────────────────────────────────────────────────────────

async function persistSuggestion(
  client: SupabaseClient,
  params: {
    organizationId: string
    userId: string
    missionId?: string
    parameterName: ParameterName
    suggestion: SuggestionOutput
    context: SuggestionContext
  },
): Promise<void> {
  const row: Record<string, unknown> = {
    organization_id: params.organizationId,
    user_id: params.userId,
    mission_id: params.missionId ?? null,
    target_table: 'missions',
    field_name: params.parameterName,
    field_kind: 'enum',
    suggested_value: { value: params.suggestion.suggestedValue },
    alternatives: params.suggestion.alternatives,
    confidence_score: params.suggestion.confidenceScore,
    explanation: params.suggestion.justification,
    features_snapshot: params.context as Record<string, unknown>,
    source: params.suggestion.source === 'static_rule' ? 'heuristic' : 'ml_model',
    status: 'pending',
  }
  const { error } = await (client as any).from('parameter_suggestions').insert(row)
  if (error) {
    console.error('[parameter-suggest] persistSuggestion error:', error.message)
  }
}

// ────────────────────────────────────────────────────────────
// Handler.
// ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonError('POST only', 405)
  }
  const supaUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supaUrl || !anonKey || !serviceKey) {
    return jsonError('missing supabase env', 500)
  }

  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return jsonError('missing bearer', 401)

  // Auth-bound client (RLS applied, used to resolve user identity).
  const authClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const userOrg = await resolveUserOrg(authClient)
  if (!userOrg) return jsonError('unauthorized', 401)

  // Service-role client for audit INSERT + reads bypassing RLS.
  const adminClient = createClient(supaUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  let body: { parameterName?: string; context?: SuggestionContext; missionId?: string }
  try {
    body = (await req.json()) as {
      parameterName?: string
      context?: SuggestionContext
      missionId?: string
    }
  } catch {
    return jsonError('invalid JSON', 400)
  }

  const parameterName = body.parameterName as ParameterName | undefined
  if (!parameterName || !(parameterName in ADEME_FIELD_BY_PARAMETER)) {
    return jsonError('parameterName invalid or unsupported', 400)
  }
  const context = body.context ?? {}
  const cacheKey = makeCacheKey(parameterName, context)
  const cached = getCached(cacheKey)
  if (cached) {
    // Cache hit : on persiste quand même pour traçabilité (mais peut être skip si bruyant).
    await persistSuggestion(adminClient, {
      organizationId: userOrg.organizationId,
      userId: userOrg.userId,
      missionId: body.missionId,
      parameterName,
      suggestion: cached,
      context,
    })
    return jsonOk({ suggestion: cached, fromCache: true })
  }

  // 1. Tentative ADEME stats
  let suggestion: SuggestionOutput | null = null
  try {
    suggestion = await suggestFromStats(
      adminClient,
      userOrg.organizationId,
      parameterName,
      context,
      cacheKey,
    )
  } catch (err) {
    console.error('[parameter-suggest] stats error:', err instanceof Error ? err.message : err)
  }

  // 2. Fallback règles statiques
  if (!suggestion) {
    suggestion = suggestFromStaticRules(parameterName, context, cacheKey)
  }

  if (!suggestion) {
    return jsonOk({
      suggestion: null,
      reason: 'no_data',
    })
  }

  setCached(cacheKey, suggestion)
  await persistSuggestion(adminClient, {
    organizationId: userOrg.organizationId,
    userId: userOrg.userId,
    missionId: body.missionId,
    parameterName,
    suggestion,
    context,
  })

  return jsonOk({ suggestion, fromCache: false })
})

function jsonOk(payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
