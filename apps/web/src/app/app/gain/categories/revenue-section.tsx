import { Euro } from 'lucide-react'
import { CategoryMiniCard, CategorySection } from './category-section'

export interface RevenueData {
  /** CA HT période en euros (entier arrondi). */
  caHt: number
  /** Delta CA vs période précédente (% entier). null = pas de baseline. */
  deltaCaPct: number | null
  /** Panier moyen en euros (CA / nb missions facturées). */
  avgInvoiceEur: number
  /** Taux conversion devis → facture (0-100, entier). null = aucun devis. */
  conversionRatePct: number | null
}

function deltaTrend(pct: number | null): { value: string; direction: 'up' | 'down' | 'neutral' } {
  if (pct === null) return { value: 'pas de baseline', direction: 'neutral' }
  if (pct === 0) return { value: 'stable', direction: 'neutral' }
  return {
    value: `${pct > 0 ? '+' : ''}${pct}%`,
    direction: pct > 0 ? 'up' : 'down',
  }
}

/**
 * Section Revenus — accent bleu Apple Mindfulness #007AFF.
 *
 * 3 cards mini :
 *  - CA HT (delta vs précédent)
 *  - Panier moyen (€/facture)
 *  - Taux conversion devis → facture (%)
 */
export function RevenueSection({ data }: { data: RevenueData }) {
  return (
    <CategorySection
      category="revenue"
      icon={Euro}
      title="Revenus"
      seeAllHref="/app/factures"
    >
      <CategoryMiniCard
        category="revenue"
        label="CA HT"
        value={data.caHt.toLocaleString('fr-FR')}
        unit="€"
        trend={deltaTrend(data.deltaCaPct)}
        hint="vs période précédente"
      />
      <CategoryMiniCard
        category="revenue"
        label="Panier moyen"
        value={data.avgInvoiceEur > 0 ? data.avgInvoiceEur.toLocaleString('fr-FR') : '—'}
        unit="€"
        hint="par facture émise"
      />
      <CategoryMiniCard
        category="revenue"
        label="Conversion devis"
        value={
          data.conversionRatePct === null ? '—' : `${data.conversionRatePct}`
        }
        unit={data.conversionRatePct === null ? undefined : '%'}
        hint="devis → facture"
      />
    </CategorySection>
  )
}
