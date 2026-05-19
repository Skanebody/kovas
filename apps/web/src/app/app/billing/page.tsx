import { redirect } from 'next/navigation'

/**
 * Consolidation : /app/billing redirige vers /app/account.
 * Toute la gestion abonnement + facturation est désormais sur la page
 * Mon compte (sections collapsibles, plan comparison s'expand
 * automatiquement si pas d'abonnement actif).
 *
 * Le composant checkout-button.tsx reste dans ce dossier (importé par
 * /app/account/page.tsx) — c'est un client component, pas une route.
 */
export default function BillingRedirect() {
  redirect('/app/account')
}
