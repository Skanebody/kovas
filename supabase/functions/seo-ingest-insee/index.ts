// ============================================
// KOVAS SEO — Edge Function : seo-ingest-insee
//
// Mission : ingerer les signaux demographiques INSEE (population) par ville
//   et generer des keywords "diagnostiqueur immobilier ${ville}" pour les
//   villes >50000 habitants (proxy d'opportunite commerciale).
//
// Auth   : Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY} OU header
//          x-cron-secret: ${CRON_SECRET}
// Trigger: pg_cron mensuel + appel admin manuel.
//
// Sources / couts API :
//   - INSEE Donnees Locales API : https://api.insee.fr/donnees-locales/V0.1
//   - OAuth2 client_credentials (memes credentials que cross-validate-sirene)
//   - Rate limit : 500 req/min en prod
//
// Mode mock : si INSEE_CLIENT_ID ou INSEE_CLIENT_SECRET absents, bascule en
//   mode mock (population aleatoire 3k-2M).
//
// Variables env :
//   - INSEE_CLIENT_ID, INSEE_CLIENT_SECRET (reutilises de cross-validate-sirene)
//   - INSEE_TOKEN_URL (optionnel)
//   - INSEE_DONNEES_LOCALES_BASE (optionnel)
// ============================================

import { type SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.0'

// ============================================
// Types
// ============================================
interface SampleCity {
  insee: string
  name: string
}

interface InseeTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface InseeLocalDataCell {
  // Structure variable selon endpoint. On extrait `valeur` numerique si dispo.
  valeur?: number | string
  Valeur?: number | string
  [key: string]: unknown
}

interface InseeLocalDataResponse {
  Cellule?: InseeLocalDataCell[] | InseeLocalDataCell
  cellules?: InseeLocalDataCell[]
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
// 50 villes (mirror exact de seo-ingest-dvf pour coherence cross-source)
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
// Helpers
// ============================================
function normalizeKeyword(raw: string): string {
  return raw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
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

async function insertSignal(supabase: SupabaseClient, params: InsertSignalParams): Promise<void> {
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
    const prev = typeof existing.total_signals_count === 'number' ? existing.total_signals_count : 0
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
// INSEE token cache (50min TTL)
// ============================================
interface CachedToken {
  token: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null

async function getInseeToken(force = false): Promise<string | null> {
  const now = Date.now()
  if (!force && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token
  }

  const clientId = Deno.env.get('INSEE_CLIENT_ID')
  const clientSecret = Deno.env.get('INSEE_CLIENT_SECRET')
  const tokenUrl = Deno.env.get('INSEE_TOKEN_URL') ?? 'https://api.insee.fr/token'

  if (!clientId || !clientSecret) {
    return null
  }

  const basic = btoa(`${clientId}:${clientSecret}`)
  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  })

  if (!res.ok) {
    return null
  }

  const data = (await res.json()) as InseeTokenResponse
  cachedToken = {
    token: data.access_token,
    expiresAt: now + Math.min(50 * 60 * 1000, (data.expires_in ?? 3000) * 1000 - 60_000),
  }
  return cachedToken.token
}

// ============================================
// INSEE fetch population
// ============================================
function pickCellules(raw: InseeLocalDataResponse): InseeLocalDataCell[] {
  if (Array.isArray(raw.Cellule)) return raw.Cellule
  if (raw.Cellule && typeof raw.Cellule === 'object') return [raw.Cellule]
  if (Array.isArray(raw.cellules)) return raw.cellules
  return []
}

function extractValeur(cell: InseeLocalDataCell): number | null {
  const v = cell.valeur ?? cell.Valeur
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const num = Number.parseFloat(v.replace(',', '.'))
    return Number.isFinite(num) ? num : null
  }
  return null
}

async function fetchPopulation(
  insee: string,
  token: string,
  apiBase: string,
): Promise<{ ok: boolean; population: number | null; status: number }> {
  // Population totale 2020 (recensement) : POPSEXEAGE-ENS / SEXE-2 (toutes
  // sexes confondus) sur le geo-COM correspondant
  const url = `${apiBase.replace(/\/$/, '')}/donnees/geo-COM-${insee}@GEO2023RP2020/SEXE-2.POPSEXEAGE-ENS`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      return { ok: false, population: null, status: res.status }
    }
    const json = (await res.json()) as InseeLocalDataResponse
    const cellules = pickCellules(json)
    let total = 0
    for (const c of cellules) {
      const v = extractValeur(c)
      if (v !== null) total += v
    }
    return { ok: true, population: total > 0 ? Math.round(total) : null, status: 200 }
  } catch {
    return { ok: false, population: null, status: 0 }
  }
}

