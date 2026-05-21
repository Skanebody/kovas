// ============================================
// KOVAS SEO — Edge Function : seo-ingest-dvf
//
// Mission : ingerer les signaux marche immobilier depuis DVF (Demandes de
//   Valeurs Foncieres) via l'API officielle data.gouv.fr. Genere 2 keywords
//   par ville ("prix immobilier ${ville}" + "diagnostic immobilier ${ville}")
//   et y associe les signaux volume_transactions + prix_m2_moyen.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron mensuel (donnees DVF trimestrielles) + appel admin manuel.
//
// Sources / couts API :
//   - DVF : https://app.dvf.etalab.gouv.fr/api/mutations3/${insee}/${year}
//   - Gratuit, illimite, FR entiere (sauf Alsace-Moselle).
//
// Mode mock : si DVF retourne 404/500 sur 3 villes consecutives, bascule
//   automatiquement en mode mock (valeurs aleatoires plausibles).
//
// Variables env : aucune (API publique).
// ============================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ============================================
// Types
// ============================================
interface SampleCity {
  insee: string
  name: string
}

interface DvfMutation {
  id_mutation?: string
  date_mutation?: string
  valeur_fonciere?: number | string | null
  surface_reelle_bati?: number | string | null
  type_local?: string | null
  nature_mutation?: string | null
}

interface DvfApiResponse {
  // L'API DVF retourne plusieurs formats selon endpoint, on couvre les usuels
  mutations?: DvfMutation[]
  features?: Array<{ properties?: DvfMutation }>
}

interface IngestStats {
  ok: boolean
  villesProcessed: number
  signals: number
  keywords: number
  mockMode: boolean
  durationMs: number
  errors: number
}

interface InsertSignalParams {
  keywordId: string
  sourceCode: string
  signalValue: number
  signalType: string
  metadata: Record<string, unknown>
  ingestionRunId: string
}

// ============================================
// 50 villes prioritaires (mix grandes metropoles + villes moyennes
// representatives de l'activite diagnostic immobilier FR).
// ============================================
const SAMPLE_CITIES: SampleCity[] = [
  { insee: '75056', name: 'Paris' },
  { insee: '13055', name: 'Marseille' },
  { insee: '69123', name: 'Lyon' },
  { insee: '31555', name: 'Toulouse' },
  { insee: '06088', name: 'Nice' },
  { insee: '44109', name: 'Nantes' },
  { insee: '67482', name: 'Strasbourg' },
  { insee: '34172', name: 'Montpellier' },
  { insee: '33063', name: 'Bordeaux' },
  { insee: '59350', name: 'Lille' },
  { insee: '35238', name: 'Rennes' },
  { insee: '51454', name: 'Reims' },
  { insee: '76217', name: 'Dieppe' },
  { insee: '87085', name: 'Limoges' },
  { insee: '74010', name: 'Annecy' },
  { insee: '38185', name: 'Grenoble' },
  { insee: '21231', name: 'Dijon' },
  { insee: '76540', name: 'Rouen' },
  { insee: '49007', name: 'Angers' },
  { insee: '63113', name: 'Clermont-Ferrand' },
  { insee: '37261', name: 'Tours' },
  { insee: '76351', name: 'Le Havre' },
  { insee: '83137', name: 'Toulon' },
  { insee: '42218', name: 'Saint-Etienne' },
  { insee: '80021', name: 'Amiens' },
  { insee: '14118', name: 'Caen' },
  { insee: '13001', name: 'Aix-en-Provence' },
  { insee: '54395', name: 'Nancy' },
  { insee: '45234', name: 'Orleans' },
  { insee: '83069', name: 'Frejus' },
  { insee: '17300', name: 'La Rochelle' },
  { insee: '85191', name: 'La Roche-sur-Yon' },
  { insee: '29019', name: 'Brest' },
  { insee: '57463', name: 'Metz' },
  { insee: '68224', name: 'Mulhouse' },
  { insee: '93066', name: 'Saint-Denis' },
  { insee: '92012', name: 'Boulogne-Billancourt' },
  { insee: '92050', name: 'Nanterre' },
  { insee: '94028', name: 'Creteil' },
  { insee: '93048', name: 'Montreuil' },
  { insee: '06029', name: 'Cannes' },
  { insee: '11069', name: 'Carcassonne' },
  { insee: '66136', name: 'Perpignan' },
  { insee: '30189', name: 'Nimes' },
  { insee: '64445', name: 'Pau' },
  { insee: '64102', name: 'Bayonne' },
  { insee: '50129', name: 'Cherbourg-en-Cotentin' },
  { insee: '72181', name: 'Le Mans' },
  { insee: '86194', name: 'Poitiers' },
  { insee: '02408', name: 'Saint-Quentin' },
]

