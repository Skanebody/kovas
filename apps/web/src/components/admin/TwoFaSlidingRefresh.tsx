'use client'

import { useEffect } from 'react'

/**
 * Déclencheur de la fenêtre glissante 2FA admin (sliding window 72 h).
 *
 * Au montage (donc à chaque navigation vers une page admin gardée), pingue
 * /api/admin/2fa/refresh en best-effort. Si le cookie 2FA est encore valide,
 * le serveur le ré-émet avec un timestamp frais → la fenêtre de 72 h repart.
 *
 * Best-effort total : toute erreur réseau est ignorée (le composant ne rend
 * rien et n'affecte jamais l'affichage). La (re)vérification 2FA reste pilotée
 * par la garde serveur du layout admin, pas par ce composant.
 *
 * Rendu UNIQUEMENT pour les admins ayant une 2FA active (cf. layout gated).
 */
export function TwoFaSlidingRefresh() {
  useEffect(() => {
    void fetch('/api/admin/2fa/refresh', { method: 'POST' }).catch(() => {
      // Best-effort : on ignore silencieusement toute erreur réseau.
    })
  }, [])

  return null
}
