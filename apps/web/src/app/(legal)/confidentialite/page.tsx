import { permanentRedirect } from 'next/navigation'

/**
 * Redirection permanente `/confidentialite` → `/politique-confidentialite`.
 *
 * Le pack juridique v1.1 du 2 juin 2026 a renommé la route publique de la
 * Politique de confidentialité. On conserve l'ancien chemin en redirection
 * permanente afin de ne pas casser les liens entrants (signup-form, account
 * settings, footer, anciennes pages indexées par Google).
 */
export default function ConfidentialiteLegacyRedirect(): never {
  permanentRedirect('/politique-confidentialite')
}