// ============================================
// Helpers reutilisables (idem D2)
// ============================================
function normalizeKeyword(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function upsertKeyword(
  supabase: SupabaseClient,
  params: {
    keywordDisplay: string
    category: string
    geoScope: string
    language: string
    intentType?: string
  },
): Promise<string> {
  const normalized = normalizeKeyword(params.keywordDisplay)

  const { data: existing, error: selectErr } = await supabase
    .from('seo_keywords')
    .select('id')
    .eq('keyword_normalized', normalized)
    .maybeSingle()

  if (selectErr && selectErr.code !== 'PGRST116') {
    throw new Error(`upsertKeyword select: ${selectErr.message}`)
  }

  if (existing && typeof existing.id === 'string') {
    await supabase
      .from('seo_keywords')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', existing.id)
    return existing.id
  }

  const insertPayload: Record<string, unknown> = {
    keyword_normalized: normalized,
    keyword_display: params.keywordDisplay,
    category: params.category,
    geo_scope: params.geoScope,
    language: params.language,
    last_seen_at: new Date().toISOString(),
  }
  if (params.intentType) insertPayload.intent_type = params.intentType

  const { data: inserted, error: insertErr } = await supabase
    .from('seo_keywords')
    .insert(insertPayload)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    throw new Error(`upsertKeyword insert: ${insertErr?.message ?? 'unknown'}`)
  }
  return inserted.id as string
}

async function insertSignal(
  supabase: SupabaseClient,
  params: InsertSignalParams,
): Promise<void> {
  const { error } = await supabase.from('seo_keyword_signals').insert({
    keyword_id: params.keywordId,
    source_code: params.sourceCode,
    signal_value: params.signalValue,
    signal_type: params.signalType,
    metadata: params.metadata,
    ingestion_run_id: params.ingestionRunId,
    captured_at: new Date().toISOString(),
  })
  if (error) throw new Error(`insertSignal: ${error.message}`)
}

async function updateSeoSource(
  supabase: SupabaseClient,
  code: string,
  signalsAdded: number,
): Promise<void> {
  // Update si exists, sinon ignore silencieusement (la table est seedee).
  const { data: existing } = await supabase
    .from('seo_sources')
    .select('code, total_signals_count')
    .eq('code', code)
    .maybeSingle()

  if (existing) {
    const prev =
      typeof existing.total_signals_count === 'number' ? existing.total_signals_count : 0
    await supabase
      .from('seo_sources')
      .update({
        last_ingested_at: new Date().toISOString(),
        total_signals_count: prev + signalsAdded,
      })
      .eq('code', code)
  } else {
    await supabase.from('seo_sources').insert({
      code,
      last_ingested_at: new Date().toISOString(),
      total_signals_count: signalsAdded,
    })
  }
}

// ============================================
// DVF fetch + parse
// ============================================
interface CityAggregate {
  insee: string
  name: string
  year: number
  transactionsCount: number
  prixM2Moyen: number | null
  isMock: boolean
}

function pickMutations(raw: DvfApiResponse): DvfMutation[] {
  if (Array.isArray(raw.mutations)) return raw.mutations
  if (Array.isArray(raw.features)) {
    return raw.features
      .map((f) => (f.properties ? f.properties : null))
      .filter((m): m is DvfMutation => m !== null)
  }
  return []
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const num = Number.parseFloat(value.replace(',', '.'))
    return Number.isFinite(num) ? num : null
  }
  return null
}

function aggregateMutations(
  mutations: DvfMutation[],
  insee: string,
  name: string,
  year: number,
): CityAggregate {
  let validCount = 0
  let totalPrixM2 = 0
  let prixM2Samples = 0

  for (const m of mutations) {
    if (m.nature_mutation && m.nature_mutation !== 'Vente') continue
    const valeur = toNumberOrNull(m.valeur_fonciere)
    const surface = toNumberOrNull(m.surface_reelle_bati)
    if (valeur === null || valeur <= 0) continue

    validCount += 1
    if (surface !== null && surface > 5 && surface < 1000) {
      const prixM2 = valeur / surface
      if (prixM2 > 100 && prixM2 < 50000) {
        totalPrixM2 += prixM2
        prixM2Samples += 1
      }
    }
  }

  return {
    insee,
    name,
    year,
    transactionsCount: validCount,
    prixM2Moyen: prixM2Samples > 0 ? Math.round(totalPrixM2 / prixM2Samples) : null,
    isMock: false,
  }
}

function mockAggregate(insee: string, name: string, year: number): CityAggregate {
  // Valeurs aleatoires plausibles : 5-50 transactions, 2000-8000 €/m²
  const transactionsCount = 5 + Math.floor(Math.random() * 46)
  const prixM2Moyen = 2000 + Math.floor(Math.random() * 6000)
  return {
    insee,
    name,
    year,
    transactionsCount,
    prixM2Moyen,
    isMock: true,
  }
}

