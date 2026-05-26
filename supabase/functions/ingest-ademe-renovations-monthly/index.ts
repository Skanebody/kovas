/**
 * KOVAS — Edge Function : ingester ADEME mensuel des rénovations énergétiques.
 *
 * Cible : table `public.observatoire_renovations_monthly`, consommée par le
 * composant `/observatoire` section "Évolution de la rénovation énergétique"
 * (apps/web/src/app/observatoire/renovation-trend.tsx).
 *
 * Source de données : ADEME DPE v2 logements existants (open data, pas
 * d'auth, rate-limit raisonnable).
 *   - Endpoint : https://observatoire-dpe-audit.ademe.fr/pub/dpe-france/lines
 *   - Documentation : https://data.ademe.fr/datasets/dpe-v2-logements-existants
 *
 * Méthode V1 — proxy rénovation = DPE classe A-C établi sur le mois.
 * On compte le nombre de DPE émis avec une classe finale A, B ou C : c'est
 * un indicateur direct de logements RÉNOVÉS énergétiquement effectivement
 * mis sur le marché ou audités après travaux. La V2 (post M+3) pourra
 * croiser DPE successifs sur même `code_insee_commune_corrige + adresse`
 * pour mesurer les VRAIES transitions (D→B, F→C, etc.).
 *
 * Trigger :
 *   - pg_cron mensuel : 1er du mois à 04:00 UTC (cf. migration séparée).
 *   - Manuel : POST /functions/v1/ingest-ademe-renovations-monthly avec
 *     Bearer ${SUPABASE_SERVICE_ROLE_KEY} ou CRON_SECRET.
 *
 * Stratégie d'agrégation :
 *   - Pour chaque mois des 24 derniers, on appelle ADEME en limitant à
 *     `size=1` et on lit `data.total` pour obtenir le COUNT direct
 *     (ADEME renvoie le total même si on ne demande qu'une ligne).
 *   - 24 mois × 2 requêtes (rénovations + total DPE) = 48 requêtes max.
 *   - Avec 200 ms entre chaque, on tient en ~10 sec : très en-dessous
 *     du timeout Edge Function 60 sec.
 *
 * UPSERT idempotent sur (period_year, period_month, region_code).
 */

import { type SupabaseClient, createClient } from 'npm:@supabase/supabase-js@2.46.1'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? ''

const ADEME_BASE = 'https://observatoire-dpe-audit.ademe.fr/pub/dpe-france/lines'
const MONTHS_TO_INGEST = 24
const RATE_DELAY_MS = 200

interface AdemeCountResponse {
  total?: number
  next?: string
  results?: unknown[]
}

interface MonthSlot {
  year: number
  month: number
  fromIso: string
  toIso: string
}

interface IngestionRow {
  period_year: number
  period_month: number
  region_code: string | null
  renovations_count: number
  class_transitions: Record<string, number>
  dpe_count: number
  source: string
  ingested_at: string
}

interface IngestionResult {
  ok: boolean
  imported: number
  updated: number
  errors: string[]
  durationMs: number
  details: ReadonlyArray<{
    year: number
    month: number
    renovations: number
    dpe_count: number
  }>
}

function getSupabase(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials missing (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })
}

/**
 * Construit la liste des 24 mois glissants à requêter (du plus ancien au
 * plus récent). Le mois courant n'est PAS ingéré car les DPE sont déposés
 * avec un délai de plusieurs jours — on s'arrête au mois M-1 complet.
 */
function buildMonthSlots(now: Date, count: number): MonthSlot[] {
  const slots: MonthSlot[] = []
  for (let i = count; i >= 1; i--) {
    const slotStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const slotEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
    slots.push({
      year: slotStart.getUTCFullYear(),
      month: slotStart.getUTCMonth() + 1,
      fromIso: slotStart.toISOString().substring(0, 10),
      toIso: slotEnd.toISOString().substring(0, 10),
    })
  }
  return slots
}

/**
 * Lance une requête ADEME en ne demandant qu'1 ligne mais en récupérant
 * `data.total` pour obtenir le COUNT global. Fallback robuste : si `total`
 * absent, on retombe sur `results.length`.
 */
