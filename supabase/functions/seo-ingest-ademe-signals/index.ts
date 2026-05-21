// ============================================
// KOVAS SEO — Edge Function : seo-ingest-ademe-signals
//
// Mission : agreger les DPE publics ADEME par ville pour generer des signaux
//   marche (volume DPE, pourcentage F+G dit "passoires thermiques") et
//   creer des keywords commerciaux pour les villes >100 DPE/an.
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron mensuel + appel admin manuel.
//
// Sources / couts API :
//   - ADEME data-fair public : https://data.ademe.fr/data-fair/api/v1
//   - Dataset : dpe-v2-logements-existants
//   - Illimite, pas d'auth requise.
//
// A ne pas confondre avec detect-ademe-activity-signal (existant) qui cible
// un diagnostiqueur individuel. Ici on aggrege par ville.
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

interface AdemeAggregationBucket {
  value: string
  total: number
}

interface AdemeAggregationsResponse {
  total: number
  aggs: {
    etiquette_dpe?: {
      total?: number
      results?: AdemeAggregationBucket[]
      buckets?: AdemeAggregationBucket[]
    }
  }
}

interface IngestStats {
  ok: boolean
  villesProcessed: number
  dpeCounted: number
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
// 50 villes (mirror DVF/INSEE)
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
// Helpers (idem D2)
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
// ADEME fetch agreg etiquettes DPE
// ============================================
interface CityDpeAggregate {
  insee: string
  name: string
  totalDpe: number
  countA: number
  countB: number
  countC: number
  countD: number
  countE: number
  countF: number
  countG: number
  passoiresPct: number
}

function readBuckets(
  data: AdemeAggregationsResponse,
): AdemeAggregationBucket[] {
  const agg = data.aggs?.etiquette_dpe
  if (!agg) return []
  if (Array.isArray(agg.results)) return agg.results
  if (Array.isArray(agg.buckets)) return agg.buckets
  return []
}

async function fetchCityDpeAgg(
  insee: string,
  name: string,
): Promise<{ ok: boolean; aggregate: CityDpeAggregate | null; status: number }> {
  const url =
    'https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines' +
    `?qs=${encodeURIComponent(`code_insee_commune:${insee}`)}&size=0&agg_size=10` +
    `&aggregations=etiquette_dpe`

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) {
      return { ok: false, aggregate: null, status: res.status }
    }
    const json = (await res.json()) as AdemeAggregationsResponse
    const buckets = readBuckets(json)

    let countA = 0
    let countB = 0
    let countC = 0
    let countD = 0
    let countE = 0
    let countF = 0
    let countG = 0

    for (const b of buckets) {
      const total = typeof b.total === 'number' ? b.total : 0
      switch ((b.value ?? '').toUpperCase()) {
        case 'A':
          countA += total
          break
        case 'B':
          countB += total
          break
        case 'C':
          countC += total
          break
        case 'D':
          countD += total
          break
        case 'E':
          countE += total
          break
        case 'F':
          countF += total
          break
        case 'G':
          countG += total
          break
      }
    }

    const totalDpe =
      typeof json.total === 'number'
        ? json.total
        : countA + countB + countC + countD + countE + countF + countG

    const passoiresPct =
      totalDpe > 0 ? Math.round(((countF + countG) / totalDpe) * 10000) / 100 : 0

    return {
      ok: true,
      aggregate: {
        insee,
        name,
        totalDpe,
        countA,
        countB,
        countC,
        countD,
        countE,
        countF,
        countG,
        passoiresPct,
      },
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

  const ingestionRunId = crypto.randomUUID()
  const stats: IngestStats = {
    ok: true,
    villesProcessed: 0,
    dpeCounted: 0,
    signals: 0,
    keywords: 0,
    mockMode: false,
    durationMs: 0,
    errors: 0,
  }

  try {
    for (const city of SAMPLE_CITIES) {
      const result = await fetchCityDpeAgg(city.insee, city.name)

      if (!result.ok || !result.aggregate) {
        stats.errors += 1
        await sleep(200) // rate limit 5 req/s
        continue
      }

      const agg = result.aggregate
      stats.dpeCounted += agg.totalDpe

      try {
        const baseMetadata = {
          insee: agg.insee,
          ville_name: agg.name,
          repartition_etiquettes: {
            A: agg.countA,
            B: agg.countB,
            C: agg.countC,
            D: agg.countD,
            E: agg.countE,
            F: agg.countF,
            G: agg.countG,
          },
        }

        // Keyword neutre : signal de volume DPE meme si <100/an
        const kwNeutre = `dpe statistiques ${city.name}`
        const idNeutre = await upsertKeyword(supabase, {
          keywordDisplay: kwNeutre,
          category: 'general',
          geoScope: 'ville',
          language: 'fr',
        })
        stats.keywords += 1

        await insertSignal(supabase, {
          keywordId: idNeutre,
          sourceCode: 'ademe',
          signalValue: agg.totalDpe,
          signalType: 'dpe_volume',
          metadata: baseMetadata,
          ingestionRunId,
        })
        stats.signals += 1

        if (agg.totalDpe > 0) {
          await insertSignal(supabase, {
            keywordId: idNeutre,
            sourceCode: 'ademe',
            signalValue: agg.passoiresPct,
            signalType: 'passoires_pct',
            metadata: baseMetadata,
            ingestionRunId,
          })
          stats.signals += 1
        }

        // Keywords commerciaux uniquement si >100 DPE/an
        if (agg.totalDpe > 100) {
          const kwDpe = `dpe ${city.name}`
          const kwAudit = `audit energetique ${city.name}`

          const idDpe = await upsertKeyword(supabase, {
            keywordDisplay: kwDpe,
            category: 'dpe',
            geoScope: 'ville',
            language: 'fr',
            intentType: 'commercial',
          })
          const idAudit = await upsertKeyword(supabase, {
            keywordDisplay: kwAudit,
            category: 'audit',
            geoScope: 'ville',
            language: 'fr',
            intentType: 'commercial',
          })
          stats.keywords += 2

          await insertSignal(supabase, {
            keywordId: idDpe,
            sourceCode: 'ademe',
            signalValue: agg.totalDpe,
            signalType: 'dpe_volume',
            metadata: baseMetadata,
            ingestionRunId,
          })
          await insertSignal(supabase, {
            keywordId: idDpe,
            sourceCode: 'ademe',
            signalValue: agg.passoiresPct,
            signalType: 'passoires_pct',
            metadata: baseMetadata,
            ingestionRunId,
          })
          await insertSignal(supabase, {
            keywordId: idAudit,
            sourceCode: 'ademe',
            signalValue: agg.countF + agg.countG,
            signalType: 'passoires_volume',
            metadata: baseMetadata,
            ingestionRunId,
          })
          stats.signals += 3
        }

        stats.villesProcessed += 1
      } catch (err) {
        stats.errors += 1
        console.error(`Ville ${city.name} ADEME erreur:`, (err as Error).message)
      }

      // Rate limit 5 req/s
      await sleep(200)
    }

    await updateSeoSource(supabase, 'ademe', stats.signals)
  } catch (err) {
    stats.ok = false
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message, stats }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }

  stats.durationMs = Date.now() - t0

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