async function fetchCityDvf(
  insee: string,
  name: string,
  year: number,
): Promise<{ ok: boolean; aggregate: CityAggregate | null; status: number }> {
  const url = `https://app.dvf.etalab.gouv.fr/api/mutations3/${insee}/${year}`
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      return { ok: false, aggregate: null, status: res.status }
    }
    const json = (await res.json()) as DvfApiResponse
    const mutations = pickMutations(json)
    return {
      ok: true,
      aggregate: aggregateMutations(mutations, insee, name, year),
      status: 200,
    }
  } catch {
    return { ok: false, aggregate: null, status: 0 }
  }
}

// ============================================
// Handler
// ============================================
Deno.serve(async (req) => {
  const t0 = Date.now()

  // --- Auth ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const cronSecretHeader = req.headers.get('x-cron-secret') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const isServiceRole = serviceKey && authHeader === `Bearer ${serviceKey}`
  const isCron = cronSecret && cronSecretHeader === cronSecret

  if (!isServiceRole && !isCron) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  if (!supabaseUrl || !serviceKey) {
    return new Response(
      JSON.stringify({ ok: false, error: 'missing supabase env' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // --- Run setup ---
  const ingestionRunId = crypto.randomUUID()
  const year = new Date().getFullYear() - 1 // DVF trimestrielles, on prend l'annee precedente complete
  const stats: IngestStats = {
    ok: true,
    villesProcessed: 0,
    signals: 0,
    keywords: 0,
    mockMode: false,
    durationMs: 0,
    errors: 0,
  }

  let consecutiveFailures = 0
  let mockMode = false

  try {
    for (const city of SAMPLE_CITIES) {
      let aggregate: CityAggregate | null = null

      if (mockMode) {
        aggregate = mockAggregate(city.insee, city.name, year)
      } else {
        const result = await fetchCityDvf(city.insee, city.name, year)
        if (result.ok && result.aggregate) {
          aggregate = result.aggregate
          consecutiveFailures = 0
        } else {
          consecutiveFailures += 1
          if (consecutiveFailures >= 3) {
            mockMode = true
            stats.mockMode = true
            aggregate = mockAggregate(city.insee, city.name, year)
          }
        }
      }

      if (!aggregate) {
        stats.errors += 1
        await sleep(500) // rate limit 2 req/s
        continue
      }

      // --- Keywords ---
      const kwPrix = `prix immobilier ${city.name}`
      const kwDiag = `diagnostic immobilier ${city.name}`

      try {
        const idPrix = await upsertKeyword(supabase, {
          keywordDisplay: kwPrix,
          category: 'general',
          geoScope: 'ville',
          language: 'fr',
        })
        const idDiag = await upsertKeyword(supabase, {
          keywordDisplay: kwDiag,
          category: 'general',
          geoScope: 'ville',
          language: 'fr',
        })
        stats.keywords += 2

        // --- Signals (2 par keyword = 4 par ville si prix m2 dispo) ---
        const baseMetadata = {
          insee: aggregate.insee,
          year: aggregate.year,
          ville_name: aggregate.name,
          mock: aggregate.isMock,
        }

        await insertSignal(supabase, {
          keywordId: idPrix,
          sourceCode: 'dvf',
          signalValue: aggregate.transactionsCount,
          signalType: 'market_activity',
          metadata: baseMetadata,
          ingestionRunId,
        })
        stats.signals += 1

        if (aggregate.prixM2Moyen !== null) {
          await insertSignal(supabase, {
            keywordId: idPrix,
            sourceCode: 'dvf',
            signalValue: aggregate.prixM2Moyen,
            signalType: 'market_value',
            metadata: baseMetadata,
            ingestionRunId,
          })
          stats.signals += 1
        }

        await insertSignal(supabase, {
          keywordId: idDiag,
          sourceCode: 'dvf',
          signalValue: aggregate.transactionsCount,
          signalType: 'market_activity',
          metadata: baseMetadata,
          ingestionRunId,
        })
        stats.signals += 1

        if (aggregate.prixM2Moyen !== null) {
          await insertSignal(supabase, {
            keywordId: idDiag,
            sourceCode: 'dvf',
            signalValue: aggregate.prixM2Moyen,
            signalType: 'market_value',
            metadata: baseMetadata,
            ingestionRunId,
          })
          stats.signals += 1
        }

        stats.villesProcessed += 1
      } catch (err) {
        stats.errors += 1
        console.error(`Ville ${city.name} (${city.insee}) erreur:`, (err as Error).message)
      }

      // Rate limit 2 req/s (sleep 500ms)
      if (!mockMode) await sleep(500)
    }

    await updateSeoSource(supabase, 'dvf', stats.signals)
  } catch (err) {
    stats.ok = false
    return new Response(
      JSON.stringify({
        ok: false,
        error: (err as Error).message,
        stats,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  stats.durationMs = Date.now() - t0

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
