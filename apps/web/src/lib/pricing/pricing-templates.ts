/**
 * KOVAS — Templates tarifaires pré-remplis (Partition B).
 *
 * Source : étude marché FR 2025-2026 — 3 niveaux (économique / médian / premium).
 * Le template médian est recommandé par défaut.
 *
 * Modulations : multiplicateurs appliqués au prix de base selon le type de bien.
 *   - studio          (< 30 m²)
 *   - appartement     (30-80 m²)            — pivot 1.0x
 *   - grandAppartement (80-130 m²)
 *   - maison          (jusqu'à ~150 m²)
 *   - grandeMaison    (> 150 m²)
 *
 * Note : `BOUTIN` est traité comme un diagnostic distinct mais aux mêmes prix
 * que `CARREZ` (cf. CLAUDE.md §3 — "Carrez/Boutin" est un cas réglementaire
 * unifié dans la pratique commerciale).
 */

import type { DiagnosticType } from '@/lib/mission/types'

/**
 * Type étendu pour la grille tarifaire — inclut BOUTIN en plus des 8 diagnostics
 * du `DiagnosticType` de base. Utilisé UNIQUEMENT côté pricing.
 */
export type PricingDiagnosticType = DiagnosticType | 'BOUTIN'

export interface DiagnosticModulations {
  studio: number
  appartement: number
  grandAppartement: number
  maison: number
  grandeMaison: number
}

export interface DiagnosticPricing {
  basePrice: number
  modulations: DiagnosticModulations
}

export interface TravelFeesConfig {
  /** Rayon inclus dans le tarif de base (km). Au-delà : facturation. */
  includedRadiusKm: number
  /** Tarif au km au-delà du rayon inclus (EUR HT). */
  pricePerKmBeyond: number
  /** Plafond global des frais de déplacement (EUR HT). */
  capAmount: number
}

export interface MajorationsConfig {
  /** Majoration pour intervention urgente (< 48h). */
  urgency48h: number
  /** Majoration pour intervention le weekend. */
  weekend: number
  /** Majoration pour intervention en soirée (après 18h). */
  evening: number
}

export interface PricingTemplate {
  id: 'economique' | 'median' | 'premium'
  label: string
  description: string
  diagnostics: Record<PricingDiagnosticType, DiagnosticPricing>
  travelFees: TravelFeesConfig
  majorations: MajorationsConfig
}

// ============================================
// Template économique — positionnement bas du marché
// ============================================
export const TEMPLATE_ECONOMIQUE: PricingTemplate = {
  id: 'economique',
  label: 'Économique',
  description: 'Positionnement compétitif, volume élevé, marges plus serrées.',
  diagnostics: {
    DPE: {
      basePrice: 90,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.15,
        maison: 1.2,
        grandeMaison: 1.4,
      },
    },
    AMIANTE: {
      basePrice: 80,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    PLOMB: {
      basePrice: 100,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.3,
        grandeMaison: 1.5,
      },
    },
    GAZ: {
      basePrice: 90,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.1,
        maison: 1.15,
        grandeMaison: 1.3,
      },
    },
    ELEC: {
      basePrice: 90,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.1,
        maison: 1.15,
        grandeMaison: 1.3,
      },
    },
    TERMITES: {
      basePrice: 80,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.15,
        maison: 1.2,
        grandeMaison: 1.4,
      },
    },
    CARREZ: {
      basePrice: 70,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    BOUTIN: {
      basePrice: 70,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    ERP: {
      basePrice: 25,
      modulations: {
        studio: 1.0,
        appartement: 1.0,
        grandAppartement: 1.0,
        maison: 1.0,
        grandeMaison: 1.0,
      },
    },
  },
  travelFees: {
    includedRadiusKm: 15,
    pricePerKmBeyond: 0.4,
    capAmount: 40,
  },
  majorations: {
    urgency48h: 20,
    weekend: 30,
    evening: 15,
  },
}

