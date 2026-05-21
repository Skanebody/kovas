import { AppPageHeader } from '@/components/app-page-header'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { convertQuoteToInvoiceAction } from '../actions'
import { InvoiceWizardForm } from './InvoiceWizardForm'
import { Card, CardContent } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Nouvelle facture' }
export const dynamic = 'force-dynamic'

interface NouvellePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * /app/factures/nouveau — Wizard création facture.
 *
 * Si `?from_quote=<id>` est présent : tente de convertir le devis en facture
 * draft via la server action `convertQuoteToInvoiceAction`, puis redirige
 * vers la facture créée. Sinon : affiche le wizard manuel.
 */
export default async function NouvelleFacturePage({ searchParams }: NouvellePageProps) {
  const sp = await searchParams
  const fromQuoteRaw = sp.from_quote
  const fromQuoteId = typeof fromQuoteRaw === 'string' ? fromQuoteRaw : undefined

  if (fromQuoteId) {
    // Conversion devis → facture draft (côté serveur, pas de form ici)
    const result = await convertQuoteToInvoiceAction(fromQuoteId)
    if (result.invoiceId) {
      redirect(`/dashboard/factures/${result.invoiceId}?from_quote=${fromQuoteId}`)
    }
    return (
      <div className="space-y-6 animate-fade-in">
        <AppPageHeader title="Conversion" accent="impossible" />
        <Card>
          <CardContent className="p-6">
            <p className="text-[14px] text-ink-mute">
              {result.error ?? 'Erreur conversion devis.'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Charge les clients pour le picker
  const { supabase, orgId } = await getCurrentUser()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, display_name, email')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('display_name', { ascending: true })
    .limit(500)

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Nouvelle"
        accent="facture"
        description="Renseignez les prestations, vérifiez l'aperçu, puis émettez la facture."
      />
      <InvoiceWizardForm
        clients={(clients ?? []).map((c) => ({
          id: c.id,
          display_name: c.display_name,
          email: c.email,
        }))}
      />
    </div>
  )
}
