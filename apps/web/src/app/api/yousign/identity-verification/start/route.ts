import { createAdminClientLoose } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

/**
 * Placeholder Yousign signature qualifiée eIDAS.
 *
 * Stub V2 — TODO :
 *  1. POST https://api.yousign.app/v3/signature_requests avec le document
 *     de référence "Attestation d'identité KOVAS" pré-rempli (nom, SIRET).
 *  2. Envoi par email du lien signataire (face-to-face vidéo + ID gov scan).
 *  3. Webhook signature_complete → flip identity_status = 'verified'.
 *  4. Stockage du PDF signé + audit trail dans verification_documents.
 *
 * En dev/sans config : on simule directement.
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.YOUSIGN_API_KEY) {
    return NextResponse.json(
      {
        error:
          'Yousign non configuré. Contactez contact@kovas.fr ou choisissez FranceConnect / KYC scan.',
      },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Session expirée' }, { status: 401 })
  }

  const adminLoose = createAdminClientLoose()

  const { data: diag } = await adminLoose
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  if (diag?.id) {
    await adminLoose
      .from('diagnostician_verification_status')
      .update({
        identity_method: 'yousign_qualified',
        identity_status: 'in_review',
      })
      .eq('diagnostician_id', diag.id)
  }

  redirect('/signup/diagnostiqueur?step=4')
}
