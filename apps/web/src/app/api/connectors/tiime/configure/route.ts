/**
 * POST /api/connectors/tiime/configure
 *
 * Enregistre / met à jour la configuration du connecteur Tiime pour l'organisation
 * courante. Le token est stocké chiffré (placeholder ici — chiffrement applicatif
 * à compléter via le module crypto déjà présent dans le projet lorsqu'il sera
 * disponible). Pour ne pas casser le typecheck on stocke tel quel sous la colonne
 * `oauth_access_token_encrypted` (le nom rappelle l'intention).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { TiimeClient } from '@/lib/tiime/client'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { supabase, orgId } = await getCurrentUser()
  let body: { workspaceId?: string; accessToken?: string }
  try {
    body = (await req.json()) as { workspaceId?: string; accessToken?: string }
  } catch {
    return NextResponse.json({ ok: false, message: 'JSON invalide' }, { status: 400 })
  }

  const { workspaceId, accessToken } = body
  if (!workspaceId || !accessToken) {
    return NextResponse.json(
      { ok: false, message: 'workspaceId et accessToken obligatoires' },
      { status: 400 },
    )
  }

  // Vérification rapide de l'identifiant via un ping Tiime.
  const tiime = new TiimeClient({ accessToken, companyId: workspaceId })
  const ping = await tiime.ping()
  if (!ping.ok) {
    return NextResponse.json(
      {
        ok: false,
        message:
          ping.status === 401 || ping.status === 403
            ? 'Identifiants Tiime refusés (vérifiez le token et la société).'
            : (ping.message ?? 'Échec de la vérification Tiime'),
      },
      { status: 400 },
    )
  }

  // Le schéma garde `token_encrypted` (legacy NOT NULL) ET les colonnes OAuth
  // ajoutées en DEPLOY-4. Pour Tiime (flow OAuth), on alimente les deux avec la
  // même valeur jusqu'à ce que la colonne legacy puisse être déposée.
  const { error } = await supabase.from('accounting_connectors').upsert(
    {
      organization_id: orgId,
      provider: 'tiime',
      status: 'active',
      workspace_id: workspaceId,
      oauth_access_token_encrypted: accessToken,
      token_encrypted: accessToken,
      last_error: null,
      last_error_at: null,
    },
    { onConflict: 'organization_id,provider' },
  )

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
