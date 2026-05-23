/**
 * Déclencheur manuel de la vérification croisée quotidienne diagnostiqueurs.
 *
 * Route : `POST /api/admin/diagnosticians/run-verify-daily`
 *
 * Appelle l'Edge Function Supabase `verify-diagnosticians-daily` qui :
 *   1. Sélectionne 500 diagnostiqueurs par ordre LRU (activity_score_computed_at)
 *   2. Croise DHUP (freshness < 60j) + Sirene API + Google Places API
 *   3. Recalcule `activity_score` (0-1) via formule pondérée
 *   4. Lève des `fraud_flags` si score < 0.5 OU signaux négatifs détectés
 *   5. Logue 1 ligne `diagnostician_cross_validation_logs` par fiche traitée
 *
 * Auth : admin uniquement (allowlist `ADMIN_EMAILS` env).
 *
 * Le cron équivalent tourne tous les jours à 03:00 UTC via pg_cron
 * (cf. migration 20260524190000_verify_diagnosticians_daily_cron.sql).
 */

import { requireAdmin } from '@/lib/auth/require-admin'
import { NextResponse } from 'next/server'

interface EdgeResponse {
  ok: boolean
  processed?: number
  dhupActive?: number
  dhupInactive?: number
  sireneActive?: number
  sireneCeased?: number
  sireneSkipped?: number
  gmbEnriched?: number
  gmbSkipped?: number
  flaggedFraud?: number
  belowThreshold?: number
  durationMs?: number
  batchOffset?: number
  batchLimit?: number
  notes?: string[]
  error?: string
}

export interface RunVerifyDailyResponse {
  ok: boolean
  edge?: EdgeResponse
  triggeredBy: string
  triggeredAt: string
  error?: string
}

interface RequestBody {
  limit?: number
  offset?: number
}

export async function POST(req: Request): Promise<NextResponse<RunVerifyDailyResponse>> {
  const admin = await requireAdmin()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const triggeredAt = new Date().toISOString()

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        ok: false,
        triggeredBy: admin.email,
        triggeredAt,
        error: 'SUPABASE_URL ou SERVICE_ROLE_KEY manquant en environnement.',
      },
      { status: 500 },
    )
  }

  let body: RequestBody = {}
  try {
    const raw = await req.text()
    if (raw) body = JSON.parse(raw) as RequestBody
  } catch {
    body = {}
  }

  const limit = Math.max(1, Math.min(body.limit ?? 500, 2000))
  const offset = Math.max(0, body.offset ?? 0)

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/verify-diagnosticians-daily`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mode: 'batch', limit, offset }),
    })

    const payload = (await res.json().catch(() => ({}))) as EdgeResponse

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          edge: payload,
          triggeredBy: admin.email,
          triggeredAt,
          error: payload.error ?? `Edge Function HTTP ${res.status}`,
        },
        { status: 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      edge: payload,
      triggeredBy: admin.email,
      triggeredAt,
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        triggeredBy: admin.email,
        triggeredAt,
        error: e instanceof Error ? e.message : 'Erreur inconnue',
      },
      { status: 500 },
    )
  }
}
