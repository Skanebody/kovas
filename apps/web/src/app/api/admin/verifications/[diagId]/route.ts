import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { NextResponse } from 'next/server'

/**
 * GET /api/admin/verifications/:diagId
 *
 * Charge les détails complets d'un diagnostician pour le modal de review :
 *   - status_status / phase fields (4 phases)
 *   - history (verification_checks_log, 20 derniers)
 *   - signalements (status='new'|'investigating')
 *
 * Gate : verifyAdminAccess() — refuse 404-equivalent pour les non-admins.
 */

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ diagId: string }>
}

export async function GET(_req: Request, { params }: RouteParams): Promise<NextResponse> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || access.needs2FA || access.hasNoSecret) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const { diagId } = await params
  if (!diagId || diagId.length < 8) {
    return NextResponse.json({ error: 'bad_id' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const [diagRes, statusRes, historyRes, signalementsRes] = await Promise.all([
    supabase
      .from('diagnosticians')
      .select('id, full_name, first_name, last_name, city, email')
      .eq('id', diagId)
      .maybeSingle(),
    supabase
      .from('diagnostician_verification_status')
      .select('*')
      .eq('diagnostician_id', diagId)
      .maybeSingle(),
    supabase
      .from('verification_checks_log')
      .select('id, check_type, check_source, status, performed_at, result')
      .eq('diagnostician_id', diagId)
      .order('performed_at', { ascending: false })
      .limit(20),
    supabase
      .from('diagnostician_signalements')
      .select('id, reason, description, status, created_at')
      .eq('diagnostician_id', diagId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const diag = diagRes.data as {
    id: string
    full_name: string | null
    first_name: string | null
    last_name: string | null
    city: string | null
    email: string | null
  } | null
  if (!diag) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const status = statusRes.data as Record<string, unknown> | null

  const fullName =
    diag.full_name?.trim() ||
    [diag.first_name, diag.last_name].filter(Boolean).join(' ').trim() ||
    'Diagnostiqueur'

  return NextResponse.json({
    diagId: diag.id,
    fullName,
    city: diag.city,
    email: diag.email,
    overallStatus: (status?.overall_status as string | null) ?? null,
    badgeLevel: (status?.badge_level as string | null) ?? null,
    signalementsCount: (status?.signalements_count as number | null) ?? 0,
    identity: {
      status: (status?.identity_status as string | null) ?? null,
      rejectionReason: (status?.identity_rejection_reason as string | null) ?? null,
      verifiedAt: (status?.identity_verified_at as string | null) ?? null,
      fields: {
        method: (status?.identity_method as string | null) ?? null,
        provider_ref: (status?.identity_provider_ref as string | null) ?? null,
      },
    },
    cofrac: {
      status: (status?.cofrac_status as string | null) ?? null,
      rejectionReason: (status?.cofrac_rejection_reason as string | null) ?? null,
      verifiedAt: (status?.cofrac_verified_at as string | null) ?? null,
      fields: {
        cofrac_number: (status?.cofrac_number as string | null) ?? null,
        organism: (status?.cofrac_certifying_body as string | null) ?? null,
        valid_from: (status?.cofrac_valid_from as string | null) ?? null,
        valid_until: (status?.cofrac_valid_until as string | null) ?? null,
        last_check: (status?.cofrac_last_api_check as string | null) ?? null,
      },
    },
    rcpro: {
      status: (status?.rcpro_status as string | null) ?? null,
      rejectionReason: (status?.rcpro_rejection_reason as string | null) ?? null,
      verifiedAt: (status?.rcpro_verified_at as string | null) ?? null,
      fields: {
        insurer: (status?.rcpro_insurer as string | null) ?? null,
        policy_number: (status?.rcpro_policy_number as string | null) ?? null,
        per_claim_eur: (status?.rcpro_amount_per_claim_eur as number | null) ?? null,
        per_year_eur: (status?.rcpro_amount_per_year_eur as number | null) ?? null,
        valid_from: (status?.rcpro_valid_from as string | null) ?? null,
        valid_until: (status?.rcpro_valid_until as string | null) ?? null,
      },
    },
    sirene: {
      status: (status?.sirene_status as string | null) ?? null,
      rejectionReason: (status?.sirene_rejection_reason as string | null) ?? null,
      verifiedAt: (status?.sirene_verified_at as string | null) ?? null,
      fields: {
        siret: (status?.sirene_siret as string | null) ?? null,
        company_name: (status?.sirene_company_name as string | null) ?? null,
        legal_form: (status?.sirene_legal_form as string | null) ?? null,
        ape_code: (status?.sirene_ape_code as string | null) ?? null,
        director: (status?.sirene_director_name as string | null) ?? null,
        created_at: (status?.sirene_company_created_at as string | null) ?? null,
      },
    },
    history: (historyRes.data ?? []).map((h) => {
      const row = h as {
        id: string
        check_type: string
        check_source: string
        status: string
        performed_at: string
        result: Record<string, unknown> | null
      }
      return {
        id: row.id,
        checkType: row.check_type,
        checkSource: row.check_source,
        status: row.status,
        performedAt: row.performed_at,
        resultSummary: row.result ? JSON.stringify(row.result).slice(0, 200) : undefined,
      }
    }),
    signalements: (signalementsRes.data ?? []).map((s) => {
      const row = s as {
        id: string
        reason: string
        description: string | null
        status: string
        created_at: string
      }
      return {
        id: row.id,
        reason: row.reason,
        description: row.description,
        status: row.status,
        createdAt: row.created_at,
      }
    }),
  })
}
