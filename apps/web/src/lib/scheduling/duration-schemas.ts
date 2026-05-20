/**
 * KOVAS — Constantes durée mission (Phase A scheduling).
 *
 * Authority : briefing scheduling 2026-05-20 (durées calibrées sur entretiens
 * diagnostiqueurs FR + recherche métier — moyennes médianes 2024-2025).
 *
 * Toutes les durées sont en minutes. Les coefficients sont sans unité.
 */

import type { DiagnosticType } from '@/lib/mission/types'

/**
 * Durée terrain de base par diagnostic (1 logement type T3, 70m², copro standard).
 * À ces valeurs s'ajoutent : coef surface, coef property type, coef copropriété, coef perso.
 */
export const DURATION_BASE: Record<DiagnosticType, number> = {
  DPE: 45,
  AMIANTE: 30,
  PLOMB: 75,
  GAZ: 25,
  ELEC: 40,
  TERMITES: 30,
  CARREZ: 25,
  ERP: 10,
}

/**
 * Coefficient surface non linéaire — surface < 40m² = travail compressé,
 * > 200m² = sur-coût croissant.
 *
 * @param surface m² Carrez/Boutin (ou habitable si non spécifié)
 */
export function getSurfaceCoefficient(surface: number): number {
  if (surface < 40) return 0.7
  if (surface < 60) return 0.85
  if (surface < 80) return 1.0
  if (surface < 120) return 1.2
  if (surface < 160) return 1.4
  if (surface < 200) return 1.6
  return 1.8 + Math.floor((surface - 200) / 50) * 0.1
}

/**
 * Coefficient type de propriété — un escalier coûte ~10% par niveau supplémentaire.
 */
export const PROPERTY_TYPE_COEFFICIENTS = {
  studio: 0.8,
  appartement: 1.0,
  maison_1_niveau: 1.1,
  maison_2_niveaux: 1.2,
  maison_3_plus: 1.4,
  local: 1.0,
} as const

export type SchedulingPropertyType = keyof typeof PROPERTY_TYPE_COEFFICIENTS

/**
 * Coefficient régime de propriété (copropriété = parties communes + RGE + carnet d'entretien).
 * Ne s'applique qu'aux diagnostics concernés par la copro (cf. COPRO_AFFECTED).
 */
export const COPRO_COEFFICIENTS = {
  individuel: 1.0,
  monopropriete: 1.08,
  copropriete: 1.15,
} as const

export type SchedulingOwnership = keyof typeof COPRO_COEFFICIENTS

/**
 * Diagnostics affectés par la copropriété (parties communes, RGE).
 * Carrez/Boutin/Termites/Gaz/Elec = intérieur logement → pas d'impact copro significatif.
 */
export const COPRO_AFFECTED: ReadonlyArray<DiagnosticType> = ['DPE', 'AMIANTE', 'ERP']

/**
 * Mutualisation : quand plusieurs diagnostics sont réalisés dans la même visite,
 * le 2e et 3e+ coûtent moins (préparation déjà faite, mesures partagées).
 */
export const MUTUALIZATION_COEFFICIENTS = {
  first: 1.0,
  second: 0.85,
  thirdAndMore: 0.8,
} as const

/**
 * Bonus durée pour dépendances présentes (garage, sous-sol, combles aménagées).
 * Ajoutés au total final (pas multipliés).
 */
export const DEPENDENCY_BONUS = {
  garage: 5,
  sous_sol: 10,
  combles_amenagees: 15,
} as const

/**
 * Buffer de transition par défaut entre missions (rangement matériel, briefing, etc.).
 * Surchargé par `user_preferences.scheduling_buffer_minutes`.
 */
export const DEFAULT_BUFFER_MINUTES = 25
