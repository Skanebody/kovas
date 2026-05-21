import { CreditCard, FileText, Receipt } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AppPageHeader } from '@/components/app-page-header'
import { InvoicesList } from '@/components/billing/InvoicesList'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { getCurrentUser } from '@/lib/auth/current-user'
import { isStripeConfigured } from '@/lib/stripe'
import { getInvoicesForOrganization } from '@/lib/stripe/invoices'

export const metadata: Metadata = { title: 'Mes factures' }
export const dynamic = 'force-dynamic'

/**
 * /app/facturation — Liste des factures Stripe de l'organisation courante.
 *
 * Comble la lacune V1 critique pour la compta annuelle des diagnostiqueurs
 * indépendants : retrouver et télécharger les factures KOVAS depuis l'app
 * (au lieu de fouiller dans les emails Stripe).
 */
export default async function FacturationPage() {
  const { orgId, supabase } = await getCurrentUser()

  // Cas Stripe pas encore configuré (env dev) → empty state explicite
  if (!isStripeConfigured()) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AppPageHeader title="Mes" accent="factures" />
        <EmptyState
          icon={CreditCard}
          title="Facturation indisponible."
          description="Le service de facturation n'est pas encore configuré sur cet environnement."
          action={
            <Button asChild>
              <Link href="/dashboard/dashboard">Retour au tableau de bord</Link>
            </Button>
          }
        />
      </div>
    )
  }

  let invoices: Awaited<ReturnType<typeof getInvoicesForOrganization>> = null
  let fetchError: string | null = null
  try {
    invoices = await getInvoicesForOrganization(orgId, supabase)
  } catch (err) {
    fetchError = err instanceof Error ? err.message : 'Erreur inconnue'
  }

  // Pas d'abonnement Stripe associé à l'org → invitation à s'abonner
  if (invoices === null) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AppPageHeader
          title="Mes"
          accent="factures"
          description="Retrouvez ici toutes vos factures KOVAS, téléchargeables au format PDF."
        />
        <EmptyState
          icon={Receipt}
          title="Aucune facture pour le moment."
          description="Vous n'avez pas encore d'abonnement actif. Choisissez votre formule pour démarrer."
          action={
            <Button asChild variant="accent">
              <Link href="/pricing">Voir les formules</Link>
            </Button>
          }
          secondaryAction={
            <Button variant="ghost" asChild>
              <Link href="/dashboard/dashboard">Retour au tableau de bord</Link>
            </Button>
          }
        />
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="space-y-6 animate-fade-in">
        <AppPageHeader title="Mes" accent="factures" />
        <EmptyState
          icon={FileText}
          title="Impossible de charger vos factures."
          description={`Réessayez dans un instant. Détail technique : ${fetchError}`}
          action={
            <Button asChild>
              <Link href="/dashboard/facturation">Réessayer</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const count = invoices.length
  const description =
    count === 0
      ? "Aucune facture émise pour l'instant — la première arrivera à la fin de votre période d'essai."
      : `${count} facture${count > 1 ? 's' : ''} disponible${count > 1 ? 's' : ''} · téléchargeable${count > 1 ? 's' : ''} en PDF pour votre comptabilité.`

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Mes"
        accent="factures"
        description={description}
        action={
          <Button asChild variant="ghost">
            <Link href="/dashboard/account">Gérer mon abonnement</Link>
          </Button>
        }
      />

      {count === 0 ? (
        <EmptyState
          icon={FileText}
          title="Pas encore de facture."
          description="Vos factures apparaîtront ici dès le premier prélèvement Stripe."
        />
      ) : (
        <InvoicesList invoices={invoices} />
      )}
    </div>
  )
}
