import { canUnlockLead } from '@/lib/diagnosticians/listing-level'
import { asUntyped } from '@/lib/diagnosticians/supabase-untyped'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string; leadId: string }>
}

interface DiagOwnerRow {
  id: string
  claimed_by_user_id: string | null
}

interface LeadRow {
  id: string
  requester_first_name: string | null
  requester_last_name: string | null
  requester_email: string | null
  requester_phone: string | null
  property_address: string | null
  property_postal_code: string | null
  property_city: string | null
  property_type: string | null
  property_surface_m2: number | null
  diagnostics_requested: string[] | null
  message: string | null
  created_at: string
}

/**
 * POST /api/diagnosticians/[id]/leads/[leadId]/unlock
 *
 * Déverrouille les coordonnées d'une lead pour un diag claimed.
 *
 * Pré-requis :
 * - Auth (cookie session)
 * - L'user authentifié doit être propriétaire (claimed_by_user_id) du diag
 * - Abonnement actif tier ≥ Essential
 * - Quota mensuel non dépassé
 *
 * Réponses :
 * - 200 { lead: {...} } — déverrouillé (ou déjà unlocked, idempotent)
 * - 401 — non authentifié
 * - 402 — quota dépassé (Payment Required, force upgrade)
 * - 403 — pas propriétaire OU pas d'abonnement actif
 * - 404 — lead/diag introuvable
 */
export async function POST(_req: Request, { params }: RouteParams) {
  const { id: diagnosticianId, leadId } = await params

  const supabase = await createClient()
  const sb = asUntyped(supabase)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // 1. Vérifie ownership
  const { data: diagRaw } = await sb
    .from('diagnosticians')
    .select('id, claimed_by_user_id')
    .eq('id', diagnosticianId)
    .maybeSingle()

  const diag = diagRaw as DiagOwnerRow | null
  if (!diag) {
    return NextResponse.json({ error: 'diagnostician_not_found' }, { status: 404 })
  }
  if (diag.claimed_by_user_id !== user.id) {
    return NextResponse.json({ error: 'not_owner' }, { status: 403 })
  }

  // 2. Vérifie quota / abonnement
  const check = await canUnlockLead(sb, diagnosticianId, leadId)
  if (!check.allowed) {
    if (check.reason === 'quota_exceeded') {
      return NextResponse.json(
        {
          error: 'quota_exceeded',
          message: 'Quota mensuel de leads atteint. Passez au tier Pro pour des unlocks illimités.',
          remainingUnlocks: 0,
          quotaMax: check.quotaMax,
        },
        { status: 402 },
      )
    }
    if (check.reason === 'no_subscription') {
      return NextResponse.json(
        {
          error: 'no_subscription',
          message: 'Abonnement actif requis pour déverrouiller les leads.',
        },
        { status: 403 },
      )
    }
    return NextResponse.json(
      { error: check.reason ?? 'forbidden', message: 'Déverrouillage impossible.' },
      { status: 403 },
    )
  }

  // 3. Lit la lead
  const { data: leadRaw } = await sb
    .from('quote_requests')
    .select(
      'id, requester_first_name, requester_last_name, requester_email, requester_phone, property_address, property_postal_code, property_city, property_type, property_surface_m2, diagnostics_requested, message, created_at',
    )
    .eq('id', leadId)
    .eq('diagnostician_id', diagnosticianId)
    .maybeSingle()

  const lead = leadRaw as LeadRow | null
  if (!lead) {
    return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  }

  // 4. Insère l'unlock (idempotent via UNIQUE constraint)
  // Si déjà unlocked, on ignore l'erreur de conflit
  if (check.reason !== 'already_unlocked') {
    // Récupère subscription_id pour audit (column user_id ajoutée par
    // notre migration, peut être null si l'abonnement est encore
    // org-scoped V1)
    const { data: subRaw } = await sb
      .from('subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle<{ id: string }>()

    await sb.from('quote_request_unlocks').insert({
      quote_request_id: leadId,
      diagnostician_id: diagnosticianId,
      user_id: user.id,
      subscription_id: subRaw?.id ?? null,
    })
  }

  return NextResponse.json({
    lead,
    remainingUnlocks:
      check.remainingUnlocks === Number.POSITIVE_INFINITY ? -1 : (check.remainingUnlocks ?? null),
    quotaMax: check.quotaMax === Number.POSITIVE_INFINITY ? -1 : (check.quotaMax ?? null),
  })
}
