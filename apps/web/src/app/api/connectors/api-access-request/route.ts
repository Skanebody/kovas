/**
 * POST /api/connectors/api-access-request
 *
 * Crée une demande d'accès API pour un connecteur (Indy en premier lieu).
 * Une seule demande "pending" par (organisation, provider).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

const ALLOWED_PROVIDERS = new Set(['qonto', 'pennylane', 'indy', 'tiime'])

export async function POST(req: Request) {
  const { supabase, orgId, user } = await getCurrentUser()
  let body: { provider?: string; email?: string; message?: string }
  try {
    body = (await req.json()) as { provider?: string; email?: string; message?: string }
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON invalide' }, { status: 400 })
  }

  const { provider, email, message } = body
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ ok: false, message: 'Provider invalide' }, { status: 400 })
  }

  const { error } = await supabase.from('connector_api_access_requests').insert({
    organization_id: orgId,
    provider: provider as 'qonto' | 'pennylane' | 'indy' | 'tiime',
    requested_by: user.id,
    contact_email: email ?? null,
    message: message ?? null,
    status: 'pending',
  })

  if (error) {
    // Cas typique : conflit avec la contrainte unique pending
    if (error.code === '23505') {
      return NextResponse.json(
        { ok: false, message: 'Une demande est déjà en cours pour ce connecteur.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
