import { Award } from 'lucide-react'
import { CategoryMiniCard, CategorySection } from './category-section'

export interface QualityData {
  /** Note moyenne clients (0-5, une décimale). null = pas encore de note. */
  avgRating: number | null
  /** Taux validation au 1er coup (% entier). null = pas de mesure. */
  firstPassRatePct: number | null
  /** Nombre de litiges/contestations sur la période (count). */
  litigationCount: number
}

/**
 * Section Qualité — accent orange Apple Workout #FF9500.
 *
 * 3 cards mini :
 *  - Note moyenne clients /5
 *  - Validation 1er coup %
 *  - Litiges (count)
 *
 * NB : ces 3 KPIs nécessitent un module Qualité V1.5 (avis clients,
 * tracking re-saisies, table litigation_workflows). En V1, valeurs `—`
 * acceptables — la card reste affichée pour la cohérence visuelle.
 */
export function QualitySection({ data }: { data: QualityData }) {
  return (
    <CategorySection
      category="quality"
      icon={Award}
      title="Qualité"
    >
      <CategoryMiniCard
        category="quality"
        label="Note moyenne"
        value={data.avgRating === null ? '—' : data.avgRating.toFixed(1)}
        unit={data.avgRating === null ? undefined : '/ 5'}
        hint="avis clients"
      />
      <CategoryMiniCard
        category="quality"
        label="Validation 1er coup"
        value={data.firstPassRatePct === null ? '—' : String(data.firstPassRatePct)}
        unit={data.firstPassRatePct === null ? undefined : '%'}
        hint="sans correction"
      />
      <CategoryMiniCard
        category="quality"
        label="Litiges"
        value={String(data.litigationCount)}
        unit={data.litigationCount > 1 ? 'cas ouverts' : 'cas ouvert'}
        hint={data.litigationCount === 0 ? 'aucune contestation' : 'en cours de traitement'}
      />
    </CategorySection>
  )
}
