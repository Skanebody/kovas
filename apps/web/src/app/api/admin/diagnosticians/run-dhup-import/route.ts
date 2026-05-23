/**
 * Déclencheur manuel de l'import DHUP officiel (annuaire diagnostiqueurs).
 *
 * Route : `POST /api/admin/diagnosticians/run-dhup-import`
 *
 * Appelle l'Edge Function Supabase `absorb-dhup-directory` qui :
 *   1. Télécharge le CSV DHUP officiel depuis data.gouv.fr
 *   2. Parse + déduplique par SHA-256(siret|nom+prenom+dept)
 *   3. UPSERT idempotent dans `diagnosticians` (+ certifications)
 *   4. Marque les fiches disparues en validation_status='pending' (ghost lifecycle)
 *
 * Auth : admin uniquement (allowlist `ADMIN_EMAILS` env).
 *
 * Le cron équivalent tourne lundi 03:00 UTC via
 * `.github/workflows/cron-dhup-weekly.yml`. Cette route est utilisée pour
 * les imports d'urgence ou la première synchronisation.
 */

import { requireAdmin } from '@/lib/auth/require-admin'
import { NextResponse } from 'next/server'

interface EdgeResponse {
  ok: boolean
  imported?: number
  updated?: number
  ceased?: number
  errors?: number
  durationMs?: number
  totalRows?: number
  certificationsUpserted?: number
  errorMessages?: string[]
  error?: string
}

export interface RunDhupImportResponse {
  ok: boolean
  edge?: EdgeResponse
  triggeredBy: string
  triggeredAt: string
  error?: string
}

export async function POST(): Promise<NextResponse<RunDhupImportResponse>> {
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

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/absorb-dhup-directory`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ source: 'admin_manual', triggered_by: admin.email }),
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
