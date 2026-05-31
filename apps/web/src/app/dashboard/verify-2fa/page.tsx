import type { Metadata } from 'next'
import { logoutAction } from '../actions'
import { Verify2faClient } from './verify-2fa-client'

export const metadata: Metadata = { title: 'Vérification en deux étapes' }

/**
 * Page de challenge 2FA (MFA native Supabase TOTP).
 *
 * L'utilisateur arrive ici UNIQUEMENT s'il possède un facteur TOTP vérifié
 * mais n'a pas encore validé son code pour la session courante (session AAL1
 * alors que nextLevel = AAL2). Le redirect est déclenché par la garde
 * fail-open de `dashboard/layout.tsx`, qui whiteliste cette route pour éviter
 * toute boucle de redirection.
 *
 * Le challenge lui-même est 100% client-side (supabase.auth.mfa.* n'existe
 * que côté navigateur). La page serveur ne fait que câbler le composant et
 * fournir l'action de déconnexion en secours.
 */
export default function Verify2faPage() {
  return <Verify2faClient onLogout={logoutAction} />
}
