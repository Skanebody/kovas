'use client'

/**
 * Client wrapper pour les 3 onglets canoniques de /tarifs:
 *   - Logiciel  (KOVAS SaaS terrain — 29/59/149/299 €/mo)
 *   - Annuaire  (KOVAS Annuaire — 19/39/79 €/mo, second pilier revenu)
 *   - Bundles   (Logiciel + Annuaire combinés avec remise)
 *
 * URL deep-link via query param ?tab=annuaire / ?tab=bundles (par défaut
 * "logiciel"). Préserve l'état au refresh + permet de partager un lien direct.
 *
 * Modèle Doctolib : l'annuaire est un produit à part entière, pas un add-on.
 * Cette présentation 3 onglets signale au visiteur qu'il peut souscrire à
 * l'annuaire SEUL sans le logiciel.
 *
 * Authority : prompt orchestration refonte (Update 6 — architecture
 * économique annuaire second pilier de revenu).
 */

import { cn } from '@/lib/utils'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import type React from 'react'

type TabKey = 'logiciel' | 'annuaire' | 'bundles'

const TABS: ReadonlyArray<{
  key: TabKey
  label: string
  pricing: string
  helper: string
}> = [
  {
    key: 'logiciel',
    label: 'Logiciel',
    pricing: '29 – 299 €/mois',
    helper: 'Outil terrain compagnon de Liciel · OBBC · AnalysImmo · ORIS',
  },
  {
    key: 'annuaire',
    label: 'Annuaire',
    pricing: '19 – 79 €/mois',
    helper: 'Visibilité kovas.fr · leads B2C qualifiés · modèle Doctolib',
  },
  {
    key: 'bundles',
    label: 'Bundles',
    pricing: '39 – 319 €/mois',
    helper: "Logiciel + Annuaire combinés, jusqu'à 24 % de remise",
  },
]

interface TarifsTabsProps {
  logiciel: React.ReactNode
  annuaire: React.ReactNode
  bundles: React.ReactNode
}

export function TarifsTabs({ logiciel, annuaire, bundles }: TarifsTabsProps): React.ReactElement {
  const searchParams = useSearchParams()
  const [active, setActive] = useState<TabKey>('logiciel')

  // Hydrate from URL query param on mount
  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'annuaire' || tab === 'bundles' || tab === 'logiciel') {
      setActive(tab)
    }
  }, [searchParams])

  function handleSelect(tab: TabKey): void {
    setActive(tab)
    // Soft URL update (no reload)
    const url = new URL(window.location.href)
    if (tab === 'logiciel') {
      url.searchParams.delete('tab')
    } else {
      url.searchParams.set('tab', tab)
    }
    window.history.replaceState({}, '', url.toString())
  }

  return (
    <div className="space-y-10">
      {/* Tab strip — sobre, V5, bordure 1px en bas */}
      <div
        role="tablist"
        aria-label="Catégories de tarification"
        className="border-b border-[#0F1419]/[0.12] flex flex-col sm:flex-row gap-0"
      >
        {TABS.map((tab) => {
          const isActive = active === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tarifs-panel-${tab.key}`}
              id={`tarifs-tab-${tab.key}`}
              onClick={() => handleSelect(tab.key)}
              className={cn(
                'group flex-1 px-5 py-4 text-left transition-colors border-b-2 -mb-px',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse-deep/40 focus-visible:ring-offset-2',
                isActive
                  ? 'border-chartreuse-deep text-[#0F1419]'
                  : 'border-transparent text-[#0F1419]/55 hover:text-[#0F1419] hover:border-[#0F1419]/15',
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-base font-semibold tracking-tight">{tab.label}</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-[#0F1419]/55">
                  {tab.pricing}
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[#0F1419]/55 leading-relaxed">{tab.helper}</p>
            </button>
          )
        })}
      </div>

      {/* Panels — un seul visible à la fois */}
      <div
        role="tabpanel"
        id={`tarifs-panel-${active}`}
        aria-labelledby={`tarifs-tab-${active}`}
        className="animate-fade-in motion-reduce:animate-none"
      >
        {active === 'logiciel' ? logiciel : null}
        {active === 'annuaire' ? annuaire : null}
        {active === 'bundles' ? bundles : null}
      </div>
    </div>
  )
}
