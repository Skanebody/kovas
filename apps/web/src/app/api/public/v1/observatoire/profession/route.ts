/**
 * KOVAS — API publique : GET /api/public/v1/observatoire/profession
 *
 * Statistiques agrégées de la profession de diagnostiqueur immobilier en
 * France (Game Changer 4). Consomme les vues SQL `v_etat_profession_*`.
 *
 * Aucune PII exposée — uniquement des compteurs et pourcentages.
 *
 * Rate limit : 60 req/min anon, 600 req/min avec X-API-Key.
 * Cache : 1h public + s-maxage.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §6.4 + §10.
 */

import { NextResponse } from 'next/server'
import { checkRateLimit, rateLimitHeaders } from '@/lib/api-public/rate-limit'
import {
  computeRatios,
  getEtatProfessionSummary,
  getEtatProfessionTopDepts,
} from '@/lib/observatoire/etat-profession'

export const runtime = 'nodejs'
export const revalidate = 3600 // 1h ISR

export async function GET(request: Request) {
  const rl = await checkRateLimit(request, { prefix: 'api:observatoire' })
  const rlHeaders = rateLimitHeaders(rl)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limit_exceeded', retry_after: rl.retry_after },
      { status: 429, headers: rlHeaders },
    )
  }

  try {
    const [summary, topDepts] = await Promise.all([
      getEtatProfessionSummary(),
      getEtatProfessionTopDepts(20),
    ])
    const ratios = computeRatios(summary)

    const payload = {
      api_version: '1.0',
      generated_at: new Date().toISOString(),
      // Cohérence : on retourne les snake_case pour rester aligné REST
      summary: {
        total_diagnosticians: summary.total,
        verified: summary.verified,
        unverified: summary.unverified,
        pending: summary.pending,
        suspended: summary.suspended,
        ceased: summary.ceased,
        with_sirene: summary.withSirene,
        sirene_active: summary.sireneActive,
        sirene_closed: summary.sireneClosed,
        very_active: summary.veryActive,
        moderately_active: summary.moderatelyActive,
        low_activity: summary.lowActivity,
        claimed: summary.claimed,
        unclaimed: summary.unclaimed,
        with_fraud_flags: summary.withFraudFlags,
        last_dhup_sync_at: summary.lastDhupSyncAt,
        dhup_synced_last_7d: summary.dhupSyncedLast7d,
      },
      ratios_pct: {
        verified: ratios.verifiedPct,
        sirene_active: ratios.sireneActivePct,
        very_active: ratios.veryActivePct,
        claimed: ratios.claimedPct,
        with_fraud_flags: ratios.withFraudFlagsPct,
      },
      top_departments: topDepts.map((d) => ({
        department_code: d.departmentCode,
        total: d.totalCount,
        verified: d.verifiedCount,
        sirene_active: d.sireneActiveCount,
        very_active: d.veryActiveCount,
        claimed: d.claimedCount,
        avg_activity_score: d.avgActivityScore,
      })),
      methodology: {
        source: 'DHUP (Direction de l\'Habitat, de l\'Urbanisme et des Paysages)',
        cross_validation: 'INSEE Sirene + COFRAC + scoring activité interne KOVAS',
        anonymization: 'Aucune PII — uniquement des compteurs et pourcentages',
        license: 'CC-BY 4.0 — attribution KOVAS Observatoire required',
        homepage: 'https://kovas.fr/observatoire/etat-profession',
      },
    }

    return NextResponse.json(payload, {
      status: 200,
      headers: {
        ...rlHeaders,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'API-Version': '1.0',
      },
    })
  } catch (err) {
    console.error('[api/public/observatoire/profession] error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'internal error' },
      { status: 500, headers: rlHeaders },
    )
  }
}
