import { AppPageHeader } from '@/components/app-page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { CreditNoteForm } from './CreditNoteForm'

export const metadata: Metadata = { title: 'Créer un avoir' }
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount)
}

/**
 * Wizard création d'un avoir lié à une facture existante.
 *
 * V1 : avoir total uniquement (montant = total facture). V2 ajoutera les
 * avoirs partiels avec sélection ligne par ligne.
 */
export default async function CreateCreditNotePage({ params }: PageProps) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const { data: invoice } = await supabase
    .from('invoices')
    .select(
      'id, reference, status, amount_ht, amount_tva, amount_ttc, client_id, credit_note_for_invoice_id, client_snapshot',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (!invoice) notFound()

  // Refus : ne peut pas faire un avoir sur un avoir, ni sur un draft, ni sur cancelled
  if (invoice.credit_note_for_invoice_id || invoice.status === 'draft' || invoice.status === 'cancelled') {
    return (
      <div className="space-y-6 animate-fade-in">
        <AppPageHeader title="Avoir" accent="impossible" />
        <Card>
          <CardContent className="p-6">
            <p className="text-[14px] text-ink-mute">
              Un avoir ne peut être créé que sur une facture émise (issued / partial / paid /
              overdue). État actuel : <strong>{invoice.status}</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const snapshot = invoice.client_snapshot as { display_name?: string } | null
  const clientName = snapshot?.display_name ?? '—'

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Avoir lié à"
        accent={invoice.reference}
        description={`Client : ${clientName} · Montant : ${formatEur(Number(invoice.amount_ttc))} TTC`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Motif de l'avoir</CardTitle>
        </CardHeader>
        <CardContent>
          <CreditNoteForm invoiceId={invoice.id} amountTtc={Number(invoice.amount_ttc)} />
        </CardContent>
      </Card>
    </div>
  )
}
