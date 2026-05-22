import { AppPageHeader } from '@/components/app-page-header'
import { DevisMobileCard } from '@/components/facturation/devis-mobile-card'
import { DevisTable } from '@/components/facturation/devis-table'
import { FacturationFilters } from '@/components/facturation/facturation-filters'
import { FacturationKpiCards } from '@/components/facturation/facturation-kpi-cards'
import { FacturationSearchBar } from '@/components/facturation/facturation-search-bar'
import { FacturationTabs } from '@/components/facturation/facturation-tabs'
import { FacturesMobileCard } from '@/components/facturation/factures-mobile-card'
import { FacturesTable } from '@/components/facturation/factures-table'
import { filterDevis, filterFactures, filterTarifs } from '@/components/facturation/filter'
import {
  MOCK_DEVIS,
  MOCK_DEVIS_KPI,
  MOCK_FACTURES,
  MOCK_FACTURE_KPI,
  MOCK_TARIFS,
  MOCK_TARIF_KPI,
} from '@/components/facturation/mock-data'
import { NewDocumentButton } from '@/components/facturation/new-document-button'
import { TarifsMobileCard } from '@/components/facturation/tarifs-mobile-card'
import { TarifsTable } from '@/components/facturation/tarifs-table'
import { type FacturationTab, isFacturationTab } from '@/components/facturation/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { CreditCard, FileSpreadsheet, FileText, Package } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Facturation' }

interface FacturationPageProps {
  searchParams: Promise<{
    tab?: string
    q?: string
    status?: string
    filter?: string
    client_id?: string
  }>
}

/**
 * Facturation v1.5 — page unifiée style Qonto.
 *
 * 3 onglets dans une seule page :
 * - Devis : pipeline propositions commerciales
 * - Factures : émissions + statut paiement (CA mois, retards)
 * - Tarifs : catalogue produits/services réutilisables
 *
 * Source de vérité de la navigation : query param `?tab=`. Deep-link OK.
 * Recherche globale (`?q=`) filtre l'onglet courant.
 * Filtres statut (`?status=`) propres à devis/factures.
 *
 * Tables Supabase (quotes, invoices, products) à créer en V1.5 — pour
 * l'instant : mock data dans `components/facturation/mock-data.ts`.
 */
export default async function FacturationPage({ searchParams }: FacturationPageProps) {
  const params = await searchParams
  const current: FacturationTab = isFacturationTab(params.tab) ? params.tab : 'devis'
  const query = params.q
  const statusFilter = params.status

  const devisRows = filterDevis(MOCK_DEVIS, query, statusFilter)
  const facturesRows = filterFactures(MOCK_FACTURES, query, statusFilter)
  const tarifsRows = filterTarifs(MOCK_TARIFS, query)

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        title="Votre"
        accent="facturation"
        description="Devis, factures et catalogue tarifs réunis — pilotez votre activité commerciale en un endroit."
        action={<NewDocumentButton current={current} />}
      />

      <FacturationKpiCards
        current={current}
        devisKpi={MOCK_DEVIS_KPI}
        factureKpi={MOCK_FACTURE_KPI}
        tarifKpi={MOCK_TARIF_KPI}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FacturationTabs current={current} />
        <FacturationSearchBar current={current} />
      </div>

      <FacturationFilters current={current} />

      {current === 'devis' && (
        <DevisSection rows={devisRows} hasQuery={Boolean(query || statusFilter)} />
      )}
      {current === 'factures' && (
        <FacturesSection rows={facturesRows} hasQuery={Boolean(query || statusFilter)} />
      )}
      {current === 'tarifs' && <TarifsSection rows={tarifsRows} hasQuery={Boolean(query)} />}
    </div>
  )
}

function DevisSection({
  rows,
  hasQuery,
}: { rows: ReturnType<typeof filterDevis>; hasQuery: boolean }) {
  if (rows.length === 0) {
    return hasQuery ? (
      <EmptyState
        icon={FileText}
        title="Aucun devis trouvé."
        description="Aucun résultat ne correspond à votre recherche. Essayez d'élargir le filtre."
      />
    ) : (
      <EmptyState
        icon={FileText}
        title="Premier devis en 2 minutes."
        description="Créez un devis depuis un dossier existant ou en partant d'un produit du catalogue."
        action={
          <Button asChild variant="accent">
            <Link href="/dashboard/facturation/devis/new">Créer mon premier devis</Link>
          </Button>
        }
      />
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <DevisTable rows={rows} />
      </div>
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <DevisMobileCard key={r.id} row={r} />
        ))}
      </div>
    </>
  )
}

function FacturesSection({
  rows,
  hasQuery,
}: {
  rows: ReturnType<typeof filterFactures>
  hasQuery: boolean
}) {
  if (rows.length === 0) {
    return hasQuery ? (
      <EmptyState
        icon={CreditCard}
        title="Aucune facture trouvée."
        description="Aucun résultat ne correspond à votre recherche. Essayez d'élargir le filtre."
      />
    ) : (
      <EmptyState
        icon={CreditCard}
        title="Première facture à émettre."
        description="Émettez une facture depuis un devis accepté ou directement depuis un dossier terminé."
        action={
          <Button asChild variant="accent">
            <Link href="/dashboard/facturation/factures/new">Créer ma première facture</Link>
          </Button>
        }
      />
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <FacturesTable rows={rows} />
      </div>
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <FacturesMobileCard key={r.id} row={r} />
        ))}
      </div>
    </>
  )
}

function TarifsSection({
  rows,
  hasQuery,
}: {
  rows: ReturnType<typeof filterTarifs>
  hasQuery: boolean
}) {
  if (rows.length === 0) {
    return hasQuery ? (
      <EmptyState
        icon={FileSpreadsheet}
        title="Aucun produit trouvé."
        description="Aucun produit du catalogue ne correspond à votre recherche."
      />
    ) : (
      <EmptyState
        icon={Package}
        title="Catalogue tarifs vide."
        description="Créez vos packs et tarifs réutilisables (DPE seul, pack vente, audit, etc.) pour les insérer en 1 clic dans vos devis."
      />
    )
  }

  return (
    <>
      <div className="hidden md:block">
        <TarifsTable rows={rows} />
      </div>
      <div className="md:hidden space-y-2">
        {rows.map((r) => (
          <TarifsMobileCard key={r.id} row={r} />
        ))}
      </div>
    </>
  )
}