function mockPopulation(): number {
  // 3000 - 2 000 000 plausible
  return 3000 + Math.floor(Math.random() * 1_997_000)
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
    return new Response(JSON.stringify({ ok: false, error: 'missing supabase env' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const ingestionRunId = crypto.randomUUID()
  const apiBase =
    Deno.env.get('INSEE_DONNEES_LOCALES_BASE') ?? 'https://api.insee.fr/donnees-locales/V0.1'

  const stats: IngestStats = {
    ok: true,
    villesProcessed: 0,
    signals: 0,
    keywords: 0,
    mockMode: false,
    durationMs: 0,
    errors: 0,
  }

  try {
    // --- Token (ou mock si absent) ---
    const token = await getInseeToken()
    const mockMode = token === null
    stats.mockMode = mockMode

    for (const city of SAMPLE_CITIES) {
      let population: number | null = null

      if (mockMode) {
        population = mockPopulation()
      } else {
        const result = await fetchPopulation(city.insee, token, apiBase)
        if (result.ok && result.population !== null) {
          population = result.population
        } else if (result.status === 401) {
          // Token expire, force refresh + retry
          cachedToken = null
          const fresh = await getInseeToken(true)
          if (fresh) {
            const retry = await fetchPopulation(city.insee, fresh, apiBase)
            if (retry.ok && retry.population !== null) population = retry.population
          }
        }
      }

      if (population === null) {
        stats.errors += 1
        await sleep(200) // INSEE 500/min = ~120ms entre req, on prend marge
        continue
      }

      try {
        const baseMetadata = {
          insee: city.insee,
          year: 2020,
          ville_name: city.name,
          mock: mockMode,
        }

        // Signal demographique generique : on cree un keyword "neutre" par
        // ville pour ancrer la population, meme < 50k habitants.
        const kwNeutre = `demographie ${city.name}`
        const idNeutre = await upsertKeyword(supabase, {
          keywordDisplay: kwNeutre,
          category: 'general',
          geoScope: 'ville',
          language: 'fr',
        })
        stats.keywords += 1

        await insertSignal(supabase, {
          keywordId: idNeutre,
          sourceCode: 'insee',
          signalValue: population,
          signalType: 'population',
          metadata: baseMetadata,
          ingestionRunId,
        })
        stats.signals += 1

        // Keyword commercial uniquement si population > 50 000
        if (population > 50_000) {
          const kwDiag = `diagnostiqueur immobilier ${city.name}`
          const idDiag = await upsertKeyword(supabase, {
            keywordDisplay: kwDiag,
            category: 'general',
            geoScope: 'ville',
            language: 'fr',
            intentType: 'transactional',
          })
          stats.keywords += 1

          await insertSignal(supabase, {
            keywordId: idDiag,
            sourceCode: 'insee',
            signalValue: population,
            signalType: 'population',
            metadata: baseMetadata,
            ingestionRunId,
          })
          stats.signals += 1
        }

        stats.villesProcessed += 1
      } catch (err) {
        stats.errors += 1
        console.error(`Ville ${city.name} erreur:`, (err as Error).message)
      }

      // Rate limit INSEE 500/min : on reste tres en dessous a ~5 req/s
      if (!mockMode) await sleep(200)
    }

    await updateSeoSource(supabase, 'insee', stats.signals)
  } catch (err) {
    stats.ok = false
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message, stats }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  stats.durationMs = Date.now() - t0

  return new Response(JSON.stringify(stats), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