// ============================================
// Template médian (RECOMMANDÉ) — moyenne marché FR
// ============================================
export const TEMPLATE_MEDIAN: PricingTemplate = {
  id: 'median',
  label: 'Médian (recommandé)',
  description: 'Positionnement standard du marché FR, équilibre volume / marge.',
  diagnostics: {
    DPE: {
      basePrice: 130,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.15,
        maison: 1.2,
        grandeMaison: 1.4,
      },
    },
    AMIANTE: {
      basePrice: 110,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    PLOMB: {
      basePrice: 130,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.3,
        grandeMaison: 1.5,
      },
    },
    GAZ: {
      basePrice: 120,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.1,
        maison: 1.15,
        grandeMaison: 1.3,
      },
    },
    ELEC: {
      basePrice: 120,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.1,
        maison: 1.15,
        grandeMaison: 1.3,
      },
    },
    TERMITES: {
      basePrice: 110,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.15,
        maison: 1.2,
        grandeMaison: 1.4,
      },
    },
    CARREZ: {
      basePrice: 90,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    BOUTIN: {
      basePrice: 90,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    ERP: {
      basePrice: 30,
      modulations: {
        studio: 1.0,
        appartement: 1.0,
        grandAppartement: 1.0,
        maison: 1.0,
        grandeMaison: 1.0,
      },
    },
  },
  travelFees: {
    includedRadiusKm: 20,
    pricePerKmBeyond: 0.5,
    capAmount: 50,
  },
  majorations: {
    urgency48h: 30,
    weekend: 50,
    evening: 25,
  },
}

// ============================================
// Template premium — positionnement haut de gamme
// ============================================
export const TEMPLATE_PREMIUM: PricingTemplate = {
  id: 'premium',
  label: 'Premium',
  description: 'Positionnement haut de gamme, expertise reconnue, marges élevées.',
  diagnostics: {
    DPE: {
      basePrice: 170,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.15,
        maison: 1.2,
        grandeMaison: 1.4,
      },
    },
    AMIANTE: {
      basePrice: 150,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    PLOMB: {
      basePrice: 170,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.3,
        grandeMaison: 1.5,
      },
    },
    GAZ: {
      basePrice: 150,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.1,
        maison: 1.15,
        grandeMaison: 1.3,
      },
    },
    ELEC: {
      basePrice: 150,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.1,
        maison: 1.15,
        grandeMaison: 1.3,
      },
    },
    TERMITES: {
      basePrice: 140,
      modulations: {
        studio: 0.9,
        appartement: 1.0,
        grandAppartement: 1.15,
        maison: 1.2,
        grandeMaison: 1.4,
      },
    },
    CARREZ: {
      basePrice: 110,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    BOUTIN: {
      basePrice: 110,
      modulations: {
        studio: 0.85,
        appartement: 1.0,
        grandAppartement: 1.2,
        maison: 1.25,
        grandeMaison: 1.45,
      },
    },
    ERP: {
      basePrice: 40,
      modulations: {
        studio: 1.0,
        appartement: 1.0,
        grandAppartement: 1.0,
        maison: 1.0,
        grandeMaison: 1.0,
      },
    },
  },
  travelFees: {
    includedRadiusKm: 25,
    pricePerKmBeyond: 0.7,
    capAmount: 70,
  },
  majorations: {
    urgency48h: 50,
    weekend: 80,
    evening: 40,
  },
}

export const ALL_TEMPLATES: PricingTemplate[] = [
  TEMPLATE_ECONOMIQUE,
  TEMPLATE_MEDIAN,
  TEMPLATE_PREMIUM,
]

/**
 * Récupère un template par son id. Retourne null si non trouvé.
 */
export function getTemplate(id: string): PricingTemplate | null {
  return ALL_TEMPLATES.find((t) => t.id === id) ?? null
}

/**
 * Type de bien utilisé pour résoudre une modulation.
 * Si `surface` est faible (< 30) → on dégrade vers `studio`.
 * Si `surface` est grande (> 80) → on monte vers `grandAppartement` / `grandeMaison`.
 */
export type PropertyType = 'studio' | 'appartement' | 'maison' | 'local'

/**
 * Helper : résout la modulation à appliquer pour un bien donné.
 * - propertyType=studio    → studio
 * - propertyType=appartement + surface < 30 → studio
 * - propertyType=appartement + surface 30-80 → appartement
 * - propertyType=appartement + surface > 80 → grandAppartement
 * - propertyType=maison + surface <= 150 → maison
 * - propertyType=maison + surface > 150 → grandeMaison
 * - propertyType=local → appartement (fallback raisonnable)
 */
export function getModulationForProperty(
  modulations: DiagnosticModulations,
  propertyType: PropertyType,
  surface: number,
): number {
  if (propertyType === 'studio') {
    return modulations.studio
  }
  if (propertyType === 'maison') {
    return surface > 150 ? modulations.grandeMaison : modulations.maison
  }
  if (propertyType === 'appartement') {
    if (surface < 30) return modulations.studio
    if (surface > 80) return modulations.grandAppartement
    return modulations.appartement
  }
  // local → appartement par défaut
  return modulations.appartement
}
