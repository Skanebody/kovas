import { redirect } from 'next/navigation'

/**
 * Alias `/guides` (pluriel) → `/guide` (singulier canonique).
 *
 * Beaucoup d'utilisateurs tapent le pluriel par habitude. On évite le 404
 * via une simple redirection server-side, sans dupliquer la page guides
 * (qui reste hébergée sur la route canonique singulière).
 *
 * Lot B63 — couvre l'écart entre saisie utilisateur et URL canonique SEO.
 */
export default function GuidesAliasPage(): never {
  redirect('/guide')
}
