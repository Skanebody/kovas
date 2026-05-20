/**
 * Panneau actions financières rapides.
 * Server component — délègue le run aux ActionRunner client.
 */

import { Card } from '@/components/ui/card'
import { ActionRunner } from './ActionRunner'

export function FinancialActionsPanel() {
  return (
    <Card variant="opaque" padding="default" className="space-y-3">
      <header className="space-y-1">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          💶 Finance · Outils rapides
        </p>
        <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
          Actions financières
        </h2>
      </header>

      <ActionRunner
        label="Forcer recalcul invoices ce mois"
        description="Recompute des invoices du mois courant (V1 log only)"
        endpoint="/api/admin/tools/recalc-invoices"
        confirm
      />
      <ActionRunner
        label="Marquer un paiement comme refunded"
        description="Saisir le payment_intent_id Stripe (V1 log only, V2 refund API)"
        endpoint="/api/admin/tools/refund-payment"
        inputField={{ key: 'payment_intent_id', label: 'Payment intent ID', placeholder: 'pi_xxx' }}
        confirm
        variant="destructive"
      />
      <ActionRunner
        label="Générer facture manuelle"
        description="Crée une invoice Stripe ad-hoc (V1 log only)"
        endpoint="/api/admin/tools/generate-invoice"
        inputField={{ key: 'organization_id', label: 'Organization ID', placeholder: 'org-uuid' }}
      />
      <ActionRunner
        label="Reset compteur missions (démo)"
        description="Remet les compteurs de mission à 0 sur l'organisation (V1 log only)"
        endpoint="/api/admin/tools/reset-missions"
        inputField={{ key: 'organization_id', label: 'Organization ID', placeholder: 'org-uuid' }}
        confirm
        variant="destructive"
      />
    </Card>
  )
}
