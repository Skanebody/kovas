/**
 * Helpers d'affichage des badges niveau — séparation
 * de la donnée pure (levels.ts) et du rendu (badges.ts).
 */

import type { Level, LevelId } from './levels'
import { LEVELS } from './levels'

/**
 * Classes Tailwind du ring/fill du badge selon le niveau.
 * Respect strict du design system V5 :
 *  - niveaux 1-3 : navy progressif
 *  - niveaux 4-5 : chartreuse
 *  - niveaux 6-7 : chartreuse-deep + ombre subtile
 */
export function ringClassesFor(level: Level): string {
  switch (level.iconColor) {
    case 'ink-mute':
      return 'ring-1 ring-ink-mute/30 bg-paper'
    case 'ink-soft':
      return 'ring-1 ring-ink-soft/40 bg-paper'
    case 'navy':
      return 'ring-2 ring-navy/40 bg-paper'
    case 'chartreuse':
      return 'ring-2 ring-chartreuse-deep/50 bg-paper'
    case 'chartreuse-deep':
      return 'ring-2 ring-chartreuse-deep bg-paper shadow-glass-sm'
  }
}

/**
 * Classes du texte du badge.
 */
export function textClassesFor(level: Level): string {
  if (level.iconColor === 'chartreuse-deep' || level.iconColor === 'chartreuse') {
    return 'text-ink'
  }
  return 'text-ink-soft'
}

/**
 * Retourne le niveau en pourcentage 0..100 (progress bar).
 */
export function progressionPercent(currentLevelId: LevelId): number {
  return Math.round(((currentLevelId - 1) / 6) * 100)
}

export function allLevels(): readonly Level[] {
  return LEVELS
}
