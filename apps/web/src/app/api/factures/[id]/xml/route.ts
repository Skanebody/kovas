import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/current-user'

/**
 * GET /api/factures/[id]/xml
 *
 * Renvoie le XML Factur-X d'une facture pour téléchargement.
 * RLS Supabase protège l'accès (is_member_of via SELECT).
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params
  const { supabase, orgId } = await getCurrentUser()

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('reference, facturx_xml')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error || !invoice || !invoice.facturx_xml) {
    return NextResponse.json({ error: 'XML indisponible' }, { status: 404 })
  }

  return new NextResponse(invoice.facturx_xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Content-Disposition': `attachment; filename="${invoice.reference}.xml"`,
    },
  })
}
