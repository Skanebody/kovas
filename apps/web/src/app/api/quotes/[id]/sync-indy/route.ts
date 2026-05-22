/**
 * POST /api/quotes/:id/sync-indy
 *
 * Indy supporte les devis dans ses workspaces freelance. Tant que l'API n'est
 * pas publique, répond 501.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: Request, ctx: RouteParams) {
  const { id } = await ctx.params
  const { supabase, orgId } = await getCurrentUser()

  const { data: connector } = await supabase
    .from('accounting_connectors')
    .select('status')
    .eq('organization_id', orgId)
    .eq('provider', 'indy')
    .maybeSingle()

  if (!connector || connector.status !== 'active') {
    return NextResponse.json(
      {
        ok: false,
        code: 'connector_inactive',
        message: 'Connecteur Indy non configuré.',
      },
      { status: 400 },
    )
  }

  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('id, reference, indy_quote_id')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (quoteErr || !quote) {
    return NextResponse.json({ ok: false, message: 'Devis introuvable' }, { status: 404 })
  }

  if (quote.indy_quote_id) {
    return NextResponse.json(
      { ok: true, alreadySynced: true, indyQuoteId: quote.indy_quote_id },
      { status: 200 },
    )
  }

  // API Indy publique non encore disponible — devis non poussés tant que l'accès n'est pas ouvert.
  return NextResponse.json(
    {
      ok: false,
      code: 'api_unavailable',
      message:
        "L'API Indy pour les devis n'est pas encore publique. Demandez l'accès depuis Compte → Intégrations → Indy.",
    },
    { status: 501 },
  )
}
