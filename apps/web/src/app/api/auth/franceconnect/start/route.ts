import { createAdminClientLoose } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

/**
 * Placeholder FranceConnect — V2 implémentera l'OAuth officiel
 * (https://partenaires.franceconnect.gouv.fr/) avec PKCE + nonce.
 *
 * En mode dev, on simule la redirection : on marque la phase identity
 * comme `verified` puis on renvoie l'utilisateur à l'étape 4.
 *
 * Stub V2 — TODO :
 *  1. Génération PKCE + state + nonce + cookie HttpOnly
 *  2. Redirection vers https://app.franceconnect.gouv.fr/api/v1/authorize
 *  3. Callback /api/auth/franceconnect/callback avec échange code → tokens
 *  4. Récupération sub (identité pivot) + insertion identity_provider_ref
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production' && !process.env.FRANCE_CONNECT_CLIENT_ID) {
    return NextResponse.json(
      {
        error:
          'FranceConnect non configuré. Contactez contact@kovas.fr ou choisissez la méthode KYC ou Yousign.',
      },
      { status: 503 },
    )
  }

  // Mode dev / sans config : simulation
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
        identity_method: 'france_connect',
        identity_status: 'verified',
        identity_verified_at: new Date().toISOString(),
        identity_provider_ref: `fc_dev_sim_${Date.now()}`,
      })
      .eq('diagnostician_id', diag.id)

    await adminLoose.from('verification_checks_log').insert({
      diagnostician_id: diag.id,
      check_type: 'identity_initial',
      check_source: 'france_connect',
      status: 'success',
      result: { mode: 'dev_simulation' },
      triggered_by: 'user',
    })
  }

  redirect('/signup/diagnostiqueur?step=4')
}
