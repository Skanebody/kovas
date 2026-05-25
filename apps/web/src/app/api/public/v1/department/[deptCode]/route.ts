/**
 * KOVAS — API publique : GET /api/public/v1/department/[deptCode]
 *
 * Distribution DPE par classe (A-G) pour un département français (code 2-3
 * caractères : 01-95 ou 971-976 outre-mer ou 2A/2B Corse).
 *
 * Aggège `data.ademe_dpe` côté département via le préfixe INSEE
 * (`LEFT(commune_insee, 2)` ou 3 pour 97x).
 *
 * Open data CC-BY 4.0. Cache 6h. Rate-limit 60/600 req/min.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §10.
 */

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@/lib/api-public/rate-limit'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const revalidate = 21600 // 6h ISR

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service credentials missing')
  return createClient(url, key, { auth: { persistSession: false } })
}

function normalizeDept(code: string): string | null {
  const upper = code.toUpperCase().trim()
  // 2 chars (01-95) ou 2A/2B Corse
  if (/^(0[1-9]|[1-8][0-9]|9[0-5]|2A|2B)$/i.test(upper)) return upper
  // 3 chars outre-mer 971-976
  if (/^97[1-6]$/.test(upper)) return upper
  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deptCode: string }> },
) {
  // 1. Rate limit
  const rl = await checkRateLimit(request, { prefix: 'api:department' })
  const rlHeaders = rateLimitHeaders(rl)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded', retry_after: rl.retry_after },
      { status: 429, headers: rlHeaders },
    )
  }

  // 2. Validation code département
  const { deptCode } = await params
  const normalized = normalizeDept(deptCode ?? '')
  if (!normalized) {
    return NextResponse.json(
      {
        error:
          'invalid department code (expected 01-95, 2A/2B Corse, ou 971-976 outre-mer)',
      },
      { status: 400, headers: rlHeaders },
    )
  }

  try {
    const supabase = getServiceClient()
    const isOutreMer = normalized.length === 3

    // 3. Distribution par classe (fenêtre 24 mois, comme la matview commune)
    const twentyFourMonthsAgo = new Date()
    twentyFourMonthsAgo.setMonth(twentyFourMonthsAgo.getMonth() - 24)
    const cutoffIso = twentyFourMonthsAgo.toISOString().slice(0, 10)

    // V1 simple : récupérer toutes les rows + grouper côté JS.
    // Volume attendu < 50 000 DPE / dept / 24 mois (cap LIMIT pour sécurité).
    // Pour grosse volumétrie, créer une matview dédiée dept_dpe_distribution
    // (TODO post-MVP avec REFRESH MATERIALIZED VIEW CONCURRENTLY).
    // biome-ignore lint/suspicious/noExplicitAny: schema data pas dans Database.types
    const { data: allRowsRaw, error: classErr } = await (supabase as any)
      .schema('data')
      .from('ademe_dpe')
      .select('class_dpe')
      .gte('date_etablissement', cutoffIso)
      .ilike('commune_insee', `${normalized}%`)
      .not('class_dpe', 'is', null)
      .limit(50000)

    if (classErr) {
      console.error('[api/public/department] data lake error', classErr)
      return NextResponse.json(
        { error: 'data lake unavailable', details: classErr.message },
        { status: 503, headers: rlHeaders },
      )
    }

    const allRows = (allRowsRaw ?? []) as Array<{ class_dpe: string | null }>
    const distribution: Record<string, number> = {
      A: 0,
      B: 0,
      C: 0,
      D: 0,
      E: 0,
      F: 0,
      G: 0,
    }
    let total = 0
    for (const row of allRows) {
      const cls = row.class_dpe?.toUpperCase()
      if (cls && cls in distribution) {
        distribution[cls] += 1
        total += 1
      }
    }

    const passoires = distribution.F + distribution.G
    const ratioPassoires = total > 0 ? Math.round((passoires / total) * 1000) / 10 : null

    if (total === 0) {
      return NextResponse.json(
        {
          error: 'no DPE data for this department in the last 24 months',
          department_code: normalized,
          hint: 'Soit le département est mal référencé, soit le data lake ADEME n\'a pas encore ingéré ce périmètre.',
        },
        { status: 404, headers: rlHeaders },
      )
    }

    const payload = {
      api_version: '1.0',
      generated_at: new Date().toISOString(),
      department_code: normalized,
      region: isOutreMer ? 'Outre-mer' : 'France métropolitaine',
      window: '24 derniers mois',
      total_dpe: total,
      class_distribution: distribution,
      passoires: {
        count: passoires,
        ratio_pct: ratioPassoires,
      },
      methodology: {
        source: 'ADEME — Annuaire DPE (data.ademe_dpe)',
        aggregation: 'Préfixe INSEE 2 chars (métropole) ou 3 chars (outre-mer)',
        window: '24 mois glissants',
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
    console.error('[api/public/department] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'internal error' },
      { status: 500, headers: rlHeaders },
    )
  }
}
