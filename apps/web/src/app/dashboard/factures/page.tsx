import { permanentRedirect } from 'next/navigation'

/**
 * KOVAS — Redirect 301 post-merge 2026-05-23.
 *
 * La liste des factures vit désormais dans `/dashboard/facturation?tab=factures`
 * (page unifiée 3 onglets Devis|Factures|Tarifs). Les routes CRUD
 * `/dashboard/factures/nouveau`, `/dashboard/factures/[id]` et
 * `/dashboard/factures/history` restent actives.
 */
export default function InvoicesIndexRedirect() {
  permanentRedirect('/dashboard/facturation?tab=factures')
}
