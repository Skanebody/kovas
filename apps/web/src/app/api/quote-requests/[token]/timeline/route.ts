/**
 * KOVAS — Page suivi particulier : statut des 5 destinataires d'une demande (K1).
 *
 * GET /api/quote-requests/[token]/timeline
 *
 * Public (pas d'auth) — accès via public_tracking_token uniquement.
 * Retourne la timeline normalisée pour /mes-demandes/[token].
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface RouteContext {
  params: Promise<{ token: string }>
}

export interface TimelineRecipientView {
  id: string
  diagnostician: {
    id: string
    display_name: string
    city: string | null
    public_url: string | null
    has_response: boolean
    /** Email/téléphone uniquement si le diag a répondu */
    contact_email: string | null
    contact_phone: string | null
  }
  status: 'sent' | 'opened' | 'responded' | 'declined' | 'expired' | 'ignored'
  sent_at: string
  opened_at: string | null
  responded_at: string | null
  tier: 'premium' | 'verified' | 'basic'
}

export interface TimelineResponse {
  trackingToken: string
  status: string
  requesterFirstName: string
  propertyCity: string | null
  diagnosticsRequested: string[]
  emailVerified: boolean
  createdAt: string
  recipients: TimelineRecipientView[]
}

export async function GET(_request: Request, ctx: RouteContext): Promise<Response> {
  const { token } = await ctx.params

  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'Token invalide' }, { status: 400 })
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 1. Récupère la demande
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data: qrRow, error: qrErr } = await (admin as any)
    .from('quote_requests')
    .select(
      'id, public_tracking_token, status, requester_first_name, requester_email_verified, property_city, diagnostics_requested, created_at',
    )
    .eq('public_tracking_token', token)
    .maybeSingle()

  if (qrErr || !qrRow) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  const request = qrRow as {
    id: string
    public_tracking_token: string
    status: string
    requester_first_name: string
    requester_email_verified: boolean | null
    property_city: string | null
    diagnostics_requested: string[]
    created_at: string
  }

  // 2. Récupère les recipients
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data: recipRows } = await (admin as any)
    .from('quote_request_recipients')
    .select(
      'id, diagnostician_id, recipient_tier, status, sent_at, opened_at, responded_at',
    )
    .eq('quote_request_id', request.id)
    .order('sent_at', { ascending: true })

  const recipients = (recipRows ?? []) as Array<{
    id: string
    diagnostician_id: string
    recipient_tier: 'premium' | 'verified' | 'basic'
    status: 'sent' | 'opened' | 'responded' | 'declined' | 'expired' | 'ignored'
    sent_at: string
    opened_at: string | null
    responded_at: string | null
  }>

  // 3. Récupère les fiches diag (pour affichage nom/ville/lien)
  const diagIds = recipients.map((r) => r.diagnostician_id)
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data: diagRows } = await (admin as any)
    .from('diagnosticians')
    .select(
      'id, display_name, city, public_page_url, official_email, official_phone',
    )
    .in('id', diagIds.length > 0 ? diagIds : ['00000000-0000-0000-0000-000000000000'])

  const diagMap = new Map<
    string,
    {
      id: string
      display_name: string
      city: string | null
      public_page_url: string | null
      official_email: string | null
      official_phone: string | null
    }
  >()
  for (const d of (diagRows ?? []) as Array<{
    id: string
    display_name: string
    city: string | null
    public_page_url: string | null
    official_email: string | null
    official_phone: string | null
  }>) {
    diagMap.set(d.id, d)
  }

  const timeline: TimelineRecipientView[] = recipients.map((r) => {
    const diag = diagMap.get(r.diagnostician_id)
    const hasResponse = r.status === 'responded'
    return {
      id: r.id,
      diagnostician: {
        id: r.diagnostician_id,
        display_name: diag?.display_name ?? 'Diagnostiqueur',
        city: diag?.city ?? null,
        public_url: diag?.public_page_url ?? null,
        has_response: hasResponse,
        contact_email: hasResponse ? diag?.official_email ?? null : null,
        contact_phone: hasResponse ? diag?.official_phone ?? null : null,
      },
      status: r.status,
      sent_at: r.sent_at,
      opened_at: r.opened_at,
      responded_at: r.responded_at,
      tier: r.recipient_tier,
    }
  })

  const response: TimelineResponse = {
    trackingToken: request.public_tracking_token,
    status: request.status,
    requesterFirstName: request.requester_first_name,
    propertyCity: request.property_city,
    diagnosticsRequested: request.diagnostics_requested ?? [],
    emailVerified: request.requester_email_verified === true,
    createdAt: request.created_at,
    recipients: timeline,
  }

  return NextResponse.json(response)
}
