import { permanentRedirect } from 'next/navigation'

/**
 * KOVAS — Redirect 301 post-merge 2026-05-23.
 *
 * La liste des devis vit désormais dans `/dashboard/facturation?tab=devis`
 * (page unifiée 3 onglets Devis|Factures|Tarifs). Les routes CRUD
 * `/dashboard/devis/nouveau` et `/dashboard/devis/[id]` restent actives.
 */
export default function QuotesIndexRedirect() {
  permanentRedirect('/dashboard/facturation?tab=devis')
}
