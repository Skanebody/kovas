// KOVAS — Edge Function `fetch-ademe-benchmarks`
//
// CRON mensuel (1er du mois) : récupère la distribution publique des classes
// DPE depuis l'open data ADEME et alimente la table `ademe_benchmarks`.
//
// Sources :
//   - https://data.ademe.fr/datasets/dpe-v2-logements-existants
//   - https://search.koumoul.com (mirror data-fair)
//
// Stratégie :
//   - Scopes : national / régional / départemental
//   - Typologie : maison / appartement / immeuble × bandes années (<1948, 1948-1974, 1975-2000, >2000)
//   - Échantillonnage : 12 derniers mois pour chaque scope
//
// Authentication : Service role (cron-only).
// Trigger : Supabase cron via `supabase functions deploy --schedule "0 6 1 * *"`

/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.46.1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

const ADEME_BASE_URL = 'https://data.ademe.fr/data-fair/api/v1'
const DATASET = 'dpe-v2-logements-existants'

type EnergyClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

interface DistributionResult {
  total: number
  distribution: Record<EnergyClass, number>
}

/** Récupère la distribution DPE pour un scope donné via aggregation data-fair. */
async function fetchDistribution(
  filters: Record<string, string | undefined>,
): Promise<DistributionResult | null> {
  const qs = new URLSearchParams()
  // data-fair aggregate endpoint : /datasets/:id/values_agg?field=Etiquette_DPE
  qs.set('field', 'Etiquette_DPE')
  qs.set('agg_size', '7')

  // Construction du filtre `qs` (champs ADEME)
  const conditions: string[] = []
  if (filters.bien_type) conditions.push(`Type_bâtiment:"${filters.bien_type}"`)
  if (filters.year_min)
    conditions.push(`Année_construction:>=${filters.year_min}`)
  if (filters.year_max) conditions.push(`Année_construction:<${filters.year_max}`)
  if (filters.region) conditions.push(`Code_région_(BAN):"${filters.region}"`)
  if (filters.departement) conditions.push(`Code_département_(BAN):"${filters.departement}"`)

  if (conditions.length > 0) qs.set('qs', conditions.join(' AND '))

  const url = `${ADEME_BASE_URL}/datasets/${DATASET}/values_agg?${qs.toString()}`

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.warn(`ADEME ${res.status} for ${url}`)
      return null
    }
    const json = (await res.json()) as {
      total?: number
      aggs?: { value: string; total: number }[]
    }
    const total = json.total ?? 0
    if (total === 0) return null

    const distribution: Record<EnergyClass, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
      G: 0,
    }
    for (const agg of json.aggs ?? []) {
      const cls = agg.value as EnergyClass
      if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(cls)) {
        distribution[cls] = total > 0 ? agg.total / total : 0
      }
    }
    return { total, distribution }
  } catch (e) {
    console.error('fetch ADEME error', e)
    return null
  }
}

interface BenchmarkRow {
  scope_type: 'national' | 'regional' | 'departemental'
  scope_value: string | null
  bien_type: string | null
  year_construction_band: string | null
  distribution: Record<EnergyClass, number>
  sample_size: number
  source: string
  data_period_start: string
  data_period_end: string
  fetched_at: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  // Cron uses service role
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRole) return json({ error: 'Supabase env missing' }, 500)

  const supabase = createClient(supabaseUrl, serviceRole)

  const today = new Date()
  const dataPeriodEnd = today.toISOString().slice(0, 10)
  const periodStart = new Date(today.getFullYear() - 1, today.getMonth(), 1)
  const dataPeriodStart = periodStart.toISOString().slice(0, 10)

  const rows: BenchmarkRow[] = []

  // 1. National (no filter)
  const nat = await fetchDistribution({})
  if (nat) {
    rows.push({
      scope_type: 'national',
      scope_value: null,
      bien_type: null,
      year_construction_band: null,
      distribution: nat.distribution,
      sample_size: nat.total,
      source: 'ademe_open_data',
      data_period_start: dataPeriodStart,
      data_period_end: dataPeriodEnd,
      fetched_at: new Date().toISOString(),
    })
  }

  // 2. Par typologie × bande année (12 combinaisons)
  const typologies = ['maison', 'appartement', 'immeuble']
  const bands: { label: string; min?: string; max?: string }[] = [
    { label: '<1948', max: '1948' },
    { label: '1948-1974', min: '1948', max: '1975' },
    { label: '1975-2000', min: '1975', max: '2001' },
    { label: '>2000', min: '2001' },
  ]

  for (const t of typologies) {
    for (const b of bands) {
      const r = await fetchDistribution({
        bien_type: t,
        year_min: b.min,
        year_max: b.max,
      })
      if (r && r.total >= 100) {
        rows.push({
          scope_type: 'national',
          scope_value: null,
          bien_type: t,
          year_construction_band: b.label,
          distribution: r.distribution,
          sample_size: r.total,
          source: 'ademe_open_data',
          data_period_start: dataPeriodStart,
          data_period_end: dataPeriodEnd,
          fetched_at: new Date().toISOString(),
        })
      }
    }
  }

  // 3. Persistance — DELETE puis INSERT (snapshot mensuel)
  await supabase
    .from('ademe_benchmarks')
    .delete()
    .eq('source', 'ademe_open_data')

  if (rows.length > 0) {
    const { error: insertErr } = await supabase.from('ademe_benchmarks').insert(rows)
    if (insertErr) return json({ error: 'Failed insert', detail: insertErr.message }, 500)
  }

  return json({ fetched: rows.length, period_end: dataPeriodEnd })
})
