/**
 * KOVAS — Calculateur DPE (Lot #143)
 *
 * Mapping score 0-100 → classe énergétique A-G (échelle inversée :
 * 100 = A bonne perf, 0 = G mauvaise perf).
 *
 * L'algorithme `estimation-engine.ts` calcule le score puis appelle
 * `scoreToClass()`. Les seuils sont indicatifs et calés sur des
 * percentiles arrondis — il ne s'agit PAS d'un calcul 3CL-2021
 * (Phase 2 ADEME).
 */

import type { DpeClass } from './question-tree'

export const DPE_CLASSES: ReadonlyArray<DpeClass> = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

interface ClassThreshold {
  cls: DpeClass
  min: number
  max: number
}

/**
 * Seuils de mapping. Bornes inclusives min, exclusives max sauf G qui inclut 0.
 *
 * 90-100 → A
 * 75-89  → B
 * 60-74  → C
 * 45-59  → D
 * 30-44  → E
 * 15-29  → F
 *  0-14  → G
 */
const THRESHOLDS: ReadonlyArray<ClassThreshold> = [
  { cls: 'A', min: 90, max: 101 },
  { cls: 'B', min: 75, max: 90 },
  { cls: 'C', min: 60, max: 75 },
  { cls: 'D', min: 45, max: 60 },
  { cls: 'E', min: 30, max: 45 },
  { cls: 'F', min: 15, max: 30 },
  { cls: 'G', min: 0, max: 15 },
]

/**
 * Convertit un score numérique (0-100, clampé) en classe DPE.
 */
export function scoreToClass(rawScore: number): DpeClass {
  const score = Math.max(0, Math.min(100, Math.round(rawScore)))
  for (const t of THRESHOLDS) {
    if (score >= t.min && score < t.max) return t.cls
  }
  // Fallback (ne devrait pas arriver après clamp)
  return score >= 90 ? 'A' : 'G'
}

/**
 * Inverse — utilisé quand l'utilisateur déclare déjà un DPE existant :
 * on le ramène à un score baseline avant ajustements.
 */
export function classToScore(cls: DpeClass): number {
  // Centre de chaque tranche pour éviter les bords
  const center: Record<DpeClass, number> = {
    A: 95,
    B: 82,
    C: 67,
    D: 52,
    E: 37,
    F: 22,
    G: 7,
  }
  return center[cls]
}

/**
 * Mapping classe → famille de couleur sémantique pour la UI.
 * A, B, C → green | D, E → orange | F, G → red
 *
 * Aligné sur les tokens v5 `--accent-green` / `--accent-orange` (warning)
 * / `--accent-red`. On utilise orange (warning saturé) pour D-E plutôt
 * que jaune pâle qui ne s'imprime pas bien sur le sage `#F5F7F4`.
 */
export type DpeClassColor = 'green' | 'orange' | 'red'

export function classToColor(cls: DpeClass): DpeClassColor {
  if (cls === 'A' || cls === 'B' || cls === 'C') return 'green'
  if (cls === 'D' || cls === 'E') return 'orange'
  return 'red'
}

/**
 * Tailwind classes prêtes à coller — text + bg + border par couleur.
 * Centralisé ici pour rester cohérent entre result-card et email récap.
 */
export const DPE_CLASS_STYLES: Record<
  DpeClassColor,
  { text: string; bg: string; bgSoft: string; border: string }
> = {
  green: {
    text: 'text-accent-green',
    bg: 'bg-accent-green',
    bgSoft: 'bg-accent-green-soft',
    border: 'border-accent-green/30',
  },
  orange: {
    text: 'text-accent-orange',
    bg: 'bg-accent-orange',
    bgSoft: 'bg-accent-orange-soft',
    border: 'border-accent-orange/30',
  },
  red: {
    text: 'text-accent-red',
    bg: 'bg-accent-red',
    bgSoft: 'bg-accent-red-soft',
    border: 'border-accent-red/30',
  },
}
