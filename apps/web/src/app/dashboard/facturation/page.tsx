import { AppPageHeader } from '@/components/app-page-header'
import { DevisSectionLive } from '@/components/facturation/devis-section'
import { FacturationSearchBar } from '@/components/facturation/facturation-search-bar'
import { FacturationTabs } from '@/components/facturation/facturation-tabs'
import { FacturesSectionLive } from '@/components/facturation/factures-section'
import { filterTarifs } from '@/components/facturation/filter'
import { MOCK_TARIFS } from '@/components/facturation/mock-data'
import { NewDocumentButton } from '@/components/facturation/new-document-button'
import { TarifsMobileCard } from '@/components/facturation/tarifs-mobile-card'
import { TarifsTable } from '@/components/facturation/tarifs-table'
import { type FacturationTab, isFacturationTab } from '@/components/facturation/types'
import { EmptyState } from '@/components/ui/empty-state'
import { FileSpreadsheet, Package } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Facturation' }
export const dynamic = 'force-dynamic'

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
 * Facturation v1.5 — point d'entrée unifié (post-merge 2026-05-23).
 *
 * 3 onglets dans une seule page :
 * - Devis    : pipeline urgence (à envoyer / en attente / refusés-expirés)
 *              — données live Supabase via `DevisSectionLive`
 * - Factures : pipeline urgence (en retard / à échéance / payées résumé)
 *              — données live Supabase via `FacturesSectionLive`
 * - Tarifs   : catalogue produits/services réutilisables (placeholder mock V1.5)
 *
 * Source de vérité de la navigation : query param `?tab=`. Deep-link OK.
 * Les routes CRUD historiques (`/dashboard/devis/nouveau`, `/dashboard/factures/[id]`,
 * etc.) restent actives — seules les routes index `/dashboard/devis` et
 * `/dashboard/factures` redirigent (301) vers cette page.
 */
export default async function FacturationPage({ searchParams }: FacturationPageProps) {
  const params = await searchParams
  const current: FacturationTab = isFacturationTab(params.tab) ? params.tab : 'devis'
  const query = params.q

  const tarifsRows = filterTarifs(MOCK_TARIFS, query)

  const headerCopy =
    current === 'devis'
      ? "Pipeline de devis par ordre d'urgence — à envoyer, en attente de signature, à archiver."
      : current === 'factures'
        ? "Pipeline de facturation par ordre d'urgence — en retard, à échéance, payées."
        : 'Catalogue de produits et services réutilisables dans vos devis et factures.'

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto w-full">
      {/* ============================================
          Ribbon "Vos revenus" — distinction visuelle vs abonnement KOVAS.
          Pattern chartreuse pour identifier la catégorie "argent qui rentre".
          ============================================ */}
      <div
        className="inline-flex items-center gap-2 rounded-pill border border-[#D4F542]/60 bg-[#D4F542]/15 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.12em] text-[#0F1419]"
        aria-label="Cette page concerne vos revenus, pas votre abonnement KOVAS"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-[#0F1419]" />
        Vos revenus · factures émises à vos clients
      </div>

      <AppPageHeader
        title="Votre"
        accent="facturation"
        description={headerCopy}
        action={<NewDocumentButton current={current} />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FacturationTabs current={current} />
        <FacturationSearchBar current={current} />
      </div>

      {current === 'devis' && <DevisSectionLive />}
      {current === 'factures' && <FacturesSectionLive />}
      {current === 'tarifs' && <TarifsSection rows={tarifsRows} hasQuery={Boolean(query)} />}
    </div>
  )
}

function TarifsSection({
  rows,
  hasQuery,
}: { rows: ReturnType<typeof filterTarifs>; hasQuery: boolean }) {
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
