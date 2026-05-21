import { Clock, Zap, Calendar } from 'lucide-react'
import { CategoryMiniCard, CategorySection } from './category-section'

export interface ProductivityData {
  /** Temps économisé total période (en minutes). */
  minutesSaved: number
  /** Delta temps économisé vs période précédente (% entier). null = pas de baseline. */
  deltaMinutesSavedPct: number | null
  /** Vitesse moyenne (minutes par mission). */
  avgMinutesPerMission: number
  /** Streak — nombre de jours actifs consécutifs avec au moins 1 mission. */
  activeStreakDays: number
}

function formatHoursCompact(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h'
  const totalHours = Math.round(totalMinutes / 60)
  if (totalHours < 100) {
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    return minutes > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${hours}h`
  }
  return `${totalHours.toLocaleString('fr-FR')}h`
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
 * Section Productivité — accent vert Apple Activity #34C759.
 *
 * 3 cards mini :
 *  - Temps économisé (formatHoursCompact + delta vs mois précédent)
 *  - Vitesse moyenne (minutes par mission)
 *  - Streak (jours actifs consécutifs)
 */
export function ProductivitySection({ data }: { data: ProductivityData }) {
  return (
    <CategorySection
      category="productivity"
      icon={Clock}
      title="Productivité"
    >
      <CategoryMiniCard
        category="productivity"
        label="Temps économisé"
        value={formatHoursCompact(data.minutesSaved)}
        trend={deltaTrend(data.deltaMinutesSavedPct)}
        hint="vs période précédente"
      />
      <CategoryMiniCard
        category="productivity"
        label="Vitesse moyenne"
        value={data.avgMinutesPerMission > 0 ? String(data.avgMinutesPerMission) : '—'}
        unit="min/mission"
        hint="durée moyenne mesurée"
      />
      <CategoryMiniCard
        category="productivity"
        label="Régularité"
        value={data.activeStreakDays > 0 ? String(data.activeStreakDays) : '—'}
        unit={data.activeStreakDays > 1 ? 'jours actifs' : 'jour actif'}
        hint="consécutifs avec mission"
      />
    </CategorySection>
  )
}

// re-exports pour usage hors fichier
export { Zap, Calendar }
