import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CreditCard } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Facturation' }

/**
 * Facturation v1.5 (placeholder).
 * Spec wireframe v4 §8 : 3 tabs Devis/Factures/Avoirs + stats hero Drama
 * partiel + détail vue document A4. À implémenter post-MVP V1.
 */
export default function FacturationPage() {
  return (
    <EmptyState
      icon={CreditCard}
      title="La facturation arrive bientôt."
      description="Devis, factures et avoirs intégrés avec sync Pennylane et export FEC. Disponible dans la V1.5 — vous serez notifié dès l'ouverture."
      action={
        <Button asChild>
          <Link href="/app/dashboard">Retour au tableau de bord</Link>
        </Button>
      }
      secondaryAction={
        <Button variant="ghost" asChild>
          <Link href="/app/dossiers">Voir mes dossiers</Link>
        </Button>
      }
    />
  )
}
