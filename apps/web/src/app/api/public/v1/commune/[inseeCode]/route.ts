/**
 * KOVAS — API publique : GET /api/public/v1/commune/[inseeCode]
 *
 * Statistiques DPE + DVF agrégées pour une commune française (code INSEE 5 chars).
 * Consomme deux matviews du data lake :
 *   - analytics.passoires_thermiques_by_commune (% F-G, total DPE 24 mois)
 *   - analytics.transactions_history_by_commune (prix médian, avg €/m², volume 12 mois)
 *
 * Aucune PII. Open data agrégée (source ADEME + DVF Etalab).
 * Cache 6h public + s-maxage.
 *
 * Rate limit : 60 req/min anon, 600 req/min avec X-API-Key.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §10 API publique.
 */

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@/lib/api-public/rate-limit'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const revalidate = 21600 // 6h ISR

interface PassoiresRow {
  commune_insee: string
  count_passoires: number
  total_dpe: number
  ratio_passoires: number | null
  last_dpe_date: string | null
}

interface TransactionsRow {
  commune_insee: string
  total_transactions_12m: number
  avg_price_per_m2: number | null
  median_price: number | null
  last_transaction_date: string | null
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ inseeCode: string }> },
) {
  // 1. Rate limit
  const rl = await checkRateLimit(request, { prefix: 'api:commune' })
  const rlHeaders = rateLimitHeaders(rl)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded', retry_after: rl.retry_after },
      { status: 429, headers: rlHeaders },
    )
  }

  // 2. Validation code INSEE (5 chars alphanumériques, 01001 → 97617)
  const { inseeCode } = await params
  if (!inseeCode || !/^[0-9A-B]{5}$/i.test(inseeCode)) {
    return NextResponse.json(
      { error: 'invalid INSEE code (expected 5 alphanumeric chars, e.g. 75056)' },
      { status: 400, headers: rlHeaders },
    )
  }
  const normalizedCode = inseeCode.toUpperCase()

  try {
    const supabase = getServiceClient()

    // 3. Fetch les deux matviews en parallèle
    const [passoiresRes, transactionsRes] = await Promise.all([
      // biome-ignore lint/suspicious/noExplicitAny: schéma data/analytics pas dans Database.types
      (supabase as any)
        .schema('analytics')
        .from('passoires_thermiques_by_commune')
        .select('commune_insee, count_passoires, total_dpe, ratio_passoires, last_dpe_date')
        .eq('commune_insee', normalizedCode)
        .maybeSingle(),
      // biome-ignore lint/suspicious/noExplicitAny: pas dans Database.types
      (supabase as any)
        .schema('analytics')
        .from('transactions_history_by_commune')
        .select(
          'commune_insee, total_transactions_12m, avg_price_per_m2, median_price, last_transaction_date',
        )
        .eq('commune_insee', normalizedCode)
        .maybeSingle(),
    ])

    const passoires = (passoiresRes.data ?? null) as PassoiresRow | null
    const transactions = (transactionsRes.data ?? null) as TransactionsRow | null

    if (!passoires && !transactions) {
      return NextResponse.json(
        {
          error: 'commune not found in data lake',
          insee_code: normalizedCode,
          hint: "La commune n'a pas encore été ingestée. Les matviews sont rafraîchies quotidiennement.",
        },
        { status: 404, headers: rlHeaders },
      )
    }

    const payload = {
      api_version: '1.0',
      generated_at: new Date().toISOString(),
      insee_code: normalizedCode,
      dpe: passoires
        ? {
            total_dpe_24_months: passoires.total_dpe,
            count_passoires_f_g: passoires.count_passoires,
            ratio_passoires_pct:
              passoires.ratio_passoires != null
                ? Math.round(passoires.ratio_passoires * 1000) / 10
                : null,
            last_dpe_date: passoires.last_dpe_date,
          }
        : null,
      transactions: transactions
        ? {
            total_transactions_12_months: transactions.total_transactions_12m,
            avg_price_per_m2_eur:
              transactions.avg_price_per_m2 != null
                ? Math.round(transactions.avg_price_per_m2)
                : null,
            median_price_eur:
              transactions.median_price != null ? Math.round(transactions.median_price) : null,
            last_transaction_date: transactions.last_transaction_date,
          }
        : null,
      methodology: {
        dpe_source: 'ADEME — Annuaire DPE (data.ademe_dpe), fenêtre 24 mois',
        dvf_source: 'Etalab DVF — Demandes de valeurs foncières (data.dvf_mutations), fenêtre 12 mois',
        refresh: 'Matviews rafraîchies quotidiennement (cron refresh-data-lake-matviews)',
        license: 'CC-BY 4.0',
        homepage: 'https://kovas.fr/observatoire',
      },
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        ...rlHeaders,
        'Cache-Control': 'public, max-age=21600, s-maxage=21600',
        'API-Version': '1.0',
      },
    })
  } catch (err) {
    console.error('[api/public/commune] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'internal error' },
      { status: 500, headers: rlHeaders },
    )
  }
}