async function ademeCount(where: string): Promise<number> {
  const url = `${ADEME_BASE}?q_mode=simple&where=${encodeURIComponent(where)}&size=1`
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!r.ok) {
    throw new Error(`ADEME HTTP ${r.status} for query: ${where}`)
  }
  const data = (await r.json()) as AdemeCountResponse
  if (typeof data.total === 'number') return data.total
  return Array.isArray(data.results) ? data.results.length : 0
}

/**
 * Comptage par mois × classe finale. Renvoie le total DPE émis et le total
 * DPE classés A-C (proxy rénovation).
 */
async function countMonth(slot: MonthSlot): Promise<{
  renovations: number
  dpe: number
}> {
  // Total DPE émis sur la fenêtre
  const dpeWhere = `date_etablissement_dpe>=${slot.fromIso} AND date_etablissement_dpe<${slot.toIso}`
  const dpe = await ademeCount(dpeWhere)
  await new Promise((resolve) => setTimeout(resolve, RATE_DELAY_MS))

  // DPE finaux A-C (proxy rénovation effective)
  const renovWhere =
    `date_etablissement_dpe>=${slot.fromIso} AND date_etablissement_dpe<${slot.toIso} ` +
    'AND classe_consommation_energie IN (A,B,C)'
  const renovations = await ademeCount(renovWhere)
  await new Promise((resolve) => setTimeout(resolve, RATE_DELAY_MS))

  return { renovations, dpe }
}

async function upsertRow(supabase: SupabaseClient, row: IngestionRow): Promise<void> {
  const { error } = await supabase
    .from('observatoire_renovations_monthly')
    .upsert(row, { onConflict: 'period_year,period_month,region_code' })
  if (error) {
    throw new Error(`UPSERT failed for ${row.period_year}-${row.period_month}: ${error.message}`)
  }
}

/**
 * Vérifie l'authentification d'un appel manuel à la fonction.
 * Accepte 2 sources :
 *   - service_role_key (utilisée par pg_cron via invoke_edge_function)
 *   - CRON_SECRET (override manuel admin)
 */
function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return false
  const token = authHeader.slice(7).trim()
  if (token.length === 0) return false
  if (token === SERVICE_ROLE_KEY) return true
  if (CRON_SECRET.length > 0 && token === CRON_SECRET) return true
  return false
}

Deno.serve(async (req: Request): Promise<Response> => {
  const startedAt = Date.now()

  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    })
  }

  const errors: string[] = []
  const details: Array<{ year: number; month: number; renovations: number; dpe_count: number }> = []
  let imported = 0
  const updated = 0

  try {
    const supabase = getSupabase()
    const slots = buildMonthSlots(new Date(), MONTHS_TO_INGEST)

    for (const slot of slots) {
      try {
        const { renovations, dpe } = await countMonth(slot)

        const row: IngestionRow = {
          period_year: slot.year,
          period_month: slot.month,
          region_code: null, // V1 = national uniquement
          renovations_count: renovations,
          class_transitions: {},
          dpe_count: dpe,
          source: 'ademe',
          ingested_at: new Date().toISOString(),
        }

        // On compte "imported" sans distinguer insert vs update car
        // PostgREST ne renvoie pas explicitement le statut. On laisse
        // `updated` à 0 dans la version simple ; un futur RPC custom
        // pourrait distinguer les deux.
        await upsertRow(supabase, row)
        imported += 1
        details.push({
          year: slot.year,
          month: slot.month,
          renovations,
          dpe_count: dpe,
        })
      } catch (slotError) {
        const msg = slotError instanceof Error ? slotError.message : 'unknown'
        errors.push(`${slot.year}-${String(slot.month).padStart(2, '0')}: ${msg}`)
      }
    }

    const result: IngestionResult = {
      ok: errors.length === 0,
      imported,
      updated,
      errors,
      durationMs: Date.now() - startedAt,
      details,
    }

    return new Response(JSON.stringify(result), {
      status: errors.length === 0 ? 200 : 207, // 207 Multi-Status si partiel
      headers: { 'content-type': 'application/json' },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error'
    const result: IngestionResult = {
      ok: false,
      imported,
      updated,
      errors: [...errors, msg],
      durationMs: Date.now() - startedAt,
      details,
    }
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
})
