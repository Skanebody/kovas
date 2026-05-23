'use client'

/**
 * KOVAS — Contenu client de la page /app/relances (tabs + KPI + manager).
 *
 * 6 tabs : Toutes · Devis · Factures · Post-DPE · Prescripteurs · Avis.
 * Tab `Toutes` passe `forceKind={null}` au manager pour vue unifiée.
 */

import {
  type FollowUpKind,
  FollowUpSequencesManager,
} from '@/components/followup/FollowUpSequencesManager'
import { KpiHero } from '@/components/ui/kpi-hero'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface RelancesStats {
  activeCount: number
  emailsSentThisMonth: number
  conversionsThisMonth: number
  averageResponseRate: number | null
}

type TabKey = 'all' | FollowUpKind

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'pending_quote', label: 'Devis' },
  { key: 'unpaid_invoice', label: 'Factures' },
  { key: 'post_dpe_fg', label: 'Post-DPE' },
  { key: 'silent_prescriber', label: 'Prescripteurs' },
  { key: 'client_review', label: 'Avis' },
]

function mapTabFromUrl(tab: string | null): TabKey {
  if (!tab) return 'all'
  if (tab === 'devis') return 'pending_quote'
  if (tab === 'factures') return 'unpaid_invoice'
  if (
    tab === 'pending_quote' ||
    tab === 'unpaid_invoice' ||
    tab === 'post_dpe_fg' ||
    tab === 'silent_prescriber' ||
    tab === 'client_review'
  ) {
    return tab
  }
  return 'all'
}

export interface RelancesPageContentProps {
  stats: RelancesStats
  defaultTab: string | null
}

export function RelancesPageContent({ stats, defaultTab }: RelancesPageContentProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(mapTabFromUrl(defaultTab))

  // forceKind passé au manager : null pour vue "Toutes", sinon le kind.
  const forceKind: FollowUpKind | null = activeTab === 'all' ? null : activeTab

  return (
    <div className="space-y-6">
      {/* KPI bar — alignée sur pattern fiche client (4 KpiHero) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiHero
          value={stats.activeCount}
          label="Séquences actives"
          hint="Tous types confondus"
          trend={null}
        />
        <KpiHero
          value={stats.emailsSentThisMonth}
          label="Emails envoyés ce mois"
          hint="Étapes franchies depuis le 1er"
          trend={null}
        />
        <KpiHero
          value={stats.conversionsThisMonth}
          label="Conversions ce mois"
          hint="Séquences terminées avec succès"
          trend={null}
        />
        <KpiHero
          value={
            stats.averageResponseRate === null
              ? '—'
              : `${Math.round(stats.averageResponseRate * 100)}%`
          }
          label="Taux d'ouverture"
          hint={stats.averageResponseRate === null ? 'Disponible en V1.5' : '30 derniers jours'}
          trend={null}
        />
      </div>

      {/* Tabs filtres */}
      <nav
        role="tablist"
        aria-label="Filtres de relances"
        className="flex flex-wrap gap-1.5 border-b border-rule/60 pb-2"
      >
        {TABS.map((tab) => {
          const active = tab.key === activeTab
          return (
            <button
              key={tab.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-3.5 py-1.5 rounded-pill text-[12px] font-medium transition-colors',
                active ? 'bg-navy text-paper' : 'text-ink-mute hover:bg-ink/5 hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </nav>

      {/* Manager : tabs internes masqués, kind forcé par le tab parent */}
      <FollowUpSequencesManager hideTabs forceKind={forceKind} />
    </div>
  )
}
