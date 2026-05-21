/**
 * GET /api/cron/monthly-reports
 *
 * Cron Vercel — déclenché chaque 1er du mois à 07:00 UTC (cf. vercel.json,
 * schedule "0 7 1 * *" = 8h Europe/Paris hiver, 9h été).
 *
 * Workflow :
 *   1. Récupère toutes les organisations avec subscription active/trialing/past_due
 *   2. Pour chacune : RPC SQL compute_monthly_report(org, year, month-1) → upsert ligne
 *   3. Envoie l'email Resend si pas déjà 'sent' (idempotent) + retry max 3
 *   4. Skip si user opt-out OU 0 missions ce mois (silence respectueux)
 *
 * Sécurité : Authorization Bearer ${CRON_SECRET} (envoyé automatiquement par
 * Vercel sur les routes définies dans vercel.json.crons). En dev local, on
 * accepte aussi ?secret=... en query string.
 *
 * Cf. CLAUDE.md §21bis (Gain Tracker V1.5).
 */

import {
  createMonthlyReportsSupabaseClient,
  runMonthlyReportsCron,
} from '@/lib/reports/monthly-reports'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
// Cron Vercel Pro : jusqu'à 300s. Pour V1 ~50-200 orgs c'est large.
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Pas de secret configuré → refuse en prod, autorise en dev pour test local
    return process.env.NODE_ENV !== 'production'
  }

  const auth = request.headers.get('authorization') ?? ''
  if (auth === `Bearer ${secret}`) return true

  if (process.env.NODE_ENV !== 'production') {
    const url = new URL(request.url)
    if (url.searchParams.get('secret') === secret) return true
  }
  return false
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createMonthlyReportsSupabaseClient()
  const startedAt = Date.now()

  try {
    const result = await runMonthlyReportsCron(supabase)
    const elapsedMs = Date.now() - startedAt

    console.log('[cron/monthly-reports] done', {
      elapsed_ms: elapsedMs,
      organizations_scanned: result.organizations_scanned,
      emails_sent: result.emails_sent,
      emails_skipped: result.emails_skipped,
      emails_failed: result.emails_failed,
      errors_count: result.errors.length,
    })

    return NextResponse.json({
      ok: true,
      elapsed_ms: elapsedMs,
      ...result,
    })
  } catch (e) {
    console.error('[cron/monthly-reports] failed', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}

// POST identique à GET — utile pour déclenchement manuel via admin/tools
export const POST = GET
