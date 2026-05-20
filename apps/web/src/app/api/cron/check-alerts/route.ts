/**
 * GET /api/cron/check-alerts
 *
 * Cron Vercel (toutes les 5 minutes — cf. vercel.json) qui lance le moteur
 * d'évaluation des alertes admin.
 *
 * Sécurité :
 *   - Vercel envoie automatiquement `Authorization: Bearer ${CRON_SECRET}` sur
 *     les routes définies dans vercel.json.crons. On vérifie ce header.
 *   - En dev local, on peut passer le secret en query `?secret=...` (pratique
 *     pour curl). Refusé en prod.
 *
 * Retourne un JSON metrics (rules évaluées, déclenchements, notifications).
 */

import { createCronSupabaseClient, runAlertChecks } from '@/lib/admin/alert-engine'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0
// Cron Vercel max 60s sur plan Hobby, 300s sur Pro. 30s est large pour notre volume V1.
export const maxDuration = 30

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // Si la var n'est pas configurée, on refuse en prod. En dev, on laisse passer
    // pour pouvoir tester localement sans setup secret.
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

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createCronSupabaseClient()
  const startedAt = Date.now()
  try {
    const result = await runAlertChecks(supabase)
    const elapsedMs = Date.now() - startedAt
    return NextResponse.json({
      ok: true,
      elapsed_ms: elapsedMs,
      ...result,
    })
  } catch (e) {
    console.error('[cron/check-alerts] failed', e)
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
